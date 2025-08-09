import { component$, useSignal, $ } from '@builder.io/qwik';
import { routeLoader$, useLocation } from '@builder.io/qwik-city';
import { tursoClient, runMigrations } from '~/utils/turso';
import { LuUsers, LuFileText, LuBriefcase, LuDollarSign, LuAlertCircle, LuClock, LuTrendingUp } from '@qwikest/icons/lucide';

// Dashboard data loader
export const useDashboardDataLoader = routeLoader$(async (requestEvent) => {
  // Ensure DB migrations are always run before any queries
  await runMigrations(requestEvent);
  const db = tursoClient(requestEvent);
  try {
    // Get counts and summary data
    const professionals = await db.execute("SELECT COUNT(*) as count FROM professionals");
    const activeContracts = await db.execute("SELECT COUNT(*) as count FROM contracts WHERE status = 'active'");
    const pendingInvoices = await db.execute("SELECT COUNT(*) as count, SUM(amount) as total FROM invoices WHERE status = 'pending'");
    const upcomingPayments = await db.execute({
      sql: `
        SELECT COUNT(*) as count 
        FROM payments 
        WHERE status = 'scheduled' AND payment_date BETWEEN date('now') AND date('now', '+7 days')
      `,
      args: []
    });
    const totalSettled = await db.execute("SELECT SUM(total_in_knrt) as total FROM settlements WHERE status = 'paid'");
    const recentProfessionals = await db.execute({
      sql: `
        SELECT id, name, role, created_at 
        FROM professionals 
        ORDER BY created_at DESC 
        LIMIT 5
      `,
      args: []
    });
    const recentInvoices = await db.execute({
      sql: `
        SELECT 
          i.id, 
          i.amount, 
          i.currency, 
          i.status, 
          i.issue_date, 
          p.name as professional_name 
        FROM invoices i
        JOIN professionals p ON i.professional_id = p.id
        ORDER BY i.created_at DESC 
        LIMIT 5
      `,
      args: []
    });
    // Return the dashboard data
    return {
      professionals: professionals.rows[0]?.count || 0,
      activeContracts: activeContracts.rows[0]?.count || 0,
      pendingInvoices: {
        count: pendingInvoices.rows[0]?.count || 0,
        total: pendingInvoices.rows[0]?.total || 0
      },
      upcomingPayments: upcomingPayments.rows[0]?.count || 0,
      totalSettled: totalSettled.rows[0]?.total || 0,
      recentProfessionals: recentProfessionals.rows || [],
      recentInvoices: recentInvoices.rows || []
    };
  } catch (error) {
    console.error('Dashboard data loading error:', error);
    // Return placeholder data if there's an error
    return {
      professionals: 0,
      activeContracts: 0,
      pendingInvoices: { count: 0, total: 0 },
      upcomingPayments: 0,
      totalSettled: 0,
      recentProfessionals: [],
      recentInvoices: []
    };
  }
});

export default component$(() => {
  const dashboardData = useDashboardDataLoader();
  const location = useLocation();

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const formatCurrency = $((amount: number, currencyCode = 'USD') => {
    const isKNRT = currencyCode === 'KNRT';
    const displayCurrency = isKNRT ? 'USD' : currencyCode;
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: displayCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return isKNRT ? `${formatted} KNRT` : formatted;
  });

  // Use numbers for stats, and call formatCurrency in JSX
  const dashboardStats = {
    totalProfessionals: Number(dashboardData.value.professionals) || 0,
    activeContracts: Number(dashboardData.value.activeContracts) || 0,
    pendingInvoices: Number(dashboardData.value.pendingInvoices?.count) || 0,
    upcomingPayments: Number(dashboardData.value.upcomingPayments) || 0,
    totalSettled: Number(dashboardData.value.totalSettled) || 0,
    pendingAmount: Number(dashboardData.value.pendingInvoices?.total) || 0
  };

  return (
    <div class="min-h-screen bg-white dark:bg-slate-900 flex flex-col">
      <div class="container mx-auto px-4 py-8 flex-1 flex flex-col">
        {/* Dashboard header */}
        <header class="mb-8 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700 rounded-xl shadow-sm p-6">
          <h1 class="text-2xl md:text-3xl font-bold mb-2 text-slate-800 dark:text-slate-100">Dashboard</h1>
          <p class="text-sm md:text-base text-slate-500 dark:text-slate-400">{currentDate}</p>
        </header>

        {/* Stats Grid */}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Professionals */}
          <div class="bg-white dark:bg-slate-800 rounded-xl shadow-elegant p-6 border border-slate-100 dark:border-slate-700 transition-all hover:shadow-elegant-lg">
            <div class="flex justify-between items-center">
              <div>
                <p class="text-sm font-medium text-slate-500 dark:text-slate-400">Total Professionals</p>
                <p class="text-2xl font-bold mt-1 text-slate-800 dark:text-slate-100">{dashboardStats.totalProfessionals}</p>
              </div>
              <div class="w-12 h-12 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-slate-700 dark:text-slate-300 shadow-sm">
                <LuUsers class="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Active Contracts */}
          <div class="bg-white dark:bg-slate-800 rounded-xl shadow-elegant p-6 border border-slate-100 dark:border-slate-700 transition-all hover:shadow-elegant-lg">
            <div class="flex justify-between items-center">
              <div>
                <p class="text-sm font-medium text-slate-500 dark:text-slate-400">Active Contracts</p>
                <p class="text-2xl font-bold mt-1 text-slate-800 dark:text-slate-100">{dashboardStats.activeContracts}</p>
              </div>
              <div class="w-12 h-12 rounded-full bg-gradient-to-br from-teal-100 to-teal-200 dark:from-teal-800/30 dark:to-teal-700/30 flex items-center justify-center text-teal-600 dark:text-teal-400 shadow-sm">
                <LuBriefcase class="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Pending Invoices */}
          <div class="bg-white dark:bg-slate-800 rounded-xl shadow-elegant p-6 border border-slate-100 dark:border-slate-700 transition-all hover:shadow-elegant-lg">
            <div class="flex justify-between items-center">
              <div>
                <p class="text-sm font-medium text-slate-500 dark:text-slate-400">Pending Invoices</p>
                <p class="text-2xl font-bold mt-1 text-slate-800 dark:text-slate-100">{dashboardStats.pendingInvoices}</p>
              </div>
              <div class="w-12 h-12 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-800/30 dark:to-amber-700/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-sm">
                <LuFileText class="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Upcoming Payments */}
          <div class="bg-white dark:bg-slate-800 rounded-xl shadow-elegant p-6 border border-slate-100 dark:border-slate-700 transition-all hover:shadow-elegant-lg">
            <div class="flex justify-between items-center">
              <div>
                <p class="text-sm font-medium text-slate-500 dark:text-slate-400">Upcoming Payments</p>
                <p class="text-2xl font-bold mt-1 text-slate-800 dark:text-slate-100">{dashboardStats.upcomingPayments}</p>
              </div>
              <div class="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-100 to-indigo-200 dark:from-indigo-800/30 dark:to-indigo-700/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm">
                <LuClock class="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Financial overview card */}
          <div class="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-elegant p-6 border border-slate-100 dark:border-slate-700">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100">Financial Summary</h2>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p class="text-sm font-medium text-slate-500 dark:text-slate-400">Total Settled</p>
                <div class="flex items-center mt-2">
                  <span class="text-2xl font-bold text-slate-800 dark:text-slate-100">{formatCurrency(dashboardStats.totalSettled, 'KNRT')}</span>
                </div>
              </div>
              <div>
                <p class="text-sm font-medium text-slate-500 dark:text-slate-400">Pending Amount</p>
                <div class="flex items-center mt-2">
                  <span class="text-2xl font-bold text-slate-800 dark:text-slate-100">{formatCurrency(dashboardStats.pendingAmount, 'KNRT')}</span>
                </div>
              </div>
            </div>
            
            {/* Chart placeholder */}
            <div class="mt-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700/50 dark:to-slate-800/50 rounded-lg h-48 flex items-center justify-center shadow-elegant-sm">
              <p class="text-slate-500 dark:text-slate-400 text-sm font-medium">Monthly payments chart</p>
            </div>
          </div>
          
          {/* Recent Professionals card */}
          <div class="bg-white dark:bg-slate-800 rounded-xl shadow-elegant p-6 border border-slate-100 dark:border-slate-700">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100">Recent Professionals</h2>
            </div>
            <div class="space-y-4">
              {dashboardData.value.recentProfessionals.length > 0 ? (
                dashboardData.value.recentProfessionals.map((pro: any) => (
                  <div key={pro.id} class="flex items-center p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors">
                    <div class="w-10 h-10 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-slate-700 dark:text-slate-300 shadow-sm">
                      {pro.name.charAt(0).toUpperCase()}
                    </div>
                    <div class="ml-3">
                      <p class="font-medium text-sm text-slate-800 dark:text-slate-200">{pro.name}</p>
                      <p class="text-xs text-slate-500 dark:text-slate-400">{pro.role}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div class="text-center py-6 text-slate-500 dark:text-slate-400">
                  <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700/50 mb-3">
                    <LuUsers class="w-6 h-6 text-slate-400 dark:text-slate-500" />
                  </div>
                  <p>No professionals registered</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Invoices Table */}
        <div class="bg-white dark:bg-slate-800 rounded-xl shadow-elegant border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div class="p-6">
            <h2 class="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-100">Recent Invoices</h2>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="text-left bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800">
                  <th class="px-6 py-3 text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">Professional</th>
                  <th class="px-6 py-3 text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">Date</th>
                  <th class="px-6 py-3 text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">Amount</th>
                  <th class="px-6 py-3 text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                {dashboardData.value.recentInvoices.length > 0 ? (
                  dashboardData.value.recentInvoices.map((invoice: any) => (
                    <tr key={invoice.id}>
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">{invoice.professional_name}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{new Date(invoice.issue_date).toLocaleDateString()}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm">{new Intl.NumberFormat('es-ES', {
                        style: 'currency',
                        currency: invoice.currency === 'KNRT' ? 'USD' : invoice.currency
                      }).format(invoice.amount)} {invoice.currency === 'KNRT' ? 'KNRT' : ''}</td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span class={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                          invoice.status === 'paid' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                        }`}>
                          {invoice.status === 'paid' ? 'Pagado' : 'Pendiente'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} class="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                      <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700/50 mb-3">
                        <LuFileText class="w-6 h-6 text-slate-400 dark:text-slate-500" />
                      </div>
                      <p>No recent invoices</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
});
