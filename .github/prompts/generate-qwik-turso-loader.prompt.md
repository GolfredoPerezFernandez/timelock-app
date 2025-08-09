---
mode: 'agent' # O 'ask' o 'edit'
description: 'Genera un routeLoader$ de Qwik para obtener datos de Turso y un componente básico para mostrarlos.'
tools: ['codebase', 'githubRepo'] # Si quieres que use herramientas específicas
---
Tu tarea es generar el código para un `routeLoader$` de Qwik City que obtenga ${input:dataTypePlural default="items"} de una tabla llamada `${input:tableName default="my_table"}` en Turso.
También genera un componente Qwik básico que use este loader y muestre los ${input:dataTypePlural} en una lista.
Asume que las credenciales de Turso (`PRIVATE_LIBSQL_DB_URL`, `PRIVATE_LIBSQL_DB_API_TOKEN`) están disponibles vía `requestEvent.env.get()`.
Utiliza el cliente `@libsql/client`.
El componente debe usar Tailwind CSS para un estilizado simple.

Consideraciones:
1.  El `routeLoader$` debe llamarse `use${input:dataTypePascalCase default="Items"}Loader`.
2.  El componente debe llamarse `${input:dataTypePascalCase default="Items"}Page` o similar.
3.  Maneja el caso en que no haya datos retornados por la base de datos.
4.  Asegúrate de que el código sigue las mejores prácticas de Qwik y Turso descritas en las instrucciones del proyecto.
5.  Incluye importaciones necesarias.

Ejemplo de campos a seleccionar de la tabla (puedes simplificar si no se especifica): id, name, description.
${input:extraInstructions}