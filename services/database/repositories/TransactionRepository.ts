import { SQLiteDatabase } from 'expo-sqlite';
import { ParsedExpense } from '../../../modules/registration/types';
import { getDBConnection } from '../db';
import { NetWorthRepository } from './NetWorthRepository';
import { getDomainForCategory } from '../../../constants/categories';

export class TransactionRepository {
  /**
   * Transforms a ParsedExpense into a DB row and inserts it.
   */
  static async insert(expense: ParsedExpense, subscription_id?: string | null): Promise<string> {
    const db = await getDBConnection();

    const domainKey = getDomainForCategory(expense.category_key)?.key || null;

    let finalTags = expense.tags ? [...expense.tags] : [];
    if (expense.is_weekend && !finalTags.includes('weekend')) {
      finalTags.push('weekend');
    }

    await db.runAsync(`
      INSERT INTO transactions (
        id, created_at, date, time, amount, net_amount, currency, direction,
        payment_method, category_key, subcategory_key, domain_key, description,
        social_context, location_type, location_name, city, address,
        is_travel, is_online, split_people, input_method, raw_input, synced_at, is_deleted, people_mentioned, subscription_id, holiday, tags
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
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
      0, // is_deleted
      expense.people_mentioned ? expense.people_mentioned.join(',') : null,
      subscription_id || null,
      expense.holiday || null,
      finalTags.length > 0 ? finalTags.join(',') : null,
    ]);

    // Sincronizzazione Patrimonio: Incrementa o Decrementa solo se NON è nel futuro
    const todayStr = new Date().toISOString().split('T')[0];
    const isFuture = expense.date > todayStr;
    if (!isFuture) {
      const delta = expense.direction === 'in' ? expense.amount : -expense.amount;
      await NetWorthRepository.incrementTotal(delta);
    }
    return expense.id;
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
      // Calcolo Inverso: Se elimino una spesa (-), aggiungo al patrimonio (+). Se elimino un'entrata (+), tolgo al patrimonio (-). Solo se NON era nel futuro.
      const todayStr = new Date().toISOString().split('T')[0];
      const isFuture = tx.date > todayStr;
      if (!isFuture) {
        const inverseDelta = tx.direction === 'in' ? -tx.amount : tx.amount;
        await NetWorthRepository.incrementTotal(inverseDelta);
      }
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

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    const stats = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const mStr = m < 10 ? `0${m}` : `${m}`;
      
      let dateStr = '';
      if (year === currentYear && m === currentMonth) {
        dateStr = todayStr;
      } else {
        const lastDay = new Date(year, m, 0).getDate();
        const lastDayStr = lastDay < 10 ? `0${lastDay}` : `${lastDay}`;
        dateStr = `${year}-${mStr}-${lastDayStr}`;
      }

      return {
        month: m,
        date: dateStr,
        income: 0,
        expense: 0
      };
    });

    results.forEach((row: any) => {
      if (row.month >= 1 && row.month <= 12) {
        stats[row.month - 1].income = row.income;
        stats[row.month - 1].expense = row.expense;
      }
    });

    return stats as any[];
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
    const stats = Array.from({ length: lastDay }, (_, i) => {
      const dayNum = i + 1;
      const dayStr = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
      return {
        day: dayNum,
        date: `${yearStr}-${monthStr}-${dayStr}`,
        income: 0,
        expense: 0
      };
    });

    results.forEach((row: any) => {
      if (row.day >= 1 && row.day <= lastDay) {
        stats[row.day - 1].income = row.income;
        stats[row.day - 1].expense = row.expense;
      }
    });

    return stats;
  }

  /**
   * Retrieves daily stats for a specific number of days, relative to today or a base date.
   */
  static async getDailyStatsForRecentDays(days: number, anchor: number | string = 0): Promise<{ label: string, income: number, expense: number }[]> {
    const db = await getDBConnection();
    let startDateStr: string;
    let endDateStr: string;

    if (typeof anchor === 'number') {
      startDateStr = `date('now', '-${days + anchor} days')`;
      endDateStr = `date('now', '-${anchor} days')`;
    } else {
      startDateStr = `date('${anchor}', '-${days} days')`;
      endDateStr = `'${anchor}'`;
    }

    const results = await db.getAllAsync(`
      SELECT 
        date,
        SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END) as expense
      FROM transactions
      WHERE date > ${startDateStr} AND date <= ${endDateStr} AND is_deleted = 0 AND direction != 'adj'
      GROUP BY date
      ORDER BY date ASC
    `);

    const stats = [];
    const baseDate = typeof anchor === 'string' ? new Date(anchor) : new Date();
    if (typeof anchor === 'number') baseDate.setDate(baseDate.getDate() - anchor);

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const match = results.find((r: any) => r.date === dateStr);
      stats.push({
        label: d.toLocaleDateString('it-IT', { weekday: 'short' }),
        date: dateStr,
        income: match ? (match as any).income : 0,
        expense: match ? (match as any).expense : 0
      });
    }

    return stats;
  }

  /**
   * Retrieves the date of the very first transaction in the database.
   * Returns a YYYY-MM-DD string or null if no transactions exist.
   */
  static async getFirstTransactionDate(): Promise<string | null> {
    const db = await getDBConnection();
    const result = await db.getFirstAsync(`
      SELECT MIN(date) as first_date
      FROM transactions 
      WHERE is_deleted = 0
    `);
    if (!result || !(result as any).first_date) return null;
    return (result as any).first_date;
  }

  /**
   * Retrieves stats for the entire history, grouping by month or year.
   */
  static async getStatsForAllTime(): Promise<{ label: string, income: number, expense: number }[]> {
    const db = await getDBConnection();
    
    // Get first transaction date (including adjustments/onboarding)
    const firstTxResult = await db.getFirstAsync<{ first_date: string }>(`
      SELECT MIN(date) as first_date FROM transactions WHERE is_deleted = 0
    `);
    
    const firstDateStr = firstTxResult?.first_date || new Date().toISOString().split('T')[0];
    
    const parseLocalDate = (dateStr: string): Date => {
      const parts = dateStr.split('T')[0].split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      return new Date(y, m, d);
    };

    const start = parseLocalDate(firstDateStr);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const timeDiff = end.getTime() - start.getTime();
    const daysSpan = Math.round(timeDiff / (1000 * 3600 * 24));
    
    const stats = [];
    
    if (daysSpan <= 60) {
      // Daily Granularity (short history)
      const results = await db.getAllAsync<any>(`
        SELECT 
          date as period,
          SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END) as income,
          SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END) as expense
        FROM transactions
        WHERE is_deleted = 0 AND direction != 'adj'
        GROUP BY period
        ORDER BY period ASC
      `);
      
      for (let i = 0; i <= daysSpan; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        
        const yStr = d.getFullYear();
        const mStr = (d.getMonth() + 1).toString().padStart(2, '0');
        const dayStr = d.getDate().toString().padStart(2, '0');
        const dateStr = `${yStr}-${mStr}-${dayStr}`;
        
        const match = results.find(r => r.period === dateStr);
        stats.push({
          label: d.getDate().toString().padStart(2, '0') + ' ' + d.toLocaleDateString('it-IT', { month: 'short' }),
          date: dateStr,
          income: match ? match.income : 0,
          expense: match ? match.expense : 0
        });
      }
    } else if (daysSpan <= 730) {
      // Monthly Granularity (mid history)
      const results = await db.getAllAsync<any>(`
        SELECT 
          strftime('%Y-%m', date) as period,
          SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END) as income,
          SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END) as expense
        FROM transactions
        WHERE is_deleted = 0 AND direction != 'adj'
        GROUP BY period
        ORDER BY period ASC
      `);
      
      const current = new Date(start.getFullYear(), start.getMonth(), 1);
      const targetEnd = new Date(end.getFullYear(), end.getMonth(), 1);
      const todayPeriodStr = `${end.getFullYear()}-${(end.getMonth() + 1).toString().padStart(2, '0')}`;
      
      for (let c = new Date(current); c <= targetEnd; c.setMonth(c.getMonth() + 1)) {
        const yStr = c.getFullYear();
        const mStr = (c.getMonth() + 1).toString().padStart(2, '0');
        const periodStr = `${yStr}-${mStr}`;
        
        let dateStr = '';
        if (periodStr === todayPeriodStr) {
          dateStr = todayStr;
        } else {
          const lastDay = new Date(c.getFullYear(), c.getMonth() + 1, 0).getDate();
          dateStr = `${yStr}-${mStr}-${lastDay.toString().padStart(2, '0')}`;
        }
        
        const match = results.find(r => r.period === periodStr);
        stats.push({
          label: `${mStr}/${yStr.toString().slice(2)}`,
          date: dateStr,
          income: match ? match.income : 0,
          expense: match ? match.expense : 0
        });
      }
    } else {
      // Yearly Granularity (long history)
      const results = await db.getAllAsync<any>(`
        SELECT 
          strftime('%Y', date) as period,
          SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END) as income,
          SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END) as expense
        FROM transactions
        WHERE is_deleted = 0 AND direction != 'adj'
        GROUP BY period
        ORDER BY period ASC
      `);
      
      const startYear = start.getFullYear();
      const endYear = end.getFullYear();
      
      for (let y = startYear; y <= endYear; y++) {
        let dateStr = '';
        if (y === endYear) {
          dateStr = todayStr;
        } else {
          dateStr = `${y}-12-31`;
        }
        const match = results.find(r => r.period === y.toString());
        stats.push({
          label: y.toString(),
          date: dateStr,
          income: match ? match.income : 0,
          expense: match ? match.expense : 0
        });
      }
    }
    
    return stats;
  }

  /**
   * Retrieves domain distribution for a specific time range, direction and base date.
   */
  static async getDomainDistribution(
    timeRange: 'Settimana' | 'Mese' | 'Anno' | 'Tutto', 
    direction: 'in' | 'out' = 'out',
    baseDate: string = new Date().toISOString().split('T')[0],
  ): Promise<{ domain_key: string, total: number }[]> {
    const db = await getDBConnection();
    let query = `
      SELECT domain_key, SUM(amount) as total
      FROM transactions
      WHERE is_deleted = 0 AND direction = '${direction}' AND domain_key IS NOT NULL
    `;

    if (timeRange === 'Settimana') query += ` AND date >= date('${baseDate}', '-7 days') AND date <= '${baseDate}'`;
    else if (timeRange === 'Mese') query += ` AND strftime('%Y-%m', date) = strftime('%Y-%m', '${baseDate}')`;
    else if (timeRange === 'Anno') query += ` AND strftime('%Y', date) = strftime('%Y', '${baseDate}')`;

    query += " GROUP BY domain_key ORDER BY total DESC";

    const results = await db.getAllAsync(query);
    return results as any[];
  }

  /**
   * Retrieves category distribution for a specific time range, direction and base date.
   */
  static async getCategoryDistribution(
    timeRange: 'Settimana' | 'Mese' | 'Anno' | 'Tutto', 
    direction: 'in' | 'out' = 'out',
    baseDate: string = new Date().toISOString().split('T')[0],
    filters: { city?: string, socialContext?: string, personName?: string, merchantName?: string, holiday?: string, tag?: string } = {}
  ): Promise<{ category_key: string, total: number }[]> {
    const db = await getDBConnection();
    const { city, socialContext, personName, merchantName, holiday, tag } = filters;
    let query = `
      SELECT category_key, SUM(amount) as total
      FROM transactions
      WHERE is_deleted = 0 AND direction = '${direction}'
    `;
    if (city) query += ` AND city = '${city}'`;
    if (socialContext) query += ` AND social_context = '${socialContext}'`;
    if (personName) query += ` AND people_mentioned LIKE '%${personName}%'`;
    if (merchantName) query += ` AND location_name LIKE '%${merchantName}%'`;
    if (holiday) query += ` AND holiday = '${holiday}'`;
    if (tag) query += ` AND tags LIKE '%${tag}%'`;

    if (timeRange === 'Settimana') query += ` AND date >= date('${baseDate}', '-7 days') AND date <= '${baseDate}'`;
    else if (timeRange === 'Mese') query += ` AND strftime('%Y-%m', date) = strftime('%Y-%m', '${baseDate}')`;
    else if (timeRange === 'Anno') query += ` AND strftime('%Y', date) = strftime('%Y', '${baseDate}')`;

    query += " GROUP BY category_key ORDER BY total DESC";

    const results = await db.getAllAsync(query);
    return results as any[];
  }

  /**
   * Retrieves city distribution for a specific time range, direction and base date.
   */
  static async getCityDistribution(
    timeRange: 'Settimana' | 'Mese' | 'Anno' | 'Tutto',
    direction: 'in' | 'out' = 'out',
    baseDate: string = new Date().toISOString().split('T')[0],
    filters: { category_key?: string, socialContext?: string, personName?: string, merchantName?: string, holiday?: string, tag?: string } = {}
  ): Promise<{ city: string, total: number }[]> {
    const db = await getDBConnection();
    const { category_key, socialContext, personName, merchantName, holiday, tag } = filters;
    let query = `
      SELECT city, SUM(amount) as total
      FROM transactions
      WHERE is_deleted = 0 AND direction = '${direction}' AND city IS NOT NULL AND city != ''
    `;
    if (category_key) query += ` AND category_key = '${category_key}'`;
    if (socialContext) query += ` AND social_context = '${socialContext}'`;
    if (personName) query += ` AND people_mentioned LIKE '%${personName}%'`;
    if (merchantName) query += ` AND location_name LIKE '%${merchantName}%'`;
    if (holiday) query += ` AND holiday = '${holiday}'`;
    if (tag) query += ` AND tags LIKE '%${tag}%'`;

    if (timeRange === 'Settimana') query += ` AND date >= date('${baseDate}', '-7 days') AND date <= '${baseDate}'`;
    else if (timeRange === 'Mese') query += ` AND strftime('%Y-%m', date) = strftime('%Y-%m', '${baseDate}')`;
    else if (timeRange === 'Anno') query += ` AND strftime('%Y', date) = strftime('%Y', '${baseDate}')`;

    query += " GROUP BY city ORDER BY total DESC";

    const results = await db.getAllAsync(query);
    return results as any[];
  }

  /**
   * Retrieves all unique city names present in the database.
   */
  static async getDistinctCities(): Promise<string[]> {
    const db = await getDBConnection();
    const results = await db.getAllAsync('SELECT DISTINCT city FROM transactions WHERE city IS NOT NULL AND city != "" AND is_deleted = 0');
    return results.map((r: any) => r.city);
  }

  /**
   * Retrieves all unique social contexts present in the database.
   */
  static async getDistinctSocialContexts(): Promise<string[]> {
    const db = await getDBConnection();
    const results = await db.getAllAsync('SELECT DISTINCT social_context FROM transactions WHERE social_context IS NOT NULL AND social_context != "" AND is_deleted = 0');
    return results.map((r: any) => r.social_context);
  }

  /**
   * Retrieves all unique people mentioned in the database.
   */
  static async getDistinctPeople(): Promise<string[]> {
    const db = await getDBConnection();
    const results = await db.getAllAsync('SELECT people_mentioned FROM transactions WHERE people_mentioned IS NOT NULL AND people_mentioned != "" AND is_deleted = 0');
    
    const allPeople = new Set<string>();
    results.forEach((r: any) => {
      let parts: string[] = [];
      const raw = r.people_mentioned.trim();
      if (raw.startsWith('[')) {
        try {
          const parsed = JSON.parse(raw);
          parts = Array.isArray(parsed) ? parsed : [raw];
        } catch {
          parts = raw.split(',');
        }
      } else {
        parts = raw.split(',');
      }
      
      parts.forEach((p: any) => {
        const clean = String(p).trim().toLowerCase().replace(/^["']|["']$/g, '');
        if (clean) allPeople.add(clean);
      });
    });
    
    return Array.from(allPeople).sort();
  }

  /**
   * Retrieves subcategory distribution for a specific time range, direction and base date.
   */
  static async getSubcategoryDistribution(
    timeRange: 'Settimana' | 'Mese' | 'Anno' | 'Tutto', 
    direction: 'in' | 'out' = 'out', 
    categoryKey?: string,
    baseDate: string = new Date().toISOString().split('T')[0],
    city?: string
  ): Promise<{ subcategory_key: string, total: number }[]> {
    const db = await getDBConnection();
    let query = `
      SELECT subcategory_key, SUM(amount) as total
      FROM transactions
      WHERE is_deleted = 0 AND direction = '${direction}'
    `;
    if (city) query += ` AND city = '${city}'`;

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
   * Retrieves all unique holidays present in the database.
   */
  static async getDistinctHolidays(): Promise<string[]> {
    const db = await getDBConnection();
    const results = await db.getAllAsync('SELECT DISTINCT holiday FROM transactions WHERE holiday IS NOT NULL AND holiday != "" AND is_deleted = 0');
    return results.map((r: any) => r.holiday);
  }

  /**
   * Retrieves all unique user-defined tags present in the database.
   * Excludes auto-managed tags like 'weekend'.
   */
  static async getDistinctTags(): Promise<string[]> {
    const db = await getDBConnection();
    const results = await db.getAllAsync('SELECT tags FROM transactions WHERE tags IS NOT NULL AND tags != "" AND is_deleted = 0');
    
    const AUTO_TAGS = new Set(['weekend']); // tag gestiti automaticamente dal sistema
    const allTags = new Set<string>();
    results.forEach((r: any) => {
      let parts: string[] = [];
      const raw = r.tags.trim();
      if (raw.startsWith('[')) {
        try {
          const parsed = JSON.parse(raw);
          parts = Array.isArray(parsed) ? parsed : [raw];
        } catch {
          parts = raw.split(',');
        }
      } else {
        parts = raw.split(',');
      }
      
      parts.forEach((t: any) => {
        const clean = String(t).trim().toLowerCase().replace(/^["']|["']$/g, '');
        if (clean && !AUTO_TAGS.has(clean)) allTags.add(clean);
      });
    });
    
    return Array.from(allTags).sort();
  }

  /**
   * Retrieves transactions filtered by period, category, subcategory and sorted.
   */
  static async getFilteredTransactions(
    timeRange: 'Settimana' | 'Mese' | 'Anno' | 'Tutto',
    filters: { domain_key?: string, category_key?: string, subcategory_key?: string, direction?: 'in' | 'out', city?: string, social_context?: string, person?: string, merchant_name?: string, holiday?: string, tag?: string, domain_keys?: string[], category_keys?: string[] },
    sortBy: 'date' | 'amount_asc' | 'amount_desc',
    baseDate: string = new Date().toISOString().split('T')[0]
  ): Promise<any[]> {
    const db = await getDBConnection();
    let query = `
      SELECT t.*, s.name as subscription_name 
      FROM transactions t
      LEFT JOIN subscriptions s ON t.subscription_id = s.id
      WHERE t.is_deleted = 0 AND t.direction != 'adj' AND t.date <= '${baseDate}'
    `;

    // Time Filter
    if (timeRange === 'Settimana') query += ` AND t.date >= date('${baseDate}', '-7 days') AND t.date <= '${baseDate}'`;
    else if (timeRange === 'Mese') query += ` AND strftime('%Y-%m', t.date) = strftime('%Y-%m', '${baseDate}')`;
    else if (timeRange === 'Anno') query += ` AND strftime('%Y', t.date) = strftime('%Y', '${baseDate}')`;

    // Category & Domain & Merchant Filters
    if (filters.direction) query += ` AND t.direction = '${filters.direction}'`;
    if (filters.domain_key) query += ` AND t.domain_key = '${filters.domain_key}'`;
    if (filters.category_key) query += ` AND t.category_key = '${filters.category_key}'`;
    if (filters.domain_keys && filters.domain_keys.length > 0) {
      const placeholders = filters.domain_keys.map(k => `'${k}'`).join(',');
      query += ` AND t.domain_key IN (${placeholders})`;
    }
    if (filters.category_keys && filters.category_keys.length > 0) {
      const placeholders = filters.category_keys.map(k => `'${k}'`).join(',');
      query += ` AND t.category_key IN (${placeholders})`;
    }
    if (filters.subcategory_key) query += ` AND t.subcategory_key = '${filters.subcategory_key}'`;
    if (filters.merchant_name) query += ` AND t.location_name LIKE '%${filters.merchant_name}%'`;
    if (filters.city) query += ` AND t.city = '${filters.city}'`;
    if (filters.social_context) query += ` AND t.social_context = '${filters.social_context}'`;
    if (filters.person) query += ` AND t.people_mentioned LIKE '%${filters.person}%'`;
    if (filters.holiday) query += ` AND t.holiday = '${filters.holiday}'`;
    if (filters.tag) query += ` AND t.tags LIKE '%${filters.tag}%'`;

    // Sorting
    if (sortBy === 'date') query += " ORDER BY t.date DESC, t.time DESC";
    else if (sortBy === 'amount_asc') query += " ORDER BY t.amount ASC";
    else if (sortBy === 'amount_desc') query += " ORDER BY t.amount DESC";

    const results = await db.getAllAsync(query);
    return results;
  }

  /**
   * Retrieves a filtered trend for specific direction and categories.
   */
  static async getFilteredTrend(
    timeRange: 'Settimana' | 'Mese' | 'Anno' | 'Tutto',
    direction: 'in' | 'out',
    filters: { category_key?: string, subcategory_key?: string, domain_keys?: string[], category_keys?: string[] },
    baseDate: string = new Date().toISOString().split('T')[0]
  ): Promise<{ label: string, value: number, date: string }[]> {
    const db = await getDBConnection();
    
    let timeExpr = "date";
    let periodFilter = "";
    
    if (timeRange === 'Settimana') {
      periodFilter = `AND date >= date('${baseDate}', '-6 days') AND date <= '${baseDate}'`;
    } else if (timeRange === 'Mese') {
      periodFilter = `AND strftime('%Y-%m', date) = strftime('%Y-%m', '${baseDate}')`;
    } else if (timeRange === 'Anno') {
      timeExpr = "strftime('%Y-%m', date)";
      periodFilter = `AND strftime('%Y', date) = strftime('%Y', '${baseDate}')`;
    } else {
      timeExpr = "strftime('%Y-%m', date)";
    }

    let filterExpr = `AND direction = '${direction}'`;
    if (filters.category_key) filterExpr += ` AND category_key = '${filters.category_key}'`;
    if (filters.subcategory_key) filterExpr += ` AND subcategory_key = '${filters.subcategory_key}'`;
    if (filters.domain_keys && filters.domain_keys.length > 0) {
      const placeholders = filters.domain_keys.map(k => `'${k}'`).join(',');
      filterExpr += ` AND domain_key IN (${placeholders})`;
    }
    if (filters.category_keys && filters.category_keys.length > 0) {
      const placeholders = filters.category_keys.map(k => `'${k}'`).join(',');
      filterExpr += ` AND category_key IN (${placeholders})`;
    }

    const query = `
      SELECT ${timeExpr} as period, SUM(amount) as total
      FROM transactions
      WHERE is_deleted = 0 ${periodFilter} ${filterExpr}
      GROUP BY period
      ORDER BY period ASC
    `;

    const results = await db.getAllAsync<any>(query);
    const parsedBaseDate = new Date(baseDate);
    const year = parsedBaseDate.getFullYear();
    const month = parsedBaseDate.getMonth();

    if (timeRange === 'Settimana') {
      const stats = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(parsedBaseDate);
        d.setDate(parsedBaseDate.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        const match = results.find(r => r.period === dateStr);
        stats.push({
          label: d.toLocaleDateString('it-IT', { weekday: 'short' }),
          date: dateStr,
          value: match ? match.total : 0
        });
      }
      return stats;
    } 
    
    if (timeRange === 'Mese') {
      const lastDay = new Date(year, month + 1, 0).getDate();
      const stats = [];
      const monthNumStr = (month + 1).toString().padStart(2, '0');
      
      for (let dayNum = 1; dayNum <= lastDay; dayNum++) {
        const dayStr = dayNum.toString().padStart(2, '0');
        const dateStr = `${year}-${monthNumStr}-${dayStr}`;
        
        const match = results.find(r => r.period === dateStr);
        stats.push({
          label: dayStr,
          date: dateStr,
          value: match ? match.total : 0
        });
      }
      return stats;
    } 
    
    if (timeRange === 'Anno') {
      const stats = [];
      const months = ['G', 'F', 'M', 'A', 'M', 'G', 'L', 'A', 'S', 'O', 'N', 'D'];
      
      for (let m = 1; m <= 12; m++) {
        const monthPeriodStr = `${year}-${m.toString().padStart(2, '0')}`;
        const match = results.find(r => r.period === monthPeriodStr);
        
        stats.push({
          label: months[m - 1],
          date: `${year}-${m.toString().padStart(2, '0')}-01`,
          value: match ? match.total : 0
        });
      }
      return stats;
    }

    // timeRange === 'Tutto'
    // Starts from first transaction date (including adjustments/onboarding) to today
    const firstTxResult = await db.getFirstAsync<{ first_date: string }>(`
      SELECT MIN(date) as first_date FROM transactions WHERE is_deleted = 0
    `);
    
    const firstDateStr = firstTxResult?.first_date || new Date().toISOString().split('T')[0];
    
    const parseLocalDate = (dateStr: string): Date => {
      const parts = dateStr.split('T')[0].split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      return new Date(y, m, d);
    };

    const start = parseLocalDate(firstDateStr);
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const timeDiff = end.getTime() - start.getTime();
    const daysSpan = Math.round(timeDiff / (1000 * 3600 * 24));
    
    const stats = [];
    
    if (daysSpan <= 60) {
      // Daily Granularity (short history)
      const dailyQuery = `
        SELECT date as period, SUM(amount) as total
        FROM transactions
        WHERE is_deleted = 0 ${filterExpr}
        GROUP BY period
        ORDER BY period ASC
      `;
      const dailyResults = await db.getAllAsync<any>(dailyQuery);
      
      for (let i = 0; i <= daysSpan; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        
        const yStr = d.getFullYear();
        const mStr = (d.getMonth() + 1).toString().padStart(2, '0');
        const dayStr = d.getDate().toString().padStart(2, '0');
        const dateStr = `${yStr}-${mStr}-${dayStr}`;
        
        const match = dailyResults.find(r => r.period === dateStr);
        stats.push({
          label: d.getDate().toString().padStart(2, '0') + ' ' + d.toLocaleDateString('it-IT', { month: 'short' }),
          date: dateStr,
          value: match ? match.total : 0
        });
      }
    } else if (daysSpan <= 730) {
      // Monthly Granularity (mid history)
      const monthlyQuery = `
        SELECT strftime('%Y-%m', date) as period, SUM(amount) as total
        FROM transactions
        WHERE is_deleted = 0 ${filterExpr}
        GROUP BY period
        ORDER BY period ASC
      `;
      const monthlyResults = await db.getAllAsync<any>(monthlyQuery);
      
      let current = new Date(start.getFullYear(), start.getMonth(), 1);
      const targetEnd = new Date(end.getFullYear(), end.getMonth(), 1);
      
      while (current <= targetEnd) {
        const yStr = current.getFullYear();
        const mStr = (current.getMonth() + 1).toString().padStart(2, '0');
        const periodStr = `${yStr}-${mStr}`;
        
        const match = monthlyResults.find(r => r.period === periodStr);
        stats.push({
          label: `${mStr}/${yStr.toString().slice(2)}`,
          date: `${yStr}-${mStr}-01`,
          value: match ? match.total : 0
        });
        
        current.setMonth(current.getMonth() + 1);
      }
    } else {
      // Yearly Granularity (long history)
      const yearlyQuery = `
        SELECT strftime('%Y', date) as period, SUM(amount) as total
        FROM transactions
        WHERE is_deleted = 0 ${filterExpr}
        GROUP BY period
        ORDER BY period ASC
      `;
      const yearlyResults = await db.getAllAsync<any>(yearlyQuery);
      
      const startYear = start.getFullYear();
      const endYear = end.getFullYear();
      
      for (let y = startYear; y <= endYear; y++) {
        const match = yearlyResults.find(r => r.period === y.toString());
        stats.push({
          label: y.toString(),
          date: `${y}-01-01`,
          value: match ? match.total : 0
        });
      }
    }
    
    return stats;
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

    // Calculate Net Worth adjustment (taking past vs future transition into account)
    const todayStr = new Date().toISOString().split('T')[0];
    const oldIsFuture = oldTx.date > todayStr;
    const newIsFuture = (updates.date || oldTx.date) > todayStr;

    const oldImpact = oldIsFuture ? 0 : (oldTx.direction === 'in' ? oldTx.amount : -oldTx.amount);
    const newImpact = newIsFuture ? 0 : (newDirection === 'in' ? newAmount : -newAmount);
    const adjustment = newImpact - oldImpact;

    let finalTags: string[] = [];
    if (updates.tags !== undefined) {
      if (Array.isArray(updates.tags)) {
        finalTags = [...updates.tags];
      } else if (updates.tags) {
        const raw = updates.tags.trim();
        if (raw.startsWith('[')) {
          try { finalTags = JSON.parse(raw); } catch { finalTags = raw.split(','); }
        } else {
          finalTags = raw.split(',');
        }
      }
    } else if (oldTx.tags) {
      const raw = oldTx.tags.trim();
      if (raw.startsWith('[')) {
        try { finalTags = JSON.parse(raw); } catch { finalTags = raw.split(','); }
      } else {
        finalTags = raw.split(',');
      }
    }
    finalTags = finalTags.map((t: string) => t.trim().toLowerCase()).filter(Boolean);

    let finalPeople: string[] = [];
    if (updates.people_mentioned !== undefined) {
      if (Array.isArray(updates.people_mentioned)) {
        finalPeople = [...updates.people_mentioned];
      } else if (updates.people_mentioned) {
        const raw = updates.people_mentioned.trim();
        if (raw.startsWith('[')) {
          try { finalPeople = JSON.parse(raw); } catch { finalPeople = raw.split(','); }
        } else {
          finalPeople = raw.split(',');
        }
      }
    } else if (oldTx.people_mentioned) {
      const raw = oldTx.people_mentioned.trim();
      if (raw.startsWith('[')) {
        try { finalPeople = JSON.parse(raw); } catch { finalPeople = raw.split(','); }
      } else {
        finalPeople = raw.split(',');
      }
    }
    finalPeople = finalPeople.map((p: string) => p.trim().toLowerCase()).filter(Boolean);

    const isWeekendVal = updates.is_weekend !== undefined 
      ? updates.is_weekend 
      : (updates.date 
          ? (new Date(updates.date).getDay() === 0 || new Date(updates.date).getDay() === 6) 
          : (oldTx.date ? (new Date(oldTx.date).getDay() === 0 || new Date(oldTx.date).getDay() === 6) : false));

    if (isWeekendVal) {
      if (!finalTags.includes('weekend')) finalTags.push('weekend');
    } else {
      finalTags = finalTags.filter((t: string) => t !== 'weekend');
    }

    await db.runAsync(`
      UPDATE transactions SET
        date = ?, time = ?, amount = ?, net_amount = ?, currency = ?, direction = ?,
        payment_method = ?, category_key = ?, subcategory_key = ?, description = ?,
        social_context = ?, location_type = ?, location_name = ?, city = ?, address = ?,
        is_travel = ?, is_online = ?, split_people = ?, subscription_id = ?, holiday = ?, tags = ?,
        people_mentioned = ?
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
      updates.subscription_id !== undefined ? updates.subscription_id : oldTx.subscription_id,
      updates.holiday !== undefined ? updates.holiday : oldTx.holiday,
      finalTags.length > 0 ? finalTags.join(',') : null,
      finalPeople.length > 0 ? finalPeople.join(',') : null,
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
      SELECT date, amount, direction, category_key, description, city, location_name, holiday, tags, people_mentioned
      FROM transactions
      WHERE is_deleted = 0
      ORDER BY date DESC, time DESC
      LIMIT ?
    `, [limit]);
  }

  static async getUniqueMerchants(): Promise<string[]> {
    const db = await getDBConnection();
    const query = "SELECT DISTINCT location_name FROM transactions WHERE location_name IS NOT NULL AND is_deleted = 0";
    const results = await db.getAllAsync<{ location_name: string }>(query);
    return results.map(r => r.location_name);
  }

  static async getExpensesSumForPeriod(startDate: string, endDate: string): Promise<number> {
    const db = await getDBConnection();
    const result = await db.getFirstAsync<{ sum: number }>(`
      SELECT COALESCE(SUM(amount), 0) as sum FROM transactions
      WHERE is_deleted = 0 AND direction = 'out' AND date >= ? AND date <= ?
    `, [startDate, endDate]);
    return result?.sum ?? 0;
  }

  /**
   * Retrieves active scheduled transactions with date in the future.
   */
  static async getUpcomingScheduled(limit: number = 10): Promise<any[]> {
    const db = await getDBConnection();
    const todayStr = new Date().toISOString().split('T')[0];
    const results = await db.getAllAsync(`
      SELECT t.*, s.name as subscription_name
      FROM transactions t
      LEFT JOIN subscriptions s ON t.subscription_id = s.id
      WHERE t.is_deleted = 0 
        AND t.direction != 'adj'
        AND t.date > ?
        AND t.subscription_id IS NULL
      ORDER BY t.date ASC, t.time ASC
      LIMIT ?
    `, [todayStr, limit]);
    return results;
  }

  /**
   * Retrieves active scheduled expenses (direction = 'out') in the future.
   */
  static async getScheduledExpenses(orderBy: 'date' | 'amount_asc' | 'amount_desc' = 'date'): Promise<any[]> {
    const db = await getDBConnection();
    const todayStr = new Date().toISOString().split('T')[0];
    
    let orderSql = 't.date ASC, t.time ASC';
    if (orderBy === 'amount_asc') {
      orderSql = 't.amount ASC';
    } else if (orderBy === 'amount_desc') {
      orderSql = 't.amount DESC';
    }
    
    const results = await db.getAllAsync(`
      SELECT t.*, s.name as subscription_name
      FROM transactions t
      LEFT JOIN subscriptions s ON t.subscription_id = s.id
      WHERE t.is_deleted = 0 
        AND t.direction = 'out'
        AND t.date > ?
        AND t.subscription_id IS NULL
      ORDER BY ${orderSql}
    `, [todayStr]);
    return results;
  }

  /**
   * Helper to determine granularity for all time stats
   */
  static async getGranularityForTutto(): Promise<'daily' | 'monthly' | 'yearly'> {
    const db = await getDBConnection();
    const firstTxResult = await db.getFirstAsync<{ first_date: string }>(`
      SELECT MIN(date) as first_date FROM transactions WHERE is_deleted = 0
    `);
    
    const firstDateStr = firstTxResult?.first_date || new Date().toISOString().split('T')[0];
    
    const parseLocalDate = (dateStr: string): Date => {
      const parts = dateStr.split('T')[0].split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      return new Date(y, m, d);
    };

    const start = parseLocalDate(firstDateStr);
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const timeDiff = end.getTime() - start.getTime();
    const daysSpan = Math.round(timeDiff / (1000 * 3600 * 24));
    
    if (daysSpan <= 60) {
      return 'daily';
    } else if (daysSpan <= 730) {
      return 'monthly';
    } else {
      return 'yearly';
    }
  }

  /**
   * Calculates the absolute max and min values for trend aggregates (in, out, or both)
   * across the entire database history, based on the current granularity and category filters.
   */
  static async getAbsoluteTrendLimits(
    timeRange: 'Settimana' | 'Mese' | 'Anno' | 'Tutto',
    direction: 'in' | 'out' | 'both',
    filters: { category_key?: string, subcategory_key?: string, domain_keys?: string[], category_keys?: string[] } = {}
  ): Promise<{ max: number; min: number }> {
    const db = await getDBConnection();
    
    let granularity: 'daily' | 'monthly' | 'yearly' = 'daily';
    if (timeRange === 'Anno') {
      granularity = 'monthly';
    } else if (timeRange === 'Tutto') {
      granularity = await this.getGranularityForTutto();
    }
    
    let timeExpr = "date";
    if (granularity === 'monthly') {
      timeExpr = "strftime('%Y-%m', date)";
    } else if (granularity === 'yearly') {
      timeExpr = "strftime('%Y', date)";
    }
    
    let filterExpr = "";
    if (filters.category_key) filterExpr += ` AND category_key = '${filters.category_key}'`;
    if (filters.subcategory_key) filterExpr += ` AND subcategory_key = '${filters.subcategory_key}'`;
    if (filters.domain_keys && filters.domain_keys.length > 0) {
      const placeholders = filters.domain_keys.map(k => `'${k}'`).join(',');
      filterExpr += ` AND domain_key IN (${placeholders})`;
    }
    if (filters.category_keys && filters.category_keys.length > 0) {
      const placeholders = filters.category_keys.map(k => `'${k}'`).join(',');
      filterExpr += ` AND category_key IN (${placeholders})`;
    }

    let query = "";
    if (direction === 'both') {
      query = `
        SELECT MAX(CASE WHEN income > expense THEN income ELSE expense END) as max_val FROM (
          SELECT 
            SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END) as income,
            SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END) as expense
          FROM transactions
          WHERE is_deleted = 0 AND direction != 'adj' ${filterExpr}
          GROUP BY ${timeExpr}
        )
      `;
    } else {
      query = `
        SELECT MAX(total) as max_val FROM (
          SELECT SUM(amount) as total
          FROM transactions
          WHERE is_deleted = 0 AND direction = '${direction}' ${filterExpr}
          GROUP BY ${timeExpr}
        )
      `;
    }
    
    const result = await db.getFirstAsync<{ max_val: number }>(query);
    return { max: result?.max_val || 0, min: 0 };
  }

  /**
   * Deletes all transactions, subscriptions, and resets the net worth to baseline 1000.0.
   */
  static async deleteAll(): Promise<void> {
    const db = await getDBConnection();
    await db.runAsync('DELETE FROM transactions');
    await db.runAsync('DELETE FROM subscriptions');
    await db.runAsync('DELETE FROM net_worth_history');

    // Use today as the new "day zero" so all charts and stats start from now
    const now = new Date();
    const initDate = now.toISOString();
    const initDateStr = now.toISOString().split('T')[0];
    await db.runAsync(`UPDATE net_worth SET amount = 1000.0, updated_at = ?`, [initDate]);
    await db.runAsync(`INSERT OR REPLACE INTO net_worth_history (date, amount, updated_at) VALUES (?, 1000.0, ?)`, [initDateStr, initDate]);
  }
}

