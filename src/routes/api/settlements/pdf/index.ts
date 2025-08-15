import { server$, type RequestHandler } from '@builder.io/qwik-city';
import { tursoClient } from '~/utils/turso';
import { getSession } from '~/utils/auth';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export const onGet: RequestHandler = server$(async (requestEvent) => {
  const url = new URL(requestEvent.request.url);
  const professionalId = url.searchParams.get('professionalId');
    if (!professionalId) {
      return requestEvent.json(400, { error: 'Missing professionalId' });
    }
  const session = await getSession(requestEvent);
  if (!session.isAuthenticated) {
    return requestEvent.json(401, { error: 'Unauthorized' });
  }
  const client = tursoClient(requestEvent);
  // Obtener datos del profesional
  const profRes = await client.execute({
    sql: 'SELECT id, name, email, wallet FROM professionals WHERE id = ?',
    args: [professionalId]
  });
  if (!profRes.rows.length) {
    return requestEvent.json(404, { error: 'Professional not found' });
  }
  const professional = profRes.rows[0];
  // Obtener contratos activos
  const contractsRes = await client.execute({
    sql: 'SELECT * FROM contracts WHERE professional_id = ? AND status = "active"',
    args: [professionalId]
  });
  // Obtener facturas
  const invoicesRes = await client.execute({
    sql: 'SELECT * FROM invoices WHERE professional_id = ?',
    args: [professionalId]
  });
  // Obtener settlements
  const settlementsRes = await client.execute({
    sql: 'SELECT * FROM settlements WHERE professional_id = ?',
    args: [professionalId]
  });

  // Crear PDF
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let y = 800;
  page.drawText('Resumen de Settlement', { x: 50, y, size: 20, font, color: rgb(0, 0.5, 0.7) });
  y -= 30;
  page.drawText(`Profesional: ${professional.name} (${professional.email})`, { x: 50, y, size: 14, font });
  y -= 20;
  page.drawText(`Wallet: ${professional.wallet || '-'}`, { x: 50, y, size: 12, font });
  y -= 30;
  page.drawText('Contratos Activos:', { x: 50, y, size: 14, font });
  y -= 18;
  contractsRes.rows.forEach((c: any) => {
    page.drawText(`- ${c.status} (${c.start_date} - ${c.end_date || 'Presente'})`, { x: 60, y, size: 12, font });
    y -= 16;
  });
  y -= 10;
  page.drawText('Facturas:', { x: 50, y, size: 14, font });
  y -= 18;
  invoicesRes.rows.forEach((inv: any) => {
    page.drawText(`- ${inv.status} | ${inv.amount} ${inv.currency} | Emitida: ${inv.issue_date}${inv.paid_date ? ' | Pagada: ' + inv.paid_date : ''}`, { x: 60, y, size: 12, font });
    y -= 16;
  });
  y -= 10;
  page.drawText('Settlements:', { x: 50, y, size: 14, font });
  y -= 18;
  settlementsRes.rows.forEach((s: any) => {
    page.drawText(`- ${s.status} | ${s.total_amount} ${s.currency} | Mes: ${s.month}/${s.year} | Fecha pago: ${s.payment_date || '-'}`, { x: 60, y, size: 12, font });
    y -= 16;
  });

  const pdfBytes = await pdfDoc.save();
  requestEvent.headers.set('Content-Type', 'application/pdf');
  requestEvent.headers.set('Content-Disposition', `inline; filename=settlement_${professionalId}.pdf`);
  // Igual que contracts/view: devolver PDF como Uint8Array
  return new Response(new Uint8Array(pdfBytes), { status: 200 });
});
