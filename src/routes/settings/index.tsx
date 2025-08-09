import { component$, useSignal } from '@builder.io/qwik';
import { routeLoader$, routeAction$, Form, zod$, z } from '@builder.io/qwik-city';
import { tursoClient } from '~/utils/turso';
import { getSession } from '~/utils/auth';
import { 
  LuSettings, 
  LuSave, 
  LuLoader2, 
  LuAlertTriangle, 
  LuBuilding, 
  LuFileText, 
  LuPalette, 
  LuBell,
  LuCreditCard
} from '@qwikest/icons/lucide';

// Type Definition
interface Settings {
  id: number;
  company_name: string;
  company_email: string;
  company_logo_url?: string;
  invoice_prefix: string;
  default_currency: string;
  payment_methods: string; // JSON string
  notifications_enabled: boolean;
  theme: 'light' | 'dark' | 'system';
  updated_at: string;
}

// Data Loader
export const useSettingsLoader = routeLoader$(async (requestEvent) => {
  const db = tursoClient(requestEvent);
  const result = await db.execute('SELECT * FROM app_settings WHERE id = 1');
  
  const row = result.rows[0] as any;
  return {
    ...row,
    notifications_enabled: Boolean(row.notifications_enabled),
  } as unknown as Settings;
});

// Update Settings Action
export const useUpdateSettings = routeAction$(
  async (data, requestEvent) => {
    const session = await getSession(requestEvent);
    if (!session?.is_admin) return { success: false, error: 'Unauthorized' };

    const db = tursoClient(requestEvent);
    try {
      await db.execute({
        sql: `
          UPDATE app_settings SET 
            company_name = ?, company_email = ?, company_logo_url = ?, 
            invoice_prefix = ?, default_currency = ?, payment_methods = ?, 
            notifications_enabled = ?, theme = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = 1
        `,
        args: [
          data.company_name, data.company_email, data.company_logo_url || null,
          data.invoice_prefix, data.default_currency, JSON.stringify(data.payment_methods),
          data.notifications_enabled ? 1 : 0, data.theme
        ]
      });
      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: 'Failed to update settings.' };
    }
  },
  zod$({
    company_name: z.string().min(1),
    company_email: z.string().email(),
    company_logo_url: z.string().url().optional().or(z.literal('')),
    invoice_prefix: z.string().max(10),
    default_currency: z.string(),
    payment_methods: z.array(z.string()),
    notifications_enabled: z.boolean(),
    theme: z.enum(['light', 'dark', 'system'])
  })
);

export default component$(() => {

  const settings = useSettingsLoader();
  const updateAction = useUpdateSettings();

  const company_name = useSignal(settings.value.company_name);
  const company_email = useSignal(settings.value.company_email);
  const company_logo_url = useSignal(settings.value.company_logo_url || '');
  const invoice_prefix = useSignal(settings.value.invoice_prefix);
  const default_currency = useSignal(settings.value.default_currency);
  const payment_methods = useSignal<string[]>(JSON.parse(settings.value.payment_methods || '[]'));
  const notifications_enabled = useSignal(!!settings.value.notifications_enabled);
  const theme = useSignal(settings.value.theme);

  const availablePaymentMethods = [
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'paypal', label: 'PayPal' },
    { value: 'wise', label: 'Wise' },
    { value: 'crypto', label: 'Crypto' },
  ];

  const availableCurrencies = [
    { value: 'USD', label: 'USD - US Dollar' },
    { value: 'EUR', label: 'EUR - Euro' },
  ];

  const themeOptions = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' }
  ];

  return (
    <main class="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <header class="mb-8 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700 rounded-xl shadow-sm p-6">
          <div class="flex items-center">
            <LuSettings class="h-8 w-8 text-teal-600 dark:text-teal-500 mr-3" />
            <div>
              <h1 class="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">Application Settings</h1>
              <p class="text-slate-500 dark:text-slate-400 mt-1">Manage global application settings</p>
            </div>
          </div>
        </header>

        <Form action={updateAction} class="space-y-8">
          {/* Company Information */}
          <div class="bg-white dark:bg-slate-800 shadow-lg rounded-xl border border-slate-200 dark:border-slate-700">
            <div class="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center">
              <LuBuilding class="h-6 w-6 text-teal-600 dark:text-teal-500 mr-3" />
              <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100">Company Information</h2>
            </div>
            <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label for="company_name" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Company Name</label>
                <input type="text" name="company_name" id="company_name" bind:value={company_name} class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-2 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500" />
              </div>
              <div>
                <label for="company_email" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Company Email</label>
                <input type="email" name="company_email" id="company_email" bind:value={company_email} class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-2 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500" />
              </div>
              <div class="md:col-span-2">
                <label for="company_logo_url" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Logo URL</label>
                <input type="url" name="company_logo_url" id="company_logo_url" bind:value={company_logo_url} class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-2 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500" />
              </div>
            </div>
          </div>

          {/* Invoice Settings */}
          <div class="bg-white dark:bg-slate-800 shadow-lg rounded-xl border border-slate-200 dark:border-slate-700">
            <div class="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center">
              <LuFileText class="h-6 w-6 text-teal-600 dark:text-teal-500 mr-3" />
              <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100">Invoice Settings</h2>
            </div>
            <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label for="invoice_prefix" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Invoice Prefix</label>
                <input type="text" name="invoice_prefix" id="invoice_prefix" bind:value={invoice_prefix} class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-2 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500" />
              </div>
              <div>
                <label for="default_currency" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Default Currency</label>
                <select name="default_currency" id="default_currency" bind:value={default_currency} class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-2 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500">
                  {availableCurrencies.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Payment Methods */}
          <div class="bg-white dark:bg-slate-800 shadow-lg rounded-xl border border-slate-200 dark:border-slate-700">
            <div class="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center">
              <LuCreditCard class="h-6 w-6 text-teal-600 dark:text-teal-500 mr-3" />
              <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100">Payment Methods</h2>
            </div>
            <div class="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              {availablePaymentMethods.map(method => (
                <div key={method.value} class="flex items-center">
                  <input
                    type="checkbox"
                    id={`payment-${method.value}`}
                    name="payment_methods"
                    value={method.value}
                    checked={payment_methods.value.includes(method.value)}
                    onChange$={(e) => {
                      const checked = (e.target as HTMLInputElement).checked;
                      if (checked) {
                        payment_methods.value = [...payment_methods.value, method.value];
                      } else {
                        payment_methods.value = payment_methods.value.filter(m => m !== method.value);
                      }
                    }}
                    class="h-4 w-4 text-teal-600 focus:ring-teal-500 border-slate-300 dark:border-slate-600 rounded"
                  />
                  <label for={`payment-${method.value}`} class="ml-2 text-sm text-slate-700 dark:text-slate-300">{method.label}</label>
                </div>
              ))}
            </div>
          </div>

          {/* Appearance & Notifications */}
          <div class="bg-white dark:bg-slate-800 shadow-lg rounded-xl border border-slate-200 dark:border-slate-700">
            <div class="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center">
              <LuPalette class="h-6 w-6 text-teal-600 dark:text-teal-500 mr-3" />
              <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100">Appearance & Notifications</h2>
            </div>
            <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div>
                <label for="theme" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Theme</label>
                <select name="theme" id="theme" bind:value={theme} class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-2 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500">
                  {themeOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div class="flex items-center pt-6">
                <input type="checkbox" id="notifications_enabled" name="notifications_enabled" bind:checked={notifications_enabled} class="h-4 w-4 text-teal-600 focus:ring-teal-500 border-slate-300 dark:border-slate-600 rounded" />
                <label for="notifications_enabled" class="ml-2 text-sm font-medium text-slate-700 dark:text-slate-300">Enable Notifications</label>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div class="flex justify-end items-center pt-4">
            {updateAction.value?.success === false && (
              <div class="text-red-600 dark:text-red-400 mr-4 flex items-center">
                <LuAlertTriangle class="h-5 w-5 mr-2" />
                {updateAction.value.error}
              </div>
            )}
            <button type="submit" disabled={updateAction.isRunning} class="inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all duration-200 disabled:opacity-50">
              {updateAction.isRunning ? <LuLoader2 class="animate-spin h-5 w-5 mr-2" /> : <LuSave class="h-5 w-5 mr-2" />}
              Save Settings
            </button>
          </div>
        </Form>
      </div>
    </main>
  );
});
