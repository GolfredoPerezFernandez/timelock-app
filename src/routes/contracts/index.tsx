import { component$, useSignal, $, useTask$ } from '@builder.io/qwik';
import { routeLoader$, routeAction$, Form, zod$ } from '@builder.io/qwik-city';
import { tursoClient } from '~/utils/turso';
import { getSession } from '~/utils/auth';
import { isAdmin } from '~/utils/isAdmin';
import { 
  LuBriefcase, 
  LuSearch,
  LuPlus,
  LuFilter,
  LuEye,
  LuFileText,
  LuDownload,
  LuFileUp,
  LuFileCheck2,
  LuTrash2,
  LuSave,
  LuX,
  LuLoader2,
  LuAlertTriangle,
  LuExternalLink
} from '@qwikest/icons/lucide';
import { z } from 'zod';

// Type definitions
interface Contract {
  id: number;
  professional_id: number;
  professional_name: string;
  start_date: string;
  end_date: string;
  status: string;
  contract_url: string | null;
}

interface Professional {
  id: number;
  name: string;
  role: string;
}

export const useContractsLoader = routeLoader$(async (requestEvent) => {
  const session = await getSession(requestEvent);
  if (!session.isAuthenticated) {
    return requestEvent.fail(401, { error: 'Unauthorized' });
  }
  const client = tursoClient(requestEvent);
  let sql = `SELECT c.id, c.professional_id, p.name as professional_name, c.start_date, c.end_date, c.status, c.contract_url 
    FROM contracts c
    JOIN professionals p ON c.professional_id = p.id`;
  let args: any[] = [];
  if (!isAdmin(session)) {
    // Buscar el professional_id asociado al usuario normal
    const profRes = await client.execute({
      sql: 'SELECT id FROM professionals WHERE user_id = ?',
      args: [session.userId]
    });
    if (!profRes.rows.length) {
      return requestEvent.fail(403, { error: 'No professional profile found for this user.' });
    }
    const professionalId = String(profRes.rows[0].id);
    sql += ' WHERE c.professional_id = ?';
    args.push(professionalId);
    // Guardar el professionalId en la sesión para usarlo en la creación de contratos
    (session as any).professionalId = professionalId;
  }
  const result = await client.execute({ sql, args });
  // Ensure all fields are defined and of correct type
  const contracts = (result.rows as any[]).map((row) => ({
    id: typeof row.id === 'number' ? row.id : 0,
    professional_id: typeof row.professional_id === 'number' ? row.professional_id : 0,
    professional_name: typeof row.professional_name === 'string' ? row.professional_name : 'N/A',
    start_date: typeof row.start_date === 'string' ? row.start_date : '',
    end_date: typeof row.end_date === 'string' ? row.end_date : '',
    status: typeof row.status === 'string' ? row.status : 'unknown',
    contract_url: typeof row.contract_url === 'string' ? row.contract_url : null,
  }));
  return contracts as Contract[];
});

export const useProfessionalsLoader = routeLoader$(async (requestEvent) => {
  const client = tursoClient(requestEvent);
  const result = await client.execute('SELECT id, name, role FROM professionals');
  return result.rows as unknown as Professional[];
});

export const useCreateContract = routeAction$(async (data, requestEvent) => {
  const client = tursoClient(requestEvent);
  const session = await getSession(requestEvent);

  if (!session.isAuthenticated || !session.userId) {
    return requestEvent.redirect(303, '/auth');
  }

  let professionalId = data.professionalId;
  if (!isAdmin(session)) {
    // Buscar el professional_id asociado al usuario normal
    const profRes = await client.execute({
      sql: 'SELECT id FROM professionals WHERE user_id = ?',
      args: [session.userId]
    });
    if (!profRes.rows.length) {
      return requestEvent.fail(403, { error: 'No professional profile found for this user.' });
    }
    professionalId = String(profRes.rows[0].id);
  }

  try {
    await client.execute({
      sql: 'INSERT INTO contracts (professional_id, user_id, start_date, end_date, status, contract_url) VALUES (?, ?, ?, ?, ?, ?)',
      args: [professionalId || '', session.userId, data.startDate, data.endDate, 'active', data.contractUrl ?? null]
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to create contract:', error);
    return { success: false, error: 'Failed to create contract.' };
  }
}, zod$((z) =>
  z.object({
    professionalId: z.string().optional(),
    startDate: z.string().min(1, 'Start date is required.'),
    endDate: z.string().min(1, 'End date is required.'),
    contractUrl: z.string().optional().nullable(),
  })
));

export default component$(() => {
  const contracts = useContractsLoader();
  const professionals = useProfessionalsLoader();
  const createContractAction = useCreateContract();

  // Determine if user is admin and if user has a professional profile
  const contractsData = Array.isArray(contracts.value) ? contracts.value : [];
  const session = typeof window !== 'undefined' ? null : (contracts as any)?.session;
  const isAdminUser = contractsData.length > 0 && isAdmin && isAdmin(contractsData[0] as any);
  // For non-admins, check if they have a professional profile
  let userProfessionalId: string | null = null;
  if (!isAdminUser && contractsData.length > 0) {
    userProfessionalId = String(contractsData[0].professional_id);
  }

  // Debug logs
  if (typeof window !== 'undefined') {
    // Only log in browser
    // eslint-disable-next-line no-console
    console.log('[DEBUG contracts] isAdminUser:', isAdminUser);
    // eslint-disable-next-line no-console
    console.log('[DEBUG contracts] userProfessionalId:', userProfessionalId);
    // eslint-disable-next-line no-console
    console.log('[DEBUG contracts] contracts.value:', contracts.value);
    // eslint-disable-next-line no-console
    console.log('[DEBUG contracts] professionals.value:', professionals.value);
  }

  const searchQuery = useSignal('');
  const showNewContractModal = useSignal(false);
  
  const professionalId = useSignal('');
  const startDate = useSignal('');
  const endDate = useSignal('');
  const contractUrl = useSignal<string | null>(null);
  const contractPreviewUrl = useSignal('');
  const isUploading = useSignal(false);
  const uploadError = useSignal('');
  const fileInputRef = useSignal<HTMLInputElement>();

  const filteredContracts = useSignal<Contract[]>([]);

  useTask$(({ track }) => {
    const contractsList = track(() => Array.isArray(contracts.value) ? contracts.value : []);
    const query = track(() => searchQuery.value);
    if (!query) {
      filteredContracts.value = contractsList;
    } else {
      const q = query.toLowerCase();
      filteredContracts.value = contractsList.filter(
        contract =>
          contract.professional_name.toLowerCase().includes(q) ||
          contract.id.toString().includes(q)
      );
    }
  });

  const resetModalState = $(() => {
    professionalId.value = '';
    startDate.value = '';
    endDate.value = '';
    contractUrl.value = null;
    contractPreviewUrl.value = '';
    isUploading.value = false;
    uploadError.value = '';
    if (fileInputRef.value) {
      fileInputRef.value.value = '';
    }
  });

  const handleFileUpload = $(async (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }
    const file = input.files[0];
    if (file.type !== 'application/pdf') {
        uploadError.value = 'Only PDF files are allowed.';
        return;
    }

    isUploading.value = true;
    uploadError.value = '';
    
    const formData = new FormData();
    formData.append('contract', file);

    try {
      const response = await fetch('/api/upload-contract', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMsg = 'Upload failed';
        try {
          const errorData = await response.json();
          if (errorData && typeof errorData.error === 'string' && errorData.error.length > 0) {
            errorMsg = errorData.error;
          }
        } catch {}
        throw new Error(errorMsg);
      }

      const result = await response.json();
      contractUrl.value = result.fileName || '';
      contractPreviewUrl.value = result.fileName ? `/api/contracts/view/${result.fileName}` : '';

    } catch (error: any) {
      uploadError.value = (error && typeof error.message === 'string' && error.message.length > 0) ? error.message : 'An unexpected error occurred.';
      contractUrl.value = null;
      contractPreviewUrl.value = '';
    } finally {
      isUploading.value = false;
    }
  });
  

  // Removed updateFilteredList, filtering is now handled reactively in useTask$
  
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    // Adjust for timezone offset to display the correct date
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const correctedDate = new Date(date.getTime() + userTimezoneOffset);
    return correctedDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <main class="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <header class="mb-8 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700 rounded-xl shadow-sm p-6">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-center">
              <LuBriefcase class="h-8 w-8 text-teal-600 dark:text-teal-500 mr-3" />
              <div>
                <h1 class="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">
                  Contracts
                </h1>
                <p class="text-slate-500 dark:text-slate-400 mt-1">
                  Manage contracts with professionals
                </p>
              </div>
            </div>
            
            <div class="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-3">
              {/* Only show Create Contract button if admin, or if user has a professional profile */}
              {(isAdminUser || userProfessionalId) && (
                <button
                  onClick$={() => {
                    // Only allow modal if admin or user has professional profile
                    if (isAdminUser || userProfessionalId) showNewContractModal.value = true;
                  }}
                  class="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all duration-200"
                >
                  <LuPlus class="mr-2 h-4 w-4" />
                  Create Contract
                </button>
              )}
              <button class="inline-flex items-center justify-center px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all duration-200">
                <LuDownload class="mr-2 h-4 w-4" />
                Export
              </button>
            </div>
          </div>
        </header>
        
        {/* Search and Filter Bar */}
        <div class="mb-6">
          <div class="flex flex-col sm:flex-row gap-4 bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4 border border-slate-100 dark:border-slate-700">
            <div class="relative flex-1">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <LuSearch class="h-5 w-5 text-slate-400 dark:text-slate-500" />
              </div>
              <input
                type="text"
                bind:value={searchQuery}
                class="block w-full pl-10 pr-3 py-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder-slate-400 shadow-sm hover:border-teal-400 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm transition-all duration-200"
                placeholder="Search by professional or ID..."
              />
            </div>
            <div class="flex-shrink-0">
              <button class="inline-flex items-center px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all duration-200">
                <LuFilter class="mr-2 h-4 w-4" />
                Filter
              </button>
            </div>
          </div>
        </div>
        
        {/* Contracts Table */}
        <div class="bg-white dark:bg-slate-800 shadow-lg rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead class="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700">
                <tr>
                  <th scope="col" class="px-6 py-4 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    ID
                  </th>
                  <th scope="col" class="px-6 py-4 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Professional
                  </th>
                  <th scope="col" class="px-6 py-4 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Start Date
                  </th>
                  <th scope="col" class="px-6 py-4 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    End Date
                  </th>
                  <th scope="col" class="px-6 py-4 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" class="px-6 py-4 text-right text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                {Array.isArray(filteredContracts.value) ? (
                  filteredContracts.value.map((contract: Contract) => {
                    // Ensure contract_url is never undefined
                    const contractUrl = typeof contract.contract_url === 'string' ? contract.contract_url : null;
                    return (
                      <tr key={contract.id} class="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all duration-200 group">
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:text-teal-600 dark:group-hover:text-teal-500">
                          #CONT-{contract.id.toString().padStart(3, '0')}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-200 font-medium">
                          {contract.professional_name || 'N/A'}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                          {formatDate(contract.start_date)}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                          {formatDate(contract.end_date)}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          <span class={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            contract.status === 'active' 
                              ? 'bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 dark:from-emerald-900/30 dark:to-emerald-800/30 dark:text-emerald-400' 
                              : 'bg-gradient-to-r from-rose-50 to-rose-100 text-rose-700 dark:from-rose-900/30 dark:to-rose-800/30 dark:text-rose-400'
                          }`}>
                            {contract.status?.charAt(0).toUpperCase() + contract.status?.slice(1) || 'N/A'}
                          </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div class="flex justify-end space-x-2">
                            {contractUrl ? (
                              <a href={`/api/contracts/view/${contractUrl}`} target="_blank" rel="noopener noreferrer" class="p-1.5 text-slate-600 dark:text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:text-teal-400 dark:hover:bg-teal-900/20 rounded-full transition-all" title="View Contract">
                                <LuEye class="h-5 w-5" />
                              </a>
                            ) : (
                              <button class="p-1.5 text-slate-400 dark:text-slate-600 rounded-full transition-all cursor-not-allowed" disabled title="No contract uploaded">
                                <LuEye class="h-5 w-5" />
                              </button>
                            )}
                            <button class="p-1.5 text-slate-600 dark:text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/20 rounded-full transition-all">
                              <LuFileText class="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} class="text-center text-red-500 py-8">
                      Error loading contracts. Please try again.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredContracts.value.length === 0 && (
            <div class="px-6 py-12 text-center">
              <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700/50 mb-4">
                <LuBriefcase class="w-8 h-8 text-slate-400 dark:text-slate-500" />
              </div>
              <p class="text-slate-500 dark:text-slate-400 font-medium">No contracts found.</p>
              <p class="text-slate-400 dark:text-slate-500 mt-1 text-sm">Create a new contract to get started.</p>
            </div>
          )}
        </div>
        
        {/* Pagination - Optional */}
        <div class="flex items-center justify-between mt-6 bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700">
          <div class="text-sm text-slate-600 dark:text-slate-400">
            Showing <span class="font-medium text-teal-600 dark:text-teal-500">{filteredContracts.value.length}</span> of <span class="font-medium text-teal-600 dark:text-teal-500">{contracts.value.length}</span> contracts
          </div>
        </div>
      </div>

      {/* New Contract Modal */}
      {showNewContractModal.value && (
        <div class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div class="flex items-end sm:items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Overlay */}
            <div 
              class="fixed inset-0 bg-slate-700/70 dark:bg-slate-900/80 backdrop-blur-md transition-opacity" 
              aria-hidden="true"
              onClick$={() => showNewContractModal.value = false}
            ></div>

            {/* Modal */}
            <div class="inline-block align-bottom bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-xl text-left overflow-hidden shadow-2xl transform transition-all border border-slate-100/50 dark:border-slate-700/50 sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <Form 
                action={createContractAction}
                onSubmitCompleted$={() => {
                  showNewContractModal.value = false;
                  resetModalState();
                }}
              >
                <div class="px-6 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div class="sm:flex sm:items-start">
                    <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 class="text-xl leading-6 font-medium text-slate-800 dark:text-slate-100" id="modal-title">
                        Create New Contract
                      </h3>
                      <div class="mt-4">
                        <div class="space-y-4">
                          {/* Professional Select (only for admin) or hidden for normal users */}
                          {isAdminUser ? (
                            <div>
                              <label for="professional" class="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Professional
                              </label>
                              <select
                                name="professionalId"
                                id="professional"
                                bind:value={professionalId}
                                class="mt-1 block w-full pl-3 pr-10 py-3 text-base border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm transition-all"
                                required
                              >
                                <option value="">Select a professional</option>
                                {professionals.value.map((prof: Professional) => (
                                  <option key={`prof-${prof.id}`} value={prof.id}>
                                    {`${prof.name} - ${prof.role}`}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <input type="hidden" name="professionalId" value={userProfessionalId ?? ''} />
                          )}
                          
                          {/* Date Fields */}
                          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                              <label for="start-date" class="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Start Date
                              </label>
                              <input
                                type="date"
                                name="startDate"
                                id="start-date"
                                bind:value={startDate}
                                class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm transition-all"
                                required
                              />
                            </div>
                            <div>
                              <label for="end-date" class="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                End Date
                              </label>
                              <input
                                type="date"
                                name="endDate"
                                id="end-date"
                                bind:value={endDate}
                                class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm transition-all"
                                required
                              />
                            </div>
                          </div>

                          {/* Contract Upload */}
                          <div>
                            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                              Contract PDF
                            </label>
                            {contractPreviewUrl.value ? (
                              <div class="mt-2">
                                <div class="relative h-64 w-full rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden group">
                                  <iframe src={contractPreviewUrl.value} class="h-full w-full" title="Contract Preview"></iframe>
                                  <a 
                                    href={contractPreviewUrl.value} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    class="absolute top-2 right-2 p-2 bg-slate-700/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Open in new tab"
                                  >
                                    <LuExternalLink class="h-5 w-5" />
                                  </a>
                                </div>
                                <button 
                                  type="button"
                                  onClick$={() => {
                                    contractUrl.value = null;
                                    contractPreviewUrl.value = '';
                                    if (fileInputRef.value) fileInputRef.value.value = '';
                                  }}
                                  class="mt-2 inline-flex items-center text-sm font-medium text-red-600 hover:text-red-800 dark:text-red-500 dark:hover:text-red-400"
                                >
                                  <LuTrash2 class="mr-1.5 h-4 w-4" />
                                  Remove PDF
                                </button>
                              </div>
                            ) : (
                              <div class="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 dark:border-slate-600 border-dashed rounded-lg">
                                <div class="space-y-1 text-center">
                                  {isUploading.value ? (
                                    <LuLoader2 class="mx-auto h-12 w-12 text-slate-400 animate-spin" />
                                  ) : (
                                    <LuFileUp class="mx-auto h-12 w-12 text-slate-400" />
                                  )}
                                  <div class="flex text-sm text-slate-600 dark:text-slate-400">
                                    <label
                                      for="file-upload"
                                      class="relative cursor-pointer bg-white dark:bg-slate-800 rounded-md font-medium text-teal-600 dark:text-teal-500 hover:text-teal-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-teal-500"
                                    >
                                      <span>Upload a file</span>
                                      <input 
                                        ref={fileInputRef}
                                        id="file-upload" 
                                        name="file-upload" 
                                        type="file" 
                                        class="sr-only" 
                                        accept="application/pdf"
                                        onChange$={handleFileUpload}
                                        disabled={isUploading.value}
                                      />
                                    </label>
                                    <p class="pl-1">or drag and drop</p>
                                  </div>
                                  <p class="text-xs text-slate-500 dark:text-slate-500">
                                    PDF up to 10MB
                                  </p>
                                </div>
                              </div>
                            )}
                             {uploadError.value && (
                              <p class="mt-2 text-sm text-red-600 dark:text-red-500">{uploadError.value}</p>
                            )}
                            <input type="hidden" name="contractUrl" value={contractUrl.value ?? ''} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 px-6 py-4 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={createContractAction.isRunning || isUploading.value}
                    class="w-full inline-flex justify-center items-center rounded-lg border border-transparent shadow-sm px-5 py-2.5 bg-gradient-to-r from-teal-500 to-teal-600 text-base font-medium text-white hover:from-teal-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 sm:ml-3 sm:w-auto sm:text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {createContractAction.isRunning ? <LuLoader2 class="animate-spin h-5 w-5 mr-2" /> : <LuSave class="h-5 w-5 mr-2" />}
                    Save Contract
                  </button>
                  <button
                    type="button"
                    onClick$={() => {
                      showNewContractModal.value = false;
                      resetModalState();
                    }}
                    class="mt-3 w-full inline-flex justify-center items-center rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm px-5 py-2.5 bg-white dark:bg-slate-800 text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-all duration-200"
                  >
                    <LuX class="h-5 w-5 mr-2" />
                    Cancel
                  </button>
                </div>
                {/* Mostrar errores de acción y validación de forma segura */}
                {createContractAction.value &&
                  (('success' in createContractAction.value && createContractAction.value.success === false) ||
                  ('failed' in createContractAction.value && createContractAction.value.failed)) && (
                    <div class="p-4 bg-red-100 text-red-800 rounded-b-lg">
                      <LuAlertTriangle class="inline h-5 w-5 mr-2" />
                      {/* Error general */}
                      {('error' in createContractAction.value && typeof createContractAction.value.error === 'string' && createContractAction.value.error.length > 0) ? (
                        <span>{createContractAction.value.error}</span>
                      ) : null}
                      {/* Errores de validación de campos */}
                      {Array.isArray((createContractAction.value as any).formErrors) && (createContractAction.value as any).formErrors.length > 0 && (
                        <ul class="mt-2 list-disc list-inside text-sm">
                          {(createContractAction.value as any).formErrors.map((err: string) => (
                            <li>{err}</li>
                          ))}
                        </ul>
                      )}
                      {typeof (createContractAction.value as any).fieldErrors === 'object' && (createContractAction.value as any).fieldErrors !== null && (
                        <ul class="mt-2 list-disc list-inside text-sm">
                          {Object.entries((createContractAction.value as any).fieldErrors).map(([field, err]) =>
                            Array.isArray(err) && err.length > 0 ? (
                              <li key={field}><b>{field}:</b> {err.join(', ')}</li>
                            ) : null
                          )}
                        </ul>
                      )}
                    </div>
                )}
              </Form>
            </div>
          </div>
        </div>
      )}
    </main>
  );
});