# Directrices Generales del Proyecto para GitHub Copilot

## Uso de Este Archivo con GitHub Copilot en VS Code

Este archivo, `.github/copilot-instructions.md`, está diseñado para ser utilizado directamente por la funcionalidad de Chat de GitHub Copilot en Visual Studio Code. Proporciona un conjunto de directrices y reglas personalizadas que Copilot utilizará para generar código, ofrecer sugerencias y responder a preguntas en el contexto de este espacio de trabajo.

**Tipos de Archivos de Instrucciones y Prompts:**

*   **Este archivo (`.github/copilot-instructions.md`):** Actúa como el archivo de instrucciones principal para todo el espacio de trabajo. Su contenido se incluye automáticamente en las solicitudes de chat para la generación de código. Las directrices detalladas a continuación constituyen estas instrucciones.
*   **Archivos `.instructions.md`:** Para instrucciones más específicas o modulares, puedes crear archivos con la extensión `.instructions.md` (e.g., en `.github/instructions/`). Estos pueden ser aplicados a archivos o carpetas específicas usando metadatos `applyTo` en su Front Matter, o adjuntados manualmente a una solicitud de chat.
*   **Archivos `.prompt.md` (Experimentales):** Permiten crear prompts completos y reutilizables en formato Markdown (e.g., en `.github/prompts/`). Son útiles para tareas comunes, compartir conocimiento específico del dominio y estandarizar interacciones.

**Enfoque de Este Documento:**

Las secciones siguientes de este documento contienen las directrices generales y específicas del proyecto que GitHub Copilot debe seguir. Están formuladas para ser claras, concisas y directamente aplicables a las tareas de desarrollo dentro de este proyecto.

---

Este proyecto utiliza la siguiente pila tecnológica principal:
- **Framework:** Qwik (con un fuerte énfasis en Full Server-Side Rendering - SSR y Resumability)
- **Base de Datos:** Turso (una base de datos distribuida compatible con libSQL/SQLite)
- **Estilizado:** Tailwind CSS
- **Testing Unitario/Componentes:** Vitest con `@testing-library/qwik`
- **Testing End-to-End (E2E):** Playwright

## Principios Clave del Proyecto:

**Nota sobre el Gestor de Paquetes:** Este proyecto utiliza `yarn` como gestor de paquetes preferido. Todos los comandos de instalación y gestión de dependencias deben realizarse con `yarn`.

**Compilación y Chequeo de Tipos Antes de Testing:**  
Antes de ejecutar cualquier test (unitario, de componentes o E2E), **siempre** debes asegurarte de que el proyecto compila correctamente y no tiene errores de tipado.  
Para ello, ejecuta los siguientes comandos y corrige todos los errores antes de continuar con los tests:
```sh
yarn build
npx tsc
```
Solo procede a correr los tests si ambos comandos finalizan sin errores.

1.  **Qwik First:** Priorizar las primitivas y patrones de Qwik (`component$`, `useSignal()`, `useStore()`, `Resource`, `routeLoader$`, `routeAction$`, `server$`). Confiar en el sistema de reactividad de Qwik. Evitar la manipulación directa del DOM; usar `useTask$` o `useVisibleTask$` con precaución, entendiendo su impacto en la resumabilidad y el SSR.
2.  **Full SSR y Resumability:** El código debe ser escrito pensando en la resumabilidad. Evitar patrones que rompan la capacidad de Qwik de pausar en el servidor y resumir en el cliente sin re-ejecución. Esto incluye:
    *   Depender de estado global del cliente inicializado fuera de los mecanismos de Qwik (e.g., `window` objects, singletons no gestionados por Qwik). Usar `useStore()`, `useSignal()`, o la API de Contexto de Qwik.
    *   Almacenar datos no serializables (e.g., funciones, `Map`, `Set`, `Date` sin transformar) en stores, props, o contextos sin una estrategia de serialización explícita (e.g., usando `noSerialize()` con precaución y entendiendo sus implicaciones, o transformando a tipos serializables).
    *   Efectos secundarios en el cuerpo del componente o durante el renderizado que no estén encapsulados en `useTask$` (servidor y cliente) o `useVisibleTask$` (cliente, después de que el componente sea visible) y que tengan dependencias del entorno del cliente.
3.  **Tailwind CSS para Estilos:** Utilizar clases de utilidad de Tailwind CSS directamente en el JSX. Evitar CSS global o CSS-in-JS.
    *   Para estilos encapsulados específicos de un componente que no se puedan lograr fácilmente con Tailwind, se puede usar `useStylesScoped$(() => import('./component.css?inline'))`. Los estilos se aplican solo al componente.
    *   Para estilos que necesitan ser aplicados a un componente y sus hijos, pero aún así encapsulados y cargados bajo demanda con el componente, usar `useStyles$(() => import('./component-global.css?inline'))`.
    *   La prioridad es Tailwind CSS. Usar `useStylesScoped$` o `useStyles$` con moderación.
4.  **Acceso a Datos con Turso:** Las interacciones con la base de datos Turso deben realizarse exclusivamente en el servidor, típicamente dentro de `routeLoader$`, `routeAction$` o `server$`. Utilizar el cliente `@libsql/client`.
5.  **Testing Riguroso:**
    *   Escribir tests unitarios (Vitest) para lógica pura y funciones de utilidad.
    *   Escribir tests de componentes (Vitest + `@testing-library/qwik`) para verificar el renderizado, estado y comportamiento de los componentes Qwik en un entorno simulado.
    *   Escribir tests E2E (Playwright) para los flujos críticos del usuario, verificando la integración completa y la resumabilidad en navegadores reales.
6.  **Manejo de Variables de Entorno (Qwik):**
    *   Variables públicas (cliente y servidor): `PUBLIC_NOMBRE_VAR` accesibles con `import.meta.env.PUBLIC_NOMBRE_VAR`. **NO USAR PARA DATOS SENSIBLES.**
    *   Variables de servidor: Accesibles en `routeLoader$`, `routeAction$`, `server$`, etc., a través de `requestEvent.env.get('NOMBRE_VAR_SECRETA')`. Aquí van las claves de API de Turso, etc.
    *   Evitar `process.env`.
7.  **Funciones Exclusivas de Servidor (`server$`):** Utilizar `server$()` para RPCs fuertemente tipadas desde el cliente al servidor. Acceder a `RequestEvent` con `this` dentro de estas funciones para obtener `env`, `cookie`, `url`, `headers`.
8.  **Estructura de Componentes Qwik:**
    *   Usar `component$(() => { ... })` para definir componentes.
    *   Manejar eventos con el sufijo `$` (e.g., `onClick$`). La función manejadora de eventos *siempre* debe estar envuelta en `$(...)` para crear un QRL (e.g., `onClick$={$(async (event, element) => { ... })}`). Esto aplica a cualquier función pasada como prop o devuelta por un hook que deba ser un QRL (lazy-loadable y serializable).
9.  **Optimización:** Considerar siempre el impacto en el bundle y la performance. Aprovechar el lazy loading y la resumabilidad de Qwik.
10. **Tipado Estricto con TypeScript:** Aprovechar al máximo las capacidades de TypeScript para asegurar la robustez y mantenibilidad del código. Definir tipos claros para props, stores, datos de API, y eventos.
11. **Manejo de Errores:** Implementar un manejo de errores robusto, especialmente en `routeLoader$`, `routeAction$`, y `server$`. Utilizar `fail()` en `routeAction$` para comunicar errores de validación al cliente. Considerar el uso de `try/catch` y el objeto `RequestEvent` para logging o respuestas de error personalizadas.
12. **Accesibilidad (a11y):** Diseñar y desarrollar componentes teniendo en cuenta las directrices de accesibilidad web (WCAG). Utilizar HTML semántico, roles y atributos ARIA apropiados, y asegurar la navegabilidad por teclado.
13. **Estilo de Código y Linting:** Seguir las convenciones de estilo de código y calidad definidas en el proyecto (e.g., configuración de Prettier, ESLint). Ejecutar estas herramientas regularmente para mantener la consistencia y prevenir errores.
14. **Qwik City (Routing, Layouts, Endpoints):**
    *   Utilizar el sistema de enrutamiento basado en archivos de Qwik City (`src/routes`).
    *   Implementar layouts anidados (`layout.tsx`) para estructuras de página compartidas.
    *   Crear endpoints API (`index.ts` o `[param].ts` con funciones `onGet`, `onPost`, etc.) dentro de `src/routes` para manejar solicitudes de servidor.
15. **`<Resource />` Component for Async Data:** Utilizar el componente `<Resource />` para manejar de forma declarativa operaciones asíncronas (especialmente datos cargados a través de `routeLoader$`). Esto simplifica la gestión de los estados de carga (`onPending`), resuelto (`onResolved`), y error (`onRejected`) en la UI.
16. **Security Considerations:**
    *   Siempre validar y sanitizar las entradas del usuario en el servidor (especialmente en `routeAction$` y `server$`).
    *   Proteger contra vulnerabilidades web comunes (XSS, CSRF, etc.). Utilizar las capacidades de Qwik y las bibliotecas apropiadas cuando sea necesario.
    *   Manejar los secretos y las claves de API de forma segura utilizando variables de entorno del servidor. No exponer datos sensibles al cliente.
17. **Naming Conventions:**
    *   **Componentes:** PascalCase (e.g., `MyComponent.tsx`).
    *   **Archivos de Rutas (Qwik City):** `index.tsx` (para la ruta base del directorio), `[param].tsx` (para rutas dinámicas), `layout.tsx`.
    *   **Funciones y Variables:** camelCase (e.g., `myFunction`, `isLoading`).
    *   **Tipos e Interfaces:** PascalCase (e.g., `interface UserProfile`).
    *   **Archivos de Test:** `*.spec.tsx` o `*.test.tsx`.
18. **Directory Structure:** Mantener una estructura de directorios clara y organizada:
    *   `src/routes/`: Contiene todas las rutas de la aplicación, layouts y endpoints de API, siguiendo las convenciones de Qwik City.
    *   `src/components/`: Para componentes Qwik reutilizables. Se pueden subdividir en subdirectorios por funcionalidad o tipo.
        *   `src/components/ui/`: Para componentes de UI genéricos y reutilizables (botones, inputs, etc.).
        *   `src/components/feature/`: Para componentes más específicos de una funcionalidad.
    *   `src/lib/` o `src/utils/`: Para funciones de utilidad, helpers, constantes, o tipos compartidos que no son componentes.
    *   `src/server/`: Para lógica exclusiva del servidor que no está directamente ligada a una ruta específica (e.g., clientes de base de datos, lógica de negocio compleja invocada por `server$`).
    *   `src/types/`: Para definiciones de tipos globales o compartidos.
19. **Formularios y Acciones (con Modular Forms):**
    *   Utilizar `@modular-forms/qwik` como la biblioteca principal para la creación de formularios, aprovechando su seguridad de tipos y su integración nativa con Qwik.
    *   Utilizar `formAction$` (de `@modular-forms/qwik` o Qwik City, según el contexto de Modular Forms) para manejar envíos de formularios y mutaciones de datos en el servidor.
    *   Validar los datos del formulario en el servidor, preferiblemente utilizando esquemas de Valibot o Zod integrados con Modular Forms.
    *   Acceder al resultado de la acción y al estado del formulario en el componente a través de los hooks y el store proporcionados por Modular Forms.
    *   Consultar el Principio 24 para una guía detallada sobre Modular Forms.
20. **Context API de Qwik:** Utilizar la API de Contexto de Qwik (`createContextId()`, `useContextProvider()`, `useContext()`) para compartir estado entre componentes anidados sin necesidad de pasar props manualmente a través de múltiples niveles, especialmente para estado global o temático. Asegurarse de que los valores proporcionados al contexto sean serializables si necesitan persistir a través de la resumabilidad.
21. **Autenticación (Auth):**
    *   **Estrategia:** La autenticación debe ser manejada en el servidor. Se recomienda un enfoque basado en cookies HTTP-only y seguras para almacenar tokens de sesión.
    *   **Flujo de Inicio de Sesión:**
        1.  El usuario envía credenciales a través de un formulario.
        2.  Un `routeAction$` recibe las credenciales, las valida contra la base de datos (Turso).
        3.  Si son válidas, se genera un token de sesión (e.g., JWT o un token opaco almacenado en Turso con una referencia en la cookie).
        4.  Se establece una cookie HTTP-only y segura con el token.
        5.  Se redirige al usuario o se devuelve un estado de éxito.
    *   **Verificación de Sesión:**
        1.  En `routeLoader$` de rutas protegidas, o en un layout raíz, se verifica la cookie de sesión.
        2.  El token se valida (e.g., contra la base de datos o verificando la firma del JWT).
        3.  Si es válido, se cargan los datos del usuario y se proporcionan al componente.
        4.  Si no es válido o no existe, se redirige al usuario a la página de inicio de sesión.
    *   **Cierre de Sesión:** Un `routeAction$` elimina la cookie de sesión y cualquier estado de sesión en el servidor si es necesario.
    *   **Protección CSRF:** Implementar medidas de protección CSRF si se utilizan cookies para la autenticación (e.g., tokens CSRF sincronizados).
    *   **Datos del Usuario:** Los datos del usuario autenticado deben cargarse a través de `routeLoader$` y estar disponibles para los componentes. Se puede usar Context API para propagar el estado de autenticación y los datos del usuario.
22. **CRUD Operaciones con Turso:**
    *   **Exclusivamente en Servidor:** Todas las operaciones CRUD (Crear, Leer, Actualizar, Eliminar) deben realizarse en el servidor dentro de `routeLoader$` (para Leer) o `routeAction$` / `server$` (para Crear, Actualizar, Eliminar).
    *   **Cliente Turso:** Utilizar el cliente `@libsql/client` para interactuar con la base de datos Turso. Instanciar el cliente con las credenciales de la base de datos obtenidas de las variables de entorno del servidor (`requestEvent.env.get()`).
    *   **SQL o ORM Ligero:** Escribir consultas SQL directamente o utilizar un query builder ligero compatible con libSQL/SQLite si se prefiere. Evitar ORMs pesados que puedan no ser ideales para el entorno serverless o distribuido de Turso.
    *   **Transacciones:** Utilizar transacciones de base de datos cuando múltiples operaciones deban completarse atómicamente.
    *   **Validación de Datos:** Validar siempre los datos en el servidor antes de realizar operaciones de escritura (Crear, Actualizar) en la base de datos.
    *   **Manejo de Errores:** Implementar un manejo de errores adecuado para las operaciones de base de datos, incluyendo errores de conexión, errores de consulta, y violaciones de restricciones.
23. **Migraciones de Base de Datos (Turso):**
    *   **Herramienta de Migración:** Utilizar una herramienta de migración de esquemas SQL compatible con SQLite. Opciones populares incluyen `node-sqlite3-migrations`, `dbmate`, o scripts SQL gestionados manualmente. LibSQL/Turso es compatible con la sintaxis de SQLite.
    *   **Archivos de Migración:** Escribir migraciones como archivos SQL (`.sql`) que contengan declaraciones DDL (`CREATE TABLE`, `ALTER TABLE`, etc.) para la subida (`up`) y la bajada (`down`) del esquema.
    *   **Versionado:** Las migraciones deben estar versionadas y aplicadas en orden.
    *   **Aplicación de Migraciones:**
        *   **Localmente:** Ejecutar migraciones contra una base de datos Turso local o una réplica de desarrollo antes de desplegar.
        *   **Despliegue:** Integrar la aplicación de migraciones en el proceso de despliegue. Esto podría ser un script que se ejecuta antes de que la nueva versión de la aplicación se ponga en marcha. Turso ofrece `turso db shell my-db < migrations/001_create_users.sql` para ejecutar archivos SQL.
        *   Considerar herramientas como `prisma migrate` o `drizzle-kit` si se utiliza Prisma o Drizzle ORM (aunque el principio 22.c sugiere cautela con ORMs pesados, sus herramientas de migración pueden ser útiles).
    *   **Idempotencia:** Asegurarse de que los scripts de migración sean idempotentes si es posible (e.g., usando `IF NOT EXISTS` para `CREATE TABLE`).
    *   **Seed de Datos:** Se pueden crear scripts separados para sembrar la base de datos con datos iniciales, que se pueden ejecutar después de las migraciones.
24. **Formularios con Modular Forms (`@modular-forms/qwik`):**
    *   **Introducción:** Modular Forms es una biblioteca de formularios type-safe, headless, construida para Qwik, que maneja la gestión del estado y la validación.
    *   **Instalación:** `yarn add @modular-forms/qwik`.
    *   **Definición de Tipos y Esquemas de Validación:**
        *   Definir un tipo para el formulario: `type MiFormulario = { campo: string; };`
        *   Opcionalmente, derivar el tipo de un esquema de validación (Valibot recomendado, Zod soportado):
            ```typescript
            // import * as v from 'valibot';
            // const MiEsquema = v.object({ email: v.pipe(v.string(), v.email()) });
            // type MiFormulario = v.InferInput<typeof MiEsquema>;
            ```
    *   **Valores Iniciales con `routeLoader$`:**
        *   Usar `routeLoader$<InitialValues<MiFormulario>>` para proveer valores iniciales (e.g., desde DB o valores por defecto).
            ```typescript
            // import type { InitialValues } from '@modular-forms/qwik';
            // export const useFormLoader = routeLoader$<InitialValues<MiFormulario>>(() => ({
            //   email: '', /* ...otros campos */
            // }));
            ```
    *   **Creación del Formulario con `useForm`:**
        *   Obtener el store del formulario y los componentes `Form`, `Field`, `FieldArray`.
            ```typescript
            // import { useForm, valiForm$ /* o zodForm$ */ } from '@modular-forms/qwik';
            // const [miFormStore, { Form, Field }] = useForm<MiFormulario>({
            //   loader: useFormLoader(), // Para valores iniciales
            //   action: useMiFormAction(), // Para manejo de envío en servidor (opcional)
            //   validate: valiForm$(MiEsquema), // Para validación (opcional)
            // });
            ```
    *   **Componente `Form` y `Field`:**
        *   El componente `Form` envuelve los campos y maneja el envío.
        *   El componente `Field` es headless y registra un campo, proveyendo su estado.
            ```jsx
            // <Form onSubmit$={clientSubmitHandler}>
            //   <Field name="email">
            //     {(field, props) => (
            //       <div>
            //         <input {...props} type="email" value={field.value} />
            //         {field.error && <div>{field.error}</div>}
            //       </div>
            //     )}
            //   </Field>
            //   <button type="submit">Enviar</button>
            // </Form>
            ```
    *   **Manejo de Envíos:**
        *   **Acción de Servidor (Recomendado para mutaciones):**
            *   Definir un `formAction$` (de Qwik City, adaptado por Modular Forms) para procesar los datos en el servidor.
                ```typescript
                // import { formAction$, valiForm$ } from '@modular-forms/qwik'; // o de Qwik City y luego adaptar
                // export const useMiFormAction = formAction$<MiFormulario>((values, requestEvent) => {
                //   // Lógica de servidor, e.g., guardar en DB
                //   // console.log(values);
                //   // return { status: 'success', data: result };
                // }, valiForm$(MiEsquema)); // Validación en servidor antes del handler
                ```
            *   Pasar esta acción a la opción `action` de `useForm`. El formulario se enviará a esta acción.
        *   **Manejador en Cliente (`onSubmit$` en `<Form>`):**
            *   Para lógica del lado del cliente antes o en lugar del envío al servidor.
                ```typescript
                // const clientSubmitHandler = $<SubmitHandler<MiFormulario>>((values, event) => {
                //   // Lógica en cliente
                //   console.log('Client-side values:', values);
                //   // Prevenir envío por defecto si se maneja completamente en cliente o se usa `action`
                // });
                ```
    *   **Validación:**
        *   Pasar `validate: valiForm$(Schema)` o `validate: zodForm$(Schema)` a `useForm`.
        *   Los errores por campo están disponibles en `field.error` dentro del render prop de `Field`.
    *   **Actualización desde Props:**
        *   Usar `useTask$` y `setValue` de Modular Forms para actualizar el estado del formulario cuando las props cambian.
            ```typescript
            // import { useTask$ } from '@builder.io/qwik';
            // import { setValue } from '@modular-forms/qwik';
            // interface FormProps { initialData?: MiFormulario }
            // component$<FormProps>((props) => {
            //   const [miFormStore, { Form, Field }] = useForm<MiFormulario>(...);
            //   useTask$(({ track }) => {
            //     const data = track(() => props.initialData);
            //     if (data) {
            //       for (const [key, value] of Object.entries(data)) {
            //         setValue(miFormStore, key as any, value);
            //       }
            //     }
            //   });
            //   // ...
            // });
            ```
    *   **Beneficios Clave:** Seguridad de tipos de extremo a extremo, control total sobre el marcado y estilos (headless), gestión de estado integrada, y sistema de validación robusto.
25. **QRLs (Qwik URLs) para Lazy Loading:**
    *   **Definición:** QRLs son URLs especialmente formateadas que Qwik utiliza para la carga diferida (lazy load) de código y datos. Son fundamentales para la resumabilidad y el rendimiento.
    *   **Estructura:** Típicamente `./ruta/al/chunk.js#NombreSimbolo[indices_scope_lexico]`.
        *   `./ruta/al/chunk.js`: Ruta al fragmento de JavaScript que se cargará de forma diferida.
        *   `NombreSimbolo`: El nombre del símbolo (función, componente, etc.) a extraer del chunk.
        *   `[indices_scope_lexico]`: (Opcional) Array de índices que apuntan a objetos en el atributo `q:obj` del HTML, permitiendo restaurar variables capturadas en closures (ámbito léxico).
    *   **Resolución:** Las QRLs relativas se resuelven utilizando el atributo `q:base` en el HTML (o `document.baseURI` si no está presente).
    *   **Propósito:** Permiten a Qwik serializar referencias a código ejecutable en el HTML. Cuando se necesita el código (e.g., un manejador de eventos), Qwik usa la QRL para cargar solo ese fragmento específico.
    *   **Diferencias con `import()` dinámico:**
        *   **Serialización:** Las QRLs están diseñadas para ser serializadas en HTML.
        *   **Referencia a Símbolos:** Permiten referenciar un símbolo específico dentro de un chunk.
        *   **Contexto de Resolución:** Mantienen el contexto correcto para rutas relativas cuando se deserializan desde HTML.
        *   **Ámbito Léxico:** Pueden codificar y restaurar variables capturadas.
        *   **Automatización:** El Optimizador de Qwik genera QRLs automáticamente, en lugar de que el desarrollador gestione `import()` manualmente para cada límite de lazy-loading.
26. **Qwik Optimizer:**
    *   **Rol:** Es una transformación a nivel de código (parte de Rollup/Vite) que reestructura el código fuente para habilitar la carga diferida granular de Qwik.
    *   **Mecanismo:** Busca el sufijo `$` en identificadores (e.g., `component$`, `onClick$`, `$(...)` para QRLs explícitos). Cuando lo encuentra, extrae la expresión o función asociada y la convierte en un símbolo exportado en un nuevo chunk (o uno existente), generando una QRL que apunta a él.
    *   **Ejemplo Simplificado:**
        ```typescript
        // Código del desarrollador
        // export const Counter = component$(() => {
        //   const count = useSignal(0);
        //   return <button onClick$={() => count.value++}>{count.value}</button>;
        // });

        // Transformación (conceptual) por el Optimizador
        // const Counter = component(qrl('./chunk-a.js', 'Counter_onMount'));
        // // chunk-a.js
        // export const Counter_onMount = () => {
        //   const count = useSignal(0);
        //   // El JSX aquí también es transformado, y el onClick$ genera otra QRL
        //   return <button onClick$={qrl('./chunk-b.js', 'Counter_onClick', [count])}>{count.value}</button>;
        // };
        // // chunk-b.js
        // export const Counter_onClick = () => {
        //   const [count] = useLexicalScope();
        //   return count.value++;
        // };
        ```
    *   **Impacto:** Es crucial para la filosofía de Qwik de "descargar lo mínimo, ejecutar lo mínimo", ya que divide la aplicación en pequeños fragmentos que se cargan solo cuando son necesarios.
27. **Navegación del Sitio con Menús (Qwik City):**
    *   **Definición:** Qwik City permite definir la estructura de navegación del sitio usando archivos `menu.md` dentro de los directorios de rutas.
    *   **Estructura de `menu.md`:**
        *   Utilizar encabezados Markdown (`#`, `##`, etc.) para definir la jerarquía y profundidad del menú.
        *   Utilizar listas con viñetas (`-`) para definir los ítems del menú. Los enlaces se especifican con la sintaxis estándar de Markdown: `[Texto del Enlace](ruta/al/contenido)`.
            ```markdown
            // src/routes/docs/menu.md
            // # Documentación Principal
            // ## Guías
            // - [Introducción](/docs/introduction/)
            // - [Componentes Básicos](/docs/components/basics/)
            ```
    *   **Recuperación de la Estructura del Menú:**
        *   En cualquier componente dentro de una ruta (típicamente en un `layout.tsx`), usar el hook `useContent()` de `@builder.io/qwik-city`.
        *   `useContent()` devuelve un objeto que incluye una propiedad `menu` de tipo `ContentMenu`.
            ```typescript
            // import { useContent } from '@builder.io/qwik-city';
            // const { menu } = useContent();
            // // menu.text contendrá el título del menú (del primer H1 si existe)
            // // menu.items será un array de ítems del menú
            ```
    *   **Renderizado del Menú:** Iterar sobre la estructura `ContentMenu` (e.g., `menu.items`) para renderizar la UI de navegación. Se puede usar `useLocation()` para resaltar el enlace activo.
28. **Gestión de Activos Estáticos:**
    *   **Ubicación:** Todos los activos estáticos (imágenes, fuentes, archivos `favicon.ico`, etc.) deben colocarse en el directorio `/public` en la raíz del proyecto.
    *   **Servicio:** Los archivos en `/public` se sirven desde la raíz del servidor. Por ejemplo, `/public/images/logo.png` será accesible en `https://tu-dominio.com/images/logo.png`.
    *   **Prioridad:** Las rutas definidas en `src/routes/` tienen prioridad sobre los archivos estáticos si hay un conflicto de nombres en la URL.
29. **Política de Seguridad de Contenido (CSP):**
    *   **Propósito:** CSP es una capa de seguridad que ayuda a prevenir ataques como XSS y la inyección de datos, controlando qué recursos puede cargar el navegador.
    *   **Implementación (SSR en Qwik City):**
        1.  **Crear un Plugin de Ruta:** Añadir un archivo como `src/routes/plugin@csp.ts`. Este middleware se ejecutará en cada solicitud.
        2.  **Definir `onRequest`:**
            ```typescript
            // src/routes/plugin@csp.ts
            // import type { RequestHandler } from "@builder.io/qwik-city";
            // import { isDev } from "@builder.io/qwik/build"; // Correcto para build-time flags
            
            // export const onRequest: RequestHandler = event => {
            //   if (isDev) return; // Opcional: No aplicar CSP en desarrollo si interfiere con Vite
            
            //   const nonce = Date.now().toString(36) + Math.random().toString(36).substring(2);
            //   event.sharedMap.set("@nonce", nonce); // Guardar nonce para usar en la app
            
            //   const csp = [
            //     `default-src 'self'`, // Permite contenido del mismo origen
            //     `script-src 'self' 'nonce-${nonce}' 'unsafe-inline' https: 'strict-dynamic'`, // 'unsafe-inline' puede ser necesario para estilos de Qwik o si no se puede evitar, 'strict-dynamic' permite scripts cargados por scripts con nonce
            //     `style-src 'self' 'unsafe-inline'`, // Qwik puede inyectar estilos inline
            //     `img-src 'self' data:`, // Permite imágenes del mismo origen y data URIs
            //     `font-src 'self'`,
            //     `frame-src 'self'`, // Si usas iframes
            //     `object-src 'none'`, // Deshabilitar plugins como Flash
            //     `base-uri 'self'`,
            //     // Añadir otras directivas según sea necesario (connect-src para APIs, etc.)
            //   ];
            //   event.headers.set("Content-Security-Policy", csp.join("; "));
            // };
            ```
    *   **Uso del Nonce en Componentes (para scripts inline):**
        *   Recuperar el nonce en un componente usando `useServerData`:
            ```typescript
            // import { component$ } from '@builder.io/qwik';
            // import { useServerData } from '@builder.io/qwik-city';
            
            // export default component$(() => {
            //   const nonce = useServerData<string | undefined>("nonce"); // El "@" es convenido por Qwik City
            //   return (
            //     <script nonce={nonce} dangerouslySetInnerHTML="console.log('Script con nonce');" />
            //   );
            // });
            ```
    *   **Consideraciones:**
        *   **`'unsafe-inline'` y `'unsafe-eval'`:** Evitarlos tanto como sea posible. Qwik intenta evitar `eval`, pero los estilos inline pueden ser necesarios. `strict-dynamic` puede ayudar con los scripts.
        *   **Desarrollo vs. Producción:** La configuración de CSP puede ser diferente. En desarrollo, Vite puede requerir configuraciones más permisivas.
        *   **Validación:** Usar herramientas como CSP Evaluator de Google para probar la política.
30. **Qwik Containers:**
    *   **Definición:** Un "Container" en Qwik representa una aplicación Qwik completa o una porción aislada de una página que puede ser gestionada independientemente. Usualmente, el elemento `<html>` es el contenedor raíz de la aplicación.
    *   **Atributos del Contenedor:** Qwik añade atributos especiales al elemento contenedor:
        *   `q:container`: Estado del contenedor (e.g., "paused", "resumed").
        *   `q:version`: Versión de Qwik.
        *   `q:render`: Modo de renderizado (e.g., "ssr").
        *   `q:base`: URL base para resolver QRLs relativas.
        *   `q:manifest-hash`: Hash del manifiesto de la build.
        *   Se pueden añadir atributos personalizados al contenedor raíz a través de la opción `containerAttributes` en las APIs de renderizado SSR (e.g., `renderToStream`).
    *   **Propiedades y Capacidades:**
        *   **Resumabilidad Independiente:** Cada contenedor puede ser "resumido" (hidratado de forma inteligente) independientemente de otros en la página.
        *   **Actualización Independiente:** Partes de la página representadas por contenedores pueden ser actualizadas (e.g., reemplazando su `innerHTML`) sin afectar otros contenedores.
        *   **Compilación y Despliegue Separados:** Permite que diferentes partes de una aplicación grande sean compiladas y desplegadas por equipos distintos.
        *   **Versionado Independiente:** Diferentes contenedores en la misma página podrían (teóricamente) correr diferentes versiones de Qwik.
        *   **Anidación:** Los contenedores pueden ser anidados.
    *   **Contenedores vs. Componentes:**
        *   Los contenedores son más restrictivos: props de solo lectura, sin proyección de contenido (slots de la misma manera que componentes), no pueden modificar estado que se les pasa directamente.
        *   Los componentes dentro de un mismo "build" o "aplicación Qwik" se compilan juntos y comparten artefactos y versión de Qwik. La serialización y resumabilidad ocurren a nivel de contenedor.
    *   **Casos de Uso Principales:**
        *   **Routing Avanzado:** Modelar el "shell" de la aplicación (navegación, cabecera, pie) como un contenedor y el contenido de la página (outlet) como otro. En navegaciones del lado del cliente, solo se necesita fetchear y reemplazar el HTML del contenedor del outlet, manteniendo el estado del shell.
        *   **Micro-frontends:** Permite que diferentes equipos desarrollen, desplieguen y versionen partes de una aplicación web de forma independiente, integrándolas en una única experiencia de usuario. Cada micro-frontend puede ser un contenedor Qwik.
31. **View Transitions API en Qwik:**
    *   **Activación Automática:** Qwik inicia automáticamente View Transitions durante la navegación SPA.
    *   **Animación con CSS:**
        *   Asignar un `view-transition-name` único a los elementos que participarán en la transición (e.g., `style={{viewTransitionName: \`_item-\${item.id}_\`}}`).
        *   Usar la propiedad CSS `view-transition-class` para agrupar elementos con fines de animación.
        *   Definir animaciones CSS para los pseudo-elementos `::view-transition-new(nombre-clase)` y `::view-transition-old(nombre-clase)`.
            ```css
            // .item { view-transition-class: animated-item; }
            // ::view-transition-new(.animated-item):only-child { animation: fade-in 200ms; }
            // ::view-transition-old(.animated-item):only-child { animation: fade-out 200ms; }
            ```
    *   **Lógica Personalizada con `qviewTransition` Event:**
        *   Escuchar el evento `qviewTransition` en el documento para ejecutar lógica antes de que comience la animación. Útil para animar solo elementos visibles o aplicar lógica condicional.
        *   Usar `useOnDocument('qviewTransition', sync$((event: CustomEvent<ViewTransition>) => { ... }))` para lógica síncrona si es necesario modificar atributos antes de que la transición capture el estado.
            ```typescript
            // useOnDocument('qviewTransition', sync$((event: CustomEvent<ViewTransition>) => {
            //   const transition = event.detail;
            //   document.querySelectorAll('.item').forEach(item => {
            //     if (item.checkVisibility()) item.dataset.hasViewTransition = 'true';
            //   });
            // }));
            ```
            Luego, usar el atributo en CSS: `.item[data-has-view-transition="true"] { view-transition-class: animated-item; }`.
    *   **Animación con Web Animations API (WAAPI):**
        *   Permite un control más preciso sobre las animaciones.
        *   Esperar a que los pseudo-elementos de la transición estén en el DOM usando `await transition.ready;` dentro del manejador del evento `qviewTransition`.
        *   Usar `document.documentElement.animate(...)` especificando el `pseudoElement` (e.g., `::view-transition-old(nombre-transicion)`).
        *   Puede ser necesario desactivar las animaciones CSS por defecto (`animation: none;`) en los pseudo-elementos si se usa WAAPI para evitar conflictos.
            ```typescript
            // useOnDocument('qviewTransition', $(async (event: CustomEvent<ViewTransition>) => {
            //   const transition = event.detail;
            //   // ... lógica para obtener nombres de transición ...
            //   await transition.ready;
            //   names.forEach((name, i) => {
            //     document.documentElement.animate({ opacity: 0 }, {
            //       pseudoElement: `::view-transition-old(${name})`,
            //       duration: 200, fill: "forwards", delay: i * 50
            //     });
            //   });
            // }));
            ```
    *   **Nota:** La interfaz `ViewTransition` requiere TypeScript >5.6. `view-transition-class` tiene mejor soporte en Chrome.
32. **Funcionalidad de Arrastrar y Soltar (Drag & Drop):**
    *   **APIs de Qwik:** Utilizar `onDragStart$`, `onDragOver$`, `onDragLeave$`, y `onDrop$`.
    *   **Manejo de Sincronicidad:**
        *   Qwik procesa eventos de forma asíncrona por defecto. APIs como `event.preventDefault()`, `e.dataTransfer.getData()`, `e.dataTransfer.setData()` necesitan ejecución síncrona.
        *   Usar `sync$()` para envolver los manejadores de eventos que necesitan acceso síncrono a estas APIs.
        *   Para `event.preventDefault()`, se puede usar la sintaxis declarativa: `preventdefault:dragover`, `preventdefault:drop`.
    *   **Estrategia con `sync$()`:**
        *   `sync$()`: Para lógica síncrona mínima (e.g., `setData`, `getData`, `preventDefault`, manipulación de atributos para feedback visual inmediato). No puede cerrar sobre estado ni llamar funciones en scope/importadas.
        *   `$()`: Para lógica asíncrona posterior (e.g., actualizar el estado de la aplicación después de un `drop`).
        *   Pasar estado a `sync$()` a través de atributos `data-*` en los elementos.
    *   **Ejemplo de Flujo:**
        1.  **Elemento Arrastrable:**
            *   `draggable="true"`
            *   `onDragStart$={sync$((e, el) => { e.dataTransfer?.setData('text/plain', el.dataset.id); })}`
        2.  **Zona de Destino (Dropzone):**
            *   `preventdefault:dragover`
            *   `preventdefault:drop`
            *   `onDragOver$={sync$((e, el) => { el.setAttribute('data-over', 'true'); /* Feedback visual */ })}`
            *   `onDragLeave$={sync$((e, el) => { el.removeAttribute('data-over'); })}`
            *   `onDrop$={[ sync$((e, el) => { el.dataset.droppedId = e.dataTransfer?.getData('text/plain'); el.removeAttribute('data-over'); }), $((e, el) => { /* Lógica asíncrona para actualizar stores con el.dataset.droppedId */ }) ]}`
33. **Gestión de Temas (Claro/Oscuro con Tailwind CSS):**
    *   **Configuración de Tailwind:**
        *   Habilitar el modo oscuro en `tailwind.config.js`: `darkMode: "class"`.
        *   Instalar Tailwind CSS en el proyecto Qwik: `yarn qwik add tailwind`.
    *   **Script de Inicialización del Tema (en `root.tsx`):**
        *   Colocar un script en el `<head>` de `src/root.tsx` para aplicar el tema (claro/oscuro) antes de que la página se renderice completamente, evitando el "flash" (FOUT - Flash Of Unstyled Theme).
        *   Este script debe leer de `localStorage` o `prefers-color-scheme` y aplicar la clase `dark` o `light` al `document.documentElement`.
            ```html
            // <script dangerouslySetInnerHTML={`
            //   (function() {
            //     function setTheme(theme) {
            //       document.documentElement.className = theme;
            //       localStorage.setItem('theme', theme);
            //     }
            //     var theme = localStorage.getItem('theme');
            //     if (theme) {
            //       setTheme(theme);
            //     } else {
            //       if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            //         setTheme('dark');
            //       } else {
            //         setTheme('light');
            //       }
            //     }
            //   })();
            //   // Opcional: Sincronizar estado del toggle al cargar
            //   window.addEventListener('load', function() {
            //     const themeSwitch = document.getElementById('id-del-toggle'); // Asegúrate que el ID coincida
            //     if (themeSwitch) themeSwitch.checked = localStorage.getItem('theme') === 'dark'; // o 'light' dependiendo de la lógica del toggle
            //   });
            // `}></script>
            ```
    *   **Componente de Cambio de Tema:**
        *   Crear un componente con un input (e.g., checkbox) para cambiar el tema.
        *   En el `onClick$`, cambiar la clase en `document.documentElement` y actualizar `localStorage`.
            ```typescript
            // onClick$={() => {
            //   const currentTheme = document.documentElement.className;
            //   const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            //   document.documentElement.className = newTheme;
            //   localStorage.setItem('theme', newTheme);
            // }}
            ```
    *   **Estilos en Tailwind:** Usar el prefijo `dark:` para estilos específicos del modo oscuro (e.g., `bg-white dark:bg-black`).
34. **`sync$()` para Eventos Síncronos (BETA):**
    *   **Propósito:** Qwik procesa eventos de forma asíncrona. `sync$()` permite ejecutar manejadores de eventos de forma síncrona cuando es necesario (e.g., para `event.preventDefault()`, `event.stopPropagation()`, o acceso inmediato a `event.dataTransfer`).
    *   **Limitaciones de `sync$()`:**
        *   No puede cerrar sobre (capturar) estado del componente o variables del scope.
        *   No puede llamar a otras funciones declaradas en el scope o importadas directamente.
        *   Se serializa en el HTML, por lo que su código debe ser conciso.
    *   **Estrategia de Uso:**
        1.  **`sync$()`:** Para la lógica estrictamente síncrona y mínima.
        2.  **`$()`:** Para la lógica asíncrona posterior, que puede acceder al estado, llamar a otras funciones, etc.
        3.  **Atributos `data-*`:** Usar atributos en el elemento para pasar "estado" o datos necesarios al `sync$()`.
    *   **Ejemplo (Prevenir default condicionalmente):**
        ```typescript
        // const shouldPrevent = useSignal(true);
        // <a href="https://qwik.dev/"
        //    data-prevent={shouldPrevent.value.toString()} // Pasar estado como string
        //    onClick$={[
        //      sync$((e, target) => { // target es HTMLAnchorElement
        //        if (target.dataset.prevent === 'true') {
        //          e.preventDefault();
        //        }
        //      }),
        //      $(() => {
        //        console.log(shouldPrevent.value ? 'Prevented' : 'Not Prevented');
        //      })
        //    ]}
        // >Link</a>
        ```
    *   **Alternativa para `preventDefault` simple:** Usar `preventdefault:{eventName}` (e.g., `preventdefault:click`). `sync$()` es para casos más complejos o cuando se necesita `stopPropagation` o acceso síncrono a propiedades del evento.
35. **Streaming / Deferred Loaders (`routeLoader$`):**
    *   **Comportamiento por Defecto:** `routeLoader$` espera a que su promesa se resuelva antes de renderizar los componentes que dependen de sus datos.
    *   **Streaming/Deferring:** Para mejorar la TTI (Time To Interactive) y mostrar contenido antes, se puede hacer que `routeLoader$` devuelva una *función asíncrona* (`async () => { ... }`).
    *   **Funcionamiento:**
        1.  Qwik renderiza el DOM hasta el punto donde se utiliza el `routeLoader$`.
        2.  La ejecución de la función asíncrona devuelta por `routeLoader$` se difiere.
        3.  El componente `<Resource />` se utiliza para manejar los diferentes estados de esta carga diferida (pendiente, resuelto, error).
    *   **Ejemplo:**
        ```typescript
        // import { Resource, component$ } from '@builder.io/qwik';
        // import { routeLoader$ } from '@builder.io/qwik-city';
        
        // export const useMyDeferredData = routeLoader$(() => {
        //   return async () => { // Devuelve una función asíncrona
        //     await new Promise(resolve => setTimeout(resolve, 2000)); // Simula delay
        //     return { message: 'Datos cargados diferidamente!' };
        //   };
        // });
        
        // export default component$(() => {
        //   const deferredData = useMyDeferredData();
        //   return (
        //     <>
        //       <div>Contenido Inmediato</div>
        //       <Resource
        //         value={deferredData}
        //         onPending={() => <p>Cargando datos diferidos...</p>}
        //         onResolved={(data) => <p>{data.message}</p>}
        //         onRejected={(error) => <p>Error: {error.message}</p>}
        //       />
        //       <div>Otro Contenido Inmediato</div>
        //     </>
        //   );
        // });
        ```
    *   Esto permite que la página inicial se muestre rápidamente, y las secciones de datos más pesadas se carguen y rendericen después, mejorando la percepción de velocidad.
36. **Gestión de Fuentes (Fonts):**
    *   **Impacto en Performance:** Las fuentes personalizadas deben descargarse, lo que puede causar FOIT (Flash Of Invisible Text) o FOUT (Flash Of Unstyled Text) y afectar el CLS (Cumulative Layout Shift).
    *   **`font-display` CSS Property:** Controla cómo se cargan las fuentes.
        *   `swap`: Muestra texto con fuente de fallback mientras se carga la fuente personalizada. Causa FOUT pero el contenido es visible antes. Es una opción común.
        *   `fallback`: Breve período invisible, luego fallback si la fuente no carga rápido.
        *   Otras opciones: `block`, `optional`.
    *   **Auto-hospedaje (Self-Hosting):**
        *   **Beneficios:** Mejor rendimiento (evita peticiones a dominios de terceros), mayor privacidad, funcionamiento offline (para PWAs).
        *   **Fontsource:** Recomendado para auto-hospedar Google Fonts y otras fuentes open source fácilmente (`yarn add @fontsource/nombre-fuente`). Seguir su guía para Qwik City.
        *   **Manual:**
            1.  Convertir fuentes (TTF/OTF) a formatos web (WOFF/WOFF2) usando herramientas como Fontsquirrel Webfont Generator.
            2.  Definir `@font-face` en CSS, incluyendo `font-display: swap;` (o el valor elegido).
                ```css
                // @font-face {
                //   font-display: swap;
                //   font-family: "MiFuente";
                //   font-style: normal;
                //   font-weight: 400;
                //   src: url("/fonts/mi-fuente-regular.woff2") format("woff2");
                // }
                ```
    *   **Reducción del Tamaño de Fuentes:**
        *   Usar `unicode-range` en `@font-face` para cargar solo los subconjuntos de glifos necesarios (e.g., solo latinos). Herramientas como Glyphhanger pueden ayudar.
    *   **Fuentes de Fallback y CLS:**
        *   Ajustar las métricas de la fuente de fallback para que coincidan lo más posible con la fuente personalizada para minimizar el CLS.
        *   **Herramientas:** "Fallback Font Generator" (manual), "Fontaine" (plugin Vite para automatizar ajustes de `size-adjust`, `ascent-override`, `descent-override`).
    *   **Fuentes del Sistema (System Fonts):**
        *   Opción más performante ya que no requieren descarga.
        *   Usar "font stacks" (e.g., `font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, ...;`).
        *   Tailwind CSS provee utilidades para fuentes del sistema.
    *   **Buenas Prácticas de UX con Fuentes:**
        *   **`max-width` para texto:** Usar `px` o `rem` en lugar de `ch` para `max-width` en cuerpos de texto si se usan fuentes personalizadas, ya que el ancho del carácter `0` varía entre fuentes y puede causar CLS.
        *   **`font-size`:** Usar `rem` para respetar las preferencias de tamaño de fuente del usuario.
        *   **`line-height`:** Recomendado ~1.5 para cuerpo de texto, ~1.2 para encabezados.

        # Guía Exhaustiva: Qwik UI Headless 0.6.8

> **Toda la UI del proyecto debe implementarse exclusivamente con los componentes de `@qwik-ui/headless`.**

---

## Índice
- [Introducción](#introducción)
- [Instalación](#instalación)
- [Principios Clave](#principios-clave)
- [Componentes Disponibles](#componentes-disponibles)
- [Guía de Componentes (con ejemplos, props, API, CSS, accesibilidad, etc.)](#guía-de-componentes)
  - [Accordion](#accordion)
  - [Carousel](#carousel)
  - [Collapsible](#collapsible)
  - [Combobox](#combobox)
  - [Checkbox](#checkbox)
  - [Dropdown](#dropdown)
  - [Label](#label)
  - [Modal](#modal)
  - [Pagination](#pagination)
  - [Popover](#popover)
  - [Progress](#progress)
  - [Select](#select)
  - [Separator](#separator)
  - [Tabs](#tabs)
  - [Tooltip](#tooltip)
  - [Toggle](#toggle)
  - [Toggle Group](#toggle-group)
- [Recursos](#recursos)
- [Notas Finales](#notas-finales)

---

## Introducción

**Qwik UI Headless** es una librería de componentes UI accesibles, sin estilos por defecto, totalmente personalizables y optimizados para SSR/CSR con Qwik. Todos los componentes siguen los patrones WAI-ARIA, gestionan atributos ARIA, foco y navegación por teclado. 

- **Accesibilidad:** Cumple WAI-ARIA y es testeado con tecnologías de asistencia.
- **Sin estilos por defecto:** Trae tus propios estilos (Tailwind, CSS, etc.).
- **SSR/CSR agnóstico:** Funciona igual en server y client.
- **Experiencia de desarrollador:** API tipada, componible y fácil de descubrir.

---

## Instalación

```sh
yarn add -D @qwik-ui/headless
```

---

## Principios Clave
- **Accesibilidad**: Siempre usa Label, Description y atributos ARIA.
- **Estilos modernos**: Usa Tailwind CSS o CSS moderno. Aplica clases y data-attributes (`data-open`, `data-selected`, etc.) para estilos reactivos y animaciones.
- **Control de estado**: Usa signals (`useSignal`), `bind:value`, `onChange$`, etc.
- **SSR/CSR**: Todos los componentes funcionan en ambos entornos.
- **Composición**: Usa la anatomía recomendada (Root, Trigger, Content, etc.).

---

## Componentes Disponibles
- Accordion
- Carousel
- Collapsible
- Combobox
- Checkbox
- Dropdown
- Label
- Modal
- Pagination
- Popover
- Progress
- Select
- Separator
- Tabs
- Tooltip
- Toggle
- Toggle Group

---

## Guía de Componentes

### Accordion

## Descripción
Secciones colapsables que permiten mostrar u ocultar contenido. Soporta múltiples secciones abiertas, colapsado total, y callbacks para cambios de estado.

### Ejemplo de Uso
```tsx
import { component$ } from '@builder.io/qwik';
import { Accordion } from '@qwik-ui/headless';

export default component$(() => (
  <Accordion.Root>
    <Accordion.Item>
      <Accordion.Header>
        <Accordion.Trigger>Title</Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content>Content</Accordion.Content>
    </Accordion.Item>
  </Accordion.Root>
));
```

### Props Principales
| Prop                | Tipo                | Descripción |
|---------------------|---------------------|-------------|
| `value`             | string              | Controla el item abierto |
| `multiple`          | boolean             | Permite abrir varios items |
| `collapsible`       | boolean             | Permite colapsar todos los items |
| `onChange$`         | QRL                  | Callback al cambiar el item abierto |

### Anatomía
- `Accordion.Root`: Contenedor principal
- `Accordion.Item`: Item individual
- `Accordion.Header`: Cabecera del item
- `Accordion.Trigger`: Botón para activar/desactivar
- `Accordion.Content`: Contenido del item

### Accesibilidad y Teclado
- `Tab`: Navega entre controles
- `Enter`: Activa el trigger del accordion
- `Space`: Activa el trigger del accordion

### CSS Moderno
```css
@layer qwik-ui {
  .collapsible { min-width: 14rem; }
  .collapsible-trigger { width: 100%; border: 2px dotted #333; border-radius: 0.5rem; padding: 0.5rem; display: flex; justify-content: space-between; align-items: center; }
  .collapsible-trigger[data-open] { border-bottom: none; }
  .collapsible-content { width: 100%; font-weight: 500; background: #f3f4f6; border-radius: 0.5rem; overflow: hidden; }
  .collapsible-content-outline { padding: 0.5rem; border: 2px dotted #333; }
}
```

---

### Carousel
#### Descripción
Muestra y navega entre múltiples elementos de contenido. Soporta alineación, slides múltiples, autoplay, vertical/horizontal, paginación, y más.

#### Ejemplo de Uso
```tsx
import { component$, useSignal } from '@builder.io/qwik';
import { Carousel } from '@qwik-ui/headless';

export default component$(() => {
  const selectedIndex = useSignal(0);
  return (
    <Carousel.Root bind:selectedIndex={selectedIndex} slidesPerView={1} gap={16}>
      <Carousel.Scroller>
        <Carousel.Slide>Slide 1</Carousel.Slide>
        <Carousel.Slide>Slide 2</Carousel.Slide>
        <Carousel.Slide>Slide 3</Carousel.Slide>
      </Carousel.Scroller>
      <Carousel.Pagination />
      <Carousel.Previous>Prev</Carousel.Previous>
      <Carousel.Next>Next</Carousel.Next>
    </Carousel.Root>
  );
});
```

#### Props Principales
| Prop                | Tipo                | Descripción |
|---------------------|---------------------|-------------|
| `gap`               | number              | Espacio entre slides |
| `slidesPerView`     | number              | Slides visibles |
| `draggable`         | boolean             | Permite arrastrar |
| `align`             | 'start'\|'center'\|'end' | Alineación |
| `rewind`            | boolean             | Rewind al inicio |
| `bind:selectedIndex`| Signal<number>      | Índice seleccionado |
| `startIndex`        | number              | Índice inicial |
| `bind:autoplay`     | Signal<boolean>     | Autoplay |
| `autoPlayIntervalMs`| number              | Intervalo autoplay |
| `orientation`       | 'horizontal'\|'vertical' | Orientación |
| `mousewheel`        | boolean             | Navegación con rueda |
| ...                 | ...                 | ... |

#### Anatomía
- `Carousel.Root`: Contenedor principal
- `Carousel.Scroller`: Contenedor de slides
- `Carousel.Slide`: Slide individual
- `Carousel.Pagination`, `Carousel.Bullet`: Paginación
- `Carousel.Previous`, `Carousel.Next`: Navegación

#### Accesibilidad y Teclado
- `Tab`: Navega entre controles
- `ArrowLeft/ArrowRight/ArrowUp/ArrowDown`: Cambia de slide
- `Home/End`: Primer/último slide

#### CSS Moderno
```css
@layer qwik-ui {
  [data-qui-carousel-viewport] { overflow: hidden; }
  [data-qui-carousel-scroller] {
    transform: var(--transform);
    will-change: transform;
    transition: 0.3s transform ease-out;
    display: flex;
    gap: var(--gap);
    flex-direction: var(--orientation);
    scroll-snap-type: both mandatory;
    max-height: calc(var(--max-slide-height));
  }
  [data-qui-carousel-slide] {
    flex-basis: var(--slide-width);
    flex-shrink: 0;
    position: relative;
  }
}
```

#### Notas
- Soporta SSR/CSR.
- Paginación y bullets accesibles como tabs.
- Animaciones personalizables con CSS.

---

### Collapsible
#### Descripción
Sección que se puede expandir o colapsar. Ideal para ocultar contenido opcional.

#### Ejemplo de Uso
```tsx
import { component$ } from '@builder.io/qwik';
import { Collapsible } from '@qwik-ui/headless';

export default component$(() => (
  <Collapsible.Root>
    <Collapsible.Trigger>Mostrar más</Collapsible.Trigger>
    <Collapsible.Content>
      Contenido adicional aquí.
    </Collapsible.Content>
  </Collapsible.Root>
));
```

#### Props Principales
| Prop                | Tipo                | Descripción |
|---------------------|---------------------|-------------|
| `open`              | boolean             | Controla el estado abierto |
| `onOpenChange$`     | QRL                  | Callback al abrir/cerrar |

#### Anatomía
- `Collapsible.Root`: Contenedor principal
- `Collapsible.Trigger`: Botón para activar/desactivar
- `Collapsible.Content`: Contenido colapsable

#### Accesibilidad y Teclado
- `Tab`: Navega entre controles
- `Enter`: Activa el trigger del collapsible
- `Space`: Activa el trigger del collapsible

#### CSS Moderno
```css
@layer qwik-ui {
  .collapsible-content { padding: 1rem; border: 2px dotted #333; background: #f9f9f9; border-radius: 0.5rem; }
  .collapsible-trigger { padding: 0.5rem; border: 2px dotted #333; border-radius: 0.5rem; cursor: pointer; }
}
```

---

### Combobox
#### Descripción
Input que permite seleccionar un valor de una lista desplegable o escribir un valor personalizado.

#### Ejemplo de Uso
```tsx
import { component$ } from '@builder.io/qwik';
import { Combobox } from '@qwik-ui/headless';

export default component$(() => (
  <Combobox.Root>
    <Combobox.Label>label</Combobox.Label>
    <Combobox.Control>
      <Combobox.Input />
      <Combobox.Trigger>trigger</Combobox.Trigger>
    </Combobox.Control>
    <Combobox.Popover>
      <Combobox.Item>
        <Combobox.ItemLabel>item label</Combobox.ItemLabel>
        <Combobox.ItemIndicator>✓</Combobox.ItemIndicator>
      </Combobox.Item>
    </Combobox.Popover>
  </Combobox.Root>
));
```

#### Props y Estado
- `bind:value`: Valor seleccionado (controlado).
- `multiple`: Selección múltiple.
- `onChange$`: Callback al cambiar selección.
- `filter`: Desactiva el filtrado por defecto.
- `loop`: Navegación cíclica.

#### Anatomía
- `Combobox.Root`: Contenedor principal
- `Combobox.Label`: Etiqueta del combobox
- `Combobox.Control`: Contenedor del input y trigger
- `Combobox.Input`: Input de texto
- `Combobox.Trigger`: Botón para abrir/cerrar la lista
- `Combobox.Popover`: Lista desplegable
- `Combobox.Item`: Item de la lista
- `Combobox.ItemLabel`: Etiqueta del item
- `Combobox.ItemIndicator`: Indicador del item seleccionado

#### Accesibilidad y Teclado
- `Tab`: Navega entre controles
- `ArrowUp/ArrowDown`: Navega entre items
- `Enter`: Selecciona el item y cierra el combobox
- `Escape`: Cierra el combobox sin seleccionar

#### CSS Moderno
```css
@layer qwik-ui {
  .combobox-root { min-width: 12rem; }
  .combobox-input { background: transparent; padding-inline: 0.5rem; }
  .combobox-trigger { border-radius: 0.5rem; width: 44px; background: #f3f4f6; display: flex; align-items: center; justify-content: center; }
  .combobox-popover { width: 100%; background: #fff; padding: 0.5rem; border: 2px dotted #333; border-radius: 0.5rem; }
  .combobox-item { display: flex; align-items: center; justify-content: space-between; }
}
```

---

### Checkbox
#### Descripción
Componente para seleccionar una opción binaria (sí/no, verdadero/falso).

#### Ejemplo de Uso
```tsx
import { component$ } from '@builder.io/qwik';
import { Checkbox } from '@qwik-ui/headless';

export default component$(() => (
  <Checkbox.Root>
    <Checkbox.Input />
    <Checkbox.Control>
      <Checkbox.Indicator>✓</Checkbox.Indicator>
    </Checkbox.Control>
    <Checkbox.Label>Accept Terms</Checkbox.Label>
  </Checkbox.Root>
));
```

#### Props y Estado
- `bind:checked`: Controla el estado (marcado/desmarcado).

#### Anatomía
- `Checkbox.Root`: Contenedor principal
- `Checkbox.Input`: Input tipo checkbox
- `Checkbox.Control`: Contenedor del indicador
- `Checkbox.Indicator`: Indicador visual (checkmark)
- `Checkbox.Label`: Etiqueta del checkbox

#### Accesibilidad y Teclado
- `Tab`: Navega entre controles
- `Space`: Cambia el estado (marca/desmarca)

---

### Dropdown
#### Descripción
Menú contextual personalizable. Soporta grupos, separadores, items con checkbox/radio, y control total del estado.

#### Ejemplo de Uso
```tsx
import { component$ } from '@builder.io/qwik';
import { Dropdown } from '@qwik-ui/headless';

export default component$(() => (
  <Dropdown.Root>
    <Dropdown.Trigger>Open Menu</Dropdown.Trigger>
    <Dropdown.Popover>
      <Dropdown.Item>Option 1</Dropdown.Item>
      <Dropdown.Item>Option 2</Dropdown.Item>
      <Dropdown.Separator />
      <Dropdown.CheckboxItem>Check me</Dropdown.CheckboxItem>
      <Dropdown.RadioGroup>
        <Dropdown.RadioItem value="a">A</Dropdown.RadioItem>
        <Dropdown.RadioItem value="b">B</Dropdown.RadioItem>
      </Dropdown.RadioGroup>
    </Dropdown.Popover>
  </Dropdown.Root>
));
```

#### Anatomía
- `Dropdown.Root`: Contenedor principal
- `Dropdown.Trigger`: Botón para abrir el menú
- `Dropdown.Popover`: Contenedor del menú
- `Dropdown.Item`: Item del menú
- `Dropdown.CheckboxItem`: Item con checkbox
- `Dropdown.RadioGroup`: Grupo de radios
- `Dropdown.RadioItem`: Item de radio
- `Dropdown.Separator`: Separador visual
- `Dropdown.Group`: Grupo de items
- `Dropdown.GroupLabel`: Etiqueta del grupo
- `Dropdown.ItemIndicator`: Indicador del item seleccionado

#### Props Principales
| Prop         | Tipo      | Descripción |
|--------------|-----------|-------------|
| `bind:open`  | Signal    | Estado abierto |
| `onOpenChange$` | QRL    | Callback al abrir/cerrar |

#### Accesibilidad
- Roles ARIA y navegación por teclado gestionados automáticamente.

#### CSS Moderno
```css
@layer qwik-ui {
  .dropdown-popover { background: #fff; border-radius: 0.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  .dropdown-item[data-selected] { background: #f3f4f6; }
  .dropdown-item[data-disabled] { opacity: 0.5; pointer-events: none; }
}
```

---

### Label
#### Descripción
Componente para asociar etiquetas accesibles a inputs y controles.

#### Ejemplo de Uso
```tsx
import { Label } from '@qwik-ui/headless';
<Label for="input-id">Nombre</Label>
<input id="input-id" />
```

#### Props
- `for`: id del input asociado

#### Accesibilidad
- Usa siempre Label para inputs y controles interactivos.

---

### Modal
#### Descripción
Diálogo modal para mostrar contenido sobrepuesto. Soporta cierre por backdrop click, y callbacks para eventos de apertura y cierre.

#### Ejemplo de Uso
```tsx
import { component$ } from '@builder.io/qwik';
import { Modal } from '@qwik-ui/headless';

export default component$(() => (
  <Modal.Root>
    <Modal.Trigger>Open Modal</Modal.Trigger>
    <Modal.Panel>
      <Modal.Title>Title</Modal.Title>
      <Modal.Description>Description</Modal.Description>
      {/* contenido */}
      <Modal.Close>Close</Modal.Close>
    </Modal.Panel>
  </Modal.Root>
));
```

#### Props y Estado
- `bind:show`: Controla la visibilidad.
- `onShow$`/`onClose$`: Callbacks de apertura/cierre.
- `closeOnBackdropClick`: Cierra al hacer click fuera.

#### Anatomía
- `Modal.Root`: Contenedor principal
- `Modal.Trigger`: Botón para abrir el modal
- `Modal.Panel`: Contenedor del contenido del modal
- `Modal.Title`: Título del modal
- `Modal.Description`: Descripción del modal
- `Modal.Close`: Botón para cerrar el modal

#### Accesibilidad y Teclado
- `Tab`: Navega entre controles del modal
- `Escape`: Cierra el modal

#### CSS Moderno
```css
@layer qwik-ui {
  .modal-panel { padding: 1rem; border: 2px dotted #333; background: #fff; border-radius: 0.5rem; max-width: 28rem; }
  .modal-trigger { padding: 0.5rem; border: 2px dotted #333; border-radius: 0.5rem; }
  .modal-close { padding: 0.5rem; border: 2px dotted #333; border-radius: 0.5rem; }
}
```

---

### Pagination
#### Descripción
Navegación entre páginas. Soporta personalización total de botones, etiquetas, flechas, y estilos.

#### Ejemplo de Uso
```tsx
import { component$, useSignal } from '@builder.io/qwik';
import { Pagination } from '@qwik-ui/headless';

export default component$(() => {
  const selectedPage = useSignal(1);
  return (
    <Pagination
      selectedPage={selectedPage.value}
      totalPages={10}
      onPageChange$={(page) => selectedPage.value = page}
      class="pagination-wrapper"
      selectedClass="pagination-selected-btn"
      defaultClass="pagination-btn"
      dividerClass="pagination-divider"
      prevButtonClass="prevNextButtons"
      nextButtonClass="prevNextButtons"
    />
  );
});
```

#### Props Principales
| Prop              | Tipo      | Descripción |
|-------------------|-----------|-------------|
| `selectedPage`    | number    | Página actual |
| `totalPages`      | number    | Total de páginas |
| `onPageChange$`   | function  | Callback al cambiar página |
| ...               | ...       | ... |

#### Anatomía
- `Pagination`: Componente principal
- `Pagination.Button`: Botón de página
- `Pagination.Divider`: Separador entre botones
- `Pagination.Previous`: Botón de página anterior
- `Pagination.Next`: Botón de siguiente página

#### Accesibilidad y Teclado
- `Tab`: Navega entre controles
- `Enter`: Activa el botón de página
- `ArrowLeft/ArrowRight`: Navega entre páginas

#### CSS Moderno
```css
@layer qwik-ui {
  .pagination-wrapper { display: flex; gap: 0.5rem; }
  .pagination-btn { border: 1px solid #ccc; border-radius: 0.25rem; padding: 0.5rem; }
  .pagination-selected-btn { background: #333; color: #fff; }
  .pagination-divider { padding: 0 0.5rem; }
}
```

---

### Popover
#### Descripción
Componente para mostrar contenido flotante sobre otros elementos. Ideal para tooltips, menús, y más.

#### Ejemplo de Uso
```tsx
import { component$ } from '@builder.io/qwik';
import { Popover } from '@qwik-ui/headless';

export default component$(() => (
  <Popover.Root>
    <Popover.Trigger>Hover me</Popover.Trigger>
    <Popover.Content>
      Contenido del popover
    </Popover.Content>
  </Popover.Root>
));
```

#### Props y Estado
- `bind:open`: Controla la visibilidad.
- `onOpenChange$`: Callback al abrir/cerrar.

#### Anatomía
- `Popover.Root`: Contenedor principal
- `Popover.Trigger`: Elemento que activa el popover
- `Popover.Content`: Contenido del popover

#### Accesibilidad y Teclado
- `Tab`: Navega entre controles
- `Enter`: Activa el trigger del popover
- `Escape`: Cierra el popover

---

### Progress
#### Descripción
Barra de progreso para indicar el avance de una tarea.

#### Ejemplo de Uso
```tsx
import { component$, useSignal } from '@builder.io/qwik';
import { Progress } from '@qwik-ui/headless';

export default component$(() => {
  const value = useSignal(50);
  return <Progress value={value} max={100} />;
});
```

#### Props y Estado
- `value`: Valor actual.
- `min`: Valor mínimo.
- `max`: Valor máximo.
- `bind:value`: Valor controlado.

#### Anatomía
- `Progress`: Componente principal
- `Progress.Indicator`: Indicador de progreso

#### Accesibilidad
- Usa roles ARIA apropiados para indicar el estado.

#### CSS Moderno
```css
@layer qwik-ui {
  .progress { background: #e5e7eb; border-radius: 0.5rem; overflow: hidden; }
  .progress-indicator { background: #3b82f6; height: 100%; transition: width 0.3s; }
}
```

---

### Select
#### Descripción
Componente para seleccionar una o varias opciones de una lista.

#### Ejemplo de Uso
```tsx
import { component$, useSignal } from '@builder.io/qwik';
import { Select } from '@qwik-ui/headless';

export default component$(() => {
  const selected = useSignal<string[]>([]);
  return (
    <Select.Root multiple bind:value={selected}>
      <Select.Trigger>Selecciona opciones</Select.Trigger>
      <Select.Popover>
        <Select.Item value="opcion1">Opción 1</Select.Item>
        <Select.Item value="opcion2">Opción 2</Select.Item>
      </Select.Popover>
    </Select.Root>
  );
});
```

#### Props y Estado
- `bind:value`: Valor seleccionado (controlado).
- `multiple`: Permite selección múltiple.
- `onChange$`: Callback al cambiar selección.
- `loop`: Navegación cíclica.

#### Anatomía
- `Select.Root`: Contenedor principal
- `Select.Trigger`: Botón que muestra el valor seleccionado y abre el menú
- `Select.Popover`: Menú desplegable con opciones
- `Select.Item`: Opción individual

#### Accesibilidad y Teclado
- `Tab`: Navega entre controles
- `ArrowUp/ArrowDown`: Navega entre opciones
- `Enter`: Selecciona la opción y cierra el menú
- `Escape`: Cierra el menú sin seleccionar

---

### Separator
#### Descripción
Separa visualmente contenido o grupos de items.

#### Ejemplo de Uso
```tsx
import { Separator } from '@qwik-ui/headless';
<Separator orientation="horizontal" />
<Separator orientation="vertical" />
```

#### Props
| Prop         | Tipo      | Descripción |
|--------------|-----------|-------------|
| `orientation`| 'horizontal'\|'vertical' | Orientación |
| `decorative` | boolean   | Solo decorativo (no accesible) |

#### Anatomía
- `Separator`: Componente principal

#### CSS Moderno
```css
@layer qwik-ui {
  .separator-top { border-top: 1px solid #e5e7eb; margin: 1rem 0; }
  .separator-left, .separator-right { border-left: 1px solid #e5e7eb; height: 2rem; }
}
```

---

### Tabs
#### Descripción
Navegación por pestañas para organizar contenido en secciones.

#### Ejemplo de Uso
```tsx
import { component$, useSignal } from '@builder.io/qwik';
import { Tabs } from '@qwik-ui/headless';

export default component$(() => {
  const selectedIndex = useSignal(0);
  return (
    <Tabs.Root bind:selectedIndex={selectedIndex}>
      <Tabs.List>
        <Tabs.Tab>Tab 1</Tabs.Tab>
        <Tabs.Tab>Tab 2</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panels>
        <Tabs.Panel>Contenido de la pestaña 1</Tabs.Panel>
        <Tabs.Panel>Contenido de la pestaña 2</Tabs.Panel>
      </Tabs.Panels>
    </Tabs.Root>
  );
});
```

#### Props y Estado
- `bind:selectedIndex`: Índice de la pestaña seleccionada.
- `onSelectedIndexChange$`: Callback al cambiar de pestaña.

#### Anatomía
- `Tabs.Root`: Contenedor principal
- `Tabs.List`: Contenedor de las pestañas
- `Tabs.Tab`: Pestaña individual
- `Tabs.Panels`: Contenedor de los paneles de contenido
- `Tabs.Panel`: Panel de contenido de una pestaña

#### Accesibilidad y Teclado
- `Tab`: Navega entre pestañas
- `ArrowLeft/ArrowRight`: Cambia de pestaña
- `Home/End`: Primera/última pestaña

---

### Tooltip
#### Descripción
Componente para mostrar información adicional al pasar el cursor o enfocar un elemento.

#### Ejemplo de Uso
```tsx
import { component$ } from '@builder.io/qwik';
import { Tooltip } from '@qwik-ui/headless';

export default component$(() => (
  <Tooltip.Root>
    <Tooltip.Trigger>Hover me</Tooltip.Trigger>
    <Tooltip.Content>
      Información adicional aquí.
    </Tooltip.Content>
  </Tooltip.Root>
));
```

#### Props y Estado
- `bind:open`: Controla la visibilidad.
- `onOpenChange$`: Callback al abrir/cerrar.

#### Anatomía
- `Tooltip.Root`: Contenedor principal
- `Tooltip.Trigger`: Elemento que activa el tooltip
- `Tooltip.Content`: Contenido del tooltip

#### Accesibilidad y Teclado
- `Tab`: Navega entre controles
- `Enter`: Activa el trigger del tooltip
- `Escape`: Cierra el tooltip

---

### Toggle
#### Descripción
Componente para alternar entre dos estados (on/off).

#### Ejemplo de Uso
```tsx
import { component$ } from '@builder.io/qwik';
import { Toggle } from '@qwik-ui/headless';

export default component$(() => (
  <Toggle.Root>
    <Toggle.Indicator>On</Toggle.Indicator>
  </Toggle.Root>
));
```

#### Props y Estado
- `bind:pressed`: Controla el estado (activado/desactivado).
- `onPressedChange$`: Callback al cambiar el estado.

#### Anatomía
- `Toggle.Root`: Contenedor principal
- `Toggle.Indicator`: Indicador del estado

#### Accesibilidad y Teclado
- `Tab`: Navega entre controles
- `Space`: Cambia el estado (activa/desactiva)

---

### Toggle Group
#### Descripción
Grupo de toggles interrelacionados, donde el estado de uno puede afectar a los demás.

#### Ejemplo de Uso
```tsx
import { component$ } from '@builder.io/qwik';
import { ToggleGroup, Toggle } from '@qwik-ui/headless';

export default component$(() => (
  <ToggleGroup.Root type="multiple">
    <ToggleGroup.Item value="1">Toggle 1</ToggleGroup.Item>
    <ToggleGroup.Item value="2">Toggle 2</ToggleGroup.Item>
  </ToggleGroup.Root>
));
```

#### Props y Estado
- `type`: Define el comportamiento del grupo (`single` o `multiple`).
- `bind:value`: Controla los valores seleccionados.

#### Anatomía
- `ToggleGroup.Root`: Contenedor principal
- `ToggleGroup.Item`: Item individual del grupo

#### Accesibilidad y Teclado
- `Tab`: Navega entre controles
- `Space`: Cambia el estado del toggle

---

## Recursos
- [Qwik UI Headless Docs](https://qwik.dev/docs/components/qwik-ui/)
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [Tailwind CSS](https://tailwindcss.com/)

---

## Notas Finales
- Si falta un componente, revisa la guía de contribución de Qwik UI.
- Todos los ejemplos pueden y deben ser adaptados a la UI y estilos del proyecto.
- ¡Aporta mejoras o reporta issues en el repo de Qwik UI!


applyTo: "**/(*route.tsx|*server$.ts|*plugin@db.ts|*api*/*.ts)"

# Instrucciones para Interacción con Turso DB

## General
- Turso es una base de datos compatible con libSQL/SQLite.
- Utilizar el cliente oficial `@libsql/client` para interactuar con la base de datos.
- Todas las operaciones de base de datos deben ocurrir **EXCLUSIVAMENTE EN EL SERVIDOR**.

## Conexión
- Las credenciales de Turso (URL y authToken) deben ser almacenadas como variables de entorno del servidor (e.g., `PRIVATE_LIBSQL_DB_URL`, `PRIVATE_LIBSQL_DB_API_TOKEN`).
- Acceder a estas variables usando `requestEvent.env.get('NOMBRE_VARIABLE')` en `routeLoader$`, `routeAction$` o `this.env.get('NOMBRE_VARIABLE')` en `server$`.
- Considerar inicializar el cliente de base de datos en un plugin de Qwik City (e.g., `src/routes/plugin@db.ts`) para reutilizar la conexión, como se sugiere en la documentación de Qwik para arquitecturas "serverfull".

  // Ejemplo en src/routes/plugin@db.ts
  // import { createClient } from '@libsql/client';
  // import type { RequestHandler } from '@builder.io/qwik-city';
  // import { initializeDbIfNeeded } from '~/utils/db'; // Asumiendo un util como el de la doc
  //
  // export const onRequest: RequestHandler = async ({ env, sharedMap }) => {
  //   const url = env.get('PRIVATE_LIBSQL_DB_URL')!;
  //   const authToken = env.get('PRIVATE_LIBSQL_DB_API_TOKEN')!;
  //   // initializeDbIfNeeded y getDB serían helpers para manejar una instancia singleton
  //   const db = await initializeDbIfNeeded(() => createClient({ url, authToken }));
  //   sharedMap.set('db', db); // Opcional: pasarla por sharedMap si es útil
  // };


## Operaciones CRUD
- Realizar operaciones CRUD (SELECT, INSERT, UPDATE, DELETE) dentro de `routeLoader$` (para lecturas) o `routeAction$` / `server$` (para escrituras/mutaciones).
- Usar sentencias SQL preparadas (consultas parametrizadas) para prevenir inyecciones SQL. El cliente `@libsql/client` soporta esto.

  // Ejemplo de uso en un routeLoader$
  // import { routeLoader$ } from '@builder.io/qwik-city';
  // import { getDBFromRequest } from '~/utils/db'; // Helper para obtener DB
  //
  // export const useProductsLoader = routeLoader$(async (requestEvent) => {
  //   const db = getDBFromRequest(requestEvent); // O new Client(...)
  //   const results = await db.execute({
  //     sql: "SELECT * FROM products WHERE category = :category AND price < :maxPrice;",
  //     args: { category: requestEvent.params.category, maxPrice: 100 }
  //   });
  //   return results.rows;
  // });


## Manejo de Errores
- Implementar un manejo de errores robusto para las operaciones de base de datos.
- Considerar el uso de bloques `try/catch` y retornar respuestas de error apropiadas.


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

---
# Aplica estas instrucciones a todos los archivos TSX y JSX.
applyTo: "**/*.{tsx,jsx}"
---
# Instrucciones para Estilizado con Tailwind CSS

## Uso Principal
- Utilizar clases de utilidad de Tailwind CSS directamente en los atributos `class` o `className` de los elementos JSX.
- Ejemplo: `<div class="bg-blue-500 text-white p-4 rounded-lg">Contenido</div>`

## Clases Condicionales
- Para aplicar clases condicionalmente, se puede usar interpolación de strings o bibliotecas como `clsx`.
  ```typescript
  // const isActive = useSignal(false);
  // <button class={`p-2 rounded ${isActive.value ? 'bg-green-500' : 'bg-gray-300'}`}>
  //   Toggle
  // </button>

  // Con clsx (si está instalado)
  // import clsx from 'clsx';
  // <div class={clsx('p-4', { 'bg-red-500': hasError.value }, 'text-white')}>...</div>
  ```

## Configuración
- Si se necesitan extensiones o personalizaciones de Tailwind (colores, fuentes, etc.), estas deben definirse en `tailwind.config.js`.
- Evitar el uso de `@apply` en archivos CSS globales si es posible; preferir la composición de componentes o la creación de componentes Qwik que encapsulen conjuntos de clases comunes.

## Evitar
- No usar estilos en línea (`style={{}}`) para propiedades que pueden ser manejadas por Tailwind, a menos que sea para valores dinámicos que Tailwind no puede generar.
- Minimizar el uso de archivos CSS personalizados.

---
# Aplica estas instrucciones a todos los archivos relacionados con la gestión de temas.
applyTo: "src/**/*.{tsx,jsx}"
---
# Instrucciones para Gestión de Temas en Qwik

## Configuración de Tailwind CSS para Temas

- La aplicación utiliza Tailwind CSS con soporte para modo oscuro basado en clases:

```javascript
// tailwind.config.js
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class", // Habilitamos el modo oscuro basado en clases
  theme: {},
  plugins: [],
};
```

## Script de Inicialización del Tema

- Incluir este script en el `<head>` del archivo `src/root.tsx` para aplicar el tema antes del renderizado completo de la página:

```typescript
<script
  dangerouslySetInnerHTML={`
    (function() {
      function setTheme(theme) {
        document.documentElement.className = theme;
        localStorage.setItem('theme', theme);
      }
      const theme = localStorage.getItem('theme');

      if (theme) {
        setTheme(theme);
      } else {
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          setTheme('dark');
        } else {
          setTheme('light');
        }
      }
    })();
    window.addEventListener('load', function() {
      const themeSwitch = document.getElementById('theme-toggle');
      if (themeSwitch) {
        themeSwitch.checked = localStorage.getItem('theme') === 'dark';
      }
    });
  `}
></script>
```

## Componente de Toggle de Tema

- Crear un componente reutilizable para cambiar entre temas:

```typescript
// Ejemplo de implementación del componente de toggle de tema
import { component$ } from "@builder.io/qwik";

export const ThemeToggle = component$(() => {
  return (
    <div class="flex items-center gap-2">
      <input
        id="theme-toggle"
        type="checkbox"
        class="sr-only"
        onClick$={() => {
          const currentTheme = document.documentElement.className;
          const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
          document.documentElement.className = newTheme;
          localStorage.setItem('theme', newTheme);
        }}
      />
      <label 
        for="theme-toggle" 
        class="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 cursor-pointer dark:bg-gray-600"
      >
        <span class="sr-only">Cambiar tema</span>
        <span class="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-1 dark:translate-x-6"></span>
      </label>
    </div>
  );
});
```

## Clases Condicionales para Temas

- Utilizar el prefijo `dark:` de Tailwind para los estilos específicos del modo oscuro:

```typescript
// Ejemplos de uso de clases condicionales para temas
<div class="bg-white text-gray-800 dark:bg-gray-900 dark:text-white">
  Contenido adaptable al tema
</div>

<button class="bg-blue-500 hover:bg-blue-600 dark:bg-blue-700 dark:hover:bg-blue-800">
  Botón con estados hover adaptados al tema
</button>
```

## Mejores Prácticas

1. **Consistencia**: Definir un conjunto coherente de colores para temas claro y oscuro.

2. **Accesibilidad**:
   - Asegurar suficiente contraste tanto en modo claro como oscuro
   - Proporcionar indicadores visuales claros de estados (hover, focus, active)

3. **Rendimiento**:
   - Evitar el "flash" de tema incorrecto (FOUT - Flash of Unstyled Theme)
   - Utilizar el script de inicialización en el `<head>` como se muestra arriba

4. **Preferencias del Usuario**:
   - Respetar la configuración inicial del sistema (`prefers-color-scheme`)
   - Persistir la elección del usuario (`localStorage`)

5. **UI del Toggle**:
   - Proporcionar iconos claros (sol/luna) o etiquetas que indiquen la función
   - Animar suavemente las transiciones entre temas

## Componentes Específicos de Tema

Para elementos de UI que necesiten estilos diferentes según el tema:

```typescript
<div class="rounded-lg border border-gray-200 p-4 shadow-sm dark:border-gray-700 dark:shadow-gray-900/20">
  <h2 class="text-xl font-bold text-gray-900 dark:text-white">Tarjeta adaptativa</h2>
  <p class="mt-2 text-gray-600 dark:text-gray-300">
    Este componente se adapta automáticamente al tema actual del sistema.
  </p>
</div>
```

## Animación de Transición entre Temas

Para una experiencia más pulida, considerar la adición de transiciones suaves:

```css
/* Añadir en un archivo CSS global o con useStyles$ */
html.light, html.dark {
  transition: background-color 0.3s ease, color 0.3s ease;
}

/* O usar la clase de Tailwind */
<div class="transition-colors duration-300">
  <!-- Contenido -->
</div>
```
aching Responses
Caching responses is critical for keeping your site as fast as possible, both for pages as well as middleware.

A option is to use stale-while-revalidate caching for all responses. Note that this means that users will see a cached response even if the server is updated, and only when the user refreshes will they see the updated content.

For instance, we can add an onGet export to our root layout (src/routes/layout.tsx) like so, to apply good caching defaults site-wide:

src/routes/layout.tsx
import { component$, Slot } from "@builder.io/qwik";
import type { RequestHandler } from "@builder.io/qwik-city";
 
export const onGet: RequestHandler = async ({ cacheControl }) => {
  cacheControl({
    // Always serve a cached response by default, up to a week stale
    staleWhileRevalidate: 60 * 60 * 24 * 7,
    // Max once every 5 seconds, revalidate on the server to get a fresh version of this page
    maxAge: 5,
  });
};
 
export default component$(() => {
  return (
    <main class="mx-auto max-w-[2200px] relative">
      <Slot />
    </main>
  );
});
With the above setup, you will not only have better performance (pages are always served instantly from cache), but you can also have significantly decreased hosting costs, as our server or edge functions only need to run at most once every 5 seconds per page.

cacheControl
Any method that takes a request event can call request.cacheControl to set the cache control headers for the response:

src/routes/layout.tsx
import type { RequestHandler } from "@builder.io/qwik-city";
 
export const onGet: RequestHandler = async ({ cacheControl }) => {
  cacheControl({
    public: true,
    maxAge: 5,
    sMaxAge: 10,
    staleWhileRevalidate: 60 * 60 * 24 * 365,
  });
};
If you have default caching set at the root, but want to disable caching for a specific page, you can override this setting using nested layouts. The below example overrides caching for dashboard pages.

src/routes/dashboard/layout.tsx
import type { RequestHandler } from "@builder.io/qwik-city";
 
// Override caching for /dashboard pages to not cache as they are unique per visitor
export const onGet: RequestHandler = async ({ cacheControl }) => {
  cacheControl({
    public: false,
    maxAge: 0,
    sMaxAge: 0,
    staleWhileRevalidate: 0,
  });
};
 
You can see the full API reference of options you can pass to request.cacheControl.

When not to cache
Caching is generally beneficial, but not right for every page all the time. If your site has URLs that will show different content to different people — for example, pages exclusive to logged-in users or pages that show content based on a user's location — you should avoid using cache-control headers to cache these pages. Instead, render the content of these pages on the server side on a per-visitor basis.

For high traffic pages that look the same to everyone, such as a homepage, caching is great for enhancing performance and reducing cost. For pages specifically for logged in users that may have less traffic, it may advisable to disable caching.

You can conditionally change cache behaviors with any logic you like:

src/routes/layout.tsx
import type { RequestHandler } from "@builder.io/qwik-city";
 
export const onGet: RequestHandler = async ({ cacheControl, url }) => {
  // Only our homepage is public and should be CDN cached. Other pages are unique per visitor
  if (url.pathname === '/') {
    cacheControl({
      public: true,
      maxAge: 5,
      staleWhileRevalidate: 60 * 60 * 24 * 365,
    });
  }
};
CDN Cache Controls
For even more control on your caching strategy, your CDN might have another layer of cache control headers.

The cacheControl convenience method can receive a second argument (set to "Cache-Control" by default). You can pass in any string value specific to your CDN such as "CDN-Cache-Control", "Cloudflare-CDN-Cache-Control", "Vercel-CDN-Cache-Control", etc.

cacheControl({
  maxAge: 5,
  staleWhileRevalidate: 60 * 60 * 24 * 365,
}, "CDN-Cache-Control");
Missing Controls
Some CDNs (such as Vercel Edge) may strip some of your "Cache-Control" headers.

On Vercel's documentation:

If you set Cache-Control without a CDN-Cache-Control, the Vercel Edge Network strips s-maxage and stale-while-revalidate from the response before sending it to the browser. To determine if the response was served from the cache, check the x-vercel-cache header in the response.

If your CDN, such as Vercel Edge, automatically removes certain cache control headers and you wish to implement caching strategies like "stale-while-revalidate" or "s-maxage" in the browser, you can specify an additional cacheControl:

src/routes/layout.tsx
import type { RequestHandler } from "@builder.io/qwik-city";
 
export const onGet: RequestHandler = async ({ cacheControl }) => {
    // If you want the browser to use "stale-while-revalidate" or "s-maxage" Cache Control headers, you have to add the second cacheControl with "CDN-Cache-Control" or "Vercel-CDN-Cache-Control" on Vercel Edge 
    cacheControl({
      staleWhileRevalidate: 60 * 60 * 24 * 365,
      maxAge: 5,
    });
    cacheControl({
      maxAge: 5,
      staleWhileRevalidate: 60 * 60 * 24 * 365,
    }, "CDN-Cache-Control");
};


Deployments
When it's time to deploy your application, Qwik comes with ready-to-use integration that make this so easy!


pnpm

npm

yarn

bun
pnpm run qwik add

Adapters and Middleware
Qwik City middleware is a glue code that connects server rendering framework (such as Cloudflare, Netlify, Vercel, Express etc.) with the Qwik City meta-framework.

Production build
When a new integration is added to the project, a build.server script is added to the package.json file. This script is used to build the project for production.

The only thing you need to do is to run the following command:


pnpm

npm

yarn

bun
pnpm run build

Under the hood, the build script will execute, build.server and build.client scripts.

Advanced
The requestHandler() utility is what each of the above middleware bundles uses in order to translate their request/response to a standard format for Qwik City to use. This function can be used to provide middleware for specific server frameworks.

If there's middleware missing and you'd like it added, take a look at how the requestHandler() utility is used to handle requests for each of the middleware source-code above. Better yet, we'd love to have your middleware contributions! PR's are welcome!

Add A New Deployment
Thanks for your interest in adding a deployment integration to Qwik! We're more than happy to help you get started. Before we get too far, if there's already a deployment for what you're looking for, we'd love to have you contribute to it. If the deployment is not already available, let's add it!

To start it's probably best to copy an existing adapters and middleware and modify it to fit your needs. A deployment is made up of a few different parts:

Add An Adapter
An adapter is the term used to summarize the Vite config that needed for the special build configuration. Each server, whether it's a cloud-service or a custom server, has its own unique build configuration for a specific output the server uses. For example, Cloudflare, Netlify and Node.js Server each have their own build configurations.

The adapter is really a Vite config, that's extending the base config. The base config is the same for all adapters, and the adapter config is the unique part for each server.

Adapters Source
Add Middleware
Middleware is the glue code that connects the server rendering framework (such as Cloudflare, Netlify, Vercel, Express etc.) with the Qwik City meta-framework. Each middleware is responsible for handling the request and response from the server and translating it to a standard format for Qwik City to use.

Luckily Qwik City uses the standardized Request and Response interfaces, so the middleware is usually pretty minimal.

For middleware, you'll notice that each one calls the common @builder.io/qwik-city/middleware/request-handler package. The job of each middleware is to translate the request and response to the standardized format that Qwik City request handler package uses.

Middleware Source
Add To The Starter CLI
The next step is to add the new adapter to the Starter CLI. For this step it's probably best to ping the core team on Discord to help you get started. The CLI is a great place to add the new adapter, because it's a great way to test the new adapter and make sure it's working as expected.

Cache Headers
To assure proper caching of your built files, you need to serve them with the correct cache headers.

By default, files are generated under dist/build and dist/assets, and they get a content hash in the filename. This means that the name is unique for the contents of those files, and they can be cached indefinitely.

Therefore, we recommend that you serve these files with the following header:

Cache-Control: public, max-age=31536000, immutable
The various deployment platforms have different ways of configuring this, and the starters should have the correct configuration already set (you can npx qwik add again to update the configuration). However, there is no one-size-fits-all solution, so verify that caching is working as expected.

To verify proper caching, you can visit your site and open the developer tools to inspect the network requests. When you reload the page, you should see that all requests for assets are coming from the browser cache and are not contacting the server. Even a 304 Not Modified response is not good enough, because it means that the browser is still unsure that the content is cached.

⚠️ Note: If your app uses compiled-i18n or qwik-speak, then translated bundles (build/[locale]/*.js) can retain identical filenames between builds even when translations change. Consider how long you want to cache these files for so users get the latest translations.

Contributors


View Transition API
By default Qwik will start a view transition when SPA navigation. We can run animation either with CSS or WAAPI.

CSS
export default component$(({ list }) => {
  return (
    <ul>
      {list.map((item) => (
        // Create a name per item
        <li key={item.id} class="item" style={{viewTransitionName: `_${item.id}_`}}>...</li>
      ))}
    </ul>
  )
})
.item {
  /* Alias to target all .item with a view-transition-name */
  view-transition-class: animated-item;
}
/* Animate when item didn't exist in the previous page */
::view-transition-new(.animated-item):only-child {
  animation: fade-in 200ms;
}
/* Animate when item doesn't exist in the next page */
::view-transition-old(.animated-item):only-child {
  animation: fade-out 200ms;
}
Sometime we need to have some specific logic before the animation start. In this case you can listen to the qviewTransition event.

For example if you want to only animate visible element:

export default component$(() => {
  // In this case we need the callback to be sync, else the transition might have already happened
  useOnDocument('qviewTransition', sync$((event: CustomEvent<ViewTransition>) => {
    const transition = event.detail;
    const items = document.querySelectorAll('.item');
    for (const item of items) {
      if (!item.checkVisibility()) continue;
      item.dataset.hasViewTransition = true;
    }
  }))
  return (
    <ul>
      {list.map((item) => (
        // Create a name per item
        <li key={item.id} class="item" style={{viewTransitionName: `_${item.id}_`}}>...</li>
      ))}
    </ul>
  )
})
.item[data-has-view-transition="true"] {
  view-transition-class: animated-item;
}
::view-transition-new(.animated-item):only-child {
  animation: fade-in 200ms;
}
::view-transition-old(.animated-item):only-child {
  animation: fade-out 200ms;
}
Note: ViewTransition interface is available with Typescript >5.6.

WAAPI
With Web Animation API you can get more precise, but for that we need to wait for the ::view-transition pseudo-element to exist in the DOM. To achieve that you can wait the transition.ready promise.

In this example we add some delay for each item :

export default component$(() => {
  // Remove default style on the pseudo-element.
  useStyles$(`
    li {
      view-transition-class: items;
    }
    ::view-transition-old(.items) {
      animation: none;
    }
  `);
  useOnDocument('qviewTransition', $(async (event: CustomEvent<ViewTransition>) => {
    // Get visible item's viewTransitionName (should happen before transition is ready)
    const items = document.querySelectorAll<HTMLElement>('.item');
    const names = Array.from(items)
      .filter((item) => item.checkVisibility())
      .map((item) => item.style.viewTransitionName);
 
    // Wait for ::view-transition pseudo-element to exist
    const transition = event.detail;
    await transition.ready; 
 
    // Animate each leaving item
    for (let i = 0; i < names.length; i++) {
      // Note: we animate the <html> element
      document.documentElement.animate({
        opacity: 0,
        transform: 'scale(0.9)'
      }, {
        // Target the pseudo-element inside the <html> element
        pseudoElement: `::view-transition-old(${names[i]})`,
        duration: 200,
        fill: "forwards",
        delay: i * 50, // Add delay for each pseudo-element
      })
    }
  }))
  return (
    <ul>
      {list.map((item) => (
        // Create a name per item
        <li key={item.id} class="item" style={{viewTransitionName: `_${item.id}_`}}>...</li>
      ))}
    </ul>
  )
})
Note: For it to work correctly, we need to remove the default view transition animation else it happens on top of the .animate(). I'm using view-transition-class which is only working with Chrome right now.

This feature is EXPERIMENTAL. We invite you to try it out and provide feedback via the RFC issue.

To use it, you must add experimental: ['preventNavigate'] to your qwikVite plugin options.

Preventing navigation
If the user can lose state by navigating away from the page, you can use usePreventNavigate(callback) to conditionally prevent the navigation.

The callback will be called with the URL that the user is trying to navigate to. If the callback returns true, the navigation will be prevented.

You can return a Promise, and qwik-city will wait until the promise resolves before navigating.

However, in some cases the browser will navigate without calling qwik-city, such as when the user reloads the tab or navigates using <a/> instead of <Link />. When this happens, the answer must be synchronous, and user interaction is not allowed.

You can tell the difference between qwik-city and browser navigation by looking at the provided URL. If the URL is undefined, the browser is navigating away, and you must respond synchronously.

Examples:

using a modal library:
export default component$(() => {
  const okToNavigate = useSignal(true);
  usePreventNavigate$((url) => {
    if (!okToNavigate.value) {
      // we we didn't get a url, the browser is navigating away
      // and we must respond synchronously without dialogs
      if (!url) return true;
 
      // Here we assume that the confirmDialog function shows a modal and returns a promise for the result
      return confirmDialog(
        `Do you want to lose changes and go to ${url}?`
      ).then(answer => !answer);
      // or simply using the browser confirm dialog:
      // return !confirm(`Do you want to lose changes and go to ${url}?`);
    }
  });
 
  return (
    <div>
      <button onClick$={() => (okToNavigate.value = !okToNavigate.value)}>
        toggle user state
      </button>
      application content
    </div>
  );
});
Using a separate modal:
export default component$(() => {
  const okToNavigate = useSignal(true);
  const navSig = useSignal<URL | number>();
  const showConfirm = useSignal(false);
  const nav = useNavigate();
  usePreventNavigate$((url) => {
    if (!okToNavigate.value) {
      if (url) {
        navSig.value = url;
        showConfirm.value = true;
      }
      return true;
    }
  });
 
  return (
    <div>
      <button onClick$={() => (okToNavigate.value = !okToNavigate.value)}>
        toggle user state
      </button>
      application content
      {showConfirm.value && (
        <div>
          <div>
            Do you want to lose changes and go to {String(navSig.value)}?
          </div>
          <button
            onClick$={() => {
              showConfirm.value = false;
              okToNavigate.value = true;
              nav(navSig.value!);
            }}
          >
            Yes
          </button>
          <button onClick$={() => (showConfirm.value = false)}>No</button>
        </div>
      )}
    </div>
  );
});
Contributors
🧪 Devtools
Stage: prototyping

This will eventually become Devtools for your browser to better debug application. For now it is a collection of utilities to better understand the state of your application.

qwik/json
Qwik serializes the state of the application into <script type="qwik/json"> tag. This allows you to inspect the state of the application by looking at the DOM. Unfortunately the format is not very human readable. These steps describe how to parse the JSON into a more readable format.

Open the browser's developer tools.
In the Console run this JavaScript
import("https://qwik.dev/devtools/json/");
The script will parse the qwik/json and will return a much more human readable format.
Most of the resulting output should be self explanatory. But we provide few high level points here to get you oriented. (This is not meant to be a complete documentation of the output.)

objs: These are the objects in the system which have been serialized.
ctx: A set of QContext objects.
refs: A set of QRef objects.
sub: A set of QSubscription objects.
QContext: Represents a state which Qwik had to serialize for a given component. This includes props for the component as well as a set of Task objects which the component may need to execute.
QRef: If an element has a listener, then a QRef collects the listeners as well as any objects which the listener may have captured.
The way to think about Qwik serialization is that Qwik wants to serialize minimal amount of information. For this reason it only serializes objects which are reachable from either QContext or from QRef. This means that if you have an object which is not reachable from either of these two, then it will not be serialized. This is a good thing, because it means that Qwik will not serialize the entire application state, but only the state which is reachable from the component which is being rendered.

The flip side is that if you see an object being serialized and you think it should not be you can trace it backwards to see why it is being serialized. For this purpose all objects include a __backRef property which points to the object which is causing any object to be retained. By tracing the objects references back to their roots (which should be QContext or QRef) we can determine because of which one a particular object is being serialized. Similarly we can see if we can refactor our code to prevent serialization of said object.


🧪 Typed Routes
Stage: prototyping

Provides type safe way of building URLs within the application.

Installation

pnpm

npm

yarn

bun
pnpm install github:QwikDev/qwik-labs-build#main

update vite.config.ts
// ...
import { qwikTypes } from '@builder.io/qwik-labs/vite';
 
export default defineConfig(() => {
  return {
    plugins: [
     // ...
     qwikTypes() // <== Add `qwikTypes()` to the list of plugins
    ],
    // ...
  };
});
Run build so that it generates ~/routes.gen.d.ts and ~/routes.config.tsx files.
To create a typesafe link:
import { AppLink } from '~/routes.config';
 
export default component$(() => {
  // ...
  return (
    // ...
    <AppLink route="/your/[appParam]/link/" param:appParam={"some-value"}>
      Link text
    </AppLink>
  );
});
Declarative Routing
This is a package originally created by Jack Herrington aka "The Blue Collar Coder" for type safe routing inside NextJS applications and has been adapted for use inside QwikCity

Installation

pnpm

npm

yarn

bun
pnpm dlx declarative-routing init

Setup
The initialization process will create some important files for you.

.src/declarativeRoutes
makeRoute.ts - Used for defining page routes
index.ts - Where all of your route files will be imported from.
hooks.ts - A file with two custom hooks useParams & useSearchParams used to access type safe route urls, params, and searchParams
Each of your route directories
routeInfo.ts - Where you name the route, and provide a zod schema for the params and search (search params)
Usage
Declare Route Details
/src/routes/pokemon/[pokemonId]/routeInfo.ts
import { z } from "zod";
 
export const Route = {
  name: "PokemonDetail",
  params: z.object({
    pokemonId: z.coerce.number(),
  }),
};
Inside Component
There are a few different ways you can use Declarative Routes inside your component.

Use RouteName.Link
myComponent.tsx
import { PokemonDetail } from "~/declarativeRoutes";
 
export default component$(() => {
  // ...
  return (
    // ...
    <PokemonDetail.Link pokemonId={1}>Bulbasaur</PokemonDetail.Link>
  );
});
Use the standard Link and use the RouteName as a function to return the path
myComponent.tsx
import { Link } from "@builder.io/qwik-city";
import { PokemonDetail } from "~/declarativeRoutes";
 
export default component$(() => {
  // ...
  return (
    // ...
    <Link href={PokemonDetail({ pokemonId: 1 })}>Bulbasaur</Link>
  );
});
Use RouteName.ParamsLink
myComponent.tsx
import { PokemonDetail } from "~/declarativeRoutes";
 
export default component$(() => {
  // ...
  return (
    // ...
    <PokemonDetail.ParamsLink params={{ pokemonId: 1 }}>Bulbasaur</PokemonDetail.ParamsLink>
  );
});
Get the params from a RouteName
myComponent.tsx
import { PokemonDetail } from "~/declarativeRoutes";
 
export default component$(() => {
  // Typescript will know the correct params and their types
  const { pokemonId } = useParams(PokemonDetail);
  // ...
  return (
    // ...
  );
});
Add or Change Routes
If you add a new route, or move an existing route, simply run


pnpm

npm

yarn

bun
pnpm dlx declarative-routing build

and this will rerun the process and update any changes needed
🧪 Insights
Stage: prototyping

Insights allow your application to collect real user usage information to optimize the creation of bundles. By observing real user behavior, the Qwik build system can then do a better job prefetching bundles for your application. There are two benefits of this:

By noticing which symbols are used together, the bundler can colocate the symbols in the same bundle minimizing the waterfall that could occur if there are too many small files needing to be downloaded.
By observing in which order the symbols are used, the prefetcher can then fetch bundles in priority order ensuring that the bundles that are used more often are loaded first.
Architecture
The optimization consists of these parts:

A <Insights> component which collects real user usage data.
A registered application inside the builder.io database.
A qwikInsights Vite Plugin to load and save real user usage data during the build process.
NOTE: To try this new feature please drop a message inside the Qwik Discord server Currently Insights info is hosted in the Builder database. This information is about the execution of symbols/chunks in the application. The implementation of the service is open-source and you have the choice to use ours or host your own. (Please note, that this may become a paid service in the future.)

<Insights> component
The <Insights> component should be added to your root.tsx file.

// ...
import { Insights } from '@builder.io/qwik-labs';
 
export default component$(() => {
  // ...
  return (
    <QwikCityProvider>
      <head>
        // ...
        <Insights
          publicApiKey={import.meta.env.PUBLIC_QWIK_INSIGHTS_KEY}
        />
      </head>
      <body lang="en">
        // ...
      </body>
    </QwikCityProvider>
  );
});
You can get PUBLIC_QWIK_INSIGHTS_KEY by visiting Qwik Insight.

The <Insights> component collects this data:

Timing information of symbols.
The pathname part of the URL.
Random sessionID which identifies which symbol loads came from the same browser session.
NOTE: The <Insights> component does not collect any user-identifiable information.

The information collected is sent to builder.io database for storage.

Vite integration
Once the application is running for a while and it collects sufficient information on symbol usage, the stats can be used to improve the bundles of the future version of the application. This is done by connecting the vite build with Insights like so:

file: vite.config.js

//..
import { defineConfig, loadEnv } from 'vite';
import { qwikInsights } from '@builder.io/qwik-labs/vite';
 
export default defineConfig(async () => {
  return {
    plugins: [
      qwikInsights({
        publicApiKey: loadEnv('', '.', '').PUBLIC_QWIK_INSIGHTS_KEY,
      }),
      //...
    ],
    // ...
  };
});

🧪 Qwik Labs Overview
Qwik Labs is an incubator for ideas not yet ready for production. It's a place where we can publish our "work in progress" so the community can try it out and provide feedback, without any guarantees that the feature is stable or will make it into production.

Given that these are ideas in their initial stages, chances are they will significantly change over their lifetime, so they should not be relied upon in production.

USE AT YOUR OWN RISK.

DISCLAIMER: Qwik Labs is a place to experiment, as such:

We make no guarantees about the stability of the API: we can break it at any point.
It is not ready for production: we want you to try it and give us feedback so that we can improve.
No guarantees that the feature will ever make it to production: it can be abandoned at any point.
Expect lots of breaking changes as the features are being developed!!!

Stages
Each Qwik Labs feature can roughly be thought of as going through these stages:

proposal: An RFC proposal no code yet
prototyping: An experimental stage where we explore the API, algorithm and approaches. Missing features, probably not in a usable state.
implementation: We know what needs to be built and are going through the built out process.
alpha: We think the project is ready to receive feedback from the community. Try it out and let us know what works and what does not.
beta: We think the project is ready to graduate to the main repo and be used in production.
Installation
There are two ways experimental features are made available to the community:

As an experimental flag. Some features are distributed under an experimental flag. This means that the feature is already part of the main package but is not enabled by default. To enable the feature you need to set the corresponding flag in the qwikVite experimental[] array.

As a separate node package. Qwik labs are distributed as a separate node package. Because Qwik Labs is "work in progress" the node package is not published to NPM but instead as a github URL. The package is continually updated and so it will always contains the latest build. (You may read up on installing node packages here.)


pnpm

npm

yarn

bun
pnpm install github:QwikDev/qwik-labs-build#main

Or just add this to your package.json

{
  ...
  "dependencies": {
    ...
    "@builder.io/qwik-labs": "github:QwikDev/qwik-labs-build#main",
  }
}
Contributors
Qwik Homepage
Docs
Ecosystem
Tutorial
Qwik Sandbox
Blog

API Reference
Filters
function
property signature
interface
type alias
method signature
variable
namespace
References
qwik
qwik-city
qwik-city-middleware-azure-swa
qwik-city-middleware-cloudflare-pages
qwik-city-middleware-netlify-edge
qwik-city-middleware-node
qwik-city-middleware-request-handler
qwik-city-middleware-vercel-edge
qwik-city-middleware-firebase
qwik-city-static
qwik-city-vite-azure-swa
qwik-city-vite-cloud-run
qwik-city-vite-cloudflare-pages
qwik-city-vite-node-server
qwik-city-vite-netlify-edge
qwik-city-vite-static
qwik-city-vite-vercel
qwik-optimizer
qwik-server
qwik-testing
Docs
Qwik City
Ecosystem
Playground
Integrations
Deployments
Media
Showcase
Tutorial
Presentations
Community
Press
Made with ❤️ by

The Qwik Team

MIT License © 2025
Qwik Homepage
Docs
Ecosystem
Tutorial
Qwik Sandbox
Blog

Introduction
Overview
Getting Started
Project structure
FAQ
Components
Qwik City
Cookbook
Integrations
Deployments
Guides
Concepts
Advanced
Reference
API Reference
Deprecated Features
Qwik Labs 🧪
Community
Deprecated features
These features were deprecated in the preparation of Qwik for its stable release.

If you happened to come across one of them and don't know what its replacement is, we quickly mention them in this table with the link to their new documentation ✨.

Qwik
Deprecated functions and their replacements
Deprecated	Replacements
useWatch$	useTask$
useMount$	useTask$
useServerMount	useTask$ + isServer
useClientMount	useTask$ + isBrowser
useClientEffect - useClientEffectQrl	useVisibleTask$
useBrowserVisibleTask - useBrowserVisibleTaskQrl	useVisibleTask$
useEnvData	useServerData
useRef	useSignal
createContext	createContextId
Qwik City
Deprecated functions and their replacements
Deprecated	Replacements
useEndpoint	routeLoader$
loader$ - loaderQrl	routeLoader$
action$ - actionQrl	routeAction$
Contributors
Thanks to all the contributors who have helped make this documentation better!

nsdonato
mrhoodz
manucorporat
patrickjs
gioboa
API Reference
Overview
Docs
Qwik City
Ecosystem
Playground
Integrations
Deployments
Media
Showcase
Tutorial
Presentations
Community
Press
Made with ❤️ by

The Qwik Team

MIT License © 2025

On This Page
Deprecated features
Qwik
Deprecated functions and their replacements
Qwik City
Deprecated functions and their replacements
More
Edit this Page
Create an issue
Join our community
GitHub
@QwikDev


Generating Sitemaps
Generating Sitemaps in SSG
By default, when Static Site Generated (SSG) pages are built, a sitemap is generated for the site. The sitemap.xml is automatically generated based on the pages that were built. This means that if you have a page that is not built, it will not be included in the sitemap.

Configuration
The sitemap can be configured using the adapter's vite config file. The example below is configuring the Cloudflare adapter. The default sitemap file path is sitemap.xml, but you can use the sitemapOutFile option to change the file path.

  plugins: [
    cloudflarePagesAdapter({
      ssg: {
        include: ['/*'],
        origin: 'https://qwik.dev',
        sitemapOutFile: 'sitemap.xml',
      },
    }),
  ]
The include option is used to specify which pages should be built, which also adds them to the sitemap. Any pages added to the exclude option will also exclude them from the sitemap.

The origin option is used to specify the origin of the site and is used to generate the absolute URLs for the sitemap.

robots.txt
Depending on your site setup, you'll probably want to add a robots.txt file to your site. This can be done by adding a robots.txt file to the public directory. Any file in the public directory is treated as a static file and deploy alongside the build. The following is an example of a public/robots.txt file:

User-agent: *
Allow: /
 
Sitemap: https://<YOUR_HOSTNAME>/sitemap.xml
Note the added Sitemap directive to the robots.txt file which tells search engines where to find the sitemap for your site. Be sure to replace <YOUR_HOSTNAME> with the hostname of your site.

Generating Dynamic Sitemaps in SSR
In addition to generating sitemaps for Static Site Generation (SSG), you can also generate sitemaps dynamically with Server-Side Rendering (SSR). This is useful if your site has content that is not known at build time or is frequently updated.

To generate a dynamic sitemap in SSR, you can create a route that serves a dynamic-sitemap.xml file based on your site’s routes and other dynamic content. Below is an example of how to set this up.

Create a Sitemap Function
First, create a function that generates the sitemap XML based on the routes you want to include. You can create this function in a file such as src/routes/dynamic-sitemap.xml/create-sitemap.ts:

// src/routes/dynamic-sitemap.xml/create-sitemap.ts
 
export interface SitemapEntry {
  loc: string;
  priority: number;
}
 
export function createSitemap(entries: SitemapEntry[]) {
  const baseUrl = "https://<YOUR_HOSTNAME>";
 
  return `
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${entries.map(
  (entry) => `
    <url>
        <loc>${baseUrl}${entry.loc.startsWith("/") ? "" : "/"}${entry.loc}</loc>
        <priority>${entry.priority}</priority>
    </url>`,
)}
</urlset>`.trim();
}
Set Up a Route for the Dynamic Sitemap
Next, set up a route that will use the sitemap function to generate the sitemap dynamically. Create a file like src/routes/dynamic-sitemap.xml/index.tsx:

// src/routes/dynamic-sitemap.xml/index.tsx
 
import type { RequestHandler } from "@builder.io/qwik-city";
import { routes } from "@qwik-city-plan";
import { createSitemap } from "./create-sitemap";
 
export const onGet: RequestHandler = (ev) => {
  const siteRoutes = routes
    .map(([route]) => route as string)
    .filter(route => route !== "/");  // Exclude the '/' route
 
  const sitemap = createSitemap([
    { loc: "/", priority: 1 },  // Manually include the root route
    ...siteRoutes.map((route) => ({
      loc: route,
      priority: 0.9,  // Default priority, adjust as needed
    })),
  ]);
 
  const response = new Response(sitemap, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
 
  ev.send(response);
};
This route dynamically creates the sitemap XML based on the routes in your Qwik City application.

robots.txt
To ensure that search engines know where to find your dynamic sitemap, you should also add or update your robots.txt file. Add the following line to your robots.txt file, which is typically located in your public directory:

User-agent: *
Allow: /
 
# Uncomment the following line and replace <unindexedFolder> with the actual folder name you want to disallow
# Disallow: /<unindexedFolder>/
 
Sitemap: https://<YOUR_HOSTNAME>/dynamic-sitemap.xml
Be sure to replace <YOUR_HOSTNAME> with your actual site URL.

This setup will dynamically generate and serve a dynamic.sitemap.xml whenever it is requested, keeping it up to date with the latest routes and changes to your site.

Redirects
Sometimes you want to redirect a user from the current page to another page.

Let's say a user tries to go to a dashboard page but has not logged in yet. We want them to be redirected to a login page so they can be authenticated.

src/routes/dashboard.tsx
import type { RequestEvent } from '@builder.io/qwik-city';
import { checkAuthorization } from '../auth'; // Your authorization code
import type { DashboardData } from '../types'; // Your types
 
export const onGet = async ({ cookie, redirect }: RequestEvent) => {
  const isAuthorized = checkAuthorization(cookie.get('cookie'));
 
  if (!isAuthorized) {
    // User is not authorized!
    // throw the redirect response to
    // relocate the user to the log-in page
    throw redirect(302, '/login');
  } else {
    // ...
  }
};
The redirect() function, which was destructured in the RequestHandler function arguments, takes a redirect status code and URL.

throw redirect(302, '/login');
Common redirect status codes:

301: Moved Permanently. This and all future requests should be directed to the given URI.
302: Found. This response code means that the URI of requested resource has been changed temporarily. Further changes in the URI might be made in the future. Therefore, this same URI should be used by the client in future requests.
307: Temporary Redirect. The server sends this response to direct the client to get the requested resource at another URI with the same method that was used in the prior request. This has the same semantics as the 302 Found HTTP response code, with the exception that the user agent must not change the HTTP method used: if a POST was used in the first request, a POST must be used in the second request.
308: Permanent Redirect. This means that the resource is now permanently located at another URI, specified by the Location HTTP Response header. This has the same semantics as the 301 Moved Permanently HTTP response code, with the exception that the user agent must not change the HTTP method used: if a POST was used in the first request, a POST must be used in the second request.
If you do not provide a status code, Qwik City will default to a 302 Found status.

Read more about redirect status codes here.

Managing multiple redirects
In some cases, you may need to manage multiple redirects based on different conditions. For example, you might want to redirect users from old URLs to new URLs after a site restructure. Additionally, you may want editors in a CMS to manage these redirects as well. Here's one of the ways you can handle multiple redirects in Qwik:

src/routes/layout.tsx
import { type RequestHandler } from "@builder.io/qwik-city";
 
export const onGet: RequestHandler = async ({ url, redirect }) => {
  // qwik city request caching ...
 
  // example external data source
  async function fetchRules(): Promise<
    { source: string; destination: string; permanent: boolean }[]
  > {
    // Fetch data from a CMS or API, and add more rules as needed.
    // Filter and map your data to make it easier to handle, as simulated here:
    return [
      { source: "/old-path", destination: "/new-path", permanent: true },
      {
        source: "/another-old-path",
        destination: "/another-new-path",
        permanent: false,
      },
    ];
  }
 
  const redirectRules = await fetchRules();
  const redirectUrl = redirectRules.find((rule) => {
    if (url.pathname.endsWith("/")) {
      return rule.source + "/" === url.pathname;
    }
 
    return rule.source === url.pathname;
  });
 
  if (redirectUrl) {
    throw redirect(redirectUrl.permanent ? 308 : 307, redirectUrl.destination);
  }
};
Note: This code does not include caching mechanisms. Fetching redirect rules from an external source on every request can lead to performance issues. It's recommended to implement caching to improve efficiency.

The above example demonstrates:

Layouts: Grabbing data inside a root layout's onGet handler.
URL Matching: When a user requests a URL, the handler checks if it matches any source in the redirect rules.
Redirect Execution: If a match is found, it redirects the user to the corresponding destination URL.
HTTP Status Codes: Uses status code 308 for permanent redirects and 307 for temporary ones.
Content Management Integration: Enables content editors to control redirects through external data sources like a CMS or API.

Skip to content
Navigation Menu
harshmangalam
qwik-localstorage

Type / to search
Code
Issues
Pull requests
Actions
Projects
Security
Insights
Owner avatar
qwik-localstorage
Public
harshmangalam/qwik-localstorage
Go to file
t
Name		
harshmangalam
harshmangalam
allow default values
3c34ed5
 · 
last year
src
added default values empty
last year
.eslintignore
Initial commit ⚡️
2 years ago
.eslintrc.cjs
Initial commit ⚡️
2 years ago
.gitignore
Initial commit ⚡️
2 years ago
.prettierignore
Initial commit ⚡️
2 years ago
README.md
added install instructions
2 years ago
package.json
allow default values
last year
pnpm-lock.yaml
init qwik project
2 years ago
tsconfig.json
Initial commit ⚡️
2 years ago
vite.config.ts
Initial commit ⚡️
2 years ago
Repository files navigation
README
Qwik Localstorage hook ⚡️
Install
npm i qwik-localstorage
pnpm i qwik-localstorage
yarn add qwik-localstorage
Usage
import { component$, useSignal } from "@builder.io/qwik";
import { useLocalStorage } from "qwik-localstorage";

export default component$(() => {
  const input = useSignal("");

  const { data, set, remove } = useLocalStorage<string[]>("users", []);

  return (
    <div>
      <input bind:value={input} type="text" placeholder="Enter username" />
      <button
        onClick$={() => {
          set(
            Array.isArray(data.value)
              ? [...data.value, input.value]
              : [input.value]
          );
          input.value = "";
        }}
      >
        Add User
      </button>

      <ul>
        {data.value?.map((user) => (
          <li key={user}>{user}</li>
        ))}
      </ul>
      <button onClick$={() => remove("users")}>Clear</button>
    </div>
  );
});
About
Qwik hook for localstorage access

Resources
 Readme
 Activity
Stars
 8 stars
Watchers
 3 watching
Forks
 1 fork
Report repository
Releases
No releases published
Packages
No packages published
Languages
TypeScript
76.8%
 
JavaScript
23.2%
Footer
© 2025 GitHub, Inc.
Footer navigation
Terms
Privacy
Security
Status
Docs
Contact
Manage cookies
Do not share my personal information