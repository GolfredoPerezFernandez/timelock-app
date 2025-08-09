import { qwikVite } from "@builder.io/qwik/optimizer";
import { qwikCity } from "@builder.io/qwik-city/vite";
import { type PWAOptions, qwikPwa } from "@qwikdev/pwa";
// removed static import for tailwindcss
const config: PWAOptions | undefined = process.env.CUSTOM_CONFIG === "true"
    ? { config: true }
    : undefined;
export default (async () => {
    const tsconfigPaths = (await import("vite-tsconfig-paths")).default;
    const tailwindcssPlugin = (await import("@tailwindcss/vite")).default;
    return {
        define: {
            // enables debugging in workbox
            "process.env.NODE_ENV": JSON.stringify("development")
        },
        plugins: [
            qwikCity(),
            qwikVite(),
            tsconfigPaths(),
            qwikPwa(config),
            tailwindcssPlugin()
        ],
        preview: {
            headers: {
                "Cache-Control": "public, max-age=600"
            }
        },
        resolve: {
            alias: {
                'node:buffer': 'buffer'
            }
        },
        optimizeDeps: {
            esbuildOptions: {
                define: {
                    global: 'globalThis'
                }
            }
        }
    };
})();
