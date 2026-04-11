import { SQLiteDatabase } from 'expo-sqlite';
import { ParsedExpense } from '../../../modules/registration/types';
import { getDBConnection } from '../db';

export class TransactionRepository {
  /**
   * Transforms a ParsedExpense into a DB row and inserts it.
   */
  static async insert(expense: ParsedExpense): Promise<void> {
    const db = await getDBConnection();

    await db.runAsync(`
      INSERT INTO transactions (
        id, created_at, date, time, amount, net_amount, currency, direction,
        payment_method, category_key, subcategory_key, description,
        social_context, location_type, location_name, city,
        is_travel, is_online, split_people, input_method, raw_input, synced_at, is_deleted
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?
      )
    `, [
      expense.id,
      expense.created_at,
      expense.date,
      expense.time || null,
      expense.amount,
      expense.net_amount,
      expense.currency,
      expense.direction,
      expense.payment_method || null,
      expense.category_key,
      expense.subcategory_key,
      expense.description,
      expense.social_context || null,
      expense.location_type || null,
      expense.location_name || null,
      expense.city || null,
      expense.is_travel ? 1 : 0,
      expense.is_online ? 1 : 0,
      expense.split ? expense.split.total_people : null,
      expense.input_method,
      expense.raw_input,
      null, // synced_at
      0 // is_deleted
    ]);
  }

  /**
   * Retrieves all active transactions ordered by date descending.
   */
  static async getAllActive(): Promise<any[]> {
    const db = await getDBConnection();
    const result = await db.getAllAsync(`
      SELECT * FROM transactions
      WHERE is_deleted = 0
      ORDER BY date DESC, time DESC
    `);
    return result;
  }

  /**
   * Retrieves a single transaction by its ID.
   */
  static async getById(id: string): Promise<any | null> {
    const db = await getDBConnection();
    const result = await db.getFirstAsync(`
      SELECT * FROM transactions WHERE id = ? AND is_deleted = 0
    `, [id]);
    return result;
  }

  /**
   * Soft deletes a transaction.
   */
  static async softDelete(id: string): Promise<void> {
    const db = await getDBConnection();
    await db.runAsync(`
      UPDATE transactions SET is_deleted = 1 WHERE id = ?
    `, [id]);
  }
}
