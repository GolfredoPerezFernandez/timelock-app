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