import { component$, Slot, useSignal, useVisibleTask$, $, type PublicProps } from '@builder.io/qwik';
import { Link, useLocation, routeLoader$ } from '@builder.io/qwik-city';
import { getSession, type UserSession } from '~/utils/auth';
import {
  LuChevronLeft,
  LuChevronRight,
  LuMenu,
  LuX,
  LuSun,
  LuMoon,
  LuLogOut,
  LuUser,
  LuPieChart,
  LuUsers,
  LuBriefcase,
  LuFileText,
  LuDollarSign,
  LuCalendar,
  LuClock,
  LuSettings,
} from '@qwikest/icons/lucide';
import { Logo as OriginalLogo } from '~/components/ui/logo';

// Re-exporting Logo with an explicit type for className to fix template errors
export const Logo = (props: PublicProps<{className?: string}>) => <OriginalLogo {...props} />;

export const useAuthSession = routeLoader$<UserSession>(async (requestEvent) => {
  return getSession(requestEvent);
});

export default component$(() => {
  const session = useAuthSession();
  const location = useLocation();
  const isDarkMode = useSignal(false);
  const isMenuOpen = useSignal(false);
  const isSidebarExpanded = useSignal(true); // Default to expanded

  const navigation = [
    // Admin y super_admin ven todo, usuarios normales solo Contracts, Invoices, Planner Auto
    ...(session.value.role === 'admin' || session.value.role === 'super_admin' ? [
      {
        name: 'Dashboard',
        href: '/',
        icon: LuPieChart,
        description: 'Overview of key metrics',
      },
      {
        name: 'Professionals',
        href: '/professionals',
        icon: LuUsers,
        description: 'Manage professional profiles',
      },
      {
        name: 'Contracts',
        href: '/contracts',
        icon: LuBriefcase,
        description: 'Administer service contracts',
      },
      {
        name: 'Invoices',
        href: '/invoices',
        icon: LuFileText,
        description: 'Track and manage invoices',
      },
      {
        name: 'Settlements',
        href: '/settlements',
        icon: LuDollarSign,
        description: 'Process payment settlements',
      },
      {
        name: 'Planner',
        href: '/planner',
        icon: LuCalendar,
        description: 'View payment schedules',
      },
    
      ...(session.value.role === 'super_admin'
        ? [{
            name: 'User Admin',
            href: '/user-admin',
            icon: LuUsers,
            description: 'Manage system users',
          }]
        : []),
    ] : [
      {
        name: 'Contracts',
        href: '/contracts',
        icon: LuBriefcase,
        description: 'Administer service contracts',
      },
      {
        name: 'Invoices',
        href: '/invoices',
        icon: LuFileText,
        description: 'Track and manage invoices',
      },
      {
        name: 'Settlements',
        href: '/settlements',
        icon: LuClock,
        description: 'Automate payment schedules',
      },
    ]),
  ];

  const accountNavigation = session.value.isAuthenticated
    ? {
        name: 'Logout',
        href: '/auth/logout',
        icon: LuLogOut,
        description: 'Sign out of your account',
      }
    : {
        name: 'Login',
        href: '/auth',
        icon: LuUser,
        description: 'Access your account',
      };

  useVisibleTask$(() => {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
      isDarkMode.value = true;
    } else {
      document.documentElement.classList.remove('dark');
      isDarkMode.value = false;
    }
  });

  const toggleDarkMode = $(() => {
    isDarkMode.value = !isDarkMode.value;
    if (isDarkMode.value) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  });

  const toggleSidebar = $(() => {
    isSidebarExpanded.value = !isSidebarExpanded.value;
  });

  // Hide sidebar on auth page
  if (location.url.pathname === '/auth/') {
    return (
      <main class="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <Slot />
      </main>
    )
  }

  return (
    <div class="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
      {/* Desktop Sidebar */}
      <aside
        class={`hidden lg:flex flex-col transition-all duration-300 ease-in-out bg-white dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-700/50
        ${isSidebarExpanded.value ? 'w-64' : 'w-20'}`}
      >
        <div class={`flex items-center h-16 px-4 ${isSidebarExpanded.value ? 'justify-between' : 'justify-center'}`}>
          <Link href="/" class={`flex items-center gap-2 ${!isSidebarExpanded.value && 'w-full justify-center'}`}>
            <Logo className="w-8 h-8 text-teal-500" />
            {isSidebarExpanded.value && <span class="font-bold text-lg">SaveeTimelock</span>}
          </Link>
          {isSidebarExpanded.value && (
            <button onClick$={toggleSidebar} class="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700">
              <LuChevronLeft class="w-5 h-5" />
            </button>
          )}
        </div>
        {!isSidebarExpanded.value && (
          <div class="flex justify-center my-2">
             <button onClick$={toggleSidebar} class="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700">
              <LuChevronRight class="w-5 h-5" />
            </button>
          </div>
        )}
        <nav class="flex-1 px-2 py-4 space-y-2">
          {session.value.isAuthenticated && navigation.map((item) => {
            const isActive = location.url.pathname === item.href || (item.href !== '/' && location.url.pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                title={item.name}
                class={`flex items-center gap-3 rounded-md transition-colors
                ${isSidebarExpanded.value ? 'px-3 py-2' : 'p-3 justify-center'}
                ${
                  isActive
                    ? 'bg-teal-500/10 text-teal-500 dark:bg-teal-400/20 dark:text-teal-400'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700/50'
                }`}
              >
                <item.icon class="w-5 h-5 shrink-0" />
                {isSidebarExpanded.value && <span class="text-sm font-medium">{item.name}</span>}
              </Link>
            );
          })}
        </nav>
        <div class="px-2 py-4 mt-auto">
          <Link
            href={accountNavigation.href}
            title={accountNavigation.name}
            class={`flex items-center gap-3 rounded-md transition-colors
            ${isSidebarExpanded.value ? 'px-3 py-2' : 'p-3 justify-center'}
            hover:bg-slate-100 dark:hover:bg-slate-700/50`}
          >
            <accountNavigation.icon class="w-5 h-5 shrink-0" />
            {isSidebarExpanded.value && <span class="text-sm font-medium">{accountNavigation.name}</span>}
          </Link>
        </div>
      </aside>

      {/* Mobile Header */}
      <header class="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between h-16 px-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
        <button onClick$={() => (isMenuOpen.value = true)} class="p-2">
          <LuMenu class="w-6 h-6" />
        </button>
        <Link href="/" class="flex items-center gap-2">
          <Logo className="w-8 h-8 text-teal-500" />
        </Link>
        <button onClick$={toggleDarkMode} class="p-2">
          {isDarkMode.value ? <LuSun class="w-6 h-6" /> : <LuMoon class="w-6 h-6" />}
        </button>
      </header>

      {/* Mobile Menu */}
      {isMenuOpen.value && (
        <div class="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div class="fixed inset-0 bg-black/25 backdrop-blur-sm" onClick$={() => (isMenuOpen.value = false)}></div>
          <div class="fixed inset-y-0 left-0 w-64 bg-white dark:bg-slate-800 p-4">
            <div class="flex items-center justify-between h-12 mb-4">
              <Link href="/" class="flex items-center gap-2" onClick$={() => (isMenuOpen.value = false)}>
                <span class="font-bold text-lg">SaveeTimelock</span>
              </Link>
              <button onClick$={() => (isMenuOpen.value = false)} class="p-2">
                <LuX class="w-6 h-6" />
              </button>
            </div>
            <nav class="flex flex-col h-full">
              <div class="flex-1 space-y-2">
                {session.value.isAuthenticated && navigation.map((item) => {
                  const isActive = location.url.pathname === item.href || (item.href !== '/' && location.url.pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick$={() => (isMenuOpen.value = false)}
                      class={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium
                      ${
                        isActive
                          ? 'bg-teal-500/10 text-teal-500 dark:bg-teal-400/20 dark:text-teal-400'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <item.icon class="w-5 h-5" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
              <div class="mt-auto">
                <Link
                  href={accountNavigation.href}
                  onClick$={() => (isMenuOpen.value = false)}
                  class="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <accountNavigation.icon class="w-5 h-5" />
                  {accountNavigation.name}
                </Link>
              </div>
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main class="flex-1 overflow-y-auto pt-16 lg:pt-0">
        <div class="p-4 sm:p-6 lg:p-8">
          <Slot />
        </div>
      </main>
    </div>
  );
});