import { component$, useStore, $ } from '@builder.io/qwik';
import { server$ } from '@builder.io/qwik-city';
import { routeLoader$, useNavigate } from '@builder.io/qwik-city';
import { tursoClient } from '~/utils/turso';
import { LuCalendar, LuClock, LuFilter, LuDollarSign, LuChevronLeft, LuChevronRight } from '@qwikest/icons/lucide';
import { formatCurrency } from '~/utils/format';
import { useSignal, useTask$ } from '@builder.io/qwik';

type PlannedLock = {
  id: number;
  invoice_id?: string;
  token?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'released';
  release_date: string;
  recipient?: string;
  professional_name: string;
  email?: string;
};

// --- server$ para borrar timelocks ---
export const deleteTimelockQrl = server$(async function (id: number) {
  const db = tursoClient(this as any);
  await db.execute({ sql: 'DELETE FROM timelocks WHERE id = ?', args: [id] });
  return { success: true };
});

export const deleteAllTimelocksQrl = server$(async function () {
  const db = tursoClient(this as any);
  await db.execute({ sql: 'DELETE FROM timelocks', args: [] });
  return { success: true };
});

export const usePaymentPlannerLoader = routeLoader$(async (requestEvent) => {
  const db = tursoClient(requestEvent);
  const url = new URL(requestEvent.request.url);

  const today = new Date();
  const year = parseInt(url.searchParams.get('year') || today.getFullYear().toString());
  const month = parseInt(url.searchParams.get('month') || (today.getMonth() + 1).toString());

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0);
  const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

  // Solo mostrar locks con invoice asociada y datos de la factura
  // Query y estructura igual a settlements, pero filtrando por mes/año
  const query = `
    SELECT t.id, t.payment_id, t.invoice_id as facturaId, t.release_timestamp, t.status,
           i.invoice_url, i.amount, i.currency, i.status as invoice_status,
           prof.name, prof.email, prof.wallet,
           c.contract_url, c.id as contract_id
    FROM timelocks t
    LEFT JOIN invoices i ON t.invoice_id = i.id
    LEFT JOIN professionals prof ON i.professional_id = prof.id
    LEFT JOIN contracts c ON i.contract_id = c.id
    WHERE t.release_timestamp >= ? AND t.release_timestamp <= ?
    ORDER BY t.release_timestamp ASC
  `;
  const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
  const endTimestamp = Math.floor(new Date(endDateStr + 'T23:59:59').getTime() / 1000);
  const result = await db.execute({ sql: query, args: [startTimestamp, endTimestamp] });

  // Mapeo igual que settlements
  const locks: PlannedLock[] = (result.rows as any[]).map((row: any) => {
    let status: 'pending' | 'released' = 'pending';
    if (row.invoice_status === 'paid' || row.status === 'released') {
      status = 'released';
    }
    return {
      id: row.id,
      token: row.payment_id,
      invoice_id: row.facturaId,
      amount: Number(row.amount),
      currency: row.currency,
      status,
      release_date: new Date(Number(row.release_timestamp) * 1000).toISOString().split('T')[0],
      recipient: row.wallet,
      professional_name: row.name,
      email: row.email,
      contract_id: row.contract_id,
      contract_url: row.contract_url,
      invoice_url: row.invoice_url
    };
  });

  // --- Calendar Data Generation ---
  const daysInMonth = endDate.getDate();
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
  const calendarData: { day: number | null; locks: PlannedLock[] }[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarData.push({ day: null, locks: [] });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayLocks = locks.filter((l: PlannedLock) => l.release_date === dateStr);
    calendarData.push({ day, locks: dayLocks });
  }
  return {
    locks,
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
    currency: '',
    status: '',
  });

  // Vista: 'month' o 'week'
  const viewMode = useSignal<'month' | 'week'>('month');
  // Semana seleccionada (1 = primera semana del mes)
  const selectedWeek = useSignal<number>(1);

  // Opciones de filtros
  // --- Control de admin ---
  // Aquí deberías obtener el estado de autenticación y rol del usuario
  // Ejemplo: const isAdmin = useAuth().user?.role === 'admin';
  // Para demo, lo dejamos en true
  const isAdmin: boolean = true;

  // Signal para forzar recarga local tras borrar
  const refreshSignal = useSignal(0);

  const months: { value: number; label: string }[] = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' }, { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' }, { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
  ];
  const years: { value: string; label: string }[] = Array.from({ length: 6 }, (_, i) => {
    const y = new Date().getFullYear() - 3 + i;
    return { value: y.toString(), label: y.toString() };
  });

  // Handler para borrar uno
  const handleDelete = $(async (id: number) => {
    await deleteTimelockQrl(id);
    refreshSignal.value++;
  });
  // Filtro reactivo
  const filteredLocks = useSignal<PlannedLock[]>(plannerData.value.locks);

  useTask$(({ track }) => {
    track(() => filters.month);
    track(() => filters.year);
    track(() => filters.currency);
    track(() => filters.status);
    track(() => refreshSignal.value);

    filteredLocks.value = plannerData.value.locks.filter(lock => {
      const lockMonth = Number(lock.release_date.split('-')[1]);
      const lockYear = Number(lock.release_date.split('-')[0]);
      const currencyMatch = !filters.currency || lock.currency === filters.currency;
      const statusMatch = !filters.status || lock.status === filters.status;
      return (
        lockMonth === Number(filters.month) &&
        lockYear === Number(filters.year) &&
        currencyMatch &&
        statusMatch
      );
    });
  });

  // --- Calendar Data ---
  // Solo días con locks reales
  const calendarData: { day: number | null; locks: PlannedLock[] }[] = [];
  const locksByDay: Record<string, PlannedLock[]> = {};
  filteredLocks.value.forEach(lock => {
    const day = Number(lock.release_date.split('-')[2]);
    if (!locksByDay[day]) locksByDay[day] = [];
    locksByDay[day].push(lock);
  });
  // Generar grid mensual (tipo calendario)
  const year = filters.year;
  const month = filters.month;
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay(); // 0=Dom, 1=Lun
  const daysInMonth = new Date(year, month, 0).getDate();
  // Ajustar para que la semana inicie en lunes
  const offset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  for (let i = 0; i < offset; i++) {
    calendarData.push({ day: null, locks: [] });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarData.push({ day, locks: locksByDay[day] || [] });
  }
  // Rellenar hasta completar la última semana (42 celdas máximo)
  while (calendarData.length % 7 !== 0) {
    calendarData.push({ day: null, locks: [] });
  }

  // --- Week Data ---
  // Agrupar por semana (semana inicia lunes)
  const getWeeksInMonth = (year: number, month: number) => {
    const weeks: { week: number; days: { day: number; locks: PlannedLock[] }[] }[] = [];
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    let weekNum = 1;
    let weekDays: { day: number; locks: PlannedLock[] }[] = [];
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month - 1, d);
      const dayOfWeek = date.getDay(); // 0=Dom, 1=Lun, ...
      const locks = locksByDay[d] || [];
      weekDays.push({ day: d, locks });
      // Si es domingo o último día del mes, termina la semana
      if (dayOfWeek === 0 || d === lastDay.getDate()) {
        weeks.push({ week: weekNum, days: weekDays });
        weekNum++;
        weekDays = [];
      }
    }
    return weeks;
  };
  const weeks = getWeeksInMonth(filters.year, filters.month);

  // Agrupar montos por moneda
  const getTotalsByCurrency = (locks: PlannedLock[], status?: 'pending' | 'released') => {
    const totals: Record<string, number> = {};
    locks.forEach(l => {
      if (status && l.status !== status) return;
      const curr = l.currency || 'USD';
      totals[curr] = (totals[curr] || 0) + l.amount;
    });
    return totals;
  };
  const totalAmounts = getTotalsByCurrency(filteredLocks.value);
  const pendingAmounts = getTotalsByCurrency(filteredLocks.value, 'pending');

  const navigate = $((direction: 'prev' | 'next') => {
    let newMonth = Number(filters.month);
    let newYear = Number(filters.year);
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
    filters.month = newMonth;
    filters.year = newYear;
    selectedWeek.value = 1;
  });

  const getMonthName = (monthNum: number) => {
    return months.find(m => m.value === monthNum)?.label || '';
  };

  const getDayClass = (day: number | null, locks: PlannedLock[]) => {
    if (day === null) return 'bg-slate-50 dark:bg-slate-800/50 opacity-50';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cellDate = new Date(filters.year, filters.month - 1, day || 1);
    let baseClass = 'bg-white dark:bg-slate-800';
    if (cellDate.getTime() < today.getTime()) baseClass = 'bg-slate-100 dark:bg-slate-800/70';
    if (cellDate.getTime() === today.getTime()) baseClass = 'bg-teal-50 dark:bg-teal-900/30 border-teal-400 dark:border-teal-600';
    const hasPending = locks.some((l: PlannedLock) => l.status === 'pending');
    const hasReleased = locks.some((l: PlannedLock) => l.status === 'released');
    if (hasPending) return `${baseClass} border-l-4 border-amber-400 dark:border-amber-500`;
    if (hasReleased) return `${baseClass} border-l-4 border-emerald-400 dark:border-emerald-500`;
    return baseClass;
  };
  const handleDeleteAll = $(async () => {
    await deleteAllTimelocksQrl();
    refreshSignal.value++;
  });

  // --- Render ---
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
                  Locks Planner
                </h1>
                <p class="text-slate-500 dark:text-slate-400 mt-1">
                  Visualiza los pagos automatizados (locks) del mes
                </p>
              </div>
            </div>
            <div class="flex items-center space-x-2 mt-4 sm:mt-0">
              <div class="inline-flex items-center space-x-1.5 text-xs">
                <span class="w-3 h-3 inline-block bg-amber-400 rounded-full"></span>
                <span class="text-slate-600 dark:text-slate-300">Pendiente</span>
              </div>
              <div class="inline-flex items-center space-x-1.5 text-xs">
                <span class="w-3 h-3 inline-block bg-emerald-400 rounded-full"></span>
                <span class="text-slate-600 dark:text-slate-300">Liberado</span>
              </div>
            </div>
          </div>
        </header>

        {/* Filtros */}
        <div class="flex flex-wrap gap-3 mb-6">
          <select
            value={filters.month}
            onChange$={e => filters.month = Number((e.target as HTMLSelectElement).value)}
            class="px-2 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select
            value={filters.year.toString()}
            onChange$={e => filters.year = Number((e.target as HTMLSelectElement).value)}
            class="px-2 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            {years.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
          </select>
          <select
            value={filters.currency}
            onChange$={e => filters.currency = (e.target as HTMLSelectElement).value}
            class="px-2 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            <option value="">Moneda</option>
            <option value="USDC">USDC</option>
            <option value="USDT">USDT</option>
            <option value="DAI">DAI</option>
            <option value="KNRT">KNRT</option>
          </select>
          <select
            value={filters.status}
            onChange$={e => filters.status = (e.target as HTMLSelectElement).value}
            class="px-2 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            <option value="">Estado</option>
            <option value="pending">Pendiente</option>
            <option value="released">Liberado</option>
          </select>
        </div>

        {/* Botones de vista calendario y borrar todos */}
        <div class="flex gap-2 mb-6 items-center">
          <button
            class={`px-4 py-2 rounded-lg font-semibold border transition-colors ${viewMode.value === 'month' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'}`}
            onClick$={() => viewMode.value = 'month'}
          >
            Vista Mensual
          </button>
          <button
            class={`px-4 py-2 rounded-lg font-semibold border transition-colors ${viewMode.value === 'week' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'}`}
            onClick$={() => viewMode.value = 'week'}
          >
            Vista Semanal
          </button>
          <button
            class="ml-auto px-4 py-2 rounded-lg font-semibold border border-red-500 bg-red-500 text-white hover:bg-red-600 transition-colors"
            onClick$={handleDeleteAll}
            title="Borrar todos los timelocks"
          >
            Borrar todos
          </button>
        </div>

        {/* Summary Cards */}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-5 border border-slate-100 dark:border-slate-700">
            <h3 class="text-sm font-medium text-slate-500 dark:text-slate-400">Total Locks Este Mes</h3>
            <p class="text-2xl font-bold text-slate-800 dark:text-slate-200">{filteredLocks.value.length}</p>
          </div>
          <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-5 border border-slate-100 dark:border-slate-700">
            <h3 class="text-sm font-medium text-slate-500 dark:text-slate-400">Monto Pendiente</h3>
            <div>
              {Object.entries(pendingAmounts).map(([curr, amt]) => (
                <span key={curr} class="block text-amber-600 dark:text-amber-400 text-lg font-bold">
                  {amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {curr}
                </span>
              ))}
              {Object.keys(pendingAmounts).length === 0 && (
                <span class="text-amber-600 dark:text-amber-400 text-lg font-bold">0,00 USD</span>
              )}
            </div>
          </div>
          <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-5 border border-slate-100 dark:border-slate-700">
            <h3 class="text-sm font-medium text-slate-500 dark:text-slate-400">Monto Total</h3>
            <div>
              {Object.entries(totalAmounts).map(([curr, amt]) => (
                <span key={curr} class="block text-emerald-600 dark:text-emerald-400 text-lg font-bold">
                  {amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {curr}
                </span>
              ))}
              {Object.keys(totalAmounts).length === 0 && (
                <span class="text-emerald-600 dark:text-emerald-400 text-lg font-bold">0,00 USD</span>
              )}
            </div>
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
          {/* Vista mensual o semanal */}
          {viewMode.value === 'month' ? (
            <div class="overflow-x-auto">
              <div class="grid grid-cols-7 bg-slate-100 dark:bg-slate-900 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <div class="p-2 text-center">Lun</div>
                <div class="p-2 text-center">Mar</div>
                <div class="p-2 text-center">Mié</div>
                <div class="p-2 text-center">Jue</div>
                <div class="p-2 text-center">Vie</div>
                <div class="p-2 text-center">Sáb</div>
                <div class="p-2 text-center">Dom</div>
              </div>
              <div class="grid grid-cols-7">
                {calendarData.map((dayData, index) => (
                  <div
                    key={index}
                    class={`h-32 sm:h-36 md:h-40 border border-slate-100 dark:border-slate-700 p-2 align-top transition-colors duration-300 ${getDayClass(dayData.day, dayData.locks)}`}
                  >
                    <div class="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                      {dayData.day ? dayData.day : ''}
                    </div>
                    <div class="space-y-1">
                      {dayData.locks.map((lock: PlannedLock) => (
                        <div
                          key={lock.id}
                          class={`text-[10px] p-1 rounded shadow-sm ${
                            lock.status === 'released'
                              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                              : 'bg-amber-50 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                          }`}
                          title={`Token: ${lock.token || ''}\nMonto: ${lock.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${lock.currency || 'USD'}\nFecha: ${lock.release_date}\nEstado: ${lock.status}\nDestinatario: ${lock.recipient || ''}\nProfesional: ${lock.professional_name}\nEmail: ${lock.email || ''}`}
                        >
                          <div class="font-bold truncate">{lock.professional_name}</div>
                          <div class="font-medium">{lock.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {lock.currency || 'USD'}</div>
                          <button
                            class="mt-1 px-2 py-0.5 rounded text-xs bg-red-500 text-white hover:bg-red-600"
                            onClick$={() => handleDelete(lock.id)}
                            title="Borrar este timelock"
                          >
                            Borrar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {calendarData.filter(d => d.day !== null).length === 0 && (
                <div class="p-4 text-center text-slate-400">No hay locks creados este mes.</div>
              )}
            </div>
          ) : (
            <div class="p-4">
              <div class="flex gap-2 mb-4 flex-wrap">
                {weeks.map(w => (
                  <button
                    key={w.week}
                    class={`px-3 py-1 rounded border font-semibold text-xs transition-colors ${selectedWeek.value === w.week ? 'bg-teal-600 text-white border-teal-600' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'}`}
                    onClick$={() => selectedWeek.value = w.week}
                  >
                    Semana {w.week}
                  </button>
                ))}
                <button
                  class="ml-auto px-4 py-2 rounded-lg font-semibold border border-red-500 bg-red-500 text-white hover:bg-red-600 transition-colors"
                  onClick$={handleDeleteAll}
                  title="Borrar todos los timelocks"
                >
                  Borrar todos
                </button>
              </div>
              {/* Días de la semana seleccionada */}
              {weeks.find(w => w.week === selectedWeek.value)?.days.length === 0 && (
                <div class="p-4 text-center text-slate-400">No hay locks esta semana.</div>
              )}
              {weeks.find(w => w.week === selectedWeek.value)?.days.map((dayData, index) => (
                <div 
                  key={index}
                  class={`p-4 border-b border-slate-100 dark:border-slate-700 min-h-[120px] transition-colors duration-300 ${getDayClass(dayData.day, dayData.locks)}`}
                >
                  <div class="text-sm font-semibold text-slate-700 dark:text-slate-200">Día {dayData.day}</div>
                  <div class="mt-2 space-y-2">
                    {dayData.locks.map((lock: PlannedLock) => (
                      <div 
                        key={lock.id} 
                        class={`text-xs p-2 rounded-lg shadow-sm ${
                          lock.status === 'released' 
                            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' 
                            : 'bg-amber-50 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                        }`}
                        title={`Token: ${lock.token || ''}\nMonto: ${lock.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${lock.currency || 'USD'}\nFecha: ${lock.release_date}\nEstado: ${lock.status}\nDestinatario: ${lock.recipient || ''}\nProfesional: ${lock.professional_name}\nEmail: ${lock.email || ''}`}
                      >
                        <div class="font-bold truncate">{lock.professional_name}</div>
                        <div class="font-medium">{lock.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {lock.currency || 'USD'}</div>
                        <div class="text-xs text-slate-500">{lock.token ? `Token: ${lock.token}` : ''}</div>
                        <div class="text-xs text-slate-500">{lock.recipient ? `Wallet: ${lock.recipient}` : ''}</div>
                        <div class="text-xs text-slate-500">{lock.email ? lock.email : ''}</div>
                        <button
                          class="mt-1 px-2 py-0.5 rounded text-xs bg-red-500 text-white hover:bg-red-600"
                          onClick$={() => handleDelete(lock.id)}
                          title="Borrar este timelock"
                        >
                          Borrar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
});