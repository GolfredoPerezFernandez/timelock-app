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
// Helper: Convert 12h to 24h
export function to24Hour(hour: number, ampm: string) {
  if (ampm === 'AM') {
    return hour === 12 ? 0 : hour;
  } else {
    return hour === 12 ? 12 : hour + 12;
  }
}

// Helper: Convert 24h to 12h + AM/PM
export function to12Hour(hour: number): { hour12: number, ampm: 'AM' | 'PM' } {
  if (hour === 0) return { hour12: 12, ampm: 'AM' };
  if (hour === 12) return { hour12: 12, ampm: 'PM' };
  if (hour > 12) return { hour12: hour - 12, ampm: 'PM' };
  return { hour12: hour, ampm: 'AM' };
}