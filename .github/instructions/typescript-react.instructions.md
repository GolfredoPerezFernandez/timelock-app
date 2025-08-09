---
applyTo: "**/*.ts,**/*.tsx"
---
# Estándares para TypeScript y React

Aplica también las [instrucciones generales](./general-coding.instructions.md).

## Uso de TypeScript

1. **Tipado Estricto:** Mantener `tsconfig.json` con `strict: true` y resolver todos los errores de tipo.
2. **Interfaces y Tipos:** Usar `interface` para definir formas de objetos y `type` para tipos primitivos o uniones.
3. **Funciones:** Siempre tipar los parámetros y el valor de retorno de las funciones.
4. **React.FC:** Evitar el uso de `React.FC` o `FunctionComponent`. Definir tipos de props explícitamente.
5. **Hooks Personalizados:** Tipar correctamente los hooks personalizados, especialmente los que usan `useState` y `useEffect`.

## Uso de React

1. **Componentes:** Usar funciones puras para componentes. Evitar métodos de clase.
2. **JSX:** Asegurarse de que el JSX sea legible y esté correctamente indentado.
3. **Props:** Desestructurar props en la firma de la función del componente cuando sea posible.
4. **State y Efectos:** Usar `useState` y `useEffect` de manera eficiente. Limpiar efectos secundarios cuando sea necesario.
5. **Eventos:** Usar las convenciones de nomenclatura de eventos de React (e.g., `onClick`, `onChange`).
6. **Listas y Keys:** Al renderizar listas, proporcionar una `key` única para cada elemento.
7. **Fragmentos:** Usar `<>` y `</>` en lugar de `<React.Fragment>` para fragmentos vacíos.
8. **Memoización:** Usar `React.memo` para componentes que no necesitan volver a renderizar con frecuencia.
9. **Context API:** Usar la API de Contexto de React para estado global o temas, evitando el "prop drilling".
10. **Error Boundaries:** Implementar límites de error (error boundaries) para manejar errores en el árbol de componentes.

## Accesibilidad

1. **Etiquetas Alt:** Proveer etiquetas `alt` descriptivas para todas las imágenes.
2. **Roles y Atributos ARIA:** Usar roles y atributos ARIA apropiados para mejorar la accesibilidad.
3. **Navegación por Teclado:** Asegurarse de que todos los elementos interactivos sean accesibles y navegables por teclado.
4. **Contraste de Color:** Verificar que el contraste de color entre el texto y el fondo cumpla con las pautas de accesibilidad.
5. **Tamaños de Fuente y Espaciado:** Usar tamaños de fuente y espaciado que sean legibles y no causen problemas de visión.

## Buenas Prácticas

1. **Estructura del Proyecto:** Seguir la estructura de carpetas y archivos definida en la guía del proyecto.
2. **Nombres Descriptivos:** Usar nombres de variables, funciones y componentes que sean descriptivos y sigan las convenciones de nomenclatura.
3. **Comentarios:** Comentar el código donde sea necesario para explicar la lógica compleja.
4. **Limpieza:** Mantener el código limpio y libre de código comentado o no utilizado.
5. **Versionado:** Hacer commit de los cambios con mensajes claros y descriptivos.
6. **Revisiones de Código:** Participar en revisiones de código y estar abierto a recibir y dar retroalimentación.

---

Estas instrucciones están sujetas a cambios y actualizaciones. Es responsabilidad de cada desarrollador mantenerse informado sobre las últimas directrices y prácticas recomendadas.