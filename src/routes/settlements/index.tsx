// Removed duplicate imports. All necessary imports are below.
// Loader for Timelocks/Locks with pagination and joins
export const useLocksLoader = routeLoader$(async (requestEvent) => {
  // Ejecuta migraciones para asegurar que la columna invoice_id existe
  await runMigrations(requestEvent);
//  await runMigrations(requestEvent);
  const client = tursoClient(requestEvent);
  const session = await getSession(requestEvent);
  if (!session.isAuthenticated) {
    throw requestEvent.fail(401, { error: 'Unauthorized' });
  }
  const url = new URL(requestEvent.request.url);
  const page = Number(url.searchParams.get('locksPage') || 1);
  const limit = Number(url.searchParams.get('locksPerPage') || 10);
  const offset = (page - 1) * limit;

  // Query: join timelocks, invoices, professionals, contracts
  const sql = `
    SELECT t.id, t.payment_id, t.invoice_id as facturaId, t.release_timestamp, t.status,
           i.invoice_url, i.amount, i.currency, i.status as invoice_status,
           prof.name, prof.email, prof.wallet,
           c.contract_url, c.id as contract_id
    FROM timelocks t
    LEFT JOIN invoices i ON t.invoice_id = i.id
    LEFT JOIN professionals prof ON i.professional_id = prof.id
    LEFT JOIN contracts c ON i.contract_id = c.id
    ORDER BY t.id DESC
    LIMIT ? OFFSET ?`;
  const args = [limit, offset];
  const locksResult = await client.execute({ sql, args });

  // Get total count for pagination
  const countResult = await client.execute('SELECT COUNT(*) as total FROM payments');
  const total = countResult.rows[0]?.total || 0;

  // Obtener todos los profesionales con email y wallet
  const professionalsResult = await client.execute('SELECT id, name, email, wallet FROM professionals ORDER BY name');

  return {
    locks: locksResult.rows,
    total,
    page,
    limit,
    professionals: professionalsResult.rows
  };
});
import { component$, useSignal, useStore, $, useTask$, useVisibleTask$, isBrowser } from '@builder.io/qwik';
import { DateTime } from 'luxon';
import { routeLoader$, routeAction$, zod$,  } from '@builder.io/qwik-city';
import { z } from 'zod';
import { useTimelock } from '../hooks/usePropertyNft';
import { tursoClient, runMigrations } from '~/utils/turso';
import { getSession } from '~/utils/auth';
import { isAdmin } from '~/utils/isAdmin';
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
  LuDollarSign,
  LuRefreshCcw,
  LuKey,
  LuLock,
  LuWallet
} from '@qwikest/icons/lucide';
import { Payment } from '~/models/freelance';

// Helper to get token address by currency
function getTokenAddress(currency: string): `0x${string}` | undefined {
  switch (currency) {
    case 'USDC': return '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    case 'USDT': return '0xdAC17F958D2ee523a2206206994597C13D831ec7';
    case 'DAI': return '0x6B175474E89094C44Da98b954EedeAC495271d0F';
    case 'KNRT': {
      const knrt = import.meta.env.PUBLIC_KNRT_TOKEN?.replace(/"/g, "");
      return knrt && knrt.startsWith('0x') ? knrt as `0x${string}` : undefined;
    }
    default: return undefined;
  }
}

export const useAuthLoader = routeLoader$(async (event) => {
  const session = await getSession(event);
  if (!session?.isAuthenticated) {
    throw event.redirect(302, '/auth');
  }
  return session;
});

// Type Definitions
interface Professional {
  id: number;
  name: string;
  role?: string;
  email?: string | null;
  wallet?: string | null;
}
interface Contract {
  id: number;
  professional_id: number;
  professional_name: string;
  start_date: string;
  end_date: string | null;
  status: string;
  contract_url: string | null;
}
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

// Data Loader
export const usePaymentsLoader = routeLoader$(async (requestEvent) => {
  // DEBUG: Log de entrada
  console.log('[planner-auto] loader: requestEvent', {
    url: requestEvent.request.url
  });
//  await runMigrations(requestEvent);
  const session = await getSession(requestEvent);
  if (!session.isAuthenticated) {
    throw requestEvent.fail(401, { error: 'Unauthorized' });
  }
  const db = tursoClient(requestEvent);
  const url = new URL(requestEvent.request.url);
  const month = url.searchParams.get('month') || (new Date().getMonth() + 1).toString();
  const year = url.searchParams.get('year') || new Date().getFullYear().toString();

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(Number(year), Number(month), 0);
  const lastDay = endDate.getDate();
  const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  let sql = `
      SELECT p.id, p.professional_id, prof.name as professional_name, prof.wallet as professional_wallet,
             p.amount, p.currency, p.status, p.due_date, p.description, p.contract_id, c.id as contract_id, c.start_date, c.end_date, c.status as contract_status, c.contract_url
      FROM payments p
      JOIN professionals prof ON p.professional_id = prof.id
      LEFT JOIN contracts c ON p.contract_id = c.id
      WHERE p.due_date BETWEEN ? AND ?`;
  const args: any[] = [startDate, endDateStr];
  if (!isAdmin(session)) {
    // Solo mostrar pagos donde el email del profesional coincide con el del usuario
    sql += ' AND prof.email = ?';
    args.push(session.email);
  }
  sql += '\n      ORDER BY p.due_date ASC';
  const paymentsResult = await db.execute({ sql, args });

  const professionalsResult = await db.execute('SELECT id, name, wallet FROM professionals ORDER BY name');

  // Cargar todos los contratos activos
  const contractsResult = await db.execute(`
    SELECT c.id, c.professional_id, c.start_date, c.end_date, c.status, c.contract_url
    FROM contracts c
    WHERE c.status = 'active'
    ORDER BY c.start_date DESC
  `);

  const result = {
    payments: (paymentsResult.rows as any[]).map(r => ({...r, amount: Number(r.amount)})) as Payment[],
    professionals: professionalsResult.rows as unknown as Professional[],
    contracts: contractsResult.rows as any[],
    currentMonth: Number(month),
    currentYear: Number(year)
  };
  // DEBUG: Log de salida del loader
  console.log('[planner-auto] loader result', JSON.stringify(result, null, 2));
  return result;
});

// Loader: professionals, contracts, invoices grouped by professional
export const useSettlementsLoader = routeLoader$(async (requestEvent) => {
//  await runMigrations(requestEvent);
  const client = tursoClient(requestEvent);
  const session = await getSession(requestEvent);
  if (!session.isAuthenticated) {
    throw requestEvent.fail(401, { error: 'Unauthorized' });
  }
  // Professionals
  const professionalsResult = await client.execute('SELECT id, name, role, email, wallet FROM professionals ORDER BY name');
  const professionals = professionalsResult.rows as unknown as Professional[];
  // Active Contracts
  const contractsResult = await client.execute(`
    SELECT c.id, c.professional_id, p.name as professional_name, c.start_date, c.end_date, c.status, c.contract_url
    FROM contracts c
    JOIN professionals p ON c.professional_id = p.id
    WHERE c.status = 'active'
    ORDER BY p.name, c.start_date DESC
  `);
  const contracts = contractsResult.rows as unknown as Contract[];
  // Invoices
  let invoicesResult;
  if (isAdmin(session)) {
    invoicesResult = await client.execute(`
      SELECT i.id, i.professional_id, p.name as professional_name, i.contract_id, i.amount, i.currency, i.status, i.issue_date, i.paid_date, i.invoice_url, i.created_date 
      FROM invoices i
      JOIN professionals p ON i.professional_id = p.id
      ORDER BY i.created_date DESC
    `);
  } else {
    invoicesResult = await client.execute({
      sql: `SELECT i.id, i.professional_id, p.name as professional_name, i.contract_id, i.amount, i.currency, i.status, i.issue_date, i.paid_date, i.invoice_url, i.created_date 
            FROM invoices i
            JOIN professionals p ON i.professional_id = p.id
            WHERE p.email = ?
            ORDER BY i.created_date DESC`,
      args: [session.email]
    });
  }
  const invoices = (invoicesResult.rows as any[]).map(row => ({ ...row, amount: Number(row.amount) })) as Invoice[];
  return { professionals, contracts, invoices, session };
});

// Action to automate invoice payment (reuses logic from planner-auto)
export const useAutomateInvoicePayment = routeAction$(async (data, requestEvent) => {
  //await runMigrations(requestEvent);
  const client = tursoClient(requestEvent);
  const session = await getSession(requestEvent);
  if (!session.isAuthenticated || !session.userId) {
    return { success: false, error: 'Authentication required.' };
  }
  // Find invoice
  const invoiceRes = await client.execute({
    sql: 'SELECT * FROM invoices WHERE id = ?',
    args: [data.invoiceId]
  });
  if (!invoiceRes.rows.length) {
    return { success: false, error: 'Invoice not found.' };
  }
  const invoice = invoiceRes.rows[0] as unknown as Invoice;
  try {
    // Cambia el estado a 'paid' al automatizar el pago
    await client.execute({
      sql: 'UPDATE invoices SET status = ? WHERE id = ?',
      args: ['paid', data.invoiceId]
    });

    // Registrar el evento en settlements (opcional, si quieres dejar constancia)
    await client.execute({
      sql: 'INSERT INTO settlements (professional_id, user_id, month, year, total_amount, currency, status, payment_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [
        invoice.professional_id,
        session.userId,
        new Date(invoice.issue_date).getMonth() + 1,
        new Date(invoice.issue_date).getFullYear(),
        invoice.amount,
        invoice.currency,
        'paid',
        new Date().toISOString().split('T')[0]
      ]
    });

    // Guardar el lock en la DB con el invoice_id
    // release_timestamp: ahora + 1 día (ejemplo, puedes ajustar)
    const releaseTimestamp = Math.floor(Date.now() / 1000) + 24 * 3600;
    await client.execute({
      sql: 'INSERT INTO timelocks (payment_id, invoice_id, release_timestamp, status) VALUES (?, ?, ?, ?)',
      args: [data.invoiceId, data.invoiceId, data.releaseTimestamp ?? (Math.floor(Date.now() / 1000) + 24 * 3600), 'pending']
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to automate payment.' };
  }
}, zod$((z) => z.object({
  invoiceId: z.coerce.number().int().positive(),
  releaseTimestamp: z.coerce.number().int().positive().optional()
})));

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
  zod$((z) => z.object({
    professionalId: z.coerce.number(),
    month: z.coerce.number().min(1).max(12),
    year: z.coerce.number().min(2000).max(2100),
    totalAmount: z.coerce.number().positive(),
    currency: z.string().min(3),
  }))
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

  // --- Modal & Logic from planner-auto ---
  const showPlannerAutoLocks = useSignal(true);
  const locksList = useSignal<any[]>([]);
  
  // Pagination state
  const locksPage = useSignal(1);
  const locksPerPage = 10;
  const totalLocks = useSignal(0);
  // Loader usage (no args)
  const locksLoader = useLocksLoader();

  const fetchLocks = $(async () => {
    // Use loader data
    const data = locksLoader.value;
    locksList.value = data.locks;
    totalLocks.value = Number(data.total);
  });

  useVisibleTask$(({ track }) => {
  track(() => showPlannerAutoLocks.value);
  track(() => locksPage.value);
  if (showPlannerAutoLocks.value) fetchLocks();
  });

  const loader = useSettlementsLoader();
  const automateAction = useAutomateInvoicePayment();
  const searchQuery = useSignal('');
  const showAutomateModal = useSignal(false);
  const selectedInvoiceId = useSignal<number | null>(null);
  const automationError = useSignal<string>('');

  // Timelock integration
  const timelock = useTimelock();
  const timelockToken = useSignal('USDC');
  const timelockTimezone = useSignal(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const timelockWallet = useSignal('');
  const timelockAmount = useSignal(0);
  const timelockReleaseDate = useSignal(new Date(Date.now() + 24*3600*1000).toISOString().split('T')[0]); // default: tomorrow
  const timelockReleaseHour = useSignal<string>('10');
  const timelockReleaseMinute = useSignal<string>('0');
  const selectedContractId = useSignal('');

  // Advanced validation and display with timezone
  const nowUtc = useSignal<Date>(new Date());
  const selectedLocal = useSignal<Date>(new Date());
  const selectedUtc = useSignal<Date>(new Date());

  useVisibleTask$(({ track }) => {
    track(() => showAutomateModal.value); // Rerun when modal visibility changes

    const updateDateTime = () => {
        nowUtc.value = new Date();
        const tz = timelockTimezone.value;
        const dateStr = timelockReleaseDate.value;
        const hour = parseInt(timelockReleaseHour.value, 10);
        const minute = parseInt(timelockReleaseMinute.value, 10);

        let errorMsg = '';
        let dt = DateTime.now(); // Default value
        try {
            const [year, month, day] = dateStr.split('-').map(Number);
            const tempDt = DateTime.fromObject({ year, month, day, hour, minute }, { zone: tz || 'UTC' });
            if (!tempDt.isValid) {
              throw new Error(tempDt.invalidReason || 'Invalid date constructed');
            }
            dt = tempDt as typeof dt;
            selectedLocal.value = dt.toJSDate();
            selectedUtc.value = dt.toUTC().toJSDate();
            
            // Validation logic
            if (showAutomateModal.value) {
                const nowInZone = DateTime.now().setZone(tz || 'UTC');
                const minTime = nowInZone.plus({ minutes: 30 });
                if (dt < minTime) {
                    errorMsg = `Release time in ${tz} must be at least 30 minutes in the future.`;
                }
            }
        } catch(e) {
            errorMsg = 'Invalid date or time values.';
        }
        automationError.value = errorMsg;
    };

    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  });
  
  const timelockStatus = timelock.status;
  const timelockError = timelock.error;

  const selectedInvoice = $(() => loader.value.invoices.find(i => i.id === selectedInvoiceId.value));

  const executeTimelock = $(async () => {
    const tokenAddress = getTokenAddress(timelockToken.value);
    if (!tokenAddress) {
      timelockError.value = 'Unsupported token.';
      return;
    }
    if (!timelockWallet.value) {
      timelockError.value = 'Professional\'s wallet is required.';
      return;
    }
    if (automationError.value) {
      // If there's a validation error, do not proceed
      return;
    }
    // Calculate releaseTimestamp from the state signals
    const tz = timelockTimezone.value;
    const dateStr = timelockReleaseDate.value;
    const hour = parseInt(timelockReleaseHour.value, 10);
    const minute = parseInt(timelockReleaseMinute.value, 10);
    const [year, month, day] = dateStr.split('-').map(Number);
    const dt = DateTime.fromObject({ year, month, day, hour, minute }, { zone: tz || 'UTC' });
    const releaseTimestamp = Math.floor(dt.toSeconds());

    if (selectedInvoiceId.value == null) {
      timelockError.value = 'No se ha seleccionado una factura válida.';
      return;
    }
    try {
      await timelock.createLock(
        tokenAddress,
        timelockAmount.value.toString(),
        timelockWallet.value,
        timelockAmount.value.toString(),
        releaseTimestamp.toString(),
        selectedInvoiceId.value
      );
      // Solo si createLock fue exitoso, marcar como pagado
      if (selectedInvoiceId.value) {
        const result = await automateAction.submit({ invoiceId: selectedInvoiceId.value, releaseTimestamp });
        if (result.value?.success) {
          timelockStatus.value = 'Timelock creado y factura automatizada.';
          // Actualizar el estado local de la factura sin recargar
          const idx = loader.value.invoices.findIndex(i => i.id === selectedInvoiceId.value);
          if (idx !== -1) {
            loader.value.invoices[idx].status = 'paid';
          }
          closeAutomateModal();
        } else {
          timelockError.value = result.value?.error || 'Error al automatizar la factura.';
        }
      }
    } catch (e) {
      timelockError.value = (e as any)?.message || 'Error al crear el timelock en MetaMask.';
    }
  });

  // Filters for settlements
  const filterMonth = useSignal(String(new Date().getMonth() + 1));
  const filterYear = useSignal(String(new Date().getFullYear()));
  const filterCurrency = useSignal('');
  const filterStatus = useSignal('');
  const filteredProfessionals = useSignal<Professional[]>(loader.value.professionals);

  useTask$(({ track }) => {
    const query = track(() => searchQuery.value.trim().toLowerCase());
    const month = track(() => filterMonth.value);
    const year = track(() => filterYear.value);
    const currency = track(() => filterCurrency.value);
    const status = track(() => filterStatus.value);

    filteredProfessionals.value = loader.value.professionals.filter(prof => {
      let queryMatch = true;
      if (query) {
        queryMatch = prof.name.toLowerCase().includes(query) || (prof.email ?? '').toLowerCase().includes(query);
      }

      const professionalInvoices = loader.value.invoices.filter(i => i.professional_id === prof.id);
      if (professionalInvoices.length === 0 && (month || year || currency || status)) {
        return false;
      }
      
      const monthMatch = !month || professionalInvoices.some(i => String(new Date(i.issue_date).getUTCMonth() + 1) === month);
      const yearMatch = !year || professionalInvoices.some(i => String(new Date(i.issue_date).getUTCFullYear()) === year);
      const currencyMatch = !currency || professionalInvoices.some(i => i.currency === currency);
      const statusMatch = !status || professionalInvoices.some(i => i.status === status);
      
      return queryMatch && monthMatch && yearMatch && currencyMatch && statusMatch;
    });
  });

  const contractsByProfessional = (profId: number) => loader.value.contracts.filter(c => c.professional_id === profId);
  const invoicesByProfessional = (profId: number) => loader.value.invoices.filter(i => i.professional_id === profId);
  const isInvoiceAutomated = (invoiceId: number) => locksList.value.some(lock => lock.invoiceId === invoiceId);

  const openAutomateModal = $((invoiceId: number) => {
    selectedInvoiceId.value = invoiceId;
    const invoice = loader.value.invoices.find(i => i.id === invoiceId);
    if (!invoice) return;

    const professional = loader.value.professionals.find(p => p.id === invoice.professional_id);
    
    timelockToken.value = invoice.currency || 'USDC';
    timelockWallet.value = professional?.wallet || '';
    timelockAmount.value = invoice.amount || 0;
    timelockReleaseDate.value = new Date(Date.now() + 24*3600*1000).toISOString().split('T')[0];
    timelockReleaseHour.value = '10';
    timelockReleaseMinute.value = '0';
    selectedContractId.value = String(invoice.contract_id ?? '');
    showAutomateModal.value = true;
  });

  const closeAutomateModal = $(() => {
    showAutomateModal.value = false;
    selectedInvoiceId.value = null;
    timelockError.value = '';
    timelockStatus.value = '';
    automationError.value = '';
  });

  useTask$(({ track }) => {
    const status = track(() => timelockStatus.value);
    if (status && status.includes('Lock creado correctamente')) {
      closeAutomateModal();
      if (typeof window !== 'undefined') window.location.reload();
    }
  });
  
  // Formatear timestamp a fecha legible
  const formatTimestamp = (timestamp: bigint | number) => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };
  const loaderData = usePaymentsLoader();
  const showTimelockPanel = useSignal(false);
  const currentTimelockPayment = useSignal<Payment | null>(null);

  
    // Cargar locks existentes cuando se muestra el panel
    useVisibleTask$(({ track }) => {
      if (!isBrowser) return;
      track(() => showTimelockPanel.value);
      if (showTimelockPanel.value && timelock.address.value) {
        timelock.loadLocks().catch(console.error);
      }
    });
    
  return (
    <main class="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        <header class="mb-8 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700 rounded-xl shadow-sm p-6">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">Settlements Dashboard</h1>
            <div class="flex flex-col sm:flex-row items-center gap-3">
             <button 
                            onClick$={() => !timelock.address.value ? timelock.connect() : (showTimelockPanel.value = !showTimelockPanel.value)} 
                            class="inline-flex items-center px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium text-sm shadow-md hover:from-indigo-600 hover:to-purple-600 transition-all"
                          >
                            {timelock.address.value ? 
                              <><LuKey class="h-5 w-5 mr-2" /> {showTimelockPanel.value ? 'Ocultar Timelocks' : 'Ver Timelocks'}</> : 
                              <><LuWallet class="h-5 w-5 mr-2" /> Conectar Wallet</>
                            }
                          </button>
            </div>
          </div>
          <div class="mt-4 flex flex-wrap gap-3">
              <input
                type="text"
                bind:value={searchQuery}
                class="block w-full sm:w-64 pl-3 pr-3 py-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder-slate-400 shadow-sm hover:border-teal-400 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm transition-all duration-200"
                placeholder="Buscar profesional..."
              />
              <select bind:value={filterMonth} class="block w-full sm:w-auto pl-2 pr-8 py-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                <option value="">Mes</option>
                {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <select bind:value={filterYear} class="block w-full sm:w-auto pl-2 pr-8 py-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                <option value="">Año</option>
                {getYears().map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
              </select>
              <select bind:value={filterCurrency} class="block w-full sm:w-auto pl-2 pr-8 py-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                <option value="">Moneda</option>
                <option value="USDC">USDC</option>
                <option value="USDT">USDT</option>
                <option value="DAI">DAI</option>
                <option value="KNRT">KNRT</option>
              </select>
              <select bind:value={filterStatus} class="block w-full sm:w-auto pl-2 pr-8 py-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                <option value="">Estado</option>
                <option value="pending">Pendiente</option>
                <option value="paid">Pagado</option>
              </select>
          </div>
        </header>

        
                {/* Timelock Status Panel */}
                {timelock.address.value && showTimelockPanel.value && (
                  <div class="mb-8 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-xl shadow-md p-6 border border-indigo-100 dark:border-indigo-800/50">
                    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                      <div>
                        <div class="flex items-center">
                          <LuLock class="h-6 w-6 text-indigo-600 dark:text-indigo-400 mr-2" />
                          <h2 class="text-xl font-bold text-slate-800 dark:text-slate-200">TimeLock Smart Contract</h2>
                        </div>
                        <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">Wallet: {timelock.address.value}</p>
                      </div>
                      <div class="mt-4 sm:mt-0 space-x-2">
                        <button 
                          onClick$={timelock.loadLocks} 
                          class="inline-flex items-center px-3 py-1.5 rounded-lg bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/50 dark:hover:bg-indigo-800/70 text-indigo-700 dark:text-indigo-300 text-sm transition-all"
                        >
                          <LuRefreshCcw class={`h-4 w-4 mr-1.5 ${timelock.loadingLocks.value ? 'animate-spin' : ''}`} /> Refrescar
                        </button>
               
                        <button 
                          onClick$={timelock.performUpkeep} 
                          class="inline-flex items-center px-3 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:hover:bg-emerald-800/70 text-emerald-700 dark:text-emerald-300 text-sm transition-all"
                        >
                          <LuKey class="h-4 w-4 mr-1.5" /> Ejecutar Pagos
                        </button>
                      </div>
                    </div>
                    
                    {/* Estado de error/éxito */}
                    {timelock.error.value && (
                      <div class="mt-2 p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
                        <LuAlertTriangle class="inline-block h-4 w-4 mr-1" /> {timelock.error.value}
                      </div>
                    )}
                    
                    {timelock.status.value && (
                      <div class="mt-2 p-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-sm">
                        <LuCheckCircle class="inline-block h-4 w-4 mr-1" /> {timelock.status.value}
                      </div>
                    )}
                    
                    {/* Lista de Locks */}
                    {(() => {
                      const page = useSignal(1);
                      const limit = useSignal(10);
                      const locks = [...timelock.locks.value].slice().reverse();
                      const totalPages = Math.ceil(locks.length / limit.value);
                      const paginatedLocks = locks.slice((page.value - 1) * limit.value, page.value * limit.value);
                      return (
                        <div class="mt-4 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700/50">
                          <table class="w-full bg-white dark:bg-slate-800/50 text-left text-sm">
                            <thead class="bg-slate-50 dark:bg-slate-700/50">
                              <tr>
                                <th class="px-4 py-3 text-slate-600 dark:text-slate-300 font-semibold">ID</th>
                                <th class="px-4 py-3 text-slate-600 dark:text-slate-300 font-semibold">Factura</th>
                                <th class="px-4 py-3 text-slate-600 dark:text-slate-300 font-semibold">Token</th>
                                <th class="px-4 py-3 text-slate-600 dark:text-slate-300 font-semibold">Monto</th>
                                <th class="px-4 py-3 text-slate-600 dark:text-slate-300 font-semibold">Fecha Liberación</th>
                                <th class="px-4 py-3 text-slate-600 dark:text-slate-300 font-semibold">Time Remaining</th>
                                <th class="px-4 py-3 text-slate-600 dark:text-slate-300 font-semibold">Estado</th>
                                <th class="px-4 py-3 text-slate-600 dark:text-slate-300 font-semibold">Destinatarios</th>
                                <th class="px-4 py-3 text-slate-600 dark:text-slate-300 font-semibold">Profesional</th>
                                <th class="px-4 py-3 text-slate-600 dark:text-slate-300 font-semibold">Email</th>
                              </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-200 dark:divide-slate-700/50">
                              {timelock.loadingLocks.value ? (
                                <tr>
                                  <td colSpan={8} class="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                                    <LuLoader2 class="animate-spin h-6 w-6 mx-auto mb-2" />
                                    Cargando locks...
                                  </td>
                                </tr>
                              ) : paginatedLocks.length === 0 ? (
                                <tr>
                                  <td colSpan={8} class="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                                    No hay locks creados aún.
                                  </td>
                                </tr>
                              ) : (
                                paginatedLocks.map((lock: any) => (
                                  <tr key={lock.id} class="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                    <td class="px-4 py-3 text-slate-700 dark:text-slate-300">{lock.id}</td>
                                    <td class="px-4 py-3 text-slate-700 dark:text-slate-300">
                                      {/* Mostrar el invoiceId directamente del lock del contrato */}
                                      {lock.invoiceId !== undefined && lock.invoiceId !== null && Number(lock.invoiceId) !== 0 ? (
                                        <span class="font-mono">{String(lock.invoiceId)}</span>
                                      ) : <span class="text-slate-400">-</span>}
                                    </td>
                                    <td class="px-4 py-3 text-slate-700 dark:text-slate-300">{lock.token.slice(0, 6)}...{lock.token.slice(-4)}</td>
                                    <td class="px-4 py-3 text-slate-700 dark:text-slate-300">{(Number(lock.totalAmount) / 1e18).toFixed(4)} ETH</td>
                                    <td class="px-4 py-3 text-slate-700 dark:text-slate-300">{formatTimestamp(lock.releaseTime)}</td>
                                    <td class="px-4 py-3 text-slate-700 dark:text-slate-300">
                                      {(() => {
                                        const now = Math.floor(Date.now() / 1000);
                                        const diff = Number(lock.releaseTime) - now;
                                        if (lock.released) return <span class="text-emerald-600 dark:text-emerald-300">-</span>;
                                        if (diff <= 0) return <span class="text-amber-600 dark:text-amber-300">Ready</span>;
                                        const days = Math.floor(diff / 86400);
                                        const hours = Math.floor((diff % 86400) / 3600);
                                        const minutes = Math.floor((diff % 3600) / 60);
                                        const seconds = diff % 60;
                                        return (
                                          <span>
                                            {days > 0 && `${days}d `}
                                            {hours > 0 && `${hours}h `}
                                            {minutes > 0 && `${minutes}m `}
                                            {seconds > 0 && days === 0 && hours === 0 && minutes === 0 ? `${seconds}s` : ''}
                                          </span>
                                        );
                                      })()}
                                    </td>
                                    <td class="px-4 py-3">
                                      <span class={`px-2 py-1 rounded-full text-xs font-medium ${lock.released ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                                        {lock.released ? 'Liberado' : 'Pendiente'}
                                      </span>
                                    </td>
                                    <td class="px-4 py-3 text-slate-700 dark:text-slate-300">
                                      {lock.recipients.map((r: string, i: number) => (
                                        <div key={i} class="text-xs">{r.slice(0, 6)}...{r.slice(-4)} ({lock.amounts[i].toString()})</div>
                                      ))}
                                    </td>
                                    <td class="px-4 py-3 text-slate-700 dark:text-slate-300">
                                      {/* Buscar el nombre del profesional en la DB por wallet (recipients) */}
                                      {Array.isArray(lock.recipients) && lock.recipients.length > 0
                                        ? lock.recipients.map((wallet: string, i: number) => {
                                            const prof = (locksLoader.value.professionals ?? []).find((p: any) => p.wallet && p.wallet.toLowerCase() === wallet.toLowerCase());
                                            return (
                                              <div key={i} class="text-xs">
                                                {prof && typeof prof.name === 'string' ? prof.name : String(prof?.name ?? '-')}
                                              </div>
                                            );
                                          })
                                        : '-'}
                                    </td>
                                    <td class="px-4 py-3 text-slate-700 dark:text-slate-300">
                                      {/* Email del profesional automatizado */}
                                      {Array.isArray(lock.recipients) && lock.recipients.length > 0
                                        ? lock.recipients.map((wallet: string, i: number) => {
                                            // Buscar el email en locksLoader.value.professionals por wallet
                                            const prof = (locksLoader.value.professionals ?? []).find((p: any) => p.wallet && p.wallet.toLowerCase() === wallet.toLowerCase());
                                            return (
                                              <div key={i} class="text-xs">
                                                {prof && typeof prof.email === 'string' ? prof.email : String(prof?.email ?? '-')}
                                              </div>
                                            );
                                          })
                                        : '-'}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                          {/* Paginación frontend */}
                          <div class="flex justify-between items-center py-4 px-2">
                            <span class="text-xs text-slate-500 dark:text-slate-400">Mostrando página {page.value} de {totalPages}</span>
                            <div class="flex gap-2">
                              <button
                                class="px-3 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium disabled:opacity-50"
                                disabled={page.value === 1}
                                onClick$={() => { if (page.value > 1) page.value -= 1; }}
                              >Anterior</button>
                              <button
                                class="px-3 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium disabled:opacity-50"
                                disabled={page.value >= totalPages}
                                onClick$={() => { if (page.value < totalPages) page.value += 1; }}
                              >Siguiente</button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
        
        
        <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProfessionals.value.map(prof => (
            <div key={prof.id} class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-md p-5 flex flex-col gap-4 hover:shadow-lg transition-all duration-200">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900 flex items-center justify-center text-teal-700 dark:text-teal-300 font-bold text-lg shrink-0">
                  {prof.name[0]}
                </div>
                <div class="flex-grow">
                  <div class="font-bold text-slate-800 dark:text-slate-100 text-lg">{prof.name}</div>
                  {prof.email && <div class="text-xs text-slate-500 dark:text-slate-400 truncate">{prof.email}</div>}
                </div>
                {prof.wallet && <span class="ml-auto px-2 py-1 text-xs rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0" title={prof.wallet}>{prof.wallet.slice(0,6)}...{prof.wallet.slice(-4)}</span>}
              </div>
              
              <div>
                <div class="font-semibold text-xs text-slate-500 dark:text-slate-400 mb-1">Contratos Activos</div>
                <div class="flex flex-wrap gap-2">
                  {contractsByProfessional(prof.id).length === 0 && <span class="text-xs text-slate-400">Sin contratos</span>}
                  {contractsByProfessional(prof.id).map(c => (
                    <span key={c.id} class="px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-xs text-slate-700 dark:text-slate-200" title={c.contract_url ?? ''}>
                      <span class="text-green-600 dark:text-green-400 font-semibold">{c.status}</span> <span>({c.start_date} - {c.end_date ?? 'Presente'})</span>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div class="font-semibold text-xs text-slate-500 dark:text-slate-400 mb-1">Facturas</div>
                <div class="flex flex-col gap-2">
                  {invoicesByProfessional(prof.id).length === 0 && <span class="text-xs text-slate-400">Sin facturas</span>}
                  {invoicesByProfessional(prof.id).map(inv => {
                    // Buscar lock para la factura
                    const lock = locksList.value.find(l => l.facturaId === inv.id);
                    let statusLabel, statusClass, statusIcon;
                    // Prioridad: si la factura está pagada, mostrar 'Pagado' aunque exista lock
                    if (inv.status === 'paid') {
                      statusLabel = 'Pagado';
                      statusClass = 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
                      statusIcon = <LuCheckCircle/>;
                    } else if (lock) {
                      if (!lock.released)  {
                        statusLabel = 'Pendiente';
                        statusClass = 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
                        statusIcon = <LuAlertTriangle/>;
                      }
                    }  else {
                      statusLabel = 'Pendiente';
                      statusClass = 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
                      statusIcon = <LuAlertTriangle/>;
                    }
                    return (
                      <div key={inv.id} class="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg px-2 py-1.5">
                        <span
                          class={`px-2 py-0.5 rounded text-xs font-semibold text-center min-w-[90px] inline-flex items-center justify-center gap-1 ${statusClass}`}
                        >
                          {statusIcon} {statusLabel}
                        </span>
                        <span class="text-xs text-slate-700 dark:text-slate-200 font-mono" title={`Emitida: ${inv.issue_date}${inv.paid_date ? ' | Pagada: ' + inv.paid_date : ''}`}>{inv.amount} {inv.currency}</span>
                        <div class="ml-auto flex items-center gap-1">
                          {inv.invoice_url ? (
                            <a href={`/api/invoices/view/${inv.invoice_url}`} target="_blank" rel="noopener noreferrer" class="text-teal-500 hover:text-teal-400 text-sm" title="Ver factura"><LuFileText /></a>
                          ) : null}
                          <button
                            class="px-2 py-1 text-xs rounded bg-teal-500 text-white hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            disabled={statusLabel !== 'Pendiente'}
                            onClick$={() => openAutomateModal(inv.id)}
                            title="Automatizar pago"
                          >Automatizar</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Modal for automating payment */}
        {showAutomateModal.value && (
          <div class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div class="flex items-center justify-center min-h-screen p-4 text-center">
              <div class="fixed inset-0 bg-slate-700/70 dark:bg-slate-900/80 backdrop-blur-sm transition-opacity" aria-hidden="true" onClick$={closeAutomateModal}></div>
              <div class="inline-block bg-white dark:bg-slate-800 rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all border border-slate-200/50 dark:border-slate-700/50 my-8 sm:max-w-md w-full">
                <div class="p-6 sm:p-8">
                  <div class="flex items-center gap-4 mb-6">
                    <div class="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900 flex items-center justify-center text-teal-600 dark:text-teal-300 text-2xl shrink-0">
                      <LuClock />
                    </div>
                    <div>
                      <h2 class="text-xl font-bold text-slate-800 dark:text-slate-100" id="modal-title">Automatizar pago</h2>
                      <p class="text-sm text-slate-500 dark:text-slate-400">Programar un Timelock para esta factura.</p>
                    </div>
                  </div>
                  <div class="space-y-4">
                    <div>
                      <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Token</label>
                      <select bind:value={timelockToken} class="block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-2 px-3 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500">
                        <option value="USDC">USDC</option>
                        <option value="USDT">USDT</option>
                        <option value="DAI">DAI</option>
                        <option value="KNRT">KNRT</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Wallet del profesional</label>
                      <input type="text" bind:value={timelockWallet} placeholder="0x..." class="block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-2 px-3 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-teal-500" />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Monto a transferir</label>
                      <input type="number" min="0" step="any" bind:value={timelockAmount} class="block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-2 px-3 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500" />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fecha y Hora de Liberación</label>
                      <div class="grid grid-cols-3 gap-2">
                         <input type="date" bind:value={timelockReleaseDate} class="col-span-3 block w-full border border-slate-300 dark:border-slate-600 rounded-lg py-2 px-3 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500" />
                          <select bind:value={timelockReleaseHour} class="block w-full border border-slate-300 dark:border-slate-600 rounded-lg py-2 px-3 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                            <option value="">Hora</option>
                            {Array.from({length: 24}, (_, i) => <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>)}
                          </select>
                          <select bind:value={timelockReleaseMinute} class="block w-full border border-slate-300 dark:border-slate-600 rounded-lg py-2 px-3 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                            <option value="">Min</option>
                            <option value="0">00</option><option value="15">15</option><option value="30">30</option><option value="45">45</option>
                          </select>
                      </div>
                    </div>
                     <div>
                        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Zona Horaria</label>
                        <select bind:value={timelockTimezone} class="block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-2 px-3 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500">
                           <option value="UTC">UTC</option>
                           <option value="America/Mexico_City">America/Mexico_City</option>
                           <option value="America/Caracas">America/Caracas</option>
                           <option value="America/New_York">America/New_York</option>
                           <option value="Europe/Madrid">Europe/Madrid</option>
                           <option value="America/Argentina/Buenos_Aires">America/Argentina/Buenos_Aires</option>
                           <option value="America/Bogota">America/Bogota</option>
                           <option value="America/Lima">America/Lima</option>
                           <option value="America/Santiago">America/Santiago</option>
                        </select>
                      </div>
                      <div class="mt-2 p-2 bg-slate-100 dark:bg-slate-700/50 rounded-lg text-xs space-y-1">
                          <p class="text-slate-600 dark:text-slate-400"><b>Actual (UTC):</b> {nowUtc.value.toLocaleString('en-GB', { timeZone: 'UTC' })}</p>
                          <p class="text-slate-600 dark:text-slate-400"><b>Liberación ({timelockTimezone.value}):</b> {selectedLocal.value.toLocaleString('en-GB', { timeZone: timelockTimezone.value })}</p>
                          <p class="text-slate-600 dark:text-slate-400"><b>Liberación (UTC):</b> {selectedUtc.value.toLocaleString('en-GB', { timeZone: 'UTC' })}</p>
                      </div>
                  </div>
                  
                  <div class="mt-8 flex justify-end gap-3">
                    <button class="px-5 py-2.5 rounded-lg bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-100 font-medium hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors" onClick$={closeAutomateModal}>Cancelar</button>
                    <button
                      class={`px-5 py-2.5 rounded-lg bg-gradient-to-r from-teal-500 to-teal-600 text-white font-semibold hover:from-teal-600 hover:to-teal-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed`}
                      onClick$={executeTimelock}
                      disabled={!!automationError.value || timelock.status.value === 'loading'}
                    >{timelock.status.value === 'loading' ? 'Procesando...' : 'Automatizar'}</button>
                  </div>

                  {timelockStatus.value && (
                    <div class="mt-4 text-green-700 dark:text-green-300 text-sm font-medium bg-green-50 dark:bg-green-900/30 rounded-lg p-3 text-center">{timelockStatus.value}</div>
                  )}
                  {timelockError.value && (
                    <div class="mt-4 text-red-700 dark:text-red-300 text-sm font-medium bg-red-50 dark:bg-red-900/30 rounded-lg p-3 text-center">{timelockError.value}</div>
                  )}
                  {automationError.value && (
                    <div class="mt-4 text-red-700 dark:text-red-300 text-sm font-medium bg-red-50 dark:bg-red-900/30 rounded-lg p-3 text-center">
                      <LuAlertTriangle class="inline-block mr-2"/> {automationError.value}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
});