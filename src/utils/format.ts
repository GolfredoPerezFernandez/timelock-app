// Función de utilidad para formatear moneda
export function formatCurrency(amount: number, currency: string): string {
  const formatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: currency === 'KNRT' ? 'EUR' : currency, // Usar EUR como formato para KNRT
    minimumFractionDigits: 2,
  });
  
  const formatted = formatter.format(amount);
  return currency === 'KNRT' ? formatted.replace('€', 'KNRT') : formatted;
}
