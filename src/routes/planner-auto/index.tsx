

import { component$, useSignal, $, useStore, useVisibleTask$, useTask$, isBrowser } from '@builder.io/qwik';
import { routeLoader$, routeAction$, Form, zod$, z } from '@builder.io/qwik-city';
import { tursoClient, runMigrations } from '~/utils/turso';
import { getSession } from '~/utils/auth';
import { formatCurrency, to12Hour, to24Hour } from '~/utils/format';
import { DateTime } from 'luxon';
import { TIMEZONES } from '~/utils/timezones';
import { useTimelock } from '../hooks/usePropertyNft';
import { ENV } from '~/utils/env';
import { 
  LuCalendar, 
  LuPlus, 
  LuChevronLeft, 
  LuChevronRight, 
  LuClock, 
  LuCheckCircle, 
  LuTrash, 
  LuSave, 
  LuLoader2, 
  LuAlertTriangle,
  LuPencil,
  LuX,
  LuWallet,
  LuLock,
  LuKey,
  LuRefreshCcw,
  LuInfo,
  LuAlertCircle
} from '@qwikest/icons/lucide';

// Type Definitions
interface Payment {
  id: number;
  professional_id: number;
  professional_name: string;
  professional_wallet: string | null;
  amount: number;
  currency: string;
  status: 'pending' | 'paid';
  due_date: string;
  description: string | null;
  contract_id?: number | null;
  contract_name?: string | null;
}

interface Professional {
  id: number;
  name: string;
  wallet?: string;
}

// Data Loader
export const usePaymentsLoader = routeLoader$(async (requestEvent) => {
  // Ejecutar migraciones para asegurar que todas las tablas existen
  await runMigrations(requestEvent);
  
  const db = tursoClient(requestEvent);
  const url = new URL(requestEvent.request.url);
  const month = url.searchParams.get('month') || (new Date().getMonth() + 1).toString();
  const year = url.searchParams.get('year') || new Date().getFullYear().toString();

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(Number(year), Number(month), 0);
  const lastDay = endDate.getDate();
  const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const paymentsResult = await db.execute({
    sql: `
      SELECT p.id, p.professional_id, prof.name as professional_name, prof.wallet as professional_wallet,
             p.amount, p.currency, p.status, p.due_date, p.description, p.contract_id, c.id as contract_id, c.start_date, c.end_date, c.status as contract_status, c.contract_url
      FROM payments p
      JOIN professionals prof ON p.professional_id = prof.id
      LEFT JOIN contracts c ON p.contract_id = c.id
      WHERE p.due_date BETWEEN ? AND ?
      ORDER BY p.due_date ASC
    `,
    args: [startDate, endDateStr]
  });

  const professionalsResult = await db.execute('SELECT id, name, wallet FROM professionals ORDER BY name');

  // Cargar todos los contratos activos
  const contractsResult = await db.execute(`
    SELECT c.id, c.professional_id, c.start_date, c.end_date, c.status, c.contract_url
    FROM contracts c
    WHERE c.status = 'active'
    ORDER BY c.start_date DESC
  `);

  return {
    payments: (paymentsResult.rows as any[]).map(r => ({...r, amount: Number(r.amount)})) as Payment[],
    professionals: professionalsResult.rows as unknown as Professional[],
    contracts: contractsResult.rows as any[],
    currentMonth: Number(month),
    currentYear: Number(year)
  };
});

// Save Payment Action
export const useSavePayment = routeAction$(
  async (data, requestEvent) => {
    const session = await getSession(requestEvent);
    if (!session.isAuthenticated || !session.userId) return { success: false, error: 'Unauthorized' };

    // Ejecutar migraciones para asegurar que todas las tablas existen
    await runMigrations(requestEvent);
    
    const db = tursoClient(requestEvent);
    const { 
      id, 
      professional_id, 
      amount, 
      currency, 
      due_date, 
      description, 
      contract_id,
      autoSchedulePayment,
      autoScheduleTime,
      customDate,
      customHour,
  customMinute,
  timezone
    } = data;

    try {
      // Si está habilitada la automatización del pago con TimeLock
      if (autoSchedulePayment === 'true') {
        try {
          // Obtener detalles del profesional para su dirección de wallet
          const professionalResult = await db.execute({
            sql: 'SELECT wallet, name FROM professionals WHERE id = ?',
            args: [professional_id]
          });

          if (professionalResult.rows.length === 0) {
            return { 
              success: false, 
              error: `No se pudo encontrar la información del profesional con ID ${professional_id}`
            };
          }
          
          const professionalWallet = professionalResult.rows[0].wallet;
          const professionalName = professionalResult.rows[0].name;
          
          if (!professionalWallet) {
            return { 
              success: false, 
              error: `El profesional ${professionalName} no tiene una dirección de wallet configurada`
            };
          }
          
          // Determinar el timestamp de liberación basado en la opción seleccionada
          const now = Math.floor(Date.now() / 1000); // Timestamp actual en segundos
          let releaseTimestamp: number;
          let releaseDescription: string;
          // Crear fecha en la zona horaria seleccionada usando luxon
          const dateParts = due_date.split('-').map(Number); // [YYYY, MM, DD]
          let customHourVal = typeof customHour === 'string' ? parseInt(customHour, 10) : 0;
          const customMinuteVal = typeof customMinute === 'string' ? parseInt(customMinute, 10) : 0;
          let amPmVal = data.amPm || null;
          if (amPmVal) {
            customHourVal = to24Hour(customHourVal, amPmVal);
          }
          // Usar luxon para crear la fecha en la zona horaria seleccionada
          const dt = DateTime.fromObject({
            year: dateParts[0],
            month: dateParts[1],
            day: dateParts[2],
            hour: customHourVal,
            minute: customMinuteVal,
            second: 0,
            millisecond: 0
          }, { zone: timezone || 'UTC' });
          releaseTimestamp = Math.floor(dt.toUTC().toSeconds());
          releaseDescription = `fecha de vencimiento (${dt.toFormat('yyyy-MM-dd HH:mm')} [${timezone || 'UTC'}] | UTC: ${dt.toUTC().toFormat('yyyy-MM-dd HH:mm')})`;
          
          // Mantener estos casos para compatibilidad con código existente
          switch (autoScheduleTime) {
            case 'duedate':
            case 'custom':
            case '30min':
            case '1h':
            case '1d':
            case '1w':
              break;
            default:
              console.log("Usando la fecha de vencimiento con la hora seleccionada por defecto");
          }
          
          // Obtener la dirección del token según la moneda
          const tokenAddress = getTokenAddress(currency);
          if (!tokenAddress) {
            return { 
              success: false, 
              error: `No se ha configurado el token para ${currency}`
            };
          }
          
          // En este punto tenemos toda la información necesaria para el TimeLock
          // Pero necesitamos devolver los datos para que el cliente ejecute la transacción MetaMask
          // No podemos ejecutar MetaMask directamente desde el servidor
          // Ahora devolvemos los datos para que el cliente ejecute la transacción y solo después de éxito se guarde el pago
          return { 
            success: true, 
            needsBlockchainAction: true,
            autoSchedule: true, 
            payment_id: null, // El ID se generará después
            professional_wallet: professionalWallet as string,
            professional_name: professionalName,
            amount: Number(amount),
            currency,
            tokenAddress,
            releaseTimestamp,
            releaseDescription,
            paymentData: {
              professional_id,
              user_id: session.userId,
              amount,
              currency,
              due_date,
              description: description || null,
              releaseTimestamp
            }
          };
        } catch (error) {
          console.error('Error en la automatización del pago:', error);
          return {
            success: false,
            error: `Error en la automatización del pago: ${error instanceof Error ? error.message : String(error)}`
          };
        }
      } else {
        // Si no hay automatización, simplemente guardamos el pago si es nuevo o actualizamos
        if (id) {
          await db.execute({
            sql: 'UPDATE payments SET professional_id = ?, amount = ?, currency = ?, due_date = ?, description = ?, contract_id = ? WHERE id = ?',
            args: [professional_id, amount, currency, due_date, description || null, contract_id || null, id]
          });
        } else {
          await db.execute({
            sql: 'INSERT INTO payments (professional_id, user_id, amount, currency, status, due_date, description, contract_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            args: [professional_id, session.userId, amount, currency, 'pending', due_date, description || null, contract_id || null]
          });
        }
        return { success: true };
      }
    } catch (e) {
      console.error(e);
      return { success: false, error: `Failed to save payment: ${e instanceof Error ? e.message : String(e)}` };
    }
  },
  zod$({
    id: z.coerce.number().optional(),
    professional_id: z.coerce.number(),
    amount: z.coerce.number().positive(),
    currency: z.string(),
    due_date: z.string(),
    description: z.string().optional(),
    contract_id: z.coerce.number().optional().nullable(),
    autoSchedulePayment: z.string().optional(),
    autoScheduleTime: z.string().optional(),
    customDate: z.string().optional(),
    customHour: z.string().optional(),
    customMinute: z.string().optional(),
  amPm: z.string().optional(),
  timezone: z.string().optional()
  })
);

// Process Payment Action
export const useProcessPayment = routeAction$(async ({ id, status }, requestEvent) => {
  // Ejecutar migraciones para asegurar que todas las tablas existen
  await runMigrations(requestEvent);
  
  const db = tursoClient(requestEvent);
  const newStatus = status === 'paid' ? 'pending' : 'paid';
  const payment_date = newStatus === 'paid' ? new Date().toISOString().split('T')[0] : null;
  try {
    await db.execute({
      sql: 'UPDATE payments SET status = ?, payment_date = ? WHERE id = ?',
      args: [newStatus, payment_date, id]
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Failed to process payment.' };
  }
}, zod$({
  id: z.coerce.number(),
  status: z.enum(['pending', 'paid'])
}));

// Update Timelock Transaction Action
export const useUpdateTimelockTransaction = routeAction$(async ({ payment_id, tx_hash, status }, requestEvent) => {
  // Ejecutar migraciones para asegurar que todas las tablas existen
  await runMigrations(requestEvent);
  
  const db = tursoClient(requestEvent);
  
  try {
    // Si el payment_id es null o no es un número válido, no podemos proceder
    if (payment_id === null || isNaN(Number(payment_id))) {
      return { success: false, error: 'ID de pago no válido' };
    }

    await db.execute({
      sql: 'UPDATE timelocks SET tx_hash = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE payment_id = ?',
      args: [tx_hash, status, payment_id]
    });
    
    if (status === 'completed') {
      // Si el timelock se completa correctamente, actualizamos también el estado del pago
      await db.execute({
        sql: 'UPDATE payments SET status = ?, payment_date = ? WHERE id = ?',
        args: ['paid', new Date().toISOString().split('T')[0], payment_id]
      });
    }
    
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: 'Failed to update timelock transaction.' };
  }
}, zod$({
  payment_id: z.coerce.number().nullable(), // Ahora permitimos null para compatibilidad
  tx_hash: z.string(),
  status: z.enum(['pending', 'completed', 'failed'])
}));

// Delete Payment Action
export const useDeletePayment = routeAction$(async ({ id }, requestEvent) => {
  // Ejecutar migraciones para asegurar que todas las tablas existen
  await runMigrations(requestEvent);
  
  const db = tursoClient(requestEvent);
  try {
    await db.execute({ sql: 'DELETE FROM payments WHERE id = ?', args: [id] });
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Failed to delete payment.' };
  }
}, zod$({
  id: z.coerce.number()
}));

// Función para obtener la dirección del token según la moneda
function getTokenAddress(currency: string): `0x${string}` | undefined {
  // Direcciones de tokens para diferentes monedas
  // Usar las direcciones reales de los contratos en producción
  switch (currency) {
    case 'USD':
    case 'USDC':
      // Dirección de USDC
      return '0x5FbDB2315678afecb367f032d93F642f64180aa3' as `0x${string}`; 
    case 'ETH':
      return '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512' as `0x${string}`; 
    case 'DAI':
      return '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0' as `0x${string}`; 
    case 'USDT':
      return '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9' as `0x${string}`;
    case 'KNRT':
      // Dirección del token KNRT
      return '0x54de10fadf4ea2fbad10ebfc96979d0885dd36fa' as `0x${string}`;
    case 'EUR':
      // Dirección para EUR token
      return '0x5FbDB2315678afecb367f032d93F642f64180aa3' as `0x${string}`;
    default:
      return '0x5FbDB2315678afecb367f032d93F642f64180aa3' as `0x${string}`; // Por defecto usamos USDC
  }
}

export default component$(() => {


  const loaderData = usePaymentsLoader();
  const saveAction = useSavePayment();
  const processAction = useProcessPayment();
  const deleteAction = useDeletePayment();
  const updateTimelockAction = useUpdateTimelockTransaction();

  // Timelock Integration
  // Hook para la integración con Timelock/MetaMask
  const timelock = useTimelock();

  // Tarea visible para verificar MetaMask en el lado del cliente
  useVisibleTask$(async ({ track }) => {
    if (!isBrowser) return;
    try {
      // Rastreamos si hay algún cambio en el estado de MetaMask
      const currentAddress = track(() => timelock.address.value);
      
      // Si MetaMask está instalado pero no estamos conectados, intentar verificar cuentas existentes
      // Esta lógica solo se ejecuta en el cliente
    } catch (error) {
      console.error("Error en la tarea visible de MetaMask:", error);
    }
  });
  
  // Señal para mostrar/ocultar el panel de timelock
  const showTimelockPanel = useSignal(false);
  
  // Señal para guardar el pago actual en proceso de timelock
  const currentTimelockPayment = useSignal<Payment | null>(null);
  
  // Señales para configurar un nuevo timelock
  const timelockToken = useSignal('');
  const timelockTokenSymbol = useSignal('USDC');  // Por defecto usaremos USDC
  const showTimelockModal = useSignal(false);
  
  // Señales para la selección rápida de tiempo de liberación
  const customReleaseTime = useSignal<number | null>(null); // Tiempo personalizado en segundos desde ahora
  const customReleaseTimeLabel = useSignal<string>(''); // Etiqueta descriptiva del tiempo
  const showTimeSelector = useSignal(false); // Mostrar selector de tiempo
  
  // Señales para la selección personalizada de fecha y hora
  const customDate = useSignal<string>(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
  const customHour = useSignal<number>(0); // 0-23
  const customMinute = useSignal<number>(30); // 0-59 (mínimo 30)
  const showCustomDatePicker = useSignal(false); // Mostrar selector personalizado

  // Señal para la zona horaria seleccionada
  const selectedTimezone = useSignal<string>('UTC');
  // Señal para el reloj en tiempo real
  const nowDate = useSignal<Date>(new Date());
  // Señal para la fecha/hora UTC seleccionada
  const selectedUtcDate = useSignal<Date | null>(null);
  // Señal para error de validación UTC
  const utcError = useSignal<string | null>(null);
  // Actualizar el reloj cada segundo
  useVisibleTask$(() => {
    const interval = setInterval(() => {
      nowDate.value = new Date();
      // Si hay una fecha seleccionada, validar en UTC
      if (selectedUtcDate.value) {
        if (selectedUtcDate.value.getTime() <= Date.now()) {
          utcError.value = 'La fecha/hora seleccionada en UTC ya pasó. Elige una hora mayor.';
        } else {
          utcError.value = null;
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  });

  // Obtener zona horaria local
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // Store para guardar los datos del pago que requiere acción blockchain
  const pendingBlockchainAction = useStore({
    pending: false,
    processed: false, // Nuevo flag para evitar re-ejecución
    payment_id: 0 as number | null,
    professional_wallet: '',
    amount: 0,
    currency: '',
    tokenAddress: '' as `0x${string}` | '',
    releaseTimestamp: 0
  });
  
  // Señal para formato de hora (24h o 12h)
  const timeFormat = useSignal<'24h' | '12h'>('24h');
  // Señal para AM/PM si está en 12h
  const amPm = useSignal<'AM' | 'PM'>('AM');

  // Task para monitorear los resultados de la acción de guardar y ejecutar MetaMask cuando sea necesario
  useVisibleTask$(({ track }) => {
    if (!isBrowser) return;
    const result = track(() => saveAction.value);
    
    if (result && result.needsBlockchainAction && !pendingBlockchainAction.processed) {
      // Marcar como procesado para evitar re-ejecución
      pendingBlockchainAction.processed = true;

      // Guardar los datos para la acción blockchain
      pendingBlockchainAction.pending = true;
      pendingBlockchainAction.payment_id = result.payment_id;
      pendingBlockchainAction.professional_wallet = result.professional_wallet;
      pendingBlockchainAction.amount = result.amount;
      pendingBlockchainAction.currency = result.currency;
      pendingBlockchainAction.tokenAddress = result.tokenAddress as `0x${string}`;
      pendingBlockchainAction.releaseTimestamp = result.releaseTimestamp;

      // Mostrar modal de MetaMask
      showTimelockModal.value = true;

      // Conectar MetaMask y luego ejecutar el createLock
      (async () => {
        try {
          console.log("Iniciando conexión con MetaMask para acción blockchain...");

          // Siempre intentamos conectar para asegurar que tenemos la conexión actualizada
          const connected = await timelock.connect();

          // Verificar si la conexión fue exitosa
          if (!connected || !timelock.address.value) {
            console.error("No se pudo conectar a MetaMask");
            timelock.error.value = "Conecta MetaMask primero. Asegúrate de tener la extensión instalada y desbloqueada.";
            pendingBlockchainAction.pending = false; // Resetear si falla la conexión
            return;
          }

          console.log("MetaMask conectado correctamente. Dirección:", timelock.address.value);
          console.log("Creando TimeLock con los siguientes datos:", {
            token: pendingBlockchainAction.tokenAddress,
            amount: pendingBlockchainAction.amount.toString(),
            recipient: pendingBlockchainAction.professional_wallet,
            releaseTime: new Date(pendingBlockchainAction.releaseTimestamp * 1000).toLocaleString()
          });

          // Ejecutar la transacción en MetaMask
          await timelock.createLock(
            pendingBlockchainAction.tokenAddress,
            pendingBlockchainAction.amount.toString(),
            pendingBlockchainAction.professional_wallet,
            pendingBlockchainAction.amount.toString(),
            pendingBlockchainAction.releaseTimestamp.toString()
          );

       

        } catch (error) {
          console.error("Error durante el proceso de blockchain:", error);
          if (!timelock.error.value) {
              timelock.error.value = error instanceof Error 
                ? `Error en la transacción: ${error.message}`
                : "Error desconocido durante la transacción. Por favor, intenta de nuevo.";
          }
          pendingBlockchainAction.pending = false; // Resetear en caso de error
        }
      })();
    }
  });
  
  // Task para monitorear el estado de la transacción blockchain
  useTask$(({ track }) => {
    if (!isBrowser) return;
    const status = track(() => timelock.status.value);
    const error = track(() => timelock.error.value);
    
    // Si hay un pago pendiente de blockchain y recibimos un estado de éxito o error
    if (pendingBlockchainAction.pending) {
      if (status && status.includes("Lock creado correctamente")) {
        // La transacción fue exitosa, actualizar en la base de datos
        // No conocemos el tx_hash directamente de viem, pero podemos usar una entrada genérica
        if (pendingBlockchainAction.payment_id !== null) {
          updateTimelockAction.submit({
            payment_id: pendingBlockchainAction.payment_id,
            tx_hash: "tx_" + Date.now().toString(36), // Un identificador único basado en tiempo
            status: 'completed'
          });
        } else {
          console.warn("No se pudo actualizar el timelock porque payment_id es null");
        }
        
        // Resetear el estado pendiente
        pendingBlockchainAction.pending = false;
      } else if (error) {
        // La transacción falló
        if (pendingBlockchainAction.payment_id !== null) {
          updateTimelockAction.submit({
            payment_id: pendingBlockchainAction.payment_id,
            tx_hash: "",
            status: 'failed'
          });
        } else {
          console.warn("No se pudo actualizar el timelock porque payment_id es null");
        }
        
        // Resetear el estado pendiente
        pendingBlockchainAction.pending = false;
      }
    }
  });
  
  // Cargar locks existentes cuando se muestra el panel
  useVisibleTask$(({ track }) => {
    if (!isBrowser) return;
    track(() => showTimelockPanel.value);
    if (showTimelockPanel.value && timelock.address.value) {
      timelock.loadLocks().catch(console.error);
    }
  });
  
  const showModal = useSignal(false);
  
  const editingId = useSignal<number | undefined>();
  const editingProfessionalId = useSignal('');
  const editingProfessionalWallet = useSignal<string | null>(null);
  const editingAmount = useSignal('');
  const editingCurrency = useSignal('USD');
  const editingDueDate = useSignal('');
  const editingDescription = useSignal('');
  // Contract selection
  const editingContractId = useSignal<string>('');
  
    // Señales para la automatización de pagos directamente en el formulario
  const autoSchedulePayment = useSignal<boolean>(true);  // Indica si se automatizará el pago - habilitado por defecto
  const autoScheduleTime = useSignal<string>('duedate');  // Usamos siempre la fecha de vencimiento para la automatización
  
  const currentMonth = useSignal<number>(loaderData.value.currentMonth);
  const currentYear = useSignal<number>(loaderData.value.currentYear);

  const daysInMonth = new Date(currentYear.value, currentMonth.value, 0).getDate();
  const firstDayOfMonth = new Date(currentYear.value, currentMonth.value - 1, 1).getDay();

  const calendarDays: (number | null)[] = [
    ...Array.from({ length: firstDayOfMonth }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
  ];

  const changeMonth = $((offset: number) => {
    let newMonth = currentMonth.value + offset;
    let newYear = currentYear.value;
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('month', newMonth.toString());
    url.searchParams.set('year', newYear.toString());
    window.location.href = url.toString();
  });

  const openModal = $((day: number | null, payment: Payment | null = null) => {
    if (payment) {
      editingId.value = payment.id;
      editingProfessionalId.value = String(payment.professional_id);
      editingProfessionalWallet.value = payment.professional_wallet;
      editingAmount.value = String(payment.amount);
      editingCurrency.value = payment.currency;
      editingDueDate.value = payment.due_date;
      editingDescription.value = payment.description || '';
      editingContractId.value = payment.contract_id ? String(payment.contract_id) : '';
      autoSchedulePayment.value = true;
    } else if (day) {
      const date = new Date(currentYear.value, currentMonth.value - 1, day);
      editingId.value = undefined;
      editingProfessionalId.value = '';
      editingProfessionalWallet.value = null;
      editingAmount.value = '';
      editingCurrency.value = 'USD';
      editingDueDate.value = date.toISOString().split('T')[0];
      editingDescription.value = '';
      editingContractId.value = '';
      autoSchedulePayment.value = true;
    }
    
    // Inicializamos la hora personalizada con una hora razonable (por ejemplo, 10:00 AM)
    customHour.value = 10;
    customMinute.value = 0;
    
    // Si estamos usando la fecha de vencimiento, sincronizamos la fecha personalizada
    customDate.value = editingDueDate.value;
    
    // Resetear el estado de la acción pendiente al abrir el modal
    pendingBlockchainAction.processed = false;
    showModal.value = true;
  });

  const getMonthName = (month: number, year: number) => {
    return new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
  };
  
  // Función para convertir una fecha en timestamp para el timelock
  const dateToTimestamp = $((dateString: string) => {
    const date = new Date(dateString);
    return Math.floor(date.getTime() / 1000);
  });
  
  // Función para crear un timelock a partir de un pago
  const createTimelockFromPayment = $(async (payment: Payment) => {
    if (!timelock.address.value) {
      timelock.connect();
      return;
    }
    
    // Guardar el pago actual para mostrar información del profesional
    currentTimelockPayment.value = payment;
    
    // Mostrar primero el selector de tiempo
    showTimeSelector.value = true;
    
    // El resto del proceso se hará cuando se seleccione un tiempo o se confirme usar la fecha de vencimiento
  });
  
  // Función para ejecutar la creación del timelock con el tiempo seleccionado
  const executeTimelockCreation = $(async (payment: Payment | null) => {
    if (!payment || !payment.professional_wallet) {
      timelock.error.value = "No se puede crear un timelock sin un profesional con wallet.";
      return;
    }
    
    // Obtener dirección del token según la moneda
    const tokenAddress = getTokenAddress(payment.currency);
    
    if (!tokenAddress) {
      timelock.error.value = `No se ha configurado el token para ${payment.currency}`;
      return;
    }
    
    // Usar tiempo personalizado si está establecido, de lo contrario usar la fecha de vencimiento
    let releaseTimestamp: number;
    const now = Math.floor(Date.now() / 1000);
    const minRelease = now + 30 * 60; // 30 minutos desde ahora
    if (customReleaseTime.value) {
      releaseTimestamp = customReleaseTime.value;
    } else {
      releaseTimestamp = await dateToTimestamp(payment.due_date);
    }
    // Si la fecha es pasada, forzar mínimo 30 minutos desde ahora
    if (releaseTimestamp < minRelease) {
      releaseTimestamp = minRelease;
      customReleaseTimeLabel.value = '30 minutos desde ahora (ajustado automáticamente)';
    }
    // Crear el timelock con releaseTimestamp como número (timestamp UNIX)
    // Log para depuración
    console.log('[planner-auto] Llamando a timelock.createLock con:', {
      token: tokenAddress,
      amount: payment.amount.toString(),
      recipient: payment.professional_wallet,
      releaseTime: releaseTimestamp.toString()
    });
    timelock.createLock(
      tokenAddress,
      payment.amount.toString(),
      payment.professional_wallet, // Usamos la wallet del profesional como destinatario
      payment.amount.toString(),   // El monto completo va al profesional
      releaseTimestamp.toString() // El contrato espera string, pero debe ser el número en formato string
    );
    
    showTimeSelector.value = false; // Cerrar selector de tiempo
    showTimelockModal.value = true; // Mostrar modal de estado
  });
  
  // Función para crear timelocks para todos los pagos pendientes
  const createBatchTimelocks = $(async () => {
    try {
      // Verificar si ya estamos conectados, si no, intentar conectar
      if (!timelock.address.value) {
        console.log("No hay conexión con MetaMask. Intentando conectar...");
        const connected = await timelock.connect();
        
        if (!connected) {
          console.error("No se pudo conectar a MetaMask");
          timelock.error.value = "Conecta MetaMask primero para crear timelocks";
          showTimelockModal.value = true; // Mostrar el modal con el error
          return;
        }
      }
      
      // Ahora que estamos conectados, verificamos los pagos pendientes
      const pendingPayments = loaderData.value.payments.filter(p => p.status === 'pending');
      
      if (pendingPayments.length === 0) {
        timelock.error.value = "No hay pagos pendientes para crear timelocks";
        showTimelockModal.value = true;
        return;
      }
      
      console.log(`Procesando ${pendingPayments.length} pagos pendientes para timelocks`);
      
      // Agrupar pagos por profesional y fecha
      const groupedPayments: Record<string, Payment[]> = {};
      pendingPayments.forEach(payment => {
        const key = `${payment.professional_id}_${payment.due_date}_${payment.currency}`;
        if (!groupedPayments[key]) {
          groupedPayments[key] = [];
        }
        groupedPayments[key].push(payment);
      });
      
      console.log(`Pagos agrupados en ${Object.keys(groupedPayments).length} grupos para timelocks`);
      
      // Mostrar modal de estado antes de empezar para dar feedback
      showTimelockModal.value = true;
      timelock.status.value = "Procesando timelocks en lote...";
      
      // Para cada grupo, crear un timelock secuencialmente para evitar problemas con MetaMask
      for (const payments of Object.values(groupedPayments)) {
        if (payments.length > 0) {
          const payment = payments[0];
          
          // Obtener dirección del token según la moneda
          const tokenAddress = getTokenAddress(payment.currency);
            
          if (!tokenAddress) {
            timelock.error.value = `No se ha configurado el token para ${payment.currency}`;
            continue; // Continuamos con el siguiente grupo
          }
          
          // Total amount para este profesional en esta fecha
          const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0).toString();
          
          // Convertir la fecha de vencimiento a timestamp
          const releaseTimestamp = (await dateToTimestamp(payment.due_date)).toString();
          
          if (!payment.professional_wallet) {
            timelock.error.value = `El profesional ${payment.professional_name} no tiene una wallet configurada.`;
            continue;
          }

          // Guardar el pago actual para mostrar información del profesional
          currentTimelockPayment.value = payment;
          
          console.log(`Creando timelock para ${payment.professional_name} por ${totalAmount} ${payment.currency}`);
          
          // Crear el timelock
          await timelock.createLock(
            tokenAddress,
            totalAmount,
            payment.professional_wallet, // Usamos la wallet del profesional como destinatario
            totalAmount,
            releaseTimestamp
          );
          
          // Pequeña pausa para evitar problemas con MetaMask
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Actualizar status al final
      timelock.status.value = "Proceso de timelocks en lote completado";
    } catch (error) {
      console.error("Error al crear timelocks en lote:", error);
      timelock.error.value = error instanceof Error 
        ? `Error al crear timelocks en lote: ${error.message}`
        : "Error desconocido al crear timelocks en lote";
      showTimelockModal.value = true;
    }
  });
  
  // Formatear timestamp a fecha legible
  const formatTimestamp = (timestamp: bigint | number) => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };
  
    // Este código estaba comentado y causaba confusión. Lo eliminamos para evitar duplicación
    // Ya tenemos implementado el flujo correcto en el useTask$ principal  // Función para seleccionar rápidamente un tiempo de liberación
  const selectReleaseTime = $((timeInSeconds: number, label: string) => {
    const now = Math.floor(Date.now() / 1000); // Tiempo actual en segundos
    customReleaseTime.value = now + timeInSeconds;
    customReleaseTimeLabel.value = label;
    showCustomDatePicker.value = false; // Ocultar selector personalizado
  });
  
  // Función para establecer el tiempo personalizado desde fecha y hora
  const setCustomDateTime = $(() => {
    // Crear objeto Date a partir de los valores seleccionados
    const dateObj = new Date(customDate.value);
    dateObj.setHours(customHour.value, customMinute.value, 0, 0);
    
    // Validar que la fecha sea futura (mínimo 30 min desde ahora)
    const minTime = Date.now() + (30 * 60 * 1000); // 30 minutos desde ahora en ms
    if (dateObj.getTime() < minTime) {
      // Si es menor, establecer al mínimo (30 min desde ahora)
      const minDate = new Date(minTime);
      customDate.value = minDate.toISOString().split('T')[0];
      customHour.value = minDate.getHours();
      customMinute.value = minDate.getMinutes();
      dateObj.setTime(minDate.getTime());
    }
    
    // Convertir a timestamp y establecer
    const timestamp = Math.floor(dateObj.getTime() / 1000);
    customReleaseTime.value = timestamp;
    
    // Formatear etiqueta descriptiva
    const formattedDate = dateObj.toLocaleDateString();
    const formattedTime = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    customReleaseTimeLabel.value = `${formattedDate} a las ${formattedTime}`;
  });

  return (
    <main class="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <header class="mb-8 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700 rounded-xl shadow-sm p-6">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-center">
              <LuCalendar class="h-8 w-8 text-teal-600 dark:text-teal-500 mr-3" />
              <div>
                <h1 class="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">Payment Scheduler</h1>
                <p class="text-slate-500 dark:text-slate-400 mt-1">Plan and manage future payments</p>
              </div>
            </div>
            <div class="flex items-center mt-4 sm:mt-0 space-x-4">
              <div>
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
              <div class="flex items-center">
                <button onClick$={() => changeMonth(-1)} class="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 transition-all">
                  <LuChevronLeft class="h-6 w-6 text-slate-600 dark:text-slate-300" />
                </button>
                <h2 class="w-48 text-center text-lg font-semibold text-slate-700 dark:text-slate-200">{getMonthName(currentMonth.value, currentYear.value)}</h2>
                <button onClick$={() => changeMonth(1)} class="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 transition-all">
                  <LuChevronRight class="h-6 w-6 text-slate-600 dark:text-slate-300" />
                </button>
              </div>
            </div>
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
                  onClick$={createBatchTimelocks} 
                  class="inline-flex items-center px-3 py-1.5 rounded-lg bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/50 dark:hover:bg-purple-800/70 text-purple-700 dark:text-purple-300 text-sm transition-all"
                >
                  <LuLock class="h-4 w-4 mr-1.5" /> Crear Timelocks en Lote
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
            <div class="mt-4 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700/50">
              <table class="w-full bg-white dark:bg-slate-800/50 text-left text-sm">
                <thead class="bg-slate-50 dark:bg-slate-700/50">
                  <tr>
                    <th class="px-4 py-3 text-slate-600 dark:text-slate-300 font-semibold">ID</th>
                    <th class="px-4 py-3 text-slate-600 dark:text-slate-300 font-semibold">Token</th>
                    <th class="px-4 py-3 text-slate-600 dark:text-slate-300 font-semibold">Monto</th>
                    <th class="px-4 py-3 text-slate-600 dark:text-slate-300 font-semibold">Fecha Liberación</th>
                    <th class="px-4 py-3 text-slate-600 dark:text-slate-300 font-semibold">Time Remaining</th>
                    <th class="px-4 py-3 text-slate-600 dark:text-slate-300 font-semibold">Estado</th>
                    <th class="px-4 py-3 text-slate-600 dark:text-slate-300 font-semibold">Destinatarios</th>
                    <th class="px-4 py-3 text-slate-600 dark:text-slate-300 font-semibold">Profesional</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200 dark:divide-slate-700/50">
                  {timelock.loadingLocks.value ? (
                    <tr>
                      <td colSpan={7} class="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                        <LuLoader2 class="animate-spin h-6 w-6 mx-auto mb-2" />
                        Cargando locks...
                      </td>
                    </tr>
                  ) : timelock.locks.value.length === 0 ? (
                    <tr>
                      <td colSpan={7} class="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                        No hay locks creados aún.
                      </td>
                    </tr>
                  ) : (
                    timelock.locks.value.map((lock: any) => (
                      <tr key={lock.id} class="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td class="px-4 py-3 text-slate-700 dark:text-slate-300">{lock.id}</td>
                        <td class="px-4 py-3 text-slate-700 dark:text-slate-300">{lock.token.slice(0, 6)}...{lock.token.slice(-4)}</td>
                        <td class="px-4 py-3 text-slate-700 dark:text-slate-300">{lock.totalAmount.toString()}</td>
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
                                const prof = loaderData.value.professionals.find((p: any) => p.wallet && p.wallet.toLowerCase() === wallet.toLowerCase());
                                return (
                                  <div key={i} class="text-xs">
                                    {prof ? prof.name : '-'}
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
            </div>
          </div>
        )}

        {/* Calendar Grid */}
        <div class="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden shadow-lg">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} class="text-center py-2 bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase">{day}</div>
          ))}
          {calendarDays.map((day, index) => (
            <div key={index} class={`relative min-h-[120px] bg-white dark:bg-slate-800/50 p-2 ${day ? 'hover:bg-slate-50 dark:hover:bg-slate-700/50' : 'bg-slate-50 dark:bg-slate-800/80'}`}>
              {day && (
                <>
                  <span class="text-sm font-semibold text-slate-700 dark:text-slate-300">{day}</span>
                  <button onClick$={() => openModal(day)} class="absolute top-1 right-1 h-6 w-6 flex items-center justify-center rounded-full text-slate-400 hover:bg-teal-100 hover:text-teal-600 dark:hover:bg-teal-900/50 dark:hover:text-teal-400 transition-all">
                    <LuPlus class="h-4 w-4" />
                  </button>
                  <div class="mt-2 space-y-1">
                    {loaderData.value.payments
                      .filter(p => new Date(p.due_date + 'T00:00:00').getDate() === day)
                      .map(p => (
                        <div key={p.id} class={`p-1.5 rounded-lg text-xs cursor-pointer group ${p.status === 'paid' ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-amber-50 dark:bg-amber-900/30'}`}>
                          <p class={`font-semibold truncate ${p.status === 'paid' ? 'text-emerald-800 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'}`}>{p.professional_name}</p>
                          <p class={`truncate ${p.status === 'paid' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{formatCurrency(p.amount, p.currency)}</p>
                          <div class="hidden group-hover:flex items-center justify-end space-x-1 mt-1">
                            <button onClick$={() => openModal(day, p)} class="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600">
                              <LuPencil class="h-3 w-3 text-slate-600 dark:text-slate-300" />
                            </button>
                            {timelock.address.value && p.status === 'pending' && (
                              <button onClick$={() => createTimelockFromPayment(p)} class="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600">
                                <LuLock class="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                              </button>
                            )}
                            <Form action={processAction}>
                              <input type="hidden" name="id" value={p.id} />
                              <input type="hidden" name="status" value={p.status} />
                              <button type="submit" class="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600">
                                {p.status === 'paid' ? <LuClock class="h-3 w-3 text-yellow-600" /> : <LuCheckCircle class="h-3 w-3 text-green-600" />}
                              </button>
                            </Form>
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add/Edit Payment Modal */}
      {showModal.value && (
        <div class="fixed inset-0 z-50 overflow-y-auto">
          <div class="flex items-end sm:items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div class="fixed inset-0 bg-slate-700/70 dark:bg-slate-900/80 backdrop-blur-md transition-opacity" aria-hidden="true" onClick$={() => showModal.value = false}></div>
            <div class="inline-block align-bottom bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-xl text-left overflow-hidden shadow-2xl transform transition-all border border-slate-100/50 dark:border-slate-700/50 sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <Form action={saveAction}
                onSubmit$={e => {
                  // Validación frontend: la fecha/hora debe ser futura
                  const form = e.target as HTMLFormElement;
                  const dateStr = form.due_date.value;
                  const hour = parseInt(form.customHour.value, 10);
                  const minute = parseInt(form.customMinute.value, 10);
                  const selected = new Date(dateStr);
                  selected.setHours(hour, minute, 0, 0);
                  if (selected.getTime() <= Date.now()) {
                    e.preventDefault();
                    alert('La fecha y hora seleccionadas deben ser futuras.');
                  }
                }}
                onSubmitCompleted$={() => { 
                  if (saveAction.value?.success) { 
                    showModal.value = false;
                    // Si la automatización estaba habilitada, la creación del timelock se manejará en useTask$ que monitorea saveAction.value
                  }
                }}>
                <div class="px-6 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 class="text-xl leading-6 font-medium text-slate-800 dark:text-slate-100">{editingId.value ? 'Edit' : 'Schedule'} Payment</h3>
                  <input type="hidden" name="id" value={editingId.value} />
                    <div class="mt-4 space-y-4">
                      {/* Selector de zona horaria */}
                      <div>
                        <label for="timezone" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Zona horaria</label>
                        <select
                          id="timezone"
                          name="timezone"
                          bind:value={selectedTimezone}
                          class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                        >
                          {TIMEZONES.map(tz => (
                            <option key={tz} value={tz}>{tz}</option>
                          ))}
                        </select>
                      </div>
                    {/* Contract selection input */}
                 
                    <div>
                      <label for="professional_id" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Professional</label>
                      <select 
                        name="professional_id" 
                        id="professional_id" 
                        bind:value={editingProfessionalId} 
                        onChange$={(e, target) => {
                          const professionalId = target.value;
                          const professional = loaderData.value.professionals.find(p => p.id.toString() === professionalId);
                          editingProfessionalWallet.value = professional?.wallet || null;
                        }}
                        class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                      >
                        <option value="">Select Professional</option>
                        {loaderData.value.professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      
                      {/* Mostrar wallet del profesional seleccionado */}
                      {editingProfessionalWallet.value && (
                        <div class="mt-2 flex items-center p-2 rounded-md bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-600/30">
                          <LuWallet class="h-4 w-4 text-indigo-500 dark:text-indigo-400 mr-2 flex-shrink-0" />
                          <span class="text-xs font-mono text-slate-600 dark:text-slate-300 truncate">
                            {editingProfessionalWallet.value}
                          </span>
                        </div>
                      )}
                    </div>
                       <div>
                      <label for="contract_id" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Contrato</label>
                      <select
                        name="contract_id"
                        id="contract_id"
                        bind:value={editingContractId}
                        disabled={!editingProfessionalId.value}
                        class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                      >
                        <option value="">Selecciona un contrato</option>
                        {loaderData.value.contracts
                          .filter((c: any) => String(c.professional_id) === editingProfessionalId.value)
                          .map((c: any) => (
                            <option key={c.id} value={c.id}>
                              {c.contract_url ? `#${c.id} (${c.start_date} - ${c.end_date || 'actual'})` : `#${c.id} (${c.start_date})`}
                            </option>
                          ))}
                      </select>
                      {!editingProfessionalId.value && (
                        <p class="text-xs text-slate-400 mt-1">Selecciona primero un profesional para ver sus contratos.</p>
                      )}
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label for="amount" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Amount</label>
                        <input type="number" name="amount" id="amount" bind:value={editingAmount} class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm" />
                      </div>
                      <div>
                        <label for="currency" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Currency</label>
                        <select name="currency" id="currency" bind:value={editingCurrency} class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm">
                          <option>USD</option>
                          <option>EUR</option>
                          <option>KNRT</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label for="due_date" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Due Date y Hora</label>
                      <div class="flex flex-col space-y-2">
                        {/* Reloj en tiempo real y zona horaria */}
                        <div class="flex items-center gap-2 mb-2">
                          <LuClock class="h-4 w-4 text-indigo-500" />
                          <span class="text-xs text-slate-600 dark:text-slate-300 font-mono">
                            Ahora: {nowDate.value.toLocaleString()} ({timezone})
                          </span>
                        </div>
                        <input 
                          type="date" 
                          name="due_date" 
                          id="due_date" 
                          bind:value={editingDueDate}
                          min={new Date().toISOString().split('T')[0]}
                          onChange$={(e, target) => {
                            customDate.value = target.value;
                            // Actualizar fecha UTC seleccionada correctamente (local -> UTC)
                            const dateParts = target.value.split('-').map(Number);
                            let hour24 = customHour.value;
                            if (timeFormat.value === '12h') {
                              hour24 = to24Hour(customHour.value, amPm.value);
                            }
                            const localDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], hour24, customMinute.value, 0, 0);
                            selectedUtcDate.value = new Date(localDate.getTime());
                            if (localDate.getTime() <= Date.now()) {
                              utcError.value = 'La fecha/hora seleccionada en UTC ya pasó. Elige una hora mayor.';
                            } else {
                              utcError.value = null;
                            }
                          }}
                          class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm" 
                        />
                        <div class="flex items-center space-x-2">
                          <div class="flex-1">
                            <label for="payment_hour" class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Hora</label>
                            <select
                              id="payment_hour"
                              name="customHour"
                              value={customHour.value.toString()}
                              onChange$={(e, target) => {
                                customHour.value = parseInt(target.value, 10);
                                // Actualizar fecha UTC seleccionada usando hora local
                                const dateParts = editingDueDate.value.split('-').map(Number);
                                let hour24 = customHour.value;
                                if (timeFormat.value === '12h') {
                                  hour24 = to24Hour(customHour.value, amPm.value);
                                }
                                const localDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], hour24, customMinute.value, 0, 0);
                                selectedUtcDate.value = new Date(localDate.getTime());
                                if (localDate.getTime() <= Date.now()) {
                                  utcError.value = 'La fecha/hora seleccionada en UTC ya pasó. Elige una hora mayor.';
                                } else {
                                  utcError.value = null;
                                }
                              }}
                              class="block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-2 px-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                              aria-label="Hour"
                            >
                              {timeFormat.value === '24h'
                                ? Array.from({length: 24}, (_, i) => i).map(hour => (
                                    <option key={hour} value={hour}>{hour.toString().padStart(2, '0')}</option>
                                  ))
                                : Array.from({length: 12}, (_, i) => i + 1).map(hour => (
                                    <option key={hour} value={hour}>{hour.toString().padStart(2, '0')}</option>
                                  ))}
                            </select>
                          </div>
                          {timeFormat.value === '12h' && (
                            <div class="flex-1">
                              <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">AM/PM</label>
                              <select
                                name="amPm"
                                value={amPm.value}
                                onChange$={(e, target) => {
                                  amPm.value = target.value as 'AM' | 'PM';
                                  // Actualizar fecha UTC seleccionada usando hora local
                                  const dateParts = editingDueDate.value.split('-').map(Number);
                                  const hour24 = to24Hour(customHour.value, amPm.value);
                                  const localDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], hour24, customMinute.value, 0, 0);
                                  selectedUtcDate.value = new Date(localDate.getTime());
                                  if (localDate.getTime() <= Date.now()) {
                                    utcError.value = 'La fecha/hora seleccionada en UTC ya pasó. Elige una hora mayor.';
                                  } else {
                                    utcError.value = null;
                                  }
                                }}
                                class="block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-2 px-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                                aria-label="AM/PM"
                              >
                                <option value="AM">AM</option>
                                <option value="PM">PM</option>
                              </select>
                            </div>
                          )}
                          <div class="flex-1">
                            <label for="payment_minute" class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Minutos</label>
                            <select
                              id="payment_minute"
                              name="customMinute"
                              value={customMinute.value.toString()}
                              onChange$={(e, target) => {
                                customMinute.value = parseInt(target.value, 10);
                                // Actualizar fecha UTC seleccionada usando hora local
                                const dateParts = editingDueDate.value.split('-').map(Number);
                                let hour24 = customHour.value;
                                if (timeFormat.value === '12h') {
                                  hour24 = to24Hour(customHour.value, amPm.value);
                                }
                                const localDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], hour24, customMinute.value, 0, 0);
                                selectedUtcDate.value = new Date(localDate.getTime());
                                if (localDate.getTime() <= Date.now()) {
                                  utcError.value = 'La fecha/hora seleccionada en UTC ya pasó. Elige una hora mayor.';
                                } else {
                                  utcError.value = null;
                                }
                              }}
                              class="block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-2 px-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                              aria-label="Minute"
                            >
                              <option value="0">00</option>
                              <option value="15">15</option>
                              <option value="30">30</option>
                              <option value="45">45</option>
                            </select>
                          </div>
                        </div>
                        {/* Toggle para formato 24h/12h */}
                        <div class="flex items-center mt-2">
                          <input
                            id="toggle-time-format"
                            type="checkbox"
                            checked={timeFormat.value === '12h'}
                            onChange$={(_, el) => {
                              timeFormat.value = el.checked ? '12h' : '24h';
                              // Al cambiar el formato, ajustar customHour y amPm
                              if (el.checked) {
                                // 24h -> 12h
                                const { hour12, ampm } = to12Hour(customHour.value);
                                customHour.value = hour12;
                                amPm.value = ampm;
                              } else {
                                // 12h -> 24h
                                customHour.value = to24Hour(customHour.value, amPm.value);
                              }
                            }}
                            class="h-4 w-4 text-teal-500 focus:ring-teal-400 border-gray-300 rounded"
                          />
                          <label for="toggle-time-format" class="ml-2 text-xs text-slate-600 dark:text-slate-400 select-none">
                            Usar formato 12h (AM/PM)
                          </label>
                        </div>
                      </div>
                      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Selecciona la fecha y hora exacta para el pago o automatización.<br />
                        <b>Zona horaria local:</b> {timezone} | <b>UTC:</b> {selectedUtcDate.value ? selectedUtcDate.value.toUTCString() : '-'}
                      </p>
                      {utcError.value && (
                        <div class="mt-1 text-xs text-red-600 dark:text-red-400 font-semibold">{utcError.value}</div>
                      )}
                    </div>
                    
                    {/* Automatización de pagos */}
                    <div class="pt-2 pb-1">
                      <div class="flex items-center">
                        <input 
                          type="checkbox" 
                          id="autoSchedule" 
                          checked={autoSchedulePayment.value}
                          onChange$={(e, el) => autoSchedulePayment.value = el.checked}
                          class="h-4 w-4 text-teal-500 focus:ring-teal-400 border-gray-300 rounded"
                        />
                        <label for="autoSchedule" class="ml-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                          Automatizar pago con TimeLock
                        </label>
                      </div>
                      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Al habilitar esta opción, el pago se programará automáticamente en la blockchain
                      </p>
                    </div>
                    
                    {autoSchedulePayment.value && (
                      <div class="p-3 bg-teal-50 dark:bg-teal-900/20 rounded-lg border border-teal-100 dark:border-teal-800/30">
                        <div class="p-2 flex items-center">
                          <LuInfo class="h-5 w-5 text-teal-600 dark:text-teal-400 mr-2" />
                          <p class="text-sm text-teal-700 dark:text-teal-300">
                            El pago se programará automáticamente para la fecha de vencimiento y hora seleccionadas arriba.
                          </p>
                        </div>
                        
                        <div class="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-lg">
                          <div class="flex items-center">
                            <LuCalendar class="h-4 w-4 text-blue-600 dark:text-blue-400 mr-2" />
                            <p class="text-xs text-blue-700 dark:text-blue-300">
                              <span class="font-semibold">Fecha de ejecución:</span> {editingDueDate.value} a las {customHour.value.toString().padStart(2, '0')}:{customMinute.value.toString().padStart(2, '0')}
                            </p>
                          </div>
                        </div>
                        
                        {/* Campo oculto para establecer el autoScheduleTime como 'duedate' */}
                        <input type="hidden" name="autoScheduleTime" value="duedate" />
                        {/* Campo oculto para AM/PM si aplica */}
                        {timeFormat.value === '12h' && (
                          <input type="hidden" name="amPm" value={amPm.value} />
                        )}
                      </div>
                    )}
                    
                    <div>
                      <label for="description" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
                      <textarea name="description" id="description" rows={3} bind:value={editingDescription} class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm"></textarea>
                    </div>
                    
                    {/* Campos ocultos para enviar información de automatización */}
                    <input type="hidden" name="autoSchedulePayment" value={autoSchedulePayment.value.toString()} />
                    <input type="hidden" name="autoScheduleTime" value={autoScheduleTime.value} />
                    <input type="hidden" name="customDate" value={customDate.value} />
                    <input type="hidden" name="customHour" value={customHour.value.toString()} />
                    {timeFormat.value === '12h' && (
                      <input type="hidden" name="amPm" value={amPm.value} />
                    )}
                    <input type="hidden" name="customMinute" value={customMinute.value.toString()} />
                    <input type="hidden" name="timezone" value={selectedTimezone.value} />
                  </div>
                </div>
                <div class="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 px-6 py-4 flex justify-between items-center">
                  <div>
                    {editingId.value && (
                      <Form action={deleteAction} class="inline-block">
                        <input type="hidden" name="id" value={editingId.value} />
                        <button type="submit" class="inline-flex items-center text-red-600 hover:text-red-800 dark:text-red-500 dark:hover:text-red-400 font-medium text-sm">
                          <LuTrash class="h-4 w-4 mr-1.5" /> Delete
                        </button>
                      </Form>
                    )}
                  </div>
                  <div class="flex items-center">
                    <button type="button" onClick$={() => showModal.value = false} class="inline-flex justify-center items-center rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm px-5 py-2.5 bg-white dark:bg-slate-800 text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 sm:w-auto sm:text-sm transition-all">
                      <LuX class="h-5 w-5 mr-2" /> Cancel
                    </button>
                    <button type="submit" disabled={saveAction.isRunning || !!utcError.value} class={`ml-3 w-full inline-flex justify-center items-center rounded-lg border border-transparent shadow-sm px-5 py-2.5 ${autoSchedulePayment.value ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700' : 'bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700'} text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 sm:w-auto sm:text-sm transition-all disabled:opacity-50`}>
                      {saveAction.isRunning ? <LuLoader2 class="animate-spin h-5 w-5 mr-2" /> : autoSchedulePayment.value ? <LuLock class="h-5 w-5 mr-2" /> : <LuSave class="h-5 w-5 mr-2" />}
                      {autoSchedulePayment.value ? 'Programar Pago para el ' + editingDueDate.value : 'Guardar Pago Manual'}
                    </button>
                  </div>
                </div>
                {saveAction.value?.success === false && (
                  <div class="p-4 bg-red-100 text-red-800 rounded-b-lg">
                    <LuAlertTriangle class="inline h-5 w-5 mr-2" /> {saveAction.value.error}
                  </div>
                )}
                
                {saveAction.value && 'warning' in saveAction.value && saveAction.value.warning && (
                  <div class="p-4 bg-amber-50 text-amber-700 rounded-b-lg border-t border-amber-200">
                    <LuAlertCircle class="inline h-5 w-5 mr-2" /> {String(saveAction.value.warning)}
                  </div>
                )}
              </Form>
            </div>
          </div>
        </div>
      )}
      
      {/* Time Selector Modal */}
      {showTimeSelector.value && (
        <div class="fixed inset-0 z-50 overflow-y-auto">
          <div class="flex items-end sm:items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div class="fixed inset-0 bg-slate-700/70 dark:bg-slate-900/80 backdrop-blur-md transition-opacity" aria-hidden="true" onClick$={() => {
              showTimeSelector.value = false;
              currentTimelockPayment.value = null;
            }}></div>
            <div class="inline-block align-bottom bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-xl text-left overflow-hidden shadow-2xl transform transition-all border border-slate-100/50 dark:border-slate-700/50 sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div class="px-6 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 class="text-xl leading-6 font-medium text-slate-800 dark:text-slate-100 flex items-center">
                  <LuClock class="inline-block h-6 w-6 mr-2 text-indigo-600 dark:text-indigo-400" />
                  Seleccionar Tiempo de Liberación
                </h3>
                
                {/* Wallet display */}
                {currentTimelockPayment.value?.professional_wallet && (
                  <div class="mt-3 flex items-center p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30">
                    <LuWallet class="h-5 w-5 text-indigo-500 dark:text-indigo-400 mr-2" />
                    <div>
                      <p class="text-sm font-medium text-slate-700 dark:text-slate-300">Wallet del Profesional:</p>
                      <p class="text-xs text-slate-500 dark:text-slate-400 font-mono">{currentTimelockPayment.value.professional_wallet}</p>
                    </div>
                  </div>
                )}
                
                <div class="mt-4">
                  <p class="text-sm text-slate-600 dark:text-slate-300 mb-3">
                    Selecciona cuándo se liberarán los fondos al profesional:
                  </p>
                  
                  {/* Quick selection buttons */}
                  <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                    <button 
                      onClick$={() => selectReleaseTime(30 * 60, '30 minutos')}
                      class={`px-3 py-2 rounded-lg text-sm font-medium ${customReleaseTimeLabel.value === '30 minutos' 
                        ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-400 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-700' 
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-600'}`}
                    >
                      30 minutos
                    </button>
                    <button 
                      onClick$={() => selectReleaseTime(60 * 60, '1 hora')}
                      class={`px-3 py-2 rounded-lg text-sm font-medium ${customReleaseTimeLabel.value === '1 hora' 
                        ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-400 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-700' 
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-600'}`}
                    >
                      1 hora
                    </button>
                    <button 
                      onClick$={() => selectReleaseTime(24 * 60 * 60, '1 día')}
                      class={`px-3 py-2 rounded-lg text-sm font-medium ${customReleaseTimeLabel.value === '1 día' 
                        ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-400 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-700' 
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-600'}`}
                    >
                      1 día
                    </button>
                    <button 
                      onClick$={() => selectReleaseTime(7 * 24 * 60 * 60, '1 semana')}
                      class={`px-3 py-2 rounded-lg text-sm font-medium ${customReleaseTimeLabel.value === '1 semana' 
                        ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-400 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-700' 
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-600'}`}
                    >
                      1 semana
                    </button>
                    <button 
                      onClick$={() => selectReleaseTime(30 * 24 * 60 * 60, '1 mes')}
                      class={`px-3 py-2 rounded-lg text-sm font-medium ${customReleaseTimeLabel.value === '1 mes' 
                        ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-400 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-700' 
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-600'}`}
                    >
                      1 mes
                    </button>
                    <button 
                      onClick$={() => {
                        showCustomDatePicker.value = !showCustomDatePicker.value;
                        
                        // Si estamos abriendo el selector, inicializar con fecha actual + 30min
                        if (showCustomDatePicker.value) {
                          const now = new Date();
                          now.setMinutes(now.getMinutes() + 30);
                          customDate.value = now.toISOString().split('T')[0];
                          customHour.value = now.getHours();
                          customMinute.value = now.getMinutes();
                          
                          // Si ya teníamos un tiempo personalizado, usar esos valores
                          if (customReleaseTime.value) {
                            const date = new Date(customReleaseTime.value * 1000);
                            customDate.value = date.toISOString().split('T')[0];
                            customHour.value = date.getHours();
                            customMinute.value = date.getMinutes();
                          }
                        }
                      }}
                      class={`px-3 py-2 rounded-lg text-sm font-medium ${showCustomDatePicker.value 
                        ? 'bg-purple-100 text-purple-700 border-2 border-purple-400 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700' 
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-600'}`}
                    >
                      <span class="flex items-center justify-center">
                        <LuClock class="h-4 w-4 mr-1.5" />
                        Personalizado
                      </span>
                    </button>
                  </div>
                  
                  {/* Custom date and time picker */}
                  {showCustomDatePicker.value && (
                    <div class="mb-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800/30">
                      <h4 class="font-medium text-purple-800 dark:text-purple-300 mb-3">Selecciona fecha y hora exactas</h4>
                      
                      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label class="block text-sm text-slate-600 dark:text-slate-400 mb-1">Fecha</label>
                          <input 
                            type="date" 
                            value={customDate.value} 
                            onChange$={(e, target) => {
                              customDate.value = target.value;
                              setCustomDateTime();
                            }}
                            class="w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-2 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                            min={new Date().toISOString().split('T')[0]}
                          />
                        </div>
                        
                        <div>
                          <label class="block text-sm text-slate-600 dark:text-slate-400 mb-1">Hora</label>
                          <select 
                            value={customHour.value.toString()} 
                            onChange$={(e, target) => {
                              customHour.value = parseInt(target.value, 10);
                              setCustomDateTime();
                            }}
                            class="w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-2 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                          >
                            {Array.from({length: 24}, (_, i) => i).map(hour => (
                              <option key={hour} value={hour}>{hour.toString().padStart(2, '0')}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <label class="block text-sm text-slate-600 dark:text-slate-400 mb-1">Minutos</label>
                          <select 
                            value={customMinute.value.toString()} 
                            onChange$={(e, target) => {
                              customMinute.value = parseInt(target.value, 10);
                              setCustomDateTime();
                            }}
                            class="w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-2 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                          >
                            <option value="0">00</option>
                            <option value="15">15</option>
                            <option value="30">30</option>
                            <option value="45">45</option>
                          </select>
                        </div>
                      </div>
                      
                      <div class="mt-3 text-sm text-purple-700 dark:text-purple-300">
                        <p>Tiempo seleccionado: <span class="font-semibold">{customReleaseTimeLabel.value || "-"}</span></p>
                        <p class="text-xs text-purple-600 dark:text-purple-400 mt-1">
                          <LuInfo class="inline-block h-3.5 w-3.5 mr-1" />
                          El tiempo mínimo para la liberación es de 30 minutos desde ahora
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* Token and Selected time info */}
                  <div class="mb-4 space-y-3">
                    {/* Token info */}
                    {currentTimelockPayment.value?.currency && (
                      <div class="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg flex items-start">
                        <LuLock class="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                        <div>
                          <p class="font-medium">Token seleccionado: {currentTimelockPayment.value.currency}</p>
                          {currentTimelockPayment.value.currency === 'KNRT' && (
                            <p class="text-sm mt-1">KNRT - Konecta Real Estate Token</p>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Time info - Automatización directa */}
                    {saveAction.value?.releaseTimestamp && (
                      <div class="p-3 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 rounded-lg flex items-start">
                        <LuClock class="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                        <div>
                          <p class="font-medium">Tiempo de liberación: {saveAction.value.releaseDescription || formatTimestamp(saveAction.value.releaseTimestamp)}</p>
                          <p class="text-sm mt-1">El pago se desbloqueará automáticamente el: {formatTimestamp(saveAction.value.releaseTimestamp)}</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Time info - Selector manual */}
                    {!saveAction.value?.releaseTimestamp && customReleaseTime.value && (
                      <div class="p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg flex items-start">
                        <LuCheckCircle class="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                        <div>
                          <p class="font-medium">Tiempo seleccionado: {customReleaseTimeLabel.value}</p>
                          <p class="text-sm mt-1">Los fondos se liberarán el: {formatTimestamp(customReleaseTime.value)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Or use default date */}
                  <div class="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg flex items-start">
                    <div class="flex items-center h-5">
                      <input 
                        id="use-due-date" 
                        type="checkbox" 
                        checked={customReleaseTime.value === null}
                        onClick$={() => {
                          if (customReleaseTime.value !== null) {
                            customReleaseTime.value = null;
                            customReleaseTimeLabel.value = '';
                          }
                        }}
                        class="h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                      />
                    </div>
                    <label for="use-due-date" class="ml-3 text-sm">
                      <span class="font-medium text-slate-700 dark:text-slate-300">Usar fecha de vencimiento original</span>
                      {currentTimelockPayment.value?.due_date && (
                        <p class="text-slate-500 dark:text-slate-400">{new Date(currentTimelockPayment.value.due_date).toLocaleDateString()}</p>
                      )}
                    </label>
                  </div>
                </div>
              </div>
              
              <div class="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 px-6 py-4 flex justify-between">
                <button 
                  type="button" 
                  onClick$={() => {
                    showTimeSelector.value = false;
                    currentTimelockPayment.value = null;
                    customReleaseTime.value = null;
                    customReleaseTimeLabel.value = '';
                  }}
                  class="inline-flex justify-center items-center rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm px-5 py-2.5 bg-white dark:bg-slate-800 text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:w-auto sm:text-sm transition-all"
                >
                  <LuX class="h-4 w-4 mr-2" />
                  Cancelar
                </button>
                <button 
                  type="button" 
                  onClick$={() => executeTimelockCreation(currentTimelockPayment.value)}
                  class="inline-flex justify-center items-center rounded-lg border border-transparent shadow-sm px-5 py-2.5 bg-gradient-to-r from-teal-500 to-teal-600 text-white hover:from-teal-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 sm:w-auto sm:text-sm"
                >
                  <LuLock class="h-4 w-4 mr-2" />
                  Crear TimeLock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Timelock Status Modal */}
      {showTimelockModal.value && (
        <div class="fixed inset-0 z-50 overflow-y-auto">
          <div class="flex items-end sm:items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div class="fixed inset-0 bg-slate-700/70 dark:bg-slate-900/80 backdrop-blur-md transition-opacity" aria-hidden="true" onClick$={() => {
              showTimelockModal.value = false;
              currentTimelockPayment.value = null;
            }}></div>
            <div class="inline-block align-bottom bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-xl text-left overflow-hidden shadow-2xl transform transition-all border border-slate-100/50 dark:border-slate-700/50 sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div class="p-6">
                <div class="sm:flex sm:items-start">
                  {timelock.error.value ? (
                    <>
                      <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 sm:mx-0 sm:h-10 sm:w-10">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-red-600 dark:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                        <h3 class="text-lg leading-6 font-medium text-slate-900 dark:text-slate-100">Error al crear el TimeLock</h3>
                        <div class="mt-2">
                          <p class="text-sm text-slate-500 dark:text-slate-400">{timelock.error.value}</p>
                          
                          {/* Mostrar instrucciones adicionales si el error está relacionado con conectar MetaMask */}
                          {timelock.error.value.includes("MetaMask") && (
                            <div class="mt-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-xs">
                              <p class="font-medium mb-1 text-slate-700 dark:text-slate-300">Posibles soluciones:</p>
                              <ul class="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
                                <li>Verifica que la extensión de MetaMask está instalada en tu navegador</li>
                                <li>Asegúrate de que tu wallet esté desbloqueada</li>
                                <li>Intenta conectarte nuevamente haciendo clic en el botón "Conectar Wallet"</li>
                                <li>Si el problema persiste, recarga la página e intenta de nuevo</li>
                              </ul>
                              <button 
                                onClick$={() => timelock.connect()}
                                class="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs flex items-center"
                              >
                                <LuWallet class="w-3 h-3 mr-1" />
                                Conectar Wallet
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : timelock.status.value.includes("Lock creado") ? (
                    <>
                      <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 sm:mx-0 sm:h-10 sm:w-10">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-green-600 dark:text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                        <h3 class="text-lg leading-6 font-medium text-slate-900 dark:text-slate-100">TimeLock Creado Exitosamente</h3>
                        <div class="mt-2">
                          <p class="text-sm text-slate-500 dark:text-slate-400">
                            El pago ha sido programado con éxito en el contrato inteligente.
                          </p>
                          {currentTimelockPayment.value && (
                            <div class="mt-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-xs">
                              <div><span class="font-medium">Profesional:</span> {currentTimelockPayment.value.professional_name}</div>
                              <div><span class="font-medium">Wallet:</span> {currentTimelockPayment.value.professional_wallet}</div>
                              <div><span class="font-medium">Monto:</span> {currentTimelockPayment.value.amount} {currentTimelockPayment.value.currency}</div>
                              <div><span class="font-medium">Fecha de liberación:</span> {new Date(currentTimelockPayment.value.due_date).toLocaleDateString()}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 sm:mx-0 sm:h-10 sm:w-10">
                        <svg class="animate-spin h-6 w-6 text-blue-600 dark:text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </div>
                      <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                        <h3 class="text-lg leading-6 font-medium text-slate-900 dark:text-slate-100">
                          {timelock.status.value || "Creando TimeLock"}
                        </h3>
                        <div class="mt-2">
                          <p class="text-sm text-slate-500 dark:text-slate-400">
                            Por favor, confirma la transacción en MetaMask...
                          </p>
                          
                          {/* Mostrar información del estado actual */}
                          {timelock.address.value && (
                            <div class="mt-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-xs">
                              <div><span class="font-medium">Wallet conectada:</span> {timelock.address.value}</div>
                              {currentTimelockPayment.value && (
                                <>
                                  <div><span class="font-medium">Profesional:</span> {currentTimelockPayment.value.professional_name}</div>
                                  <div><span class="font-medium">Monto:</span> {currentTimelockPayment.value.amount} {currentTimelockPayment.value.currency}</div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <button 
                    type="button"
                    onClick$={() => {
                      showTimelockModal.value = false;
                      if (timelock.error.value) {
                        timelock.error.value = "";
                      }
                    }}
                    class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-base font-medium text-white hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Cerrar
                  </button>
                  
                  {/* Botón para reconectar si hay un error de conexión */}
                  {timelock.error.value && timelock.error.value.includes("MetaMask") && (
                    <button 
                      type="button"
                      onClick$={() => {
                        timelock.error.value = "";
                        timelock.connect();
                      }}
                      class="mt-3 sm:mt-0 w-full inline-flex justify-center rounded-md border border-blue-500 px-4 py-2 bg-white text-base font-medium text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                    >
                      <LuWallet class="w-4 h-4 mr-1" />
                      Conectar MetaMask
                    </button>
                  )}
                </div>
              </div>
              <div class="px-6 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 class="text-xl leading-6 font-medium text-slate-800 dark:text-slate-100">
                  <LuLock class="inline-block h-6 w-6 mr-2 text-indigo-600 dark:text-indigo-400" />
                  Estado del TimeLock
                </h3>
                
                {/* Professional Wallet Address - New Section */}
                {currentTimelockPayment.value?.professional_wallet && (
                  <div class="mt-3 flex items-center p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30">
                    <LuWallet class="h-5 w-5 text-indigo-500 dark:text-indigo-400 mr-2" />
                    <div>
                      <p class="text-sm font-medium text-slate-700 dark:text-slate-300">Wallet del Profesional:</p>
                      <p class="text-xs text-slate-500 dark:text-slate-400 font-mono">{currentTimelockPayment.value.professional_wallet}</p>
                    </div>
                  </div>
                )}
                
                <div class="mt-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-700/30">
                  {timelock.error.value ? (
                    <div class="text-red-600 dark:text-red-400">
                      <LuAlertTriangle class="inline-block h-5 w-5 mr-2" />
                      {timelock.error.value}
                    </div>
                  ) : timelock.status.value ? (
                    <div class="text-green-600 dark:text-green-400">
                      <LuCheckCircle class="inline-block h-5 w-5 mr-2" />
                      {timelock.status.value}
                    </div>
                  ) : (
                    <div class="text-slate-600 dark:text-slate-300 flex items-center">
                      <LuLoader2 class="animate-spin h-5 w-5 mr-2" />
                      Procesando operación...
                    </div>
                  )}
                </div>
              </div>
              
              <div class="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 px-6 py-4 flex justify-end">
                <button 
                  type="button" 
                  onClick$={() => {
                    showTimelockModal.value = false;
                    showTimelockPanel.value = true;
                    currentTimelockPayment.value = null; // Limpiar el pago actual
                  }}
                  class="inline-flex justify-center items-center rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm px-5 py-2.5 bg-white dark:bg-slate-800 text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:w-auto sm:text-sm transition-all"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
});