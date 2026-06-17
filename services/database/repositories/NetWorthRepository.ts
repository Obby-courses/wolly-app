import { getDBConnection } from '../db';
import AsyncStorage from '@react-native-async-storage/async-storage';


export class NetWorthRepository {
  static async getCurrentTotal(): Promise<number> {
    const db = await getDBConnection();
    const result = await db.getAllAsync(`SELECT amount FROM net_worth ORDER BY updated_at DESC LIMIT 1`);
    if (result && result.length > 0) {
      return (result[0] as any).amount;
    }
    return 1000.0;
  }

  /**
   * Used ONLY during onboarding to set the initial balance.
   * Logs to Supabase with source='onboarding'.
   */
  static async updateTotal(newAmount: number): Promise<void> {
    const db = await getDBConnection();
    const currentTotal = await this.getCurrentTotal();
    const diff = newAmount - currentTotal;
    if (diff === 0) return;
    const now = new Date().toISOString();
    const todayStr = now.split('T')[0];
    await db.runAsync(`UPDATE net_worth SET amount = ?, updated_at = ?`, [newAmount, now]);
    // Insert or replace an anchor point for today, preserving all past history
    await db.runAsync(
      `INSERT INTO net_worth_history (date, amount, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET amount = excluded.amount, updated_at = excluded.updated_at`,
      [todayStr, newAmount, now]
    );
  }

  /**
   * Used for manual user-initiated adjustments (home screen / settings).
   * Updates net_worth locally and logs to Supabase.
   * Does NOT touch the transactions table.
   */
  static async recordManualAdjustment(newAmount: number): Promise<void> {
    const db = await getDBConnection();
    const now = new Date().toISOString();
    const todayStr = now.split('T')[0];
    const currentTotal = await this.getCurrentTotal();
    if (newAmount === currentTotal) return;

    // Update the current net worth value
    await db.runAsync(`UPDATE net_worth SET amount = ?, updated_at = ?`, [newAmount, now]);

    // Insert a new anchor point for TODAY with the exact new balance.
    // This preserves all past history: getNetWorthAtDate will reconstruct the past
    // using transaction deltas relative to this (or previous) anchor points.
    // Example: 1000 -> spend 50 -> 950, then manual adjust to 1950:
    //   net_worth_history gets a new row (today, 1950).
    //   Querying yesterday still returns 950 (1950 minus the 50€ spend from today backward).
    await db.runAsync(
      `INSERT INTO net_worth_history (date, amount, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET amount = excluded.amount, updated_at = excluded.updated_at`,
      [todayStr, newAmount, now]
    );
  }


  static async incrementTotal(amountDelta: number): Promise<void> {
     const db = await getDBConnection();
     const currentTotal = await this.getCurrentTotal();
     const finalAmount = currentTotal + amountDelta;
     const now = new Date().toISOString();
     await db.runAsync(`UPDATE net_worth SET amount = ?, updated_at = ?`, [finalAmount, now]);
  }

  /**
   * Returns the date of the earliest anchor point in net_worth_history.
   * This is the "day zero" — no data should be shown before this date.
   */
  static async getFirstHistoryDate(): Promise<string | null> {
    const db = await getDBConnection();
    const result = await db.getFirstAsync<{ date: string }>(
      `SELECT date FROM net_worth_history ORDER BY date ASC LIMIT 1`
    );
    return result?.date ?? null;
  }

  /**
   * Returns the net worth at a given date, or null if the date is before
   * the earliest history anchor ("day zero"). Returning null tells the
   * chart to skip this point instead of showing extrapolated data.
   */
  static async getNetWorthAtDate(targetDate: string): Promise<number | null> {
    const db = await getDBConnection();
    
    // 1. Get the latest manual override on or before targetDate
    const overrideResult = await db.getFirstAsync(`
      SELECT amount, date FROM net_worth_history
      WHERE date <= ?
      ORDER BY date DESC
      LIMIT 1
    `, [targetDate]);
    
    if (overrideResult) {
      const overrideAmount = (overrideResult as any).amount;
      const overrideDate = (overrideResult as any).date;
      
      // Sum of all active transactions strictly AFTER the override date up to targetDate
      const results = await db.getFirstAsync(`
        SELECT SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END) as diff
        FROM transactions
        WHERE is_deleted = 0 AND direction != 'adj' AND date > ? AND date <= ?
      `, [overrideDate, targetDate]);
      
      const diff = (results as any)?.diff || 0;
      return overrideAmount + diff;
    }
    
    // 2. targetDate is BEFORE the first anchor in history → no data available.
    // Return null so the chart skips this point entirely.
    // (We never extrapolate backwards from the anchor — that was the source of wrong values.)
    return null;
  }

  /**
   * Automatically scans for any scheduled transactions that have matured (date <= today)
   * and applies them to the current Net Worth balance.
   */
  static async syncScheduledTransactions(): Promise<void> {
    try {
      const db = await getDBConnection();
      const todayStr = new Date().toISOString().split('T')[0];
      const lastSyncDate = await AsyncStorage.getItem('wolly_last_nw_sync_date');
      
      if (lastSyncDate) {
        if (lastSyncDate === todayStr) return; // already synced today
        
        // Find all active transactions that have matured (date > lastSyncDate AND date <= todayStr)
        const results = await db.getAllAsync(`
          SELECT amount, direction 
          FROM transactions 
          WHERE is_deleted = 0 
            AND direction != 'adj'
            AND date > ? 
            AND date <= ?
        `, [lastSyncDate, todayStr]);
        
        let delta = 0;
        for (const tx of results) {
          const txDelta = (tx as any).direction === 'in' ? (tx as any).amount : -(tx as any).amount;
          delta += txDelta;
        }
        
        if (delta !== 0) {
          await this.incrementTotal(delta);
          console.log(`[NetWorthRepository] Matured scheduled transactions applied. Delta: ${delta}`);
        }
      }
      
      // Update last sync date to today
      await AsyncStorage.setItem('wolly_last_nw_sync_date', todayStr);
    } catch (err) {
      console.error('[NetWorthRepository] Error syncing scheduled transactions:', err);
    }
  }

  static async getNetWorthHistory(dataPoints: { label: string, date?: string, day?: number, month?: number }[], type: 'daily' | 'monthly'): Promise<(number | null)[]> {
    const history: (number | null)[] = [];
    
    for (const point of dataPoints) {
      let targetDate = '';
      if (point.date) {
        targetDate = point.date;
      } else if (type === 'monthly' && point.month) {
        const year = new Date().getFullYear();
        targetDate = new Date(year, point.month, 0).toISOString().split('T')[0];
      } else {
        history.push(null);
        continue;
      }
      
      // Returns null for dates before day-zero anchor — chart will skip them
      const val = await this.getNetWorthAtDate(targetDate);
      history.push(val);
    }
    
    return history;
  }

  static async getAbsoluteNetWorthLimits(): Promise<{ max: number; min: number }> {
    const db = await getDBConnection();
    
    // Get all overrides
    const overrides = await db.getAllAsync<any>(`
      SELECT date, amount FROM net_worth_history
      ORDER BY date DESC
    `);
    
    // Get all transactions
    const txs = await db.getAllAsync<any>(`
      SELECT date, amount, direction FROM transactions
      WHERE is_deleted = 0 AND direction != 'adj'
      ORDER BY date DESC
    `);
    
    const currentTotal = await this.getCurrentTotal();
    
    let currentBalance = currentTotal;
    let maxVal = currentBalance;
    let minVal = currentBalance;
    
    const todayStr = new Date().toISOString().split('T')[0];
    let txIdx = 0;
    let overrideIdx = 0;
    
    // Find earliest date
    const earliestTxDate = txs.length > 0 ? txs[txs.length - 1].date : todayStr;
    const earliestOverrideDate = overrides.length > 0 ? overrides[overrides.length - 1].date : todayStr;
    const stopDate = earliestTxDate < earliestOverrideDate ? earliestTxDate : earliestOverrideDate;
    
    // Find latest date to start walking backwards
    const latestTxDate = txs.length > 0 ? txs[0].date : todayStr;
    const latestOverrideDate = overrides.length > 0 ? overrides[0].date : todayStr;
    const startDate = latestTxDate > latestOverrideDate ? (latestTxDate > todayStr ? latestTxDate : todayStr) : (latestOverrideDate > todayStr ? latestOverrideDate : todayStr);
    
    const dateCursor = new Date(startDate);
    const stopDateVal = new Date(stopDate);
    
    while (dateCursor >= stopDateVal) {
      const dateStr = dateCursor.toISOString().split('T')[0];
      
      // Check override
      while (overrideIdx < overrides.length && overrides[overrideIdx].date === dateStr) {
        currentBalance = overrides[overrideIdx].amount;
        overrideIdx++;
      }
      
      // Update max/min
      if (currentBalance > maxVal) maxVal = currentBalance;
      if (currentBalance < minVal) minVal = currentBalance;
      
      // Subtract transactions for this date when moving backwards
      while (txIdx < txs.length && txs[txIdx].date === dateStr) {
        const tx = txs[txIdx];
        const txDelta = tx.direction === 'in' ? tx.amount : -tx.amount;
        currentBalance -= txDelta;
        txIdx++;
      }
      
      dateCursor.setDate(dateCursor.getDate() - 1);
    }
    
    if (currentBalance > maxVal) maxVal = currentBalance;
    if (currentBalance < minVal) minVal = currentBalance;
    
    return { max: maxVal, min: minVal };
  }
}
