---
# Aplica estas instrucciones a archivos de test o cuando se genere código relacionado con tests.
applyTo: "**/*.{test.ts,test.tsx,spec.ts,spec.tsx}"
---
# Instrucciones para Testing en Proyectos Qwik

## General
- El objetivo es tener una cobertura de tests balanceada entre unitarios, componentes y E2E.

## Vitest (Unitario y Componentes)
- **Archivos:** Usar la convención `*.test.ts` o `*.test.tsx`.
- **Tests Unitarios:**
  - Para lógica de negocio pura, helpers, utilidades.
  - Aislar la unidad bajo prueba, mockear dependencias si es necesario.
  - Ejemplo: Testear una función que formatea una fecha.
- **Tests de Componentes Qwik:**
  - Usar `@testing-library/qwik` junto con Vitest.
  - Renderizar componentes usando `render()`.
  - Interactuar con componentes usando `fireEvent` o simulaciones de usuario.
  - Hacer aserciones sobre el DOM generado (simulado por HappyDOM/JSDOM).
  - Ejemplo:
    ```typescript
    // import { render, screen, fireEvent } from '@testing-library/qwik';
    // import { MyComponent } from './my-component';
    // import { expect, test, vi } from 'vitest';
    //
    // test('MyComponent should display message and call handler on click', async () => {
    //   const handleClick = vi.fn();
    //   await render(<MyComponent message="Hello" onClick$={handleClick} />);
    //
    //   expect(screen.getByText('Hello')).toBeInTheDocument();
    //   const button = screen.getByRole('button', { name: /click me/i });
    //   await fireEvent.click(button);
    //   expect(handleClick).toHaveBeenCalledTimes(1);
    // });
    ```
  - Recordar que estos tests se ejecutan en un entorno Node.js con DOM simulado, por lo que no prueban la resumabilidad completa ni el comportamiento en un navegador real.

## Playwright (End-to-End - E2E)
- **Archivos:** Usar la convención `*.e2e.ts` o `*.spec.ts` (Playwright usa `spec` por defecto).
- **Propósito:**
  - Testear flujos de usuario completos a través de la aplicación.
  - Verificar la integración de diferentes partes (frontend, `server$`, `routeLoader$`, base de datos indirectamente).
  - **Crucial para testear la resumabilidad de Qwik**: asegurar que la página carga sin JavaScript inicial (o mínimo) y que las interacciones se activan correctamente al primer input del usuario.
- **Escritura de Tests:**
  - Usar la API de Playwright para navegar, interactuar con elementos y hacer aserciones.
  - `page.goto('/')`
  - `page.locator('input[name="email"]').fill('test@example.com')`
  - `page.getByRole('button', { name: /Submit/i }).click()`
  - `await expect(page.locator('.success-message')).toBeVisible()`
- **Consideraciones para Qwik:**
  - Testear que el HTML inicial (SSR) es correcto.
  - Testear que las interacciones funcionan sin errores después de la "resumabilidad".
  - Inspeccionar el tráfico de red para asegurarse de que Qwik carga los chunks de JavaScript de forma diferida (`on:qvisible`, `on:interaction`, etc.).
  - Ejemplo Playwright snippet (conceptual):
    ```typescript
    // import { test, expect } from '@playwright/test';
    //
    // test('should submit login form and redirect', async ({ page }) => {
    //   await page.goto('/login');
    //
    //   // Verificar contenido SSR inicial
    //   await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
    //
    //   await page.locator('input[name="username"]').fill('testuser');
    //   await page.locator('input[name="password"]').fill('password123');
    //   await page.getByRole('button', { name: 'Sign In' }).click();
    //
    //   // Verificar que la acción ocurrió y hubo redirección o cambio de UI
    //   await expect(page).toHaveURL('/dashboard');
    //   await expect(page.getByText('Welcome, testuser!')).toBeVisible();
    // });
    ```