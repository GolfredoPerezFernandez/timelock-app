import { z } from 'zod';
import { runMigrations } from '../../helpers/boundary-box';
import { tursoClient } from '../../utils/turso';

// Definir el esquema de validación para el body
const SavePaymentTimelockSchema = z.object({
  professional_id: z.coerce.number(),
  user_id: z.coerce.number(),
  amount: z.coerce.number(),
  currency: z.string(),
  status: z.string().optional(),
  due_date: z.string(),
  description: z.string().nullable().optional(),
  timelock: z.object({
    release_timestamp: z.coerce.number()
  }).optional()
});

export const onPost = async (requestEvent: any) => {
  await runMigrations(requestEvent);
  const db = tursoClient(requestEvent);
  try {
    const body = await requestEvent.request.json();
    const data = SavePaymentTimelockSchema.parse(body);
    // Guardar el pago
    const result = await db.execute({
      sql: 'INSERT INTO payments (professional_id, user_id, amount, currency, status, due_date, description) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
      args: [
        data.professional_id,
        data.user_id,
        data.amount,
        data.currency,
        data.status || 'pending',
        data.due_date,
        data.description || null
      ]
    });
    const payment_id = typeof result.rows[0]?.id === 'number' ? result.rows[0].id : Number(result.rows[0]?.id);
    if (isNaN(payment_id)) {
      throw new Error('Failed to get valid payment ID');
    }
    // Guardar el timelock
    if (data.timelock && data.timelock.release_timestamp) {
      await db.execute({
        sql: 'INSERT INTO timelocks (payment_id, release_timestamp, status) VALUES (?, ?, ?)',
        args: [payment_id, data.timelock.release_timestamp, 'pending']
      });
    }
    return requestEvent.json(200, { success: true, payment_id });
  } catch (e) {
    return requestEvent.json(400, { success: false, error: e instanceof Error ? e.message : String(e) });
  }
};
