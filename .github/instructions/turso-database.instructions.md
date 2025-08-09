
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