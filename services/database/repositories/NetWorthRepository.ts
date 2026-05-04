import { getDBConnection } from '../db';
import uuid from 'react-native-uuid';

export class NetWorthRepository {
  static async getCurrentTotal(): Promise<number> {
    const db = await getDBConnection();
    const result = await db.getAllAsync(`SELECT amount FROM net_worth ORDER BY updated_at DESC LIMIT 1`);
    if (result && result.length > 0) {
      return (result[0] as any).amount;
    }
    return 1000.0;
  }

  static async updateTotal(newAmount: number): Promise<void> {
    const db = await getDBConnection();
    const currentTotal = await this.getCurrentTotal();
    const diff = newAmount - currentTotal;

    if (diff === 0) return;

    const now = new Date().toISOString();
    const adjId = uuid.v4().toString();
    
    await db.runAsync(
      `INSERT INTO transactions (
        id, created_at, date, time, amount, net_amount, currency, direction, 
        category_key, subcategory_key, description, is_social, is_travel, is_online, 
        input_method, raw_input, is_deleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        adjId, now, now.split('T')[0], null, diff, diff, 'EUR', 'adj',
        'system', 'adjustment', 'Aggiustamento manuale patrimonio', 0, 0, 0,
        'manual', 'ADJ_SYNC', 0
      ]
    );

    await db.runAsync(`UPDATE net_worth SET amount = ?, updated_at = ?`, [newAmount, now]);
  }

  static async incrementTotal(amountDelta: number): Promise<void> {
     const db = await getDBConnection();
     const currentTotal = await this.getCurrentTotal();
     const finalAmount = currentTotal + amountDelta;
     const now = new Date().toISOString();
     await db.runAsync(`UPDATE net_worth SET amount = ?, updated_at = ?`, [finalAmount, now]);
  }

  static async getNetWorthAtDate(targetDate: string): Promise<number> {
    const db = await getDBConnection();
    const currentTotal = await this.getCurrentTotal();
    
    // Sum of all transactions from targetDate+1 up to now
    // If I want net worth at end of 2026-03-31, I need to know all changes after that
    const results = await db.getFirstAsync(`
      SELECT SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END) as diff
      FROM transactions
      WHERE is_deleted = 0 AND direction != 'adj' AND date > ?
    `, [targetDate]);

    const diff = (results as any)?.diff || 0;
    return currentTotal - diff;
  }
}
