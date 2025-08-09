import { component$ } from '@builder.io/qwik';
import { RequestHandler, routeAction$, Form } from '@builder.io/qwik-city';
import { LuLogOut, LuLoader } from '@qwikest/icons/lucide';
import { clearAuthCookies } from '~/utils/auth';

export const onGet: RequestHandler = ({ cookie, redirect }) => {
  // Elimina todas las cookies de autenticación
  cookie.delete('auth_token', { path: '/' });
  cookie.delete('user_type', { path: '/' });

  // Redirige al usuario a la ruta de login
  throw redirect(302, '/auth');
};

export const useLogout = routeAction$(async (data, requestEvent) => {
  try {
    console.log('[LOGOUT] Starting logout process');
    
    // Use a more robust approach to clear cookies
    clearAuthCookies(requestEvent);
    
    // Add a short delay to ensure cookies are cleared
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check if cookies were actually cleared
    const authToken = requestEvent.cookie.get('auth_token');
    const userType = requestEvent.cookie.get('user_type');
    
    if (authToken || userType) {
      console.error('[LOGOUT] Cookies not cleared properly:', { authToken, userType });
      throw new Error('Failed to clear authentication cookies');
    }
    
    console.log('[LOGOUT] Successfully cleared all cookies');
    requestEvent.redirect(302, '/auth');
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Logout failed' };
  }
});

export default component$(() => {
  const logoutAction = useLogout();
  const isLoading = logoutAction.isRunning;
  const hasError = logoutAction.value?.success === false;

  return (
    <div class="min-h-screen w-full flex items-center justify-center transition-colors duration-300 bg-gradient-to-b from-blue-50 to-indigo-100 dark:from-gray-950 dark:to-blue-950 py-6 px-4 sm:px-6 lg:px-8 overflow-hidden relative">
      {/* Decorative elements */}
      <div class="fixed inset-0 pointer-events-none overflow-hidden">
        <div class="w-20 h-20 bg-blue-500/10 rounded-full absolute top-[10%] left-[15%] animate-[float_15s_infinite]"></div>
        <div class="w-32 h-32 bg-indigo-500/10 rounded-full absolute top-[30%] left-[65%] animate-[float_18s_infinite]" style="animation-delay: 0.5s;"></div>
        <div class="w-16 h-16 bg-teal-500/10 rounded-full absolute top-[70%] left-[25%] animate-[float_12s_infinite]" style="animation-delay: 1s;"></div>
      </div>

      {/* Logo/Branding */}
      <div class="absolute top-6 left-1/2 transform -translate-x-1/2">
        <div class="flex items-center">
          <div class="relative">
            <div class="w-10 h-10 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z" />
              </svg>
            </div>
          </div>
          <h1 class="ml-2 text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
            Move On Challenge
          </h1>
        </div>
      </div>

      {/* Main Logout Card */}
      <div class="max-w-md w-full z-10">
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden backdrop-blur-sm p-8 animate-[fade-in_0.5s_ease-out]">
          <div class="text-center mb-8">
            <h2 class="text-3xl font-bold mb-3 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
              Log Out
            </h2>
            <p class="text-gray-600 dark:text-gray-400">
              Are you sure you want to log out?
            </p>
          </div>

          {/* Logout Form */}
          <Form action={logoutAction} class="space-y-6" spaReset preventdefault:submit={isLoading}>
            <button
              type="submit"
              disabled={isLoading}
              class="w-full flex justify-center items-center py-3 px-4 rounded-xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 dark:from-blue-500 dark:to-indigo-500 dark:hover:from-blue-600 dark:hover:to-indigo-600 font-medium shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span class="flex items-center">
                  <LuLoader class="animate-spin mr-2 h-5 w-5" />
                  Logging out...
                </span>
              ) : (
                <span class="flex items-center">
                  <LuLogOut class="mr-2 h-5 w-5" />
                  Confirm Logout
                </span>
              )}
            </button>
            
            {hasError && (
              <div class="p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm mt-4">
                <p>There was a problem logging you out. Please try again.</p>
                {logoutAction.value?.error && (
                  <p class="mt-1 text-xs opacity-80">{logoutAction.value.error}</p>
                )}
              </div>
            )}
            
            <a
              href="/challenges"
              class="block w-full text-center mt-4 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-200"
            >
              Cancel
            </a>
          </Form>
        </div>

        {/* Footer */}
        <div class="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          Thank you for using Move On Challenge
        </div>
      </div>

      {/* Animations and styling */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes float {
          0% { transform: translate(0, 0); }
          25% { transform: translate(5px, -15px); }
          50% { transform: translate(10px, 0); }
          75% { transform: translate(5px, 15px); }
          100% { transform: translate(0, 0); }
        }
        
        @keyframes fade-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
});
