import { component$ } from '@builder.io/qwik';

export interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  responsive?: boolean;
}

export interface LogoResponsiveProps {
  size?: 'sm' | 'md' | 'lg' | 'xs';
  mode?: 'light' | 'dark' | 'auto';
  class?: string;
  responsive?: boolean; // Nueva propiedad para tamaños responsive
}

export const Logo = component$<LogoProps>(({ size = 'md', className = '', responsive = false }) => {
  // Dimensiones optimizadas para móvil con un tamaño extra pequeño
  const dimensions = {
    xs: { width: 24, height: 24, text: 'text-sm', subtext: 'text-xs' },
    sm: { width: 32, height: 32, text: 'text-lg', subtext: 'text-xs' },
    md: { width: 40, height: 40, text: 'text-xl', subtext: 'text-sm' },
    lg: { width: 56, height: 56, text: 'text-2xl', subtext: 'text-base' },
  };

  // Classes responsive para diferentes tamaños de pantalla
  const responsiveClasses = responsive
    ? {
        width: 'w-6 sm:w-8 md:w-10',
        height: 'h-6 sm:h-8 md:h-10',
        text: 'text-sm sm:text-lg md:text-xl',
        subtext: 'text-xs sm:text-xs md:text-sm'
      }
    : null;

  const { width, height, text, subtext } = responsive
    ? responsiveClasses!
    : dimensions[size];

  return (
    <div class={`inline-flex items-center ${className}`}>
      <div style={{ width: width, height: height }}>
        {/* Logo SVG with TimeLock branding */}
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="w-full h-full">
          <defs>
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#0f766e', stopOpacity: 1 }} />
              <stop offset="50%" style={{ stopColor: '#14b8a6', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#5eead4', stopOpacity: 1 }} />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="42" fill="url(#logoGradient)" stroke="#0f766e" stroke-width="2" />
          <text 
            x="50%" 
            y="50%" 
            dominant-baseline="central" 
            text-anchor="middle" 
            font-family="'Poppins', sans-serif" 
            font-size="28" 
            font-weight="bold" 
            fill="#ffffff"
            letter-spacing="-1"
          >
            STL
          </text>
        </svg>
      </div>
      <div class={`ml-2 sm:ml-3 font-bold ${responsive ? responsiveClasses!.text : text} flex flex-col leading-none`}>
        <span class="text-slate-800 dark:text-slate-100">Saave</span>
        <span class={`text-teal-600 dark:text-teal-400 ${responsive ? responsiveClasses!.subtext : subtext}`}>TimeLock</span>
      </div>
    </div>
  );
});