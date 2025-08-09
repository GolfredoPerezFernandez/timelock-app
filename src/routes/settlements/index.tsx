import { component$, useSignal, useStore, $ } from '@builder.io/qwik';
import { routeLoader$, routeAction$, Form, z, zod$ } from '@builder.io/qwik-city';
import { tursoClient } from '~/utils/turso';
import { getSession } from '~/utils/auth';
import { formatCurrency } from '~/utils/format';
import { 
  LuFileText, 
  LuPlus, 
  LuFilter, 
  LuTrash,
  LuSave,
  LuX,
  LuLoader2,
  LuAlertTriangle,
  LuCheckCircle,
  LuClock,
  LuCalendar,
  LuUser,
  LuDollarSign
} from '@qwikest/icons/lucide';

// Type Definitions
interface Settlement {
  id: number;
  professional_id: number;
  professional_name: string;
  month: number;
  year: number;
  total_amount: number;
  currency: string;
  status: 'pending' | 'paid';
  payment_date: string | null;
}

interface Professional {
  id: number;
  name: string;
}

// Data Loader
export const useSettlementsLoader = routeLoader$(async (requestEvent) => {
  const db = tursoClient(requestEvent);
  const url = new URL(requestEvent.request.url);
  
  const professionalId = url.searchParams.get('professional');
  const month = url.searchParams.get('month');
  const year = url.searchParams.get('year');

  let query = `
    SELECT 
      s.id, s.professional_id, p.name as professional_name, s.month, s.year, 
      s.total_amount, s.currency, s.status, s.payment_date
    FROM settlements s
    JOIN professionals p ON s.professional_id = p.id
  `;
  
  const params: (string | number)[] = [];
  const conditions: string[] = [];

  if (professionalId) {
    conditions.push('s.professional_id = ?');
    params.push(professionalId);
  }
  if (month) {
    conditions.push('s.month = ?');
    params.push(month);
  }
  if (year) {
    conditions.push('s.year = ?');
    params.push(year);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY s.year DESC, s.month DESC';

  const settlementsResult = await db.execute({ sql: query, args: params });
  const professionalsResult = await db.execute('SELECT id, name FROM professionals ORDER BY name');

  return {
    settlements: (settlementsResult.rows as any[]).map(r => ({...r, total_amount: Number(r.total_amount)})) as Settlement[],
    professionals: professionalsResult.rows as unknown as Professional[],
    filters: { professionalId, month, year }
  };
});

// Add Settlement Action
export const useAddSettlement = routeAction$(
  async (data, requestEvent) => {
    const session = await getSession(requestEvent);
    if (!session.isAuthenticated || !session.userId) return { success: false, error: 'Authentication required' };

    const client = tursoClient(requestEvent);
    try {
      await client.execute({
        sql: 'INSERT INTO settlements (professional_id, user_id, month, year, total_amount, currency, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [data.professionalId, session.userId, data.month, data.year, data.totalAmount, data.currency, 'pending']
      });
      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: 'Failed to create settlement.' };
    }
  },
  zod$({
    professionalId: z.coerce.number(),
    month: z.coerce.number().min(1).max(12),
    year: z.coerce.number().min(2000).max(2100),
    totalAmount: z.coerce.number().positive(),
    currency: z.string().min(3),
  })
);

// Update Status Action
export const useUpdateSettlementStatus = routeAction$(async ({ id, status }, requestEvent) => {
  const client = tursoClient(requestEvent);
  const newStatus = status === 'paid' ? 'pending' : 'paid';
  const paymentDate = newStatus === 'paid' ? new Date().toISOString().split('T')[0] : null;
  
  try {
    await client.execute({
      sql: 'UPDATE settlements SET status = ?, payment_date = ? WHERE id = ?',
      args: [
        String(newStatus),
        paymentDate ? String(paymentDate) : null,
        String(id)
      ]
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Failed to update status.' };
  }
});

// Delete Action
export const useDeleteSettlement = routeAction$(async ({ id }, requestEvent) => {
  const client = tursoClient(requestEvent);
  try {
    await client.execute({ sql: 'DELETE FROM settlements WHERE id = ?', args: [String(id)] });
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Failed to delete settlement.' };
  }
});

const months = [
  { value: '1', label: 'January' }, { value: '2', label: 'February' },
  { value: '3', label: 'March' }, { value: '4', label: 'April' },
  { value: '5', label: 'May' }, { value: '6', label: 'June' },
  { value: '7', label: 'July' }, { value: '8', label: 'August' },
  { value: '9', label: 'September' }, { value: '10', label: 'October' },
  { value: '11', label: 'November' }, { value: '12', label: 'December' }
];

const getYears = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear - 3; i <= currentYear + 1; i++) {
    years.push({ value: i.toString(), label: i.toString() });
  }
  return years;
};

export default component$(() => {
  const settlementsData = useSettlementsLoader();
  const addAction = useAddSettlement();
  const updateStatusAction = useUpdateSettlementStatus();
  const deleteAction = useDeleteSettlement();

  const showAddModal = useSignal(false);
  // Use signals for each filter control
  const filtersProfessionalId = useSignal(settlementsData.value.filters.professionalId || '');
  const filtersMonth = useSignal(settlementsData.value.filters.month || '');
  const filtersYear = useSignal(settlementsData.value.filters.year || new Date().getFullYear().toString());

  // Use signals for each form field (Qwik best practice)
  const professionalId = useSignal('');
  const month = useSignal((new Date().getMonth() + 1).toString());
  const year = useSignal(new Date().getFullYear().toString());
  const totalAmountSignal = useSignal('');
  const currency = useSignal('USD');

  const applyFilters = $(() => {
    const url = new URL(window.location.href);
    const filterMap = {
      professionalId: filtersProfessionalId.value,
      month: filtersMonth.value,
      year: filtersYear.value
    };
    for (const [key, value] of Object.entries(filterMap)) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    window.location.href = url.toString();
  });

  const totalAmount = settlementsData.value.settlements.reduce((sum, s) => sum + s.total_amount, 0);
  const pendingAmount = settlementsData.value.settlements.filter(s => s.status === 'pending').reduce((sum, s) => sum + s.total_amount, 0);

  const getMonthName = (monthNum: number) => months.find(m => m.value === String(monthNum))?.label || '';

  return (
    <main class="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <header class="mb-8 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700 rounded-xl shadow-sm p-6">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-center">
              <LuFileText class="h-8 w-8 text-teal-600 dark:text-teal-500 mr-3" />
              <div>
                <h1 class="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">Settlements</h1>
                <p class="text-slate-500 dark:text-slate-400 mt-1">Manage monthly payment settlements</p>
              </div>
            </div>
            <button onClick$={() => showAddModal.value = true} class="mt-4 sm:mt-0 inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all duration-200">
              <LuPlus class="mr-2 h-4 w-4" />
              Add Settlement
            </button>
          </div>
        </header>

        {/* Filters */}
        <div class="mb-6 bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4 border border-slate-100 dark:border-slate-700">
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label for="prof-filter" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Professional</label>
              <select id="prof-filter" bind:value={filtersProfessionalId} class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-2 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm transition-all">
                <option value="">All</option>
                {settlementsData.value.professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label for="month-filter" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Month</label>
              <select id="month-filter" bind:value={filtersMonth} class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-2 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm transition-all">
                <option value="">All</option>
                {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label for="year-filter" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Year</label>
              <select id="year-filter" bind:value={filtersYear} class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-2 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm transition-all">
                <option value="">All</option>
                {getYears().map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
              </select>
            </div>
            <div class="self-end">
              <button onClick$={applyFilters} class="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500">
                <LuFilter class="mr-2 h-4 w-4" />
                Apply
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-5 border border-slate-100 dark:border-slate-700">
                <h3 class="text-sm font-medium text-slate-500 dark:text-slate-400">Total Settlements</h3>
                <p class="text-2xl font-bold text-slate-800 dark:text-slate-200">{settlementsData.value.settlements.length}</p>
            </div>
            <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-5 border border-slate-100 dark:border-slate-700">
                <h3 class="text-sm font-medium text-slate-500 dark:text-slate-400">Pending Amount</h3>
                <p class="text-2xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(pendingAmount, 'USD')}</p>
            </div>
            <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-5 border border-slate-100 dark:border-slate-700">
                <h3 class="text-sm font-medium text-slate-500 dark:text-slate-400">Total Amount</h3>
                <p class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalAmount, 'USD')}</p>
            </div>
        </div>

        {/* Settlements Table */}
        <div class="bg-white dark:bg-slate-800 shadow-lg rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead class="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700">
                <tr>
                  <th class="px-6 py-4 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">Professional</th>
                  <th class="px-6 py-4 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">Period</th>
                  <th class="px-6 py-4 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">Amount</th>
                  <th class="px-6 py-4 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">Status</th>
                  <th class="px-6 py-4 text-right text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody class="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                {settlementsData.value.settlements.map((s) => (
                  <tr key={s.id} class="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all duration-200 group">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800 dark:text-slate-100">{s.professional_name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{getMonthName(s.month)} {s.year}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-800 dark:text-slate-100 font-semibold">{formatCurrency(s.total_amount, s.currency)}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span class={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${s.status === 'paid' ? 'bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 dark:from-emerald-900/30 dark:to-emerald-800/30 dark:text-emerald-400' : 'bg-gradient-to-r from-amber-50 to-amber-100 text-amber-700 dark:from-amber-900/30 dark:to-amber-800/30 dark:text-amber-400'}`}>
                        {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div class="flex justify-end space-x-2">
                        <Form action={updateStatusAction}>
                            <input type="hidden" name="id" value={s.id} />
                            <input type="hidden" name="status" value={s.status} />
                            <button type="submit" class="p-1.5 text-slate-600 dark:text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:text-teal-400 dark:hover:bg-teal-900/20 rounded-full transition-all" title={s.status === 'paid' ? 'Mark as Pending' : 'Mark as Paid'}>
                                {s.status === 'paid' ? <LuClock class="h-5 w-5" /> : <LuCheckCircle class="h-5 w-5" />}
                            </button>
                        </Form>
                        <Form action={deleteAction}>
                            <input type="hidden" name="id" value={s.id} />
                            <button type="submit" class="p-1.5 text-slate-600 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-full transition-all" title="Delete Settlement">
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
          {settlementsData.value.settlements.length === 0 && (
            <div class="px-6 py-12 text-center">
              <p class="text-slate-500 dark:text-slate-400 font-medium">No settlements found for the selected filters.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Settlement Modal */}
      {showAddModal.value && (
        <div class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div class="flex items-end sm:items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div class="fixed inset-0 bg-slate-700/70 dark:bg-slate-900/80 backdrop-blur-md transition-opacity" aria-hidden="true" onClick$={() => showAddModal.value = false}></div>
            <div class="inline-block align-bottom bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-xl text-left overflow-hidden shadow-2xl transform transition-all border border-slate-100/50 dark:border-slate-700/50 sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <Form action={addAction} onSubmitCompleted$={() => { if (addAction.value?.success) { showAddModal.value = false; } }}>
                <div class="px-6 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 class="text-xl leading-6 font-medium text-slate-800 dark:text-slate-100" id="modal-title">Add New Settlement</h3>
                  <div class="mt-4 space-y-4">
                    <div>
                      <label for="professionalId" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Professional</label>
                      <select name="professionalId" id="professionalId" bind:value={professionalId} class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm transition-all">
                        <option value="">Select a professional</option>
                        {settlementsData.value.professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      {addAction.value?.fieldErrors?.professionalId && <p class="text-red-500 text-sm mt-1">{addAction.value.fieldErrors.professionalId}</p>}
                    </div>
                    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label for="month" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Month</label>
                        <select name="month" id="month" bind:value={month} class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm transition-all">
                          {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label for="year" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Year</label>
                        <select name="year" id="year" bind:value={year} class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm transition-all">
                          {getYears().map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label for="totalAmount" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Total Amount</label>
                        <input type="number" name="totalAmount" id="totalAmount" bind:value={totalAmountSignal} class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm transition-all" />
                        {addAction.value?.fieldErrors?.totalAmount && <p class="text-red-500 text-sm mt-1">{addAction.value.fieldErrors.totalAmount}</p>}
                      </div>
                      <div>
                        <label for="currency" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Currency</label>
                        <select name="currency" id="currency" bind:value={currency} class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm transition-all">
                          <option>USD</option>
                          <option>EUR</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 px-6 py-4 sm:flex sm:flex-row-reverse">
                  <button type="submit" disabled={addAction.isRunning} class="w-full inline-flex justify-center items-center rounded-lg border border-transparent shadow-sm px-5 py-2.5 bg-gradient-to-r from-teal-500 to-teal-600 text-base font-medium text-white hover:from-teal-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 sm:ml-3 sm:w-auto sm:text-sm transition-all duration-200 disabled:opacity-50">
                    {addAction.isRunning ? <LuLoader2 class="animate-spin h-5 w-5 mr-2" /> : <LuSave class="h-5 w-5 mr-2" />}
                    Save Settlement
                  </button>
                  <button type="button" onClick$={() => showAddModal.value = false} class="mt-3 w-full inline-flex justify-center items-center rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm px-5 py-2.5 bg-white dark:bg-slate-800 text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-all duration-200">
                    <LuX class="h-5 w-5 mr-2" />
                    Cancel
                  </button>
                </div>
                {addAction.value?.success === false && (
                  <div class="p-4 bg-red-100 text-red-800 rounded-b-lg">
                    <LuAlertTriangle class="inline h-5 w-5 mr-2" />
                    {addAction.value.error}
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