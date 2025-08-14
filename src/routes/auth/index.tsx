import { component$, useSignal } from '@builder.io/qwik';
import { routeLoader$, routeAction$, Form } from '@builder.io/qwik-city';
import { hashPassword, verifyPassword, setCookies, clearAuthCookies } from '~/utils/auth';
import { tursoClient, runMigrations } from '~/utils/turso';
import { 
  LuArrowLeft, 
  LuUser, 
  LuLock, 
  LuMail,
  LuAlertCircle,
  LuCheckCircle,
  LuLoader
} from '@qwikest/icons/lucide';

export const useLogout = routeAction$(async (data, requestEvent) => {
  try {
    console.log('[LOGOUT] Starting logout process');
    clearAuthCookies(requestEvent);
    requestEvent.redirect(302, '/auth');
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Logout failed' };
  }
});

export const useCheckEmail = routeAction$(async (data, requestEvent) => {
  const client = tursoClient(requestEvent);
  const { email } = data as { email: string };

  try {
    const result = await client.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [email]
    });

    return {
      success: true,
      isRegistered: result.rows.length > 0
    };
  } catch (error) {
    console.error('Email check error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to check email' 
    };
  }
});

export const useRegister = routeAction$(async (data, requestEvent) => {
  const client = tursoClient(requestEvent);
  const {
    email,
    password,
    username // <-- agrega username si viene del formulario
  } = data as {
    email: string;
    password: string;
    username?: string;
  };

  try {
    const passwordHash = await hashPassword(password);
    // First registration is admin, others are normal users
    const firstUserCheck = await client.execute({
      sql: 'SELECT COUNT(*) as count FROM users',
      args: []
    });
    
    const isFirstUser = firstUserCheck.rows[0].count === 0;
    // Si el email es golfredo.pf@gmail.com, asignar tipo admin
    const userType = (email === 'golfredo.pf@gmail.com') ? 'admin' : (isFirstUser ? 'admin' : 'freelancer');
    
    let userId;
    const result = await client.execute({
      sql: 'INSERT INTO users (email, password_hash, type, username) VALUES (?, ?, ?, ?)',
      args: [email, passwordHash, userType, username || email.split('@')[0]]
    });
    userId = result.lastInsertRowid;
    if (!userId) {
      throw new Error("Registration failed: userId is undefined");
    }
    setCookies(requestEvent, userId, userType);
    requestEvent.redirect(302, '/');
    return { success: true };
  } catch (error) {
    console.error('Registration error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed'
    };
  }
});

// Loader to ensure DB tables exist y migraciones
export const useDbInitializer = routeLoader$(async (requestEvent) => {
//  await runMigrations(requestEvent);
  // Ejecuta también createAdminUser para asegurar admin
  // await createAdminUser(requestEvent);
  return { success: true };
});

export const useLogin = routeAction$(async (data, requestEvent) => {
  const client = tursoClient(requestEvent);
  const { email, password } = data as { email: string; password: string };

  try {
    console.log('[LOGIN] Intentando login para email:', email);
    const result = await client.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [email]
    });
    console.log('[LOGIN] Resultado de búsqueda en DB:', result.rows);

    const user = result.rows[0];
    if (!user) {
      console.error('[LOGIN] Usuario no encontrado para email:', email);
      return { success: false, error: 'Usuario no encontrado' };
    }
    if (typeof user.password_hash !== 'string') {
      console.error('[LOGIN] password_hash inválido:', user.password_hash);
      return { success: false, error: 'password_hash inválido' };
    }
    if (!user.id) {
      console.error('[LOGIN] user.id inválido:', user.id);
      return { success: false, error: 'user.id inválido' };
    }
    console.log('[LOGIN] password ingresada:', password);
    console.log('[LOGIN] hash guardado:', user.password_hash);
    const isValid = await verifyPassword(password, user.password_hash);
    console.log('[LOGIN] resultado de verifyPassword:', isValid);
    if (!isValid) {
      console.error('[LOGIN] Contraseña incorrecta para email:', email);
      return { success: false, error: 'Contraseña incorrecta' };
    }

    // Convert user.id to string to avoid type issues
    const userIdString = String(user.id);

    try {
      await client.execute({
        sql: 'UPDATE users SET session_expires = ? WHERE id = ?',
        args: [new Date(Date.now() + 60 * 60 * 1000), userIdString]
      });
      console.log('[LOGIN] session_expires actualizado para user:', userIdString);
    } catch (e) {
      console.error('[LOGIN] Error actualizando session_expires:', e);
    }

    // Get user type with proper type casting
    const userType = (user.type === 'admin')
      ? 'admin'
      : (user.type === 'super_admin')
        ? 'super_admin'
        : 'freelancer';

    // Use the utility function to set cookies
    setCookies(requestEvent, userIdString, userType);
    console.log('[LOGIN] Cookies seteadas para user:', userIdString, userType);

    requestEvent.redirect(302, '/');
    return { success: true };
  } catch (error) {
    console.error('[LOGIN] Error general en login:', error);
    return { success: false, error: 'Login failed' };
  }
});

// Ejecuta el loader siempre que se cargue la ruta
export default component$(() => {
  useDbInitializer();
  const dbInit = useDbInitializer();
  const checkEmailAction = useCheckEmail();
  const registerAction = useRegister();
  const loginAction = useLogin();
  const step = useSignal<'email' | 'password' | 'register'>('email');
  const email = useSignal('');
  const password = useSignal('');
  const errorMessage = useSignal('');
  const isLoading = useSignal(false);

  if (dbInit.value?.success) {
    console.log('Tables initialized successfully');
  }

  return (
    <main class="min-h-screen bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex flex-col items-center justify-center">
      <header class="w-full flex flex-col items-center py-8 mb-2">
        <h1 class="text-3xl md:text-4xl font-extrabold text-slate-700 dark:text-teal-400 mb-2 flex items-center gap-2 animate-slide-down">
          <span role="img" aria-label="clock">⏱️</span> Welcome to SaveeTimelock
        </h1>
        <p class="text-center text-lg text-slate-600 dark:text-slate-300 max-w-2xl animate-fade-in">
          Sign in or register to start tracking your time and managing your projects.
        </p>
      </header>
      <section class="w-full flex flex-col items-center">
        <div class="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm p-2 md:p-6 animate-grow-in transition-transform duration-700">
          {/* Email Step */}
          {step.value === 'email' && (
            <Form 
              action={checkEmailAction} 
              class="space-y-6"
              onSubmit$={async () => {
                isLoading.value = true;
                errorMessage.value = '';
                await new Promise(resolve => setTimeout(resolve, 500));
                if (checkEmailAction.value?.success) {
                  step.value = checkEmailAction.value.isRegistered ? 'password' : 'register';
                  email.value = (document.getElementById('email') as HTMLInputElement).value;
                } else {
                  errorMessage.value = checkEmailAction.value?.error || 'Failed to check email';
                }
                isLoading.value = false;
              }}
            >
              <div class="space-y-2">
                <label for="email" class="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Email address
                </label>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <LuMail class="h-5 w-5 text-slate-400 dark:text-slate-500" />
                  </div>
                  <input 
                    id="email" 
                    name="email" 
                    type="email" 
                    required 
                    class="pl-10 block w-full rounded-xl border-0 py-3 text-slate-700 dark:text-white shadow-sm ring-1 ring-inset ring-slate-300 dark:ring-slate-600 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-inset focus:ring-teal-500 dark:focus:ring-teal-400 bg-white dark:bg-gray-800"
                    placeholder="your@email.com"
                  />
                </div>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  We'll check if you already have an account
                </p>
              </div>
              <button
                type="submit"
                disabled={isLoading.value}
                class="w-full flex justify-center items-center py-3 px-4 rounded-xl text-white bg-gradient-to-r from-slate-700 to-teal-500 hover:from-slate-800 hover:to-teal-600 dark:from-slate-700 dark:to-teal-600 font-medium shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading.value ? (
                  <span class="flex items-center">
                    <LuLoader class="animate-spin mr-2 h-5 w-5 text-white" />
                    Verifying...
                  </span>
                ) : (
                  'Continue'
                )}
              </button>
            </Form>
          )}

          {/* Password Step (Login) */}
          {step.value === 'password' && (
            <Form 
              action={loginAction} 
              class="space-y-6"
              onSubmit$={async () => {
                isLoading.value = true;
                errorMessage.value = '';
                await new Promise(resolve => setTimeout(resolve, 500));
                if (!loginAction.value?.success) {
                  errorMessage.value = loginAction.value?.error || 'Login failed';
                }
                isLoading.value = false;
              }}
            >
              <input type="hidden" name="email" value={email.value} />
              <div class="space-y-2">
                <label for="password" class="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Password
                </label>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <LuLock class="h-5 w-5 text-slate-400 dark:text-slate-500" />
                  </div>
                  <input 
                    id="password" 
                    name="password" 
                    type="password" 
                    required 
                    class="pl-10 block w-full rounded-xl border-0 py-3 text-slate-700 dark:text-white shadow-sm ring-1 ring-inset ring-slate-300 dark:ring-slate-600 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-inset focus:ring-teal-500 dark:focus:ring-teal-400 bg-white dark:bg-gray-800"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <div class="flex justify-between items-center">
                <button 
                  type="button"
                  onClick$={() => {
                    step.value = 'email';
                    password.value = '';
                    errorMessage.value = '';
                  }}
                  class="flex items-center px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 text-sm"
                >
                  <LuArrowLeft class="mr-2 h-4 w-4" />
                  Back
                </button>
                <button 
                  type="submit" 
                  disabled={isLoading.value}
                  class="flex justify-center items-center py-2 px-6 rounded-lg text-white bg-gradient-to-r from-slate-700 to-teal-500 hover:from-slate-800 hover:to-teal-600 dark:from-slate-700 dark:to-teal-600 font-medium shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading.value ? (
                    <span class="flex items-center">
                      <LuLoader class="animate-spin mr-2 h-5 w-5 text-white" />
                      Signing in...
                    </span>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </div>
            </Form>
          )}

          {/* Register Step */}
          {step.value === 'register' && (
            <Form 
              action={registerAction} 
              class="space-y-6"
              onSubmit$={async () => {
                isLoading.value = true;
                errorMessage.value = '';
                await new Promise(resolve => setTimeout(resolve, 500));
                if (!registerAction.value?.success) {
                  errorMessage.value = registerAction.value?.error || 'Registration failed';
                }
                isLoading.value = false;
              }}
            >
              <input type="hidden" name="email" value={email.value} />
              <div class="space-y-2">
                <label for="password" class="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Create a password
                </label>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <LuLock class="h-5 w-5 text-slate-400 dark:text-slate-500" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    class="pl-10 block w-full rounded-xl border-0 py-3 text-slate-700 dark:text-white shadow-sm ring-1 ring-inset ring-slate-300 dark:ring-slate-600 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-inset focus:ring-teal-500 dark:focus:ring-teal-400 bg-white dark:bg-gray-800"
                    placeholder="••••••••"
                    minLength={6}
                  />
                </div>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Password must be at least 6 characters
                </p>
              </div>
              <div class="flex justify-between items-center">
                <button 
                  type="button"
                  onClick$={() => {
                    step.value = 'email';
                    password.value = '';
                    errorMessage.value = '';
                  }}
                  class="flex items-center px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 text-sm"
                >
                  <LuArrowLeft class="mr-2 h-4 w-4" />
                  Back
                </button>
                <button 
                  type="submit" 
                  disabled={isLoading.value}
                  class="flex justify-center items-center py-2 px-6 rounded-lg text-white bg-gradient-to-r from-slate-700 to-teal-500 hover:from-slate-800 hover:to-teal-600 dark:from-slate-700 dark:to-teal-600 font-medium shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading.value ? (
                    <span class="flex items-center">
                      <LuLoader class="animate-spin mr-2 h-5 w-5 text-white" />
                      Creating account...
                    </span>
                  ) : (
                    'Create account'
                  )}
                </button>
              </div>
            </Form>
          )}

          {/* Error Message */}
          {errorMessage.value && (
            <div class="mt-6 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl animate-[slide-up_0.3s_ease-out]">
              <div class="flex items-start">
                <LuAlertCircle class="h-5 w-5 text-rose-500 dark:text-rose-400 mt-0.5 mr-2 flex-shrink-0" />
                <p class="text-sm text-rose-600 dark:text-rose-300">
                  {errorMessage.value}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
      <div class="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
        By continuing, you agree to our
        <a href="#" class="text-teal-600 hover:text-teal-500 dark:text-teal-400 dark:hover:text-teal-300 ml-1">Terms of Service</a>
        <span class="mx-1">and</span>
        <a href="#" class="text-teal-600 hover:text-teal-500 dark:text-teal-400 dark:hover:text-teal-300">Privacy Policy</a>
      </div>
      <style>{`
        .animate-fade-in { animation: fadeIn 1s both; }
        .animate-slide-down { animation: slideDown 0.8s both; }
        .animate-slide-up { animation: slideUp 0.7s both; }
        .animate-grow-in { animation: growIn 1.2s both; }
        .animate-pop { animation: popIn 0.5s both; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-40px); } to { opacity: 1, transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1, transform: translateY(0); } }
        @keyframes growIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1, transform: scale(1); } }
        @keyframes popIn { 0% { transform: scale(0.7); opacity: 0; } 80% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); } }
      `}</style>
    </main>
  );
});