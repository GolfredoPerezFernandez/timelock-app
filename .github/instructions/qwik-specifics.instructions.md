---
applyTo: "**/*.tsx"
---
# Instrucciones específicas para Qwik

## Componentes y Estado
- Para estado local simple, usar `useSignal$()`. Para objetos reactivos complejos, `useStore$()`.
- Recordar que los componentes deben ser serializables. Evitar cierres (closures) complejos que no puedan ser serializados por Qwik Optimizer.
- Utilizar `<Slot />` para la proyección de contenido.
- Para efectos secundarios que se ejecutan al ser visible el componente en el cliente: `useVisibleTask$()`.
- Para tareas que se ejecutan en el servidor durante SSR y opcionalmente en el cliente tras la hidratación: `useTask$()`.

## Enrutamiento y Carga de Datos (Qwik City)
- `routeLoader$`: Para cargar datos necesarios para una ruta antes de renderizar. Los datos son accesibles con el hook `useMiLoader()`.
  - Para streaming/deferred loaders: `export const useMyData = routeLoader$(() => { return async () => { /* ... */ }; });` y usar `<Resource value={myData} ... />`.
- `routeAction$`: Para manejar envíos de formularios y mutaciones de datos.
- `server$`: Para llamadas RPC. Ideal para operaciones que no encajan en `routeLoader$` o `routeAction$`, o para ser llamadas desde cualquier parte del cliente.
  - Dentro de `server$`, `this` es `RequestEvent`. Acceder a `this.env.get('MI_VARIABLE')`, `this.cookie`, `this.url`.
- Los middleware para `server$` deben definirse en `plugin.ts` para que se apliquen.

## Estructura de Eventos
- Siempre envolver los manejadores de eventos en `$()`: `onClick$={$(async (event, element) => { ... })}`.
- Si se llama a una función `server$()` dentro de un manejador, asegurarse que el manejador esté correctamente envuelto: `onClick$={$(async () => { const result = await miServerFunction(); })}`.

## Estilizado con Tailwind
- Usar clases de Tailwind directamente en los elementos JSX.
- Para estilos condicionales, se pueden construir strings de clases o usar utilidades como `clsx`.

## Variables de Entorno
- Cliente+Servidor (públicas): `import.meta.env.PUBLIC_MI_VAR`
- Solo Servidor (privadas): `this.env.get('MI_SECRETO')` dentro de `server$`, o `requestEvent.env.get('MI_SECRETO')` en `routeLoader$`, `routeAction$`.

## Full SSR y Resumabilidad
- Asumir que el código puede ejecutarse primero en el servidor.
- El código del cliente debe "resumir" el estado del servidor. Minimizar el JavaScript enviado al cliente.
- Verificar que cualquier manipulación del DOM o acceso a APIs del navegador esté dentro de `useVisibleTask$()` o condicionado a `isBrowser` si es estrictamente necesario fuera de un hook de ciclo de vida del cliente.