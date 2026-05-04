import { SQLiteDatabase } from 'expo-sqlite';
import { ParsedExpense } from '../../../modules/registration/types';
import { getDBConnection } from '../db';
import { NetWorthRepository } from './NetWorthRepository';
import { getDomainForCategory } from '../../../constants/categories';

export class TransactionRepository {
  /**
   * Transforms a ParsedExpense into a DB row and inserts it.
   */
  static async insert(expense: ParsedExpense): Promise<void> {
    const db = await getDBConnection();

    const domainKey = getDomainForCategory(expense.category_key)?.key || null;

    await db.runAsync(`
      INSERT INTO transactions (
        id, created_at, date, time, amount, net_amount, currency, direction,
        payment_method, category_key, subcategory_key, domain_key, description,
        social_context, location_type, location_name, city, address,
        is_travel, is_online, split_people, input_method, raw_input, synced_at, is_deleted
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
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
      expense.subcategory_key || expense.category_key,
      domainKey,
      expense.description,
      expense.social_context || null,
      expense.location_type || null,
      expense.location_name || null,
      expense.city || null,
      expense.address || null,
      expense.is_travel ? 1 : 0,
      expense.is_online ? 1 : 0,
      expense.split ? expense.split.total_people : null,
      expense.input_method,
      expense.raw_input,
      null, // synced_at
      0 // is_deleted
    ]);

    // Sincronizzazione Patrimonio: Incrementa o Decrementa
    const delta = expense.direction === 'in' ? expense.amount : -expense.amount;
    await NetWorthRepository.incrementTotal(delta);
  }

  /**
   * Retrieves all active transactions ordered by date descending.
   */
  static async getAllActive(): Promise<any[]> {
    const db = await getDBConnection();
    const result = await db.getAllAsync(`
      SELECT * FROM transactions
      WHERE is_deleted = 0 AND direction != 'adj'
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
    
    // Recupera la transazione prima di eliminarla per calcolare l'impronta sul patrimonio
    const tx = await this.getById(id);
    
    await db.runAsync(`
      UPDATE transactions SET is_deleted = 1 WHERE id = ?
    `, [id]);

    if (tx) {
      // Calcolo Inverso: Se elimino una spesa (-), aggiungo al patrimonio (+). Se elimino un'entrata (+), tolgo al patrimonio (-).
      const inverseDelta = tx.direction === 'in' ? -tx.amount : tx.amount;
      await NetWorthRepository.incrementTotal(inverseDelta);
    }
  }

  /**
   * Retrieves monthly stats (income vs expense) for a specific year.
   */
  static async getMonthlyStatsForYear(year: number): Promise<{ month: number, income: number, expense: number }[]> {
    const db = await getDBConnection();
    const results = await db.getAllAsync(`
      SELECT 
        CAST(strftime('%m', date) AS INTEGER) as month,
        SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END) as expense
      FROM transactions
      WHERE strftime('%Y', date) = ? AND is_deleted = 0 AND direction != 'adj'
      GROUP BY month
      ORDER BY month ASC
    `, [year.toString()]);

    // Initialize all 12 months
    const stats = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      income: 0,
      expense: 0
    }));

    // Merge DB results
    results.forEach((row: any) => {
      if (row.month >= 1 && row.month <= 12) {
        stats[row.month - 1].income = row.income;
        stats[row.month - 1].expense = row.expense;
      }
    });

    return stats;
  }

  /**
   * Retrieves daily stats for a specific month.
   */
  static async getDailyStatsForMonth(year: number, month: number): Promise<{ day: number, income: number, expense: number }[]> {
    const db = await getDBConnection();
    const monthStr = month < 10 ? `0${month}` : `${month}`;
    const yearStr = year.toString();
    
    const results = await db.getAllAsync(`
      SELECT 
        CAST(strftime('%d', date) AS INTEGER) as day,
        SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END) as expense
      FROM transactions
      WHERE strftime('%Y-%m', date) = ? AND is_deleted = 0 AND direction != 'adj'
      GROUP BY day
      ORDER BY day ASC
    `, [`${yearStr}-${monthStr}`]);

    const lastDay = new Date(year, month, 0).getDate();
    const stats = Array.from({ length: lastDay }, (_, i) => ({
      day: i + 1,
      income: 0,
      expense: 0
    }));

    results.forEach((row: any) => {
      if (row.day >= 1 && row.day <= lastDay) {
        stats[row.day - 1].income = row.income;
        stats[row.day - 1].expense = row.expense;
      }
    });

    return stats;
  }

  /**
   * Retrieves daily stats for the current week (Mon-Sun).
   */
  static async getDailyStatsForRecentDays(days: number): Promise<{ label: string, income: number, expense: number }[]> {
    const db = await getDBConnection();
    const results = await db.getAllAsync(`
      SELECT 
        date,
        SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END) as expense
      FROM transactions
      WHERE date >= date('now', ?) AND is_deleted = 0 AND direction != 'adj'
      GROUP BY date
      ORDER BY date ASC
    `, [`-${days} days`]);

    const stats = [];
    for (let i = days; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const match = results.find((r: any) => r.date === dateStr);
      stats.push({
        label: d.toLocaleDateString('it-IT', { weekday: 'short' }),
        income: match ? (match as any).income : 0,
        expense: match ? (match as any).expense : 0
      });
    }

    return stats;
  }

  /**
   * Retrieves stats for the entire history, grouping by month or year.
   */
  static async getStatsForAllTime(): Promise<{ label: string, income: number, expense: number }[]> {
    const db = await getDBConnection();
    
    // 1. Get total span
    const spanResult = await db.getFirstAsync(`
      SELECT 
        MIN(date) as first_date,
        MAX(date) as last_date,
        (julianday(MAX(date)) - julianday(MIN(date))) / 30 as months_span
      FROM transactions 
      WHERE is_deleted = 0 AND direction != 'adj'
    `);

    if (!spanResult || !(spanResult as any).first_date) return [];

    const monthsSpan = (spanResult as any).months_span || 0;

    if (monthsSpan < 24) {
      // Group by Month
      const results = await db.getAllAsync(`
        SELECT 
          strftime('%Y-%m', date) as period,
          SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END) as income,
          SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END) as expense
        FROM transactions
        WHERE is_deleted = 0 AND direction != 'adj'
        GROUP BY period
        ORDER BY period ASC
      `);
      return results.map((r: any) => ({
        label: r.period.split('-')[1] + '/' + r.period.split('-')[0].slice(2),
        income: r.income,
        expense: r.expense
      }));
    } else {
      // Group by Year
      const results = await db.getAllAsync(`
        SELECT 
          strftime('%Y', date) as period,
          SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END) as income,
          SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END) as expense
        FROM transactions
        WHERE is_deleted = 0 AND direction != 'adj'
        GROUP BY period
        ORDER BY period ASC
      `);
      return results.map((r: any) => ({
        label: r.period,
        income: r.income,
        expense: r.expense
      }));
    }
  }

  /**
   * Retrieves category distribution for a specific time range, direction and base date.
   */
  static async getCategoryDistribution(
    timeRange: 'Settimana' | 'Mese' | 'Anno' | 'Tutto', 
    direction: 'in' | 'out' = 'out',
    baseDate: string = new Date().toISOString().split('T')[0]
  ): Promise<{ category_key: string, total: number }[]> {
    const db = await getDBConnection();
    let query = `
      SELECT category_key, SUM(amount) as total
      FROM transactions
      WHERE is_deleted = 0 AND direction = '${direction}'
    `;

    if (timeRange === 'Settimana') query += ` AND date >= date('${baseDate}', '-7 days') AND date <= '${baseDate}'`;
    else if (timeRange === 'Mese') query += ` AND strftime('%Y-%m', date) = strftime('%Y-%m', '${baseDate}')`;
    else if (timeRange === 'Anno') query += ` AND strftime('%Y', date) = strftime('%Y', '${baseDate}')`;

    query += " GROUP BY category_key ORDER BY total DESC";

    const results = await db.getAllAsync(query);
    return results as any[];
  }

  /**
   * Retrieves subcategory distribution for a specific time range, direction and base date.
   */
  static async getSubcategoryDistribution(
    timeRange: 'Settimana' | 'Mese' | 'Anno' | 'Tutto', 
    direction: 'in' | 'out' = 'out', 
    categoryKey?: string,
    baseDate: string = new Date().toISOString().split('T')[0]
  ): Promise<{ subcategory_key: string, total: number }[]> {
    const db = await getDBConnection();
    let query = `
      SELECT subcategory_key, SUM(amount) as total
      FROM transactions
      WHERE is_deleted = 0 AND direction = '${direction}'
    `;

    if (timeRange === 'Settimana') query += ` AND date >= date('${baseDate}', '-7 days') AND date <= '${baseDate}'`;
    else if (timeRange === 'Mese') query += ` AND strftime('%Y-%m', date) = strftime('%Y-%m', '${baseDate}')`;
    else if (timeRange === 'Anno') query += ` AND strftime('%Y', date) = strftime('%Y', '${baseDate}')`;
    
    if (categoryKey) {
      query += ` AND category_key = '${categoryKey}'`;
    }

    query += " GROUP BY subcategory_key ORDER BY total DESC";

    const results = await db.getAllAsync(query);
    return results as any[];
  }

  /**
   * Retrieves transactions filtered by period, category, subcategory and sorted.
   */
  static async getFilteredTransactions(
    timeRange: 'Settimana' | 'Mese' | 'Anno' | 'Tutto',
    filters: { category_key?: string, subcategory_key?: string, direction?: 'in' | 'out' },
    sortBy: 'date' | 'amount_asc' | 'amount_desc',
    baseDate: string = new Date().toISOString().split('T')[0]
  ): Promise<any[]> {
    const db = await getDBConnection();
    let query = `
      SELECT * FROM transactions
      WHERE is_deleted = 0 AND direction != 'adj'
    `;

    // Time Filter
    if (timeRange === 'Settimana') query += ` AND date >= date('${baseDate}', '-7 days') AND date <= '${baseDate}'`;
    else if (timeRange === 'Mese') query += ` AND strftime('%Y-%m', date) = strftime('%Y-%m', '${baseDate}')`;
    else if (timeRange === 'Anno') query += ` AND strftime('%Y', date) = strftime('%Y', '${baseDate}')`;

    // Category Filters
    if (filters.direction) query += ` AND direction = '${filters.direction}'`;
    if (filters.category_key) query += ` AND category_key = '${filters.category_key}'`;
    if (filters.subcategory_key) query += ` AND subcategory_key = '${filters.subcategory_key}'`;

    // Sorting
    if (sortBy === 'date') query += " ORDER BY date DESC, time DESC";
    else if (sortBy === 'amount_asc') query += " ORDER BY amount ASC";
    else if (sortBy === 'amount_desc') query += " ORDER BY amount DESC";

    const results = await db.getAllAsync(query);
    return results;
  }

  /**
   * Retrieves a filtered trend for specific direction and categories.
   */
  static async getFilteredTrend(
    timeRange: 'Settimana' | 'Mese' | 'Anno' | 'Tutto',
    direction: 'in' | 'out',
    filters: { category_key?: string, subcategory_key?: string },
    baseDate: string = new Date().toISOString().split('T')[0]
  ): Promise<{ label: string, value: number }[]> {
    const db = await getDBConnection();
    
    let timeExpr = "date";
    let periodFilter = "";
    
    if (timeRange === 'Settimana') periodFilter = `AND date >= date('${baseDate}', '-7 days') AND date <= '${baseDate}'`;
    else if (timeRange === 'Mese') periodFilter = `AND strftime('%Y-%m', date) = strftime('%Y-%m', '${baseDate}')`;
    else if (timeRange === 'Anno') {
      timeExpr = "strftime('%Y-%m', date)";
      periodFilter = `AND strftime('%Y', date) = strftime('%Y', '${baseDate}')`;
    } else {
      timeExpr = "strftime('%Y', date)";
    }

    let filterExpr = `AND direction = '${direction}'`;
    if (filters.category_key) filterExpr += ` AND category_key = '${filters.category_key}'`;
    if (filters.subcategory_key) filterExpr += ` AND subcategory_key = '${filters.subcategory_key}'`;

    const query = `
      SELECT ${timeExpr} as period, SUM(amount) as total
      FROM transactions
      WHERE is_deleted = 0 ${periodFilter} ${filterExpr}
      GROUP BY period
      ORDER BY period ASC
    `;

    const results = await db.getAllAsync(query);
    
    // Transform results to labels
    return results.map((r: any) => {
      let label = r.period;
      if (timeRange === 'Settimana') {
          const d = new Date(r.period);
          label = d.toLocaleDateString('it-IT', { weekday: 'short' });
      } else if (timeRange === 'Mese') {
          label = r.period.split('-')[2] || r.period;
      } else if (timeRange === 'Anno') {
          const m = parseInt(r.period.split('-')[1]);
          const months = ['G', 'F', 'M', 'A', 'M', 'G', 'L', 'A', 'S', 'O', 'N', 'D'];
          label = months[m-1] || r.period;
      }
      return { label, value: r.total };
    });
  }

  /**
   * Soft deletes ALL active transactions.
   */
  static async deleteAllActive(): Promise<void> {
    const db = await getDBConnection();
    await db.runAsync('UPDATE transactions SET is_deleted = 1 WHERE is_deleted = 0');
  }

  /**
   * Updates an existing transaction and adjusts NetWorth accordingly.
   */
  static async update(id: string, updates: Partial<any>): Promise<void> {
    const db = await getDBConnection();
    const oldTx = await this.getById(id);
    if (!oldTx) throw new Error('Transaction not found');

    // Prepare new values (falling back to old ones)
    const newAmount = updates.amount !== undefined ? updates.amount : oldTx.amount;
    const newDirection = updates.direction !== undefined ? updates.direction : oldTx.direction;

    // Calculate Net Worth adjustment
    const oldImpact = oldTx.direction === 'in' ? oldTx.amount : -oldTx.amount;
    const newImpact = newDirection === 'in' ? newAmount : -newAmount;
    const adjustment = newImpact - oldImpact;

    // Build the query dynamically based on ParsedExpense keys if needed, 
    // but here we can just update all standard fields for simplicity as in insert.
    await db.runAsync(`
      UPDATE transactions SET
        date = ?, time = ?, amount = ?, net_amount = ?, currency = ?, direction = ?,
        payment_method = ?, category_key = ?, subcategory_key = ?, description = ?,
        social_context = ?, location_type = ?, location_name = ?, city = ?, address = ?,
        is_travel = ?, is_online = ?, split_people = ?
      WHERE id = ?
    `, [
      updates.date || oldTx.date,
      updates.time !== undefined ? updates.time : oldTx.time,
      newAmount,
      updates.net_amount !== undefined ? updates.net_amount : (updates.amount || oldTx.amount),
      updates.currency || oldTx.currency,
      newDirection,
      updates.payment_method !== undefined ? updates.payment_method : oldTx.payment_method,
      updates.category_key || oldTx.category_key,
      updates.subcategory_key || oldTx.subcategory_key,
      updates.description !== undefined ? updates.description : oldTx.description,
      updates.social_context !== undefined ? updates.social_context : oldTx.social_context,
      updates.location_type !== undefined ? updates.location_type : oldTx.location_type,
      updates.location_name !== undefined ? updates.location_name : oldTx.location_name,
      updates.city !== undefined ? updates.city : oldTx.city,
      updates.address !== undefined ? updates.address : oldTx.address,
      updates.is_travel !== undefined ? (updates.is_travel ? 1 : 0) : oldTx.is_travel,
      updates.is_online !== undefined ? (updates.is_online ? 1 : 0) : oldTx.is_online,
      updates.split_people !== undefined ? updates.split_people : oldTx.split_people,
      id
    ]);

    if (adjustment !== 0) {
      await NetWorthRepository.incrementTotal(adjustment);
    }
  }

  /**
   * Retrieves a compact list of recent transactions for AI context.
   */
  static async getRecentForAi(limit: number = 50): Promise<any[]> {
    const db = await getDBConnection();
    return db.getAllAsync(`
      SELECT date, amount, direction, category_key, description, city, location_name
      FROM transactions
      WHERE is_deleted = 0
      ORDER BY date DESC, time DESC
      LIMIT ?
    `, [limit]);
  }
}

