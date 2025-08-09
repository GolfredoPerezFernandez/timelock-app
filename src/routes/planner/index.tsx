import { component$, useStore, $ } from '@builder.io/qwik';
import { routeLoader$ } from '@builder.io/qwik-city';
import { tursoClient } from '~/utils/turso';
import { LuCalendar, LuClock, LuFilter, LuDollarSign, LuChevronLeft, LuChevronRight } from '@qwikest/icons/lucide';
import { formatCurrency } from '~/utils/format';

interface PlannedPayment {
  id: number;
  professional_name: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid';
  due_date: string;
}

export const usePaymentPlannerLoader = routeLoader$(async (requestEvent) => {
  const db = tursoClient(requestEvent);
  const url = new URL(requestEvent.request.url);
  
  const today = new Date();
  const year = parseInt(url.searchParams.get('year') || today.getFullYear().toString());
  const month = parseInt(url.searchParams.get('month') || (today.getMonth() + 1).toString());

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0);
  const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

  const query = `
    SELECT 
      i.id,
      p.name as professional_name,
      i.amount,
      i.currency,
      i.status,
      i.issue_date as due_date
    FROM invoices i
    JOIN professionals p ON i.professional_id = p.id
    WHERE i.issue_date >= ? AND i.issue_date <= ?
    ORDER BY i.issue_date ASC
  `;
  
  const result = await db.execute({ sql: query, args: [startDate, endDateStr] });
  const payments = (result.rows as any[]).map(row => ({ ...row, amount: Number(row.amount) })) as PlannedPayment[];

  // --- Calendar Data Generation ---
  const daysInMonth = endDate.getDate();
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay(); // 0=Sun, 1=Mon...
  
  const calendarData: { day: number | null; payments: PlannedPayment[] }[] = [];

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarData.push({ day: null, payments: [] });
  }

  // Add days with their corresponding payments
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayPayments = payments.filter(p => p.due_date === dateStr);
    calendarData.push({ day, payments: dayPayments });
  }

  return {
    payments,
    calendarData,
    currentMonth: month,
    currentYear: year,
  };
});

export default component$(() => {
  const plannerData = usePaymentPlannerLoader();
  
  const filters = useStore({
    month: plannerData.value.currentMonth,
    year: plannerData.value.currentYear,
  });

  const totalAmount = plannerData.value.payments.reduce((sum, p) => sum + p.amount, 0);
  const pendingAmount = plannerData.value.payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);

  const navigate = $((direction: 'prev' | 'next') => {
    let newMonth = filters.month;
    let newYear = filters.year;

    if (direction === 'prev') {
      newMonth--;
      if (newMonth < 1) {
        newMonth = 12;
        newYear--;
      }
    } else {
      newMonth++;
      if (newMonth > 12) {
        newMonth = 1;
        newYear++;
      }
    }
    
    const url = new URL(window.location.href);
    url.searchParams.set('month', String(newMonth));
    url.searchParams.set('year', String(newYear));
    window.location.href = url.toString();
  });

  const getMonthName = (monthNum: number) => {
    return new Date(filters.year, monthNum - 1, 1).toLocaleString('en-US', { month: 'long' });
  };

  const getDayClass = (day: number | null, payments: PlannedPayment[]) => {
    if (day === null) return 'bg-slate-50 dark:bg-slate-800/50 opacity-50';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cellDate = new Date(filters.year, filters.month - 1, day);

    let baseClass = 'bg-white dark:bg-slate-800';
    if (cellDate.getTime() < today.getTime()) baseClass = 'bg-slate-100 dark:bg-slate-800/70';
    if (cellDate.getTime() === today.getTime()) baseClass = 'bg-teal-50 dark:bg-teal-900/30 border-teal-400 dark:border-teal-600';

    const hasPending = payments.some(p => p.status === 'pending');
    const hasPaid = payments.some(p => p.status === 'paid');

    if (hasPending) return `${baseClass} border-l-4 border-amber-400 dark:border-amber-500`;
    if (hasPaid) return `${baseClass} border-l-4 border-emerald-400 dark:border-emerald-500`;
    
    return baseClass;
  };

  return (
    <main class="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <header class="mb-8 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700 rounded-xl shadow-sm p-6">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-center">
              <LuCalendar class="h-8 w-8 text-teal-600 dark:text-teal-500 mr-3" />
              <div>
                <h1 class="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">
                  Payment Planner
                </h1>
                <p class="text-slate-500 dark:text-slate-400 mt-1">
                  Visualize your monthly financial commitments
                </p>
              </div>
            </div>
            <div class="flex items-center space-x-2 mt-4 sm:mt-0">
              <div class="inline-flex items-center space-x-1.5 text-xs">
                <span class="w-3 h-3 inline-block bg-amber-400 rounded-full"></span>
                <span class="text-slate-600 dark:text-slate-300">Pending</span>
              </div>
              <div class="inline-flex items-center space-x-1.5 text-xs">
                <span class="w-3 h-3 inline-block bg-emerald-400 rounded-full"></span>
                <span class="text-slate-600 dark:text-slate-300">Paid</span>
              </div>
            </div>
          </div>
        </header>

        {/* Summary Cards */}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-5 border border-slate-100 dark:border-slate-700">
                <h3 class="text-sm font-medium text-slate-500 dark:text-slate-400">Total Payments This Month</h3>
                <p class="text-2xl font-bold text-slate-800 dark:text-slate-200">{plannerData.value.payments.length}</p>
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

        {/* Calendar */}
        <div class="bg-white dark:bg-slate-800 shadow-lg rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
          <div class="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
            <button onClick$={() => navigate('prev')} class="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <LuChevronLeft class="h-5 w-5 text-slate-600 dark:text-slate-300" />
            </button>
            <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {getMonthName(filters.month)} {filters.year}
            </h2>
            <button onClick$={() => navigate('next')} class="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <LuChevronRight class="h-5 w-5 text-slate-600 dark:text-slate-300" />
            </button>
          </div>
          
          <div class="grid grid-cols-7">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} class="p-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400 border-b border-r border-slate-100 dark:border-slate-700">
                {day}
              </div>
            ))}
            
            {plannerData.value.calendarData.map((dayData, index) => (
              <div 
                key={index}
                class={`p-2 border-b border-r border-slate-100 dark:border-slate-700 min-h-[120px] transition-colors duration-300 ${getDayClass(dayData.day, dayData.payments)}`}
              >
                {dayData.day !== null && (
                  <div class="text-sm font-semibold text-slate-700 dark:text-slate-200">{dayData.day}</div>
                )}
                
                <div class="mt-1 space-y-1">
                  {dayData.payments.map((payment) => (
                    <div 
                      key={payment.id} 
                      class={`text-xs p-1.5 rounded-lg shadow-sm ${
                        payment.status === 'paid' 
                          ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' 
                          : 'bg-amber-50 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                      }`}
                      title={`${payment.professional_name}: ${formatCurrency(payment.amount, payment.currency)}`}
                    >
                      <div class="font-bold truncate">{payment.professional_name}</div>
                      <div class="font-medium">{formatCurrency(payment.amount, payment.currency)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
});