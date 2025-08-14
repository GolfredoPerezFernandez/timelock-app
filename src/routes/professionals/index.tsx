import { component$, useSignal, useStore, $, useTask$ } from '@builder.io/qwik';
import { routeLoader$, routeAction$, Form, z, zod$ } from '@builder.io/qwik-city';
import { tursoClient } from '~/utils/turso';
import { getSession } from '~/utils/auth';

export const useAuthLoader = routeLoader$(async (event) => {
  const session = await getSession(event);
  if (!session?.isAuthenticated) {
    throw event.redirect(302, '/auth');
  }
  return session;
});
import { 
  LuUsers, 
  LuSearch, 
  LuPlus, 
  LuDownload, 
  LuFilter, 
  LuPencil, 
  LuTrash, 
  LuBriefcase, 
  LuEye, 
  LuUpload,
  LuSave,
  LuX,
  LuLoader2,
  LuAlertTriangle,
  LuChevronDown
} from '@qwikest/icons/lucide';

// Professional type definition
interface Professional {
  id: number;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
  wallet: string | null; // Este campo se llama wallet en la base de datos
}



export const useProfessionalsLoader = routeLoader$(async (requestEvent) => {
  //await runMigrations(requestEvent);
  const client = tursoClient(requestEvent);
  const result = await client.execute('SELECT id, name, role, email, phone, wallet FROM professionals ORDER BY name');
  return result.rows as unknown as Professional[];
});

export const useAddProfessional = routeAction$(
  async (data, requestEvent) => {
   // await runMigrations(requestEvent);
    const client = tursoClient(requestEvent);

    const session = await getSession(requestEvent);
    if (!session.isAuthenticated || !session.userId) {
      return { success: false, error: 'Authentication required.' };
    }

    try {
      await client.execute({
        sql: 'INSERT INTO professionals (user_id, name, role, email, phone, wallet) VALUES (?, ?, ?, ?, ?, ?)',
        args: [
          session.userId,
          data.name ?? '',
          data.role ?? '',
          data.email ?? '',
          data.phone ?? '',
          data.wallet ?? ''
        ]
      });
      return { success: true };
    } catch (error) {
      console.error('Failed to add professional:', error);
      return { success: false, error: 'Failed to add professional.' };
    }
  },
  zod$({
    name: z.string().min(3, 'Name must be at least 3 characters.'),
    role: z.string().min(3, 'Role must be at least 3 characters.'),
    email: z.string().email('Please enter a valid email.').optional().or(z.literal('')),
    phone: z.string().optional(),
    wallet: z.string().optional(),
  })
);

export const useDeleteProfessional = routeAction$(
  async (data, requestEvent) => {
    //await runMigrations(requestEvent);
    const client = tursoClient(requestEvent);

    const session = await getSession(requestEvent);
    if (!session.isAuthenticated || !session.userId) {
      return { success: false, error: 'Authentication required.' };
    }

    try {
      // Verificar que el profesional existe
      const checkResult = await client.execute({
        sql: 'SELECT user_id FROM professionals WHERE id = ?',
        args: [data.id]
      });
      
      if (checkResult.rows.length === 0) {
        return { success: false, error: 'Professional not found.' };
      }
      
      // Verificar si el usuario es administrador
      const userQuery = await client.execute({
        sql: 'SELECT email FROM users WHERE id = ?',
        args: [session.userId]
      });
      
      const userEmail = userQuery.rows[0]?.email;
      const userId = checkResult.rows[0].user_id;
      
      // Permitir la eliminación si el usuario es el creador o es el administrador (admin@gmail.com)
      if (userEmail !== 'admin@gmail.com' && userId !== session.userId) {
        return { success: false, error: 'You do not have permission to delete this professional.' };
      }
      
      // Verificar si hay pagos asociados a este profesional
      const paymentsCheck = await client.execute({
        sql: 'SELECT COUNT(*) as count FROM payments WHERE professional_id = ?',
        args: [data.id]
      });
      
      // Convertir el resultado a número para hacer la comparación
      const paymentsCount = Number(paymentsCheck.rows[0]?.count || 0);
      if (paymentsCount > 0) {
        return { success: false, error: 'Cannot delete a professional with associated payments.' };
      }
      
      // Eliminar el profesional
      await client.execute({
        sql: 'DELETE FROM professionals WHERE id = ?',
        args: [data.id]
      });
      
      return { success: true };
    } catch (error) {
      console.error('Failed to delete professional:', error);
      return { success: false, error: 'Failed to delete professional.' };
    }
  },
  zod$({
    id: z.coerce.number()
  })
);

export const useEditProfessional = routeAction$(
  async (data, requestEvent) => {
    //await runMigrations(requestEvent);
    const client = tursoClient(requestEvent);

    const session = await getSession(requestEvent);
    if (!session.isAuthenticated || !session.userId) {
      return { success: false, error: 'Authentication required.' };
    }

    try {
      // Verificar que el profesional existe
      const checkResult = await client.execute({
        sql: 'SELECT user_id FROM professionals WHERE id = ?',
        args: [data.id]
      });
      
      if (checkResult.rows.length === 0) {
        return { success: false, error: 'Professional not found.' };
      }
      
      // Verificar si el usuario es administrador
      const userQuery = await client.execute({
        sql: 'SELECT email FROM users WHERE id = ?',
        args: [session.userId]
      });
      
      const userEmail = userQuery.rows[0]?.email;
      const userId = checkResult.rows[0].user_id;
      
      // Permitir la edición si el usuario es el creador o es el administrador (admin@gmail.com)
      if (userEmail !== 'admin@gmail.com' && userId !== session.userId) {
        return { success: false, error: 'You do not have permission to edit this professional.' };
      }

      await client.execute({
        sql: 'UPDATE professionals SET name = ?, role = ?, email = ?, phone = ?, wallet = ? WHERE id = ?',
        args: [
          data.name ?? '',
          data.role ?? '',
          data.email ?? '',
          data.phone ?? '',
          data.wallet ?? '',
          data.id
        ]
      });
      return { success: true };
    } catch (error) {
      console.error('Failed to edit professional:', error);
      return { success: false, error: 'Failed to edit professional.' };
    }
  },
  zod$({
    id: z.coerce.number(),
    name: z.string().min(3, 'Name must be at least 3 characters.'),
    role: z.string().min(3, 'Role must be at least 3 characters.'),
    email: z.string().email('Please enter a valid email.').optional().or(z.literal('')),
    phone: z.string().optional(),
    wallet: z.string().optional(),
  })
);

export default component$(() => {
  useAuthLoader();
  const professionals = useProfessionalsLoader();
  const addProfessionalAction = useAddProfessional();
  const editProfessionalAction = useEditProfessional();
  const deleteProfessionalAction = useDeleteProfessional();

  const searchQuery = useSignal('');
  const showNewProfessionalModal = useSignal(false);
  const showEditProfessionalModal = useSignal(false);
  const showDeleteConfirmModal = useSignal(false);
  const professionalToDelete = useSignal<number | null>(null);
  
  // Signals for new professional form
  const name = useSignal('');
  const role = useSignal('');
  const email = useSignal('');
  const phone = useSignal('');
  const wallet = useSignal('');
  
  // Signals for editing professional
  const editingId = useSignal<number | null>(null);
  const editingName = useSignal('');
  const editingRole = useSignal('');
  const editingEmail = useSignal('');
  const editingPhone = useSignal('');
  const editingWallet = useSignal('');

  const filteredProfessionals = useSignal<Professional[]>(professionals.value);

  useTask$(({ track }) => {
    track(() => professionals.value);
    filteredProfessionals.value = professionals.value;
  });

  // Función para abrir el modal de edición con los datos del profesional
  const openEditModal = $((prof: Professional) => {
    editingId.value = prof.id;
    editingName.value = prof.name;
    editingRole.value = prof.role;
    editingEmail.value = prof.email || '';
    editingPhone.value = prof.phone || '';
    editingWallet.value = prof.wallet || '';
    showEditProfessionalModal.value = true;
  });
  
  const updateFilteredList = $(() => {
    if (!searchQuery.value) {
      filteredProfessionals.value = professionals.value;
      return;
    }
    
    const query = searchQuery.value.toLowerCase();
    filteredProfessionals.value = professionals.value.filter(
      prof => 
        prof.name.toLowerCase().includes(query) ||
        prof.role.toLowerCase().includes(query)
    );
  });

  return (
    <main class="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <header class="mb-8 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700 rounded-xl shadow-sm p-6">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-center">
              <LuUsers class="h-8 w-8 text-teal-600 dark:text-teal-500 mr-3" />
              <div>
                <h1 class="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">
                  Professionals
                </h1>
                <p class="text-slate-500 dark:text-slate-400 mt-1">
                  Freelancer management
                </p>
              </div>
            </div>
            
            <div class="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-3">
              <button 
                onClick$={() => showNewProfessionalModal.value = true}
                class="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all duration-200"
              >
                <LuPlus class="mr-2 h-4 w-4" />
                Add Professional
              </button>
              
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
                value={searchQuery.value}
                onInput$={(event) => {
                  searchQuery.value = (event.target as HTMLInputElement).value;
                  updateFilteredList();
                }}
                class="block w-full pl-10 pr-3 py-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder-slate-400 shadow-sm hover:border-teal-400 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm transition-all duration-200"
                placeholder="Search by name or role..."
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
        
        {/* Professionals Table */}
        <div class="bg-white dark:bg-slate-800 shadow-lg rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead class="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700">
                <tr>
                  <th scope="col" class="px-6 py-4 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th scope="col" class="px-6 py-4 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Role
                  </th>
                  <th scope="col" class="px-6 py-4 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Contact
                  </th>
                  <th scope="col" class="px-6 py-4 text-right text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                {filteredProfessionals.value.map((prof: Professional) => (
                  <tr key={prof.id} class="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all duration-200 group">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800 dark:text-slate-100">
                      {prof.name}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                      {prof.role}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                      <div>{prof.email}</div>
                      <div>{prof.phone}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div class="flex justify-end space-x-2">
                        <button class="p-1.5 text-slate-600 dark:text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:text-teal-400 dark:hover:bg-teal-900/20 rounded-full transition-all">
                          <LuEye class="h-5 w-5" />
                        </button>
                        <button 
                          onClick$={() => openEditModal(prof)}
                          class="p-1.5 text-slate-600 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 rounded-full transition-all"
                        >
                          <LuPencil class="h-5 w-5" />
                        </button>
                        <button 
                          onClick$={() => {
                            professionalToDelete.value = prof.id;
                            showDeleteConfirmModal.value = true;
                          }}
                          class="p-1.5 text-slate-600 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-full transition-all"
                        >
                          <LuTrash class="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredProfessionals.value.length === 0 && (
            <div class="px-6 py-12 text-center">
              <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700/50 mb-4">
                <LuUsers class="w-8 h-8 text-slate-400 dark:text-slate-500" />
              </div>
              <p class="text-slate-500 dark:text-slate-400 font-medium">No professionals found.</p>
              <p class="text-slate-400 dark:text-slate-500 mt-1 text-sm">Add a new professional to get started.</p>
            </div>
          )}
        </div>
        
        {/* Pagination - Optional */}
        <div class="flex items-center justify-between mt-6 bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700">
          <div class="text-sm text-slate-600 dark:text-slate-400">
            Showing <span class="font-medium text-teal-600 dark:text-teal-500">{filteredProfessionals.value.length}</span> of <span class="font-medium text-teal-600 dark:text-teal-500">{professionals.value.length}</span> professionals
          </div>
        </div>
      </div>

      {/* New Professional Modal */}
      {showNewProfessionalModal.value && (
        <div class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div class="flex items-end sm:items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div 
              class="fixed inset-0 bg-slate-700/70 dark:bg-slate-900/80 backdrop-blur-md transition-opacity" 
              aria-hidden="true"
              onClick$={() => showNewProfessionalModal.value = false}
            ></div>

            <div class="inline-block align-bottom bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-xl text-left overflow-hidden shadow-2xl transform transition-all border border-slate-100/50 dark:border-slate-700/50 sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <Form 
                action={addProfessionalAction}
              onSubmitCompleted$={() => {
                if (addProfessionalAction.value?.success) {
                  showNewProfessionalModal.value = false;
                  name.value = '';
                  role.value = '';
                  email.value = '';
                  phone.value = '';
                  wallet.value = '';
                }
              }}
              >
                <div class="px-6 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div class="sm:flex sm:items-start">
                    <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 class="text-xl leading-6 font-medium text-slate-800 dark:text-slate-100" id="modal-title">
                        Add New Professional
                      </h3>
                      <div class="mt-4">
                        <div class="space-y-4">
                          <div>
                            <label for="name" class="block text-sm font-medium text-slate-700 dark:text-slate-300">
                              Full Name
                            </label>
                            <input
                              type="text"
                              name="name"
                              id="name"
                              bind:value={name}
                              class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm transition-all"
                              required
                            />
                            {addProfessionalAction.value?.fieldErrors?.name && <p class="text-red-500 text-sm mt-1">{addProfessionalAction.value.fieldErrors.name}</p>}
                          </div>
                          
                          <div>
                            <label for="role" class="block text-sm font-medium text-slate-700 dark:text-slate-300">
                              Role
                            </label>
                            <input
                              type="text"
                              name="role"
                              id="role"
                              bind:value={role}
                              class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm transition-all"
                              placeholder="e.g., Frontend Developer"
                              required
                            />
                             {addProfessionalAction.value?.fieldErrors?.role && <p class="text-red-500 text-sm mt-1">{addProfessionalAction.value.fieldErrors.role}</p>}
                          </div>
                          
                          <div>
                          <div>
                            <label for="wallet" class="block text-sm font-medium text-slate-700 dark:text-slate-300">
                              Wallet (optional)
                            </label>
                            <input
                              type="text"
                              name="wallet"
                              id="wallet"
                              bind:value={wallet}
                              class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm transition-all"
                              placeholder="Wallet address or ID"
                            />
                            {addProfessionalAction.value?.fieldErrors?.wallet && <p class="text-red-500 text-sm mt-1">{addProfessionalAction.value.fieldErrors.wallet}</p>}
                          </div>
                            <label for="email" class="block text-sm font-medium text-slate-700 dark:text-slate-300">
                              Email
                            </label>
                            <input
                              type="email"
                              name="email"
                              id="email"
                              bind:value={email}
                              class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm transition-all"
                            />
                             {addProfessionalAction.value?.fieldErrors?.email && <p class="text-red-500 text-sm mt-1">{addProfessionalAction.value.fieldErrors.email}</p>}
                          </div>
                          
                          <div>
                            <label for="phone" class="block text-sm font-medium text-slate-700 dark:text-slate-300">
                              Phone
                            </label>
                            <input
                              type="tel"
                              name="phone"
                              id="phone"
                              bind:value={phone}
                              class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm transition-all"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 px-6 py-4 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={addProfessionalAction.isRunning}
                    class="w-full inline-flex justify-center items-center rounded-lg border border-transparent shadow-sm px-5 py-2.5 bg-gradient-to-r from-teal-500 to-teal-600 text-base font-medium text-white hover:from-teal-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 sm:ml-3 sm:w-auto sm:text-sm transition-all duration-200 disabled:opacity-50"
                  >
                    {addProfessionalAction.isRunning ? <LuLoader2 class="animate-spin h-5 w-5 mr-2" /> : <LuSave class="h-5 w-5 mr-2" />}
                    Save Professional
                  </button>
                  <button
                    type="button"
                    onClick$={() => showNewProfessionalModal.value = false}
                    class="mt-3 w-full inline-flex justify-center items-center rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm px-5 py-2.5 bg-white dark:bg-slate-800 text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-all duration-200"
                  >
                    <LuX class="h-5 w-5 mr-2" />
                    Cancel
                  </button>
                </div>
                {addProfessionalAction.value?.success === false && (
                  <div class="p-4 bg-red-100 text-red-800 rounded-b-lg">
                    <LuAlertTriangle class="inline h-5 w-5 mr-2" />
                    {addProfessionalAction.value.error}
                  </div>
                )}
              </Form>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit Professional Modal */}
      {showEditProfessionalModal.value && (
        <div class="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center">
          <div class="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick$={() => showEditProfessionalModal.value = false}></div>
          <div class="relative bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md mx-4 sm:mx-auto z-10 overflow-hidden">
            <div class="bg-gradient-to-r from-blue-500 to-blue-600 py-6 px-6">
              <h3 class="text-xl font-semibold text-white flex items-center">
                <LuPencil class="h-5 w-5 mr-2" />
                Edit Professional
              </h3>
              <p class="text-blue-100 text-sm mt-1">Update the professional's information</p>
            </div>
            
            <Form action={editProfessionalAction} onSubmitCompleted$={() => {
              if (editProfessionalAction.value?.success) {
                showEditProfessionalModal.value = false;
              }
            }}>
              <div class="p-6">
                <div class="space-y-6">
                  <input type="hidden" name="id" value={editingId.value} />
                  
                  <div>
                    <label for="edit-name" class="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Name
                    </label>
                    <input
                      type="text"
                      name="name"
                      id="edit-name"
                      bind:value={editingName}
                      required
                      class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all"
                    />
                  </div>
                  
                  <div>
                    <label for="edit-role" class="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Role
                    </label>
                    <input
                      type="text"
                      name="role"
                      id="edit-role"
                      bind:value={editingRole}
                      required
                      class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all"
                    />
                  </div>
                  
                  <div>
                    <label for="edit-wallet" class="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Wallet Address
                    </label>
                    <input
                      type="text"
                      name="wallet"
                      id="edit-wallet"
                      bind:value={editingWallet}
                      placeholder="0x..."
                      class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all font-mono"
                    />
                  </div>
                  
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label for="edit-email" class="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Email
                      </label>
                      <input
                        type="email"
                        name="email"
                        id="edit-email"
                        bind:value={editingEmail}
                        class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all"
                      />
                    </div>
                    
                    <div>
                      <label for="edit-phone" class="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Phone
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        id="edit-phone"
                        bind:value={editingPhone}
                        class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 px-6 py-4 sm:flex sm:flex-row-reverse">
                <button
                  type="submit"
                  disabled={editProfessionalAction.isRunning}
                  class="w-full inline-flex justify-center items-center rounded-lg border border-transparent shadow-sm px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-base font-medium text-white hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm transition-all duration-200 disabled:opacity-50"
                >
                  {editProfessionalAction.isRunning ? <LuLoader2 class="animate-spin h-5 w-5 mr-2" /> : <LuSave class="h-5 w-5 mr-2" />}
                  Update Professional
                </button>
                <button
                  type="button"
                  onClick$={() => showEditProfessionalModal.value = false}
                  class="mt-3 w-full inline-flex justify-center items-center rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm px-5 py-2.5 bg-white dark:bg-slate-800 text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-all duration-200"
                >
                  <LuX class="h-5 w-5 mr-2" />
                  Cancel
                </button>
              </div>
              
              {editProfessionalAction.value?.success === false && (
                <div class="p-4 bg-red-100 text-red-800 rounded-b-lg">
                  <LuAlertTriangle class="inline h-5 w-5 mr-2" />
                  {editProfessionalAction.value.error}
                </div>
              )}
            </Form>
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal.value && (
        <div class="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center">
          <div class="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick$={() => showDeleteConfirmModal.value = false}></div>
          <div class="relative bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md mx-4 sm:mx-auto z-10 overflow-hidden">
            <div class="bg-gradient-to-r from-red-500 to-red-600 py-6 px-6">
              <h3 class="text-xl font-semibold text-white flex items-center">
                <LuTrash class="h-5 w-5 mr-2" />
                Confirm Deletion
              </h3>
              <p class="text-red-100 text-sm mt-1">This action cannot be undone</p>
            </div>
            
            <Form action={deleteProfessionalAction} onSubmitCompleted$={() => {
              if (deleteProfessionalAction.value?.success) {
                showDeleteConfirmModal.value = false;
                professionalToDelete.value = null;
              }
            }}>
              <div class="p-6">
                <input type="hidden" name="id" value={professionalToDelete.value} />
                
                <div class="text-center mb-6">
                  <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30">
                    <LuTrash class="h-6 w-6 text-red-600 dark:text-red-500" />
                  </div>
                  <h3 class="mt-3 text-lg font-medium text-slate-900 dark:text-slate-100">Delete Professional</h3>
                  <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Are you sure you want to delete this professional? This action cannot be undone.
                  </p>
                </div>
              </div>
              
              <div class="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 px-6 py-4 sm:flex sm:flex-row-reverse">
                <button
                  type="submit"
                  disabled={deleteProfessionalAction.isRunning}
                  class="w-full inline-flex justify-center items-center rounded-lg border border-transparent shadow-sm px-5 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-base font-medium text-white hover:from-red-600 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm transition-all duration-200 disabled:opacity-50"
                >
                  {deleteProfessionalAction.isRunning ? <LuLoader2 class="animate-spin h-5 w-5 mr-2" /> : <LuTrash class="h-5 w-5 mr-2" />}
                  Delete
                </button>
                <button
                  type="button"
                  onClick$={() => showDeleteConfirmModal.value = false}
                  class="mt-3 w-full inline-flex justify-center items-center rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm px-5 py-2.5 bg-white dark:bg-slate-800 text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-all duration-200"
                >
                  <LuX class="h-5 w-5 mr-2" />
                  Cancel
                </button>
              </div>
              
              {deleteProfessionalAction.value?.success === false && (
                <div class="p-4 bg-red-100 text-red-800 rounded-b-lg">
                  <LuAlertTriangle class="inline h-5 w-5 mr-2" />
                  {deleteProfessionalAction.value.error}
                </div>
              )}
            </Form>
          </div>
        </div>
      )}
    </main>
  );
});