
# Timelock App

Timelock es una aplicación web moderna construida con [Qwik](https://qwik.builder.io/) y [Qwik City](https://qwik.builder.io/qwikcity/overview/), diseñada para gestionar contratos, pagos, profesionales y flujos de trabajo relacionados, con un enfoque en SSR, resumabilidad y performance. Utiliza Turso (libSQL/SQLite) como base de datos distribuida, Tailwind CSS para estilos, y Modular Forms para formularios type-safe.

---

## 🛠️ Tech Stack

- **Framework:** [Qwik](https://qwik.builder.io/) + Qwik City (SSR, resumability, routing)
- **Base de Datos:** [Turso](https://turso.tech/) ([libSQL](https://libsql.org/)/SQLite compatible)
- **Estilos:** [Tailwind CSS](https://tailwindcss.com/)
- **Formularios:** [@modular-forms/qwik](https://modularforms.dev/docs/qwik)
- **Testing Unitario/Componentes:** [Vitest](https://vitest.dev/) + [@testing-library/qwik](https://testing-library.com/docs/qwik-testing-library/intro/)
- **Testing E2E:** [Playwright](https://playwright.dev/)
- **Deploy:** Cloudflare Pages, Express, o SSG
- **Gestor de Paquetes:** `yarn`

---

## 📁 Estructura del Proyecto

```
├── public/                # Activos estáticos (imágenes, fuentes, favicon, etc.)
├── src/
│   ├── components/        # Componentes Qwik reutilizables
│   │   ├── ui/            # Componentes UI genéricos
│   │   └── feature/       # Componentes específicos de funcionalidad
│   ├── helpers/           # Helpers y utilidades de UI
│   ├── media/             # Imágenes internas
│   ├── models/            # Tipos y modelos de dominio
│   ├── routes/            # Rutas, layouts, endpoints API (Qwik City)
│   ├── utils/             # Utilidades, clientes, constantes
│   └── theme.css          # Temas y estilos globales
├── migrations/            # Migraciones SQL para Turso
├── private_uploads/       # Archivos privados (no públicos)
├── server/                # Entrypoints SSR, lógica server-only
├── adapters/              # Configuración para Cloudflare, Express, etc.
├── tests/                 # (Opcional) Tests adicionales
├── package.json           # Dependencias y scripts
├── tsconfig.json          # Configuración TypeScript
├── vite.config.ts         # Configuración Vite/Qwik
└── ...
```

---

## 🚀 Instalación y Setup

1. **Clona el repositorio:**
  ```sh
  git clone https://github.com/GolfredoPerezFernandez/timelock-app.git
  cd timelock-app
  ```
2. **Instala dependencias:**
  ```sh
  yarn install
  ```
3. **Configura variables de entorno:**
  - Variables públicas: `PUBLIC_NOMBRE_VAR` en `.env` (no sensibles)
  - Variables secretas: Configura en el entorno de despliegue (Turso, claves, etc.)
  - Ejemplo de acceso en server: `requestEvent.env.get('NOMBRE_VAR')`
4. **Migraciones de base de datos:**
  - Ejecuta los scripts SQL en `migrations/` sobre tu instancia Turso.
  - Ejemplo:
    ```sh
    turso db shell my-db < migrations/create_timelocks_table.sql
    ```
5. **Build y chequeo de tipos:**
  ```sh
  yarn build
  npx tsc
  ```
6. **Desarrollo:**
  ```sh
  yarn dev
  ```

---

## 🧪 Testing

Antes de correr tests, asegúrate de que el proyecto compila y no tiene errores de tipado:

```sh
yarn build
npx tsc
```



## 🌐 Deploy

- **Fly.io (Deploy principal):**
  - Asegúrate de tener la [CLI de Fly.io](https://fly.io/docs/hands-on/install-flyctl/) instalada y estar autenticado (`fly auth login`).
  - El archivo `fly.toml` ya está configurado para la app (`app = 'saveetimelock-knrt'`, región `bog`, puerto interno 3000, recursos performance-2x).
  - Despliega con:
    ```sh
    fly deploy
    ```
  - Puedes configurar variables de entorno y secretos con:
    ```sh
    fly secrets set NOMBRE_VAR=valor
    ```
  - Consulta logs con:
    ```sh
    fly logs
    ```
  - Más info: [Fly.io Docs](https://fly.io/docs/)


- **Fly.io (Deploy principal):**
  - Asegúrate de tener la [CLI de Fly.io](https://fly.io/docs/hands-on/install-flyctl/) instalada y estar autenticado (`fly auth login`).
  - El archivo `fly.toml` ya está configurado para la app (`app = 'saveetimelock-knrt'`, región `bog`, puerto interno 3000, recursos performance-2x).
  - Despliega con:
    ```sh
    fly deploy
    ```
  - Puedes configurar variables de entorno y secretos con:
    ```sh
    fly secrets set NOMBRE_VAR=valor
    ```
  - Consulta logs con:
    ```sh
    fly logs
    ```
  - Más info: [Fly.io Docs](https://fly.io/docs/)

- **Docker (opcional):**
  - Build de la imagen:
    ```sh
    docker build -t timelock-app .
    ```
  - Ejecuta el contenedor:
    ```sh
    docker run -p 3000:3000 timelock-app
    ```

- **Express (opcional):**
  - Build: `yarn build`
  - Serve: `yarn serve`
  - Visita: [http://localhost:8080/](http://localhost:8080/)

- **SSG (opcional):**
  - `yarn build.server`

---

## 🗄️ Base de Datos y Migraciones (Turso)

- Todas las operaciones CRUD se realizan en el servidor usando el cliente `@libsql/client`.
- Migraciones SQL en `migrations/`.
- Ejemplo de migración:
  ```sh
  turso db shell my-db < migrations/add_contract_id_to_payments.sql
  ```

---

## 📝 Formularios con Modular Forms

- Usa `@modular-forms/qwik` para formularios type-safe y validación robusta.
- Validación recomendada con [Valibot](https://valibot.dev/) o Zod.
- Los formularios se procesan en el servidor usando `formAction$`.
- Ver ejemplos en los componentes de `src/routes/`.

---

## 🎨 Estilos y Temas

- Tailwind CSS como base (`yarn qwik add tailwind` ya aplicado).
- Temas claro/oscuro gestionados con clase `dark` en `document.documentElement`.
- Fuentes personalizadas en `public/fonts/` y declaradas en CSS.

---

## 🧑‍💻 Principios y Buenas Prácticas

- **Qwik First:** Usa las primitivas de Qwik (`component$`, `useSignal`, `useStore`, etc.)
- **SSR y Resumabilidad:** Evita patrones que rompan la resumabilidad.
- **Acceso a datos solo en server:** CRUD y lógica sensible solo en server (`routeLoader$`, `routeAction$`, `server$`).
- **Testing riguroso:** Unit, component y E2E tests obligatorios para flujos críticos.
- **Tipado estricto:** TypeScript en todo.
- **Accesibilidad:** HTML semántico y roles ARIA.
- **Estilo:** Sigue las reglas de ESLint y Prettier.
- **Ver más en `.github/copilot-instructions.md`**

---

## 📚 Recursos

- [Qwik Docs](https://qwik.builder.io/)
- [Qwik City Routing](https://qwik.builder.io/qwikcity/routing/overview/)
- [Turso Docs](https://docs.turso.tech/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Modular Forms Qwik](https://modularforms.dev/docs/qwik)
- [Valibot](https://valibot.dev/)
- [Playwright](https://playwright.dev/)

---

## Licencia

MIT

The production build will generate client and server modules by running both client and server build commands. The build command will use Typescript to run a type check on the source code.

```shell
pnpm build # or `pnpm build`
```

## Static Site Generator (Node.js)

```shell
pnpm build.server
```

## Cloudflare Pages

Cloudflare's [wrangler](https://github.com/cloudflare/wrangler) CLI can be used to preview a production build locally. To start a local server, run:

```
yarn serve
```

Then visit [http://localhost:8787/](http://localhost:8787/)

### Deployments

[Cloudflare Pages](https://pages.cloudflare.com/) are deployable through their [Git provider integrations](https://developers.cloudflare.com/pages/platform/git-integration/).

If you don't already have an account, then [create a Cloudflare account here](https://dash.cloudflare.com/sign-up/pages). Next go to your dashboard and follow the [Cloudflare Pages deployment guide](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/).

Within the projects "Settings" for "Build and deployments", the "Build command" should be `yarn build`, and the "Build output directory" should be set to `dist`.

### Function Invocation Routes

Cloudflare Page's [function-invocation-routes config](https://developers.cloudflare.com/pages/platform/functions/routing/#functions-invocation-routes) can be used to include, or exclude, certain paths to be used by the worker functions. Having a `_routes.json` file gives developers more granular control over when your Function is invoked.
This is useful to determine if a page response should be Server-Side Rendered (SSR) or if the response should use a static-site generated (SSG) `index.html` file.

By default, the Cloudflare pages adaptor _does not_ include a `public/_routes.json` config, but rather it is auto-generated from the build by the Cloudflare adaptor. An example of an auto-generate `dist/_routes.json` would be:

```
{
  "include": [
    "/*"
  ],
  "exclude": [
    "/_headers",
    "/_redirects",
    "/build/*",
    "/favicon.ico",
    "/manifest.json",
    "/service-worker.js",
    "/about"
  ],
  "version": 1
}
```

In the above example, it's saying _all_ pages should be SSR'd. However, the root static files such as `/favicon.ico` and any static assets in `/build/*` should be excluded from the Functions, and instead treated as a static file.

In most cases the generated `dist/_routes.json` file is ideal. However, if you need more granular control over each path, you can instead provide you're own `public/_routes.json` file. When the project provides its own `public/_routes.json` file, then the Cloudflare adaptor will not auto-generate the routes config and instead use the committed one within the `public` directory.

