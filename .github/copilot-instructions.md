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