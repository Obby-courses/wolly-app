import { getDBConnection } from '../db';
import uuid from 'react-native-uuid';

export interface RecurringPayment {
  id?: string;
  amount: number;
  currency: string;
  direction: 'in' | 'out';
  category_key: string;
  subcategory_key: string;
  description: string;
  frequency: 'monthly' | 'yearly' | 'weekly';
  start_date: string;
  next_due_date: string;
  payment_method?: string | null;
}

export class RecurringPaymentRepository {
  static async insert(payment: RecurringPayment): Promise<void> {
    const db = await getDBConnection();
    const id = payment.id || uuid.v4().toString();
    const now = new Date().toISOString();

    await db.runAsync(`
      INSERT INTO recurring_payments (
        id, created_at, amount, currency, direction,
        category_key, subcategory_key, description, frequency,
        start_date, next_due_date, payment_method, is_active, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      now,
      payment.amount,
      payment.currency || 'EUR',
      payment.direction,
      payment.category_key,
      payment.subcategory_key,
      payment.description,
      payment.frequency,
      payment.start_date,
      payment.next_due_date,
      payment.payment_method || null,
      1, // is_active
      null // synced_at
    ]);
  }

  static async getDuePayments(todayIso: string): Promise<any[]> {
    const db = await getDBConnection();
    return await db.getAllAsync(`
      SELECT * FROM recurring_payments
      WHERE is_active = 1 AND next_due_date <= ?
    `, [todayIso]);
  }

  static async updateNextDueDate(id: string, newDueDate: string): Promise<void> {
    const db = await getDBConnection();
    await db.runAsync(`
      UPDATE recurring_payments SET next_due_date = ? WHERE id = ?
    `, [newDueDate, id]);
  }
}
