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
    await db.runAsync(`UPDATE net_worth SET amount = ?, updated_at = ?`, [newAmount, now]);
  }

  /**
   * Used for manual user-initiated adjustments (home screen / settings).
   * Updates net_worth locally and logs to Supabase.
   * Does NOT touch the transactions table.
   */
  static async recordManualAdjustment(newAmount: number): Promise<void> {
    const db = await getDBConnection();
    const currentTotal = await this.getCurrentTotal();
    const diff = newAmount - currentTotal;
    if (diff === 0) return;
    const now = new Date().toISOString();
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
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Sum of all active transactions from targetDate+1 up to today (excluding future scheduled ones)
    const results = await db.getFirstAsync(`
      SELECT SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END) as diff
      FROM transactions
      WHERE is_deleted = 0 AND direction != 'adj' AND date > ? AND date <= ?
    `, [targetDate, todayStr]);

    const diff = (results as any)?.diff || 0;
    return currentTotal - diff;
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

  static async getNetWorthHistory(dataPoints: { label: string, date?: string, day?: number, month?: number }[], type: 'daily' | 'monthly'): Promise<number[]> {
    const currentTotal = await this.getCurrentTotal();
    const history: number[] = [];
    
    // We iterate backwards to calculate net worth at each point
    // Net worth at point N = Current Total - Sum of changes after point N
    
    for (const point of dataPoints) {
      let targetDate = '';
      if (type === 'daily' && point.date) {
        targetDate = point.date;
      } else if (type === 'monthly' && point.month) {
        // Net worth at end of month
        const year = new Date().getFullYear(); // Simplified for now
        targetDate = new Date(year, point.month, 0).toISOString().split('T')[0];
      } else {
        // Fallback or label based
        history.push(currentTotal);
        continue;
      }
      
      const val = await this.getNetWorthAtDate(targetDate);
      history.push(val);
    }
    
    return history;
  }
}
