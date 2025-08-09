import { component$, Slot, useSignal, useVisibleTask$ } from '@builder.io/qwik';

export default component$(() => {
  const isDarkMode = useSignal(false);

  useVisibleTask$(() => {
    const prefersDark = document.documentElement.classList.contains('dark');
    isDarkMode.value = prefersDark;
  });

  return (
    <div
      class={`min-h-screen flex flex-col items-center justify-center transition-colors duration-300 bg-transparent`}
      style={{
        paddingTop: "calc(env(safe-area-inset-top))"
      }}>
      {/* Floating shapes animation, Apamate Fest colors */}
      <div class="fixed inset-0 pointer-events-none overflow-hidden opacity-40">
        <div class="w-20 h-20 bg-teal-500/20 rounded-full absolute top-[10%] left-[15%] animate-[float_15s_infinite]"></div>
        <div class="w-32 h-32 bg-slate-500/20 rounded-full absolute top-[30%] left-[65%] animate-[float_18s_infinite]" style="animation-delay: 0.5s;"></div>
        <div class="w-16 h-16 bg-amber-400/20 rounded-full absolute top-[70%] left-[25%] animate-[float_12s_infinite]" style="animation-delay: 1s;"></div>
      </div>
      <div class="pt-safe">
        <Slot />
      </div>
      <style>{`
        @keyframes float {
          0% { transform: translate(0, 0); }
          25% { transform: translate(5px, -15px); }
          50% { transform: translate(10px, 0); }
          75% { transform: translate(5px, 15px); }
          100% { transform: translate(0, 0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
});
