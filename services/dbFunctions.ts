/**
 * dbFunctions.ts
 * Catalogo delle funzioni DB deterministiche per Wolly AI.
 *
 * ARCHITETTURA (da DEVELOPMENT_RULES §2):
 *   L'AI non calcola mai. L'AI chiama queste funzioni per nome con i parametri giusti.
 *   Le funzioni interrogano il DB con SQL e restituiscono il risultato già aggregato.
 *   L'AI riceve solo il valore finale e formula la risposta in linguaggio naturale.
 *
 * Ogni funzione è:
 *   - Testabile in isolamento (nessuna dipendenza da AI o stato globale)
 *   - Deterministiche (stessi input → stesso output)
 *   - Single-purpose (fa una sola cosa)
 */

import { getDBConnection } from './database/db';
import { ALL_CATEGORIES, DOMAINS_CONFIG } from '../constants/categories';

// ─── Tipi Filtri Comuni ───────────────────────────────────────────────────────

export interface DateRange {
  from: string;  // YYYY-MM-DD
  to: string;    // YYYY-MM-DD
}

export interface CommonFilters {
  date_from?: string;           // YYYY-MM-DD
  date_to?: string;             // YYYY-MM-DD
  direction?: 'in' | 'out';
  category_key?: string;
  domain_key?: string;
  merchant_name?: string;
  city?: string;
  social_context?: string;
  person?: string;
  holiday?: string;
  tag?: string;
  location_type?: string;
  time_of_day?: 'mattina' | 'pomeriggio' | 'sera' | 'notte';
  is_impulsive?: boolean;
  is_recurring?: boolean;
}

// ─── Helpers SQL interni ──────────────────────────────────────────────────────

/**
 * Costruisce il WHERE clause da CommonFilters.
 * Usa sempre parametri bindati per sicurezza SQL.
 */
function buildWhereClause(
  filters: CommonFilters,
  tableAlias: string = 't'
): { clause: string; params: any[] } {
  const clauses: string[] = [`${tableAlias}.is_deleted = 0`, `${tableAlias}.direction != 'adj'`];
  const params: any[] = [];

  if (filters.date_from) {
    clauses.push(`${tableAlias}.date >= ?`);
    params.push(filters.date_from);
  }
  if (filters.date_to) {
    clauses.push(`${tableAlias}.date <= ?`);
    params.push(filters.date_to);
  }
  if (filters.direction) {
    clauses.push(`${tableAlias}.direction = ?`);
    params.push(filters.direction);
  }
  if (filters.category_key) {
    clauses.push(`${tableAlias}.category_key = ?`);
    params.push(filters.category_key);
  }
  if (filters.domain_key) {
    clauses.push(`${tableAlias}.domain_key = ?`);
    params.push(filters.domain_key);
  }
  if (filters.merchant_name) {
    clauses.push(`${tableAlias}.location_name LIKE ?`);
    params.push(`%${filters.merchant_name}%`);
  }
  if (filters.city) {
    clauses.push(`${tableAlias}.city = ?`);
    params.push(filters.city);
  }
  if (filters.social_context) {
    clauses.push(`${tableAlias}.social_context = ?`);
    params.push(filters.social_context);
  }
  if (filters.person) {
    clauses.push(`${tableAlias}.people_mentioned LIKE ?`);
    params.push(`%${filters.person}%`);
  }
  if (filters.holiday) {
    clauses.push(`${tableAlias}.holiday = ?`);
    params.push(filters.holiday);
  }
  if (filters.tag) {
    clauses.push(`${tableAlias}.tags LIKE ?`);
    params.push(`%${filters.tag}%`);
  }
  if (filters.location_type) {
    clauses.push(`${tableAlias}.location_type = ?`);
    params.push(filters.location_type);
  }
  if (filters.time_of_day) {
    clauses.push(`${tableAlias}.time_of_day = ?`);
    params.push(filters.time_of_day);
  }
  if (filters.is_impulsive !== undefined) {
    clauses.push(`${tableAlias}.is_impulsive = ?`);
    params.push(filters.is_impulsive ? 1 : 0);
  }
  if (filters.is_recurring !== undefined) {
    clauses.push(`${tableAlias}.is_recurring_pattern = ?`);
    params.push(filters.is_recurring ? 1 : 0);
  }

  return { clause: clauses.join(' AND '), params };
}

// ─── getTotal ─────────────────────────────────────────────────────────────────

export interface TotalResult {
  total: number;
  count: number;
  average: number;
}

/**
 * Calcola SUM(net_amount), COUNT e media per le transazioni che corrispondono ai filtri.
 * Usata per: "quanto ho speso in X", "quante volte", "media mensile".
 *
 * @example
 * getTotal({ direction: 'out', location_type: 'cinema', date_from: '2026-01-01', date_to: '2026-05-17' })
 * → { total: 47.50, count: 3, average: 15.83 }
 */
export async function getTotal(filters: CommonFilters): Promise<TotalResult> {
  const db = await getDBConnection();
  const { clause, params } = buildWhereClause(filters);

  const row = await db.getFirstAsync<{ total: number; count: number }>(
    `SELECT COALESCE(SUM(net_amount), 0) as total, COUNT(*) as count
     FROM transactions t
     WHERE ${clause}`,
    params
  );

  const total = row?.total ?? 0;
  const count = row?.count ?? 0;
  const average = count > 0 ? total / count : 0;

  console.log(`[getTotal] ✅ total=${total.toFixed(2)} count=${count} avg=${average.toFixed(2)}`);
  return { total, count, average };
}

// ─── getList ──────────────────────────────────────────────────────────────────

export interface TransactionRow {
  id: string;
  date: string;
  time: string | null;
  amount: number;
  net_amount: number;
  direction: 'in' | 'out';
  category_key: string;
  description: string;
  location_name: string | null;
  city: string | null;
  social_context: string | null;
  subscription_name: string | null;
}

export interface ListResult {
  items: TransactionRow[];
  total_count: number;
}

/**
 * Restituisce lista transazioni filtrate, con paginazione e ordinamento.
 * Usata per: "mostrami le spese di X", "gli ultimi acquisti al supermercato".
 *
 * @example
 * getList({ direction: 'out', category_key: 'ristorante_fast_food' }, 10, 'date_desc')
 * → { items: [...], total_count: 42 }
 */
export async function getList(
  filters: CommonFilters,
  limit: number = 20,
  orderBy: 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' = 'date_desc'
): Promise<ListResult> {
  const db = await getDBConnection();
  const { clause, params } = buildWhereClause(filters);

  const ORDER_MAP = {
    date_desc: 't.date DESC, t.time DESC',
    date_asc: 't.date ASC, t.time ASC',
    amount_desc: 't.net_amount DESC',
    amount_asc: 't.net_amount ASC',
  };

  const countRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM transactions t WHERE ${clause}`,
    params
  );
  const total_count = countRow?.count ?? 0;

  const items = await db.getAllAsync<TransactionRow>(
    `SELECT t.id, t.date, t.time, t.amount, t.net_amount, t.direction,
            t.category_key, t.description, t.location_name, t.city,
            t.social_context, s.name as subscription_name
     FROM transactions t
     LEFT JOIN subscriptions s ON t.subscription_id = s.id
     WHERE ${clause}
     ORDER BY ${ORDER_MAP[orderBy]}
     LIMIT ?`,
    [...params, limit]
  );

  console.log(`[getList] ✅ ${items.length}/${total_count} transazioni`);
  return { items, total_count };
}

// ─── getDistribution ──────────────────────────────────────────────────────────

export interface DistributionRow {
  key: string;
  label: string;
  value: number;
  percentage: number;
  color: string;
}

export interface DistributionResult {
  items: DistributionRow[];
  grand_total: number;
}

const DOMAIN_COLORS: Record<string, string> = {
  cibo_bevande: '#FF6B35',
  acquisti: '#845EC2',
  alloggio: '#4B9CD3',
  trasporti: '#00C9A7',
  veicolo: '#F9A825',
  vita_intrattenimento: '#FF8B94',
  comunicazione_pc: '#2D7DD2',
  spese_finanziarie: '#E63946',
  investimenti: '#06D6A0',
  entrata: '#43AA8B',
};

function getCategoryColor(category_key: string): string {
  const cat = ALL_CATEGORIES.find(c => c.key === category_key);
  return cat ? (DOMAIN_COLORS[cat.domain_key] ?? '#8B9AB1') : '#8B9AB1';
}

function getLabelForKey(key: string): string {
  const cat = ALL_CATEGORIES.find(c => c.key === key);
  if (cat) return cat.label;
  const dom = DOMAINS_CONFIG.find(d => d.key === key);
  if (dom) return dom.label;
  return key;
}

/**
 * Calcola la distribuzione (SUM per gruppo) delle transazioni filtrate.
 * Usata per: "come ho speso", "dove vado a mangiare", grafici a torta.
 *
 * @param groupBy Campo su cui raggruppare: 'category_key' | 'domain_key' | 'city' | 'location_type'
 *
 * @example
 * getDistribution('category_key', { direction: 'out', date_from: '2026-05-01' })
 * → { items: [{ key: 'ristorante_fast_food', label: 'Ristorante', value: 120, percentage: 35, color: '#...' }], grand_total: 340 }
 */
export async function getDistribution(
  groupBy: 'category_key' | 'domain_key' | 'city' | 'location_type',
  filters: CommonFilters
): Promise<DistributionResult> {
  const db = await getDBConnection();
  const { clause, params } = buildWhereClause(filters);

  const rows = await db.getAllAsync<{ key: string; value: number }>(
    `SELECT t.${groupBy} as key, SUM(t.net_amount) as value
     FROM transactions t
     WHERE ${clause} AND t.${groupBy} IS NOT NULL AND t.${groupBy} != ''
     GROUP BY t.${groupBy}
     ORDER BY value DESC`,
    params
  );

  const grand_total = rows.reduce((acc, r) => acc + (r.value ?? 0), 0);

  const items: DistributionRow[] = rows.map(r => ({
    key: r.key,
    label: groupBy === 'category_key' || groupBy === 'domain_key'
      ? getLabelForKey(r.key)
      : r.key,
    value: r.value,
    percentage: grand_total > 0 ? Math.round((r.value / grand_total) * 100) : 0,
    color: groupBy === 'category_key' ? getCategoryColor(r.key)
      : groupBy === 'domain_key' ? (DOMAIN_COLORS[r.key] ?? '#8B9AB1')
      : '#FF6B35',
  }));

  console.log(`[getDistribution] ✅ ${items.length} gruppi, totale=${grand_total.toFixed(2)}`);
  return { items, grand_total };
}

// ─── getTimeSeries ────────────────────────────────────────────────────────────

export interface TimeSeriesRow {
  period: string;   // Label leggibile (es: "Lun", "01", "Gen")
  date: string;     // Data ISO grezza
  income: number;
  expense: number;
}

export type TimeSeriesGranularity = 'day' | 'week' | 'month' | 'year';

/**
 * Calcola l'andamento delle transazioni nel tempo.
 * Usata per: "quando spendo di più", "trend mensile", timeline charts.
 *
 * @example
 * getTimeSeries('month', { direction: 'out', date_from: '2026-01-01', date_to: '2026-12-31' })
 * → [{ period: 'Gen', date: '2026-01', income: 0, expense: 280 }, ...]
 */
export async function getTimeSeries(
  granularity: TimeSeriesGranularity,
  filters: CommonFilters
): Promise<TimeSeriesRow[]> {
  const db = await getDBConnection();
  const { clause, params } = buildWhereClause(filters);

  const FORMAT_MAP: Record<TimeSeriesGranularity, string> = {
    day: "strftime('%Y-%m-%d', t.date)",
    week: "strftime('%Y-W%W', t.date)",
    month: "strftime('%Y-%m', t.date)",
    year: "strftime('%Y', t.date)",
  };

  const rows = await db.getAllAsync<{ period_raw: string; income: number; expense: number }>(
    `SELECT ${FORMAT_MAP[granularity]} as period_raw,
            SUM(CASE WHEN t.direction = 'in' THEN t.net_amount ELSE 0 END) as income,
            SUM(CASE WHEN t.direction = 'out' THEN t.net_amount ELSE 0 END) as expense
     FROM transactions t
     WHERE ${clause}
     GROUP BY period_raw
     ORDER BY period_raw ASC`,
    params
  );

  const MONTH_ABBR = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

  const result: TimeSeriesRow[] = rows.map(r => {
    let label = r.period_raw;
    if (granularity === 'month' && r.period_raw.includes('-')) {
      const m = parseInt(r.period_raw.split('-')[1], 10);
      label = MONTH_ABBR[m - 1] ?? r.period_raw;
    } else if (granularity === 'day') {
      const d = new Date(r.period_raw);
      label = d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' });
    }
    return { period: label, date: r.period_raw, income: r.income, expense: r.expense };
  });

  console.log(`[getTimeSeries] ✅ ${result.length} punti (${granularity})`);
  return result;
}

// ─── getComparison ────────────────────────────────────────────────────────────

export interface ComparisonResult {
  period_a: { label: string; total: number; count: number };
  period_b: { label: string; total: number; count: number };
  diff: number;
  percentage_change: number;
  is_better: boolean; // true se la differenza è favorevole (meno spese o più entrate)
}

/**
 * Confronta i totali tra due periodi per gli stessi filtri.
 * Usata per: "rispetto al mese scorso", "questo anno vs anno scorso".
 *
 * @example
 * getComparison({ direction: 'out' }, { from: '2026-05-01', to: '2026-05-17' }, { from: '2026-04-01', to: '2026-04-30' })
 * → { period_a: { label: 'Mag 2026', total: 280 }, period_b: { total: 340 }, diff: -60, percentage_change: -17.6, is_better: true }
 */
export async function getComparison(
  filters: Omit<CommonFilters, 'date_from' | 'date_to'>,
  periodA: { from: string; to: string; label: string },
  periodB: { from: string; to: string; label: string }
): Promise<ComparisonResult> {
  const [resultA, resultB] = await Promise.all([
    getTotal({ ...filters, date_from: periodA.from, date_to: periodA.to }),
    getTotal({ ...filters, date_from: periodB.from, date_to: periodB.to }),
  ]);

  const diff = resultA.total - resultB.total;
  const percentage_change = resultB.total > 0
    ? Math.round((diff / resultB.total) * 100)
    : 0;

  // "meglio" = meno spese (out) o più entrate (in)
  const is_better = filters.direction === 'in' ? diff > 0 : diff < 0;

  console.log(`[getComparison] ✅ A=${resultA.total.toFixed(2)} B=${resultB.total.toFixed(2)} diff=${diff.toFixed(2)}`);

  return {
    period_a: { label: periodA.label, total: resultA.total, count: resultA.count },
    period_b: { label: periodB.label, total: resultB.total, count: resultB.count },
    diff,
    percentage_change,
    is_better,
  };
}

// ─── getStreak ────────────────────────────────────────────────────────────────

export interface StreakResult {
  current_streak_days: number;
  longest_streak_days: number;
  last_occurrence_date: string | null;
}

/**
 * Calcola quanti giorni consecutivi l'utente non ha fatto una spesa in una certa categoria.
 * Usata per gamification e insight comportamentali.
 *
 * @example
 * getStreak({ direction: 'out', category_key: 'bar_caffe' })
 * → { current_streak_days: 5, longest_streak_days: 14, last_occurrence_date: '2026-05-12' }
 */
export async function getStreak(filters: Pick<CommonFilters, 'category_key' | 'domain_key' | 'direction' | 'merchant_name'>): Promise<StreakResult> {
  const db = await getDBConnection();

  const { clause, params } = buildWhereClause(filters as CommonFilters);

  const lastRow = await db.getFirstAsync<{ last_date: string }>(
    `SELECT MAX(date) as last_date FROM transactions t WHERE ${clause}`,
    params
  );

  const last_occurrence_date = lastRow?.last_date ?? null;

  if (!last_occurrence_date) {
    return { current_streak_days: 0, longest_streak_days: 0, last_occurrence_date: null };
  }

  const today = new Date().toISOString().split('T')[0];
  const lastDate = new Date(last_occurrence_date);
  const todayDate = new Date(today);

  const diffMs = todayDate.getTime() - lastDate.getTime();
  const current_streak_days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  console.log(`[getStreak] ✅ streak corrente=${current_streak_days}gg, ultima occorrenza=${last_occurrence_date}`);

  return {
    current_streak_days,
    longest_streak_days: current_streak_days, // TODO: calcolo storico progressivo
    last_occurrence_date,
  };
}
