import { component$, useSignal, $, useTask$ } from '@builder.io/qwik';
import { routeLoader$, routeAction$, Form, zod$, z } from '@builder.io/qwik-city';
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
  LuFileText, 
  LuSearch, 
  LuPlus, 
  LuFilter, 
  LuEye, 
  LuDownload, 
  LuTrash,
  LuSave,
  LuX,
  LuLoader2,
  LuAlertTriangle,
  LuDollarSign,
  LuCalendar,
  LuCheckCircle,
  LuClock,
  LuFileUp,
  LuFileCheck2,
  LuTrash2,
  LuExternalLink
} from '@qwikest/icons/lucide';

// Type definitions
interface Invoice {
  id: number;
  professional_id: number;
  professional_name: string;
  contract_id: number;
  amount: number;
  currency: string;
  status: 'pending' | 'paid';
  issue_date: string;
  paid_date: string | null;
  invoice_url: string | null;
}

interface Professional {
  id: number;
  name: string;
  role: string;
}

interface Contract {
  id: number;
  professional_id: number;
  professional_name: string;
  start_date: string;
  end_date: string | null;
}

export const useInvoicesLoader = routeLoader$(async (requestEvent) => {
  const client = tursoClient(requestEvent);
  const session = await getSession(requestEvent);
  let invoicesResult;
  if (session.isAuthenticated && session.role === 'admin') {
    invoicesResult = await client.execute(`
      SELECT i.id, i.professional_id, p.name as professional_name, i.contract_id, i.amount, i.currency, i.status, i.issue_date, i.paid_date, i.invoice_url 
      FROM invoices i
      JOIN professionals p ON i.professional_id = p.id
      ORDER BY i.issue_date DESC
    `);
  } else if (session.isAuthenticated && session.userId) {
    invoicesResult = await client.execute({
      sql: `SELECT i.id, i.professional_id, p.name as professional_name, i.contract_id, i.amount, i.currency, i.status, i.issue_date, i.paid_date, i.invoice_url 
            FROM invoices i
            JOIN professionals p ON i.professional_id = p.id
            WHERE i.user_id = ?
            ORDER BY i.issue_date DESC`,
      args: [session.userId]
    });
  } else {
    // Not authenticated, return empty
    invoicesResult = { rows: [] };
  }

  const professionalsResult = await client.execute('SELECT id, name, role FROM professionals ORDER BY name');
  
  const contractsResult = await client.execute(`
    SELECT c.id, c.professional_id, p.name as professional_name, c.start_date, c.end_date
    FROM contracts c
    JOIN professionals p ON c.professional_id = p.id
    WHERE c.status = 'active'
    ORDER BY p.name, c.start_date DESC
  `);

  return {
    invoices: (invoicesResult.rows as any[]).map(row => ({ ...row, amount: Number(row.amount) })) as Invoice[],
    professionals: professionalsResult.rows as unknown as Professional[],
    contracts: contractsResult.rows as unknown as Contract[],
  };
});

export const useAddInvoice = routeAction$(
  async (data, requestEvent) => {
    const client = tursoClient(requestEvent);
    const session = await getSession(requestEvent);
    if (!session.isAuthenticated || !session.userId) {
      return { success: false, error: 'Authentication required.' };
    }

    const contractResult = await client.execute({
      sql: 'SELECT professional_id FROM contracts WHERE id = ?',
      args: [data.contractId]
    });

    if (contractResult.rows.length === 0) {
      return { success: false, error: 'Contract not found.' };
    }
    const professionalId = (contractResult.rows[0] as any).professional_id;

    try {
      await client.execute({
        sql: 'INSERT INTO invoices (contract_id, professional_id, user_id, issue_date, amount, currency, status, paid_date, invoice_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        args: [data.contractId, professionalId, session.userId, data.issueDate, data.amount, data.currency, data.status, data.status === 'paid' ? new Date().toISOString().split('T')[0] : null, data.invoiceUrl]
      });
      return { success: true };
    } catch (error) {
      console.error('Failed to add invoice:', error);
      return { success: false, error: 'Failed to add invoice.' };
    }
  },
  zod$({
    contractId: z.coerce.number().int().positive(),
    issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    amount: z.coerce.number().positive(),
    currency: z.string(),
    status: z.enum(['pending', 'paid']),
    invoiceUrl: z.string().optional().nullable(),
  })
);

export const useUpdateInvoiceStatus = routeAction$(async ({ id, status }, requestEvent) => {
    const client = tursoClient(requestEvent);
    const newStatus = status === 'paid' ? 'pending' : 'paid';
    const paidDate = newStatus === 'paid' ? new Date().toISOString().split('T')[0] : null;

    try {
        await client.execute({
            sql: 'UPDATE invoices SET status = ?, paid_date = ? WHERE id = ?',
            args: [newStatus, paidDate, id]
        });
        return { success: true };
    } catch (error) {
        console.error('Failed to update invoice status:', error);
        return { success: false, error: 'Failed to update status.' };
    }
}, zod$({
    id: z.coerce.number(),
    status: z.enum(['pending', 'paid'])
}));

export const useDeleteInvoice = routeAction$(async ({ id }, requestEvent) => {
    const client = tursoClient(requestEvent);
    try {
        await client.execute({
            sql: 'DELETE FROM invoices WHERE id = ?',
            args: [id]
        });
        return { success: true };
    } catch (error) {
        console.error('Failed to delete invoice:', error);
        return { success: false, error: 'Failed to delete invoice.' };
    }
}, zod$({
    id: z.coerce.number()
}));

export default component$(() => {
  useAuthLoader();
  const invoicesData = useInvoicesLoader();
  const addInvoiceAction = useAddInvoice();
  const updateStatusAction = useUpdateInvoiceStatus();
  const deleteAction = useDeleteInvoice();

  const showAddModal = useSignal(false);
  const searchQuery = useSignal('');
  
  const contractId = useSignal('');
  const issueDate = useSignal(new Date().toISOString().split('T')[0]);
  const amount = useSignal('');
  const currency = useSignal('USD');
  const status = useSignal('pending');
  const invoiceUrl = useSignal<string | null>(null);
  const invoicePreviewUrl = useSignal('');
  const isUploading = useSignal(false);
  const uploadError = useSignal('');
  const fileInputRef = useSignal<HTMLInputElement>();

  const filteredInvoices = useSignal<Invoice[]>([]);

  useTask$(({ track }) => {
    track(() => invoicesData.value.invoices);
    track(() => searchQuery.value);
    const query = searchQuery.value.toLowerCase();
    if (!query) {
      filteredInvoices.value = invoicesData.value.invoices;
    } else {
      filteredInvoices.value = invoicesData.value.invoices.filter(
        inv => inv.professional_name.toLowerCase().includes(query)
      );
    }
  });

  const totalPending = useSignal(0);
  const totalPaid = useSignal(0);

  useTask$(({ track }) => {
    track(() => invoicesData.value.invoices);
    totalPending.value = invoicesData.value.invoices
      .filter(inv => inv.status === 'pending')
      .reduce((sum, inv) => sum + inv.amount, 0);
    totalPaid.value = invoicesData.value.invoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + inv.amount, 0);
  });

  const resetModalState = $(() => {
    contractId.value = '';
    issueDate.value = new Date().toISOString().split('T')[0];
    amount.value = '';
    currency.value = 'USD';
    status.value = 'pending';
    invoiceUrl.value = null;
    invoicePreviewUrl.value = '';
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
    
    isUploading.value = true;
    uploadError.value = '';

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload-invoice', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        invoiceUrl.value = result.fileName;
        // Create a URL for previewing the local file
        invoicePreviewUrl.value = URL.createObjectURL(file);
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error: any) {
      uploadError.value = error.message || 'An unknown error occurred during upload.';
      // Clear the file input on error
      if (fileInputRef.value) {
        fileInputRef.value.value = '';
      }
    } finally {
      isUploading.value = false;
    }
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const correctedDate = new Date(date.getTime() + userTimezoneOffset);
    return correctedDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  };

  return (
    <main class="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <header class="mb-8 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700 rounded-xl shadow-sm p-6">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-center">
              <LuFileText class="h-8 w-8 text-teal-600 dark:text-teal-500 mr-3" />
              <div>
                <h1 class="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">
                  Invoices
                </h1>
                <p class="text-slate-500 dark:text-slate-400 mt-1">
                  Track and manage all payments
                </p>
              </div>
            </div>
            <button 
              onClick$={() => showAddModal.value = true}
              class="mt-4 sm:mt-0 inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all duration-200"
            >
              <LuPlus class="mr-2 h-4 w-4" />
              Add Invoice
            </button>
          </div>
        </header>

        {/* Summary Cards */}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-5 border border-slate-100 dark:border-slate-700">
                <h3 class="text-sm font-medium text-slate-500 dark:text-slate-400">Total Invoices</h3>
                <p class="text-2xl font-bold text-slate-800 dark:text-slate-200">{invoicesData.value.invoices.length}</p>
            </div>
            <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-5 border border-slate-100 dark:border-slate-700">
                <h3 class="text-sm font-medium text-slate-500 dark:text-slate-400">Pending Payment</h3>
                <p class="text-2xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(totalPending.value, 'USD')}</p>
            </div>
            <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-5 border border-slate-100 dark:border-slate-700">
                <h3 class="text-sm font-medium text-slate-500 dark:text-slate-400">Total Paid</h3>
                <p class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalPaid.value, 'USD')}</p>
            </div>
        </div>

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
                placeholder="Search by professional..."
              />
            </div>
          </div>
        </div>
        
        {/* Invoices Table */}
        <div class="bg-white dark:bg-slate-800 shadow-lg rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead class="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700">
                <tr>
                  <th class="px-6 py-4 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">Professional</th>
                  <th class="px-6 py-4 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">Issue Date</th>
                  <th class="px-6 py-4 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">Amount</th>
                  <th class="px-6 py-4 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">Status</th>
                  <th class="px-6 py-4 text-right text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody class="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                {filteredInvoices.value.map((invoice) => (
                  <tr key={invoice.id} class="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all duration-200 group">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800 dark:text-slate-100">{invoice.professional_name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{formatDate(invoice.issue_date)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-800 dark:text-slate-100 font-semibold">{formatCurrency(invoice.amount, invoice.currency)}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span class={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        invoice.status === 'paid' 
                          ? 'bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 dark:from-emerald-900/30 dark:to-emerald-800/30 dark:text-emerald-400' 
                          : 'bg-gradient-to-r from-amber-50 to-amber-100 text-amber-700 dark:from-amber-900/30 dark:to-amber-800/30 dark:text-amber-400'
                      }`}>
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div class="flex justify-end space-x-2">
                        {invoice.invoice_url ? (
                           <a href={`/api/invoices/view/${invoice.invoice_url}`} target="_blank" rel="noopener noreferrer" class="p-1.5 text-slate-600 dark:text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:text-teal-400 dark:hover:bg-teal-900/20 rounded-full transition-all" title="View Invoice">
                             <LuEye class="h-5 w-5" />
                           </a>
                         ) : (
                           <button class="p-1.5 text-slate-400 dark:text-slate-600 rounded-full transition-all cursor-not-allowed" disabled title="No invoice uploaded">
                             <LuEye class="h-5 w-5" />
                           </button>
                         )}
                        <Form action={updateStatusAction}>
                            <input type="hidden" name="id" value={invoice.id} />
                            <input type="hidden" name="status" value={invoice.status} />
                            <button type="submit" class="p-1.5 text-slate-600 dark:text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:text-teal-400 dark:hover:bg-teal-900/20 rounded-full transition-all" title={invoice.status === 'paid' ? 'Mark as Pending' : 'Mark as Paid'}>
                                {invoice.status === 'paid' ? <LuClock class="h-5 w-5" /> : <LuCheckCircle class="h-5 w-5" />}
                            </button>
                        </Form>
                        <Form action={deleteAction}>
                            <input type="hidden" name="id" value={invoice.id} />
                            <button type="submit" class="p-1.5 text-slate-600 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-full transition-all" title="Delete Invoice">
                                <LuTrash class="h-5 w-5" />
                            </button>
                        </Form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredInvoices.value.length === 0 && (
            <div class="px-6 py-12 text-center">
              <p class="text-slate-500 dark:text-slate-400 font-medium">No invoices found.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Invoice Modal */}
      {showAddModal.value && (
        <div class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div class="flex items-end sm:items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div 
              class="fixed inset-0 bg-slate-700/70 dark:bg-slate-900/80 backdrop-blur-md transition-opacity" 
              aria-hidden="true"
              onClick$={() => showAddModal.value = false}
            ></div>

            <div class="inline-block align-bottom bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-xl text-left overflow-hidden shadow-2xl transform transition-all border border-slate-100/50 dark:border-slate-700/50 sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <Form 
                action={addInvoiceAction}
                onSubmitCompleted$={() => {
                  if (addInvoiceAction.value?.success) {
                    showAddModal.value = false;
                    resetModalState();
                  }
                }}
              >
                <div class="px-6 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 class="text-xl leading-6 font-medium text-slate-800 dark:text-slate-100" id="modal-title">
                    Add New Invoice
                  </h3>
                  <div class="mt-4 space-y-4">
                    <div>
                      <label for="contractId" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Contract</label>
                      <select name="contractId" id="contractId" bind:value={contractId} class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm transition-all">
                        <option value="">Select a contract</option>
                        {invoicesData.value.contracts.map(c => <option key={c.id} value={c.id}>{`${c.professional_name} (${formatDate(c.start_date)})`}</option>)}
                      </select>
                      {addInvoiceAction.value?.fieldErrors?.contractId && <p class="text-red-500 text-sm mt-1">{addInvoiceAction.value.fieldErrors.contractId[0]}</p>}
                    </div>
                    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label for="issueDate" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Issue Date</label>
                            <input type="date" name="issueDate" id="issueDate" bind:value={issueDate} class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm transition-all" />
                            {addInvoiceAction.value?.fieldErrors?.issueDate && <p class="text-red-500 text-sm mt-1">{addInvoiceAction.value.fieldErrors.issueDate[0]}</p>}
                        </div>
                        <div>
                            <label for="amount" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Amount</label>
                            <input type="number" name="amount" id="amount" bind:value={amount} class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm transition-all" />
                            {addInvoiceAction.value?.fieldErrors?.amount && <p class="text-red-500 text-sm mt-1">{addInvoiceAction.value.fieldErrors.amount[0]}</p>}
                        </div>
                    </div>
                    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label for="currency" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Currency</label>
                            <select name="currency" id="currency" bind:value={currency} class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm transition-all">
                                <option>USD</option>
                                <option>EUR</option>
                                <option>KNRT</option>
                            </select>
                        </div>
                        <div>
                            <label for="status" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
                            <select name="status" id="status" bind:value={status} class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm transition-all">
                                <option value="pending">Pending</option>
                                <option value="paid">Paid</option>
                            </select>
                        </div>
                    </div>

                    {/* Invoice Upload */}
                    <div>
                      <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Invoice Document (PDF/Image)
                      </label>
                      {invoicePreviewUrl.value ? (
                        <div class="mt-2">
                          <div class="relative h-64 w-full rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden group">
                            {invoicePreviewUrl.value.startsWith('blob:http') && (
                                <iframe src={invoicePreviewUrl.value} class="h-full w-full" title="Invoice Preview"></iframe>
                            )}
                            <a 
                              href={invoicePreviewUrl.value} 
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
                              invoiceUrl.value = null;
                              invoicePreviewUrl.value = '';
                              if (fileInputRef.value) fileInputRef.value.value = '';
                            }}
                            class="mt-2 inline-flex items-center text-sm font-medium text-red-600 hover:text-red-800 dark:text-red-500 dark:hover:text-red-400"
                          >
                            <LuTrash2 class="mr-1.5 h-4 w-4" />
                            Remove Document
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
                                  accept="application/pdf,image/*"
                                  onChange$={handleFileUpload}
                                  disabled={isUploading.value}
                                />
                              </label>
                              <p class="pl-1">or drag and drop</p>
                            </div>
                            <p class="text-xs text-slate-500 dark:text-slate-500">
                              PDF, PNG, JPG up to 10MB
                            </p>
                          </div>
                        </div>
                      )}
                       {uploadError.value && (
                        <p class="mt-2 text-sm text-red-600 dark:text-red-500">{uploadError.value}</p>
                      )}
                      <input type="hidden" name="invoiceUrl" value={invoiceUrl.value ?? ''} />
                    </div>
                  </div>
                </div>
                <div class="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 px-6 py-4 sm:flex sm:flex-row-reverse">
                  <button type="submit" disabled={addInvoiceAction.isRunning || isUploading.value} class="w-full inline-flex justify-center items-center rounded-lg border border-transparent shadow-sm px-5 py-2.5 bg-gradient-to-r from-teal-500 to-teal-600 text-base font-medium text-white hover:from-teal-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 sm:ml-3 sm:w-auto sm:text-sm transition-all duration-200 disabled:opacity-50">
                    {addInvoiceAction.isRunning ? <LuLoader2 class="animate-spin h-5 w-5 mr-2" /> : <LuSave class="h-5 w-5 mr-2" />}
                    Save Invoice
                  </button>
                  <button type="button" onClick$={() => { showAddModal.value = false; resetModalState(); }} class="mt-3 w-full inline-flex justify-center items-center rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm px-5 py-2.5 bg-white dark:bg-slate-800 text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-all duration-200">
                    <LuX class="h-5 w-5 mr-2" />
                    Cancel
                  </button>
                </div>
                {addInvoiceAction.value?.success === false && (
                  <div class="p-4 bg-red-100 text-red-800 rounded-b-lg">
                    <LuAlertTriangle class="inline h-5 w-5 mr-2" />
                    {addInvoiceAction.value.error}
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