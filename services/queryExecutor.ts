/**
 * queryExecutor.ts
 * Fase 2 della pipeline AI: riceve il QueryIntent parsato dall'AI
 * e chiama le funzioni DB deterministiche del catalogo (dbFunctions.ts).
 *
 * FLUSSO (da DEVELOPMENT_RULES §2):
 *   AI → parseQueryIntent → [questo file] → dbFunctions → risultato numerico → AI formula risposta
 *
 * L'AI non vede mai dati grezzi. Riceve solo il valore aggregato finale.
 */

import { SubscriptionRepository, Subscription } from './database/repositories/SubscriptionRepository';
import { NetWorthRepository } from './database/repositories/NetWorthRepository';
import { ALL_CATEGORIES, DOMAINS_CONFIG } from '../constants/categories';
import { QueryIntent, QueryPeriod } from './aiQueryParser';
import { MerchantResolver } from './merchantResolver';
import {
  CommonFilters,
  getTotal,
  getList,
  getDistribution,
  getTimeSeries,
  getComparison,
  DistributionRow,
} from './dbFunctions';

// ─── Output Types ─────────────────────────────────────────────────────────────

export interface DistributionItem {
  category_key: string;
  label: string;
  value: number;
  percentage: number;
  color: string;
}

export interface ExecutionResult {
  period_label: string;
  archetype: 'total' | 'distribution' | 'list' | 'timeline' | 'text' | 'subscriptions';
  intent: QueryIntent;
  // Archetipo: QUANTO
  total?: number;
  comparison?: {
    prev_total: number;
    diff: number;
    percentage: number;
    is_better: boolean;
  };
  // Archetipo: COME
  distribution_items?: DistributionItem[];
  // Archetipo: COSA
  transactions?: any[];
  transaction_count?: number;
  // Archetipo: QUANDO
  timeline_data?: { label: string; value: number | null }[];
  // Archetipo: ABBONAMENTI
  subscriptions?: Subscription[];
}

// ─── Period → DateRange ───────────────────────────────────────────────────────

export function periodToDateRange(period: QueryPeriod): { from: string; to: string } {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  if (period.type === 'week') {
    const from = new Date(now);
    from.setDate(now.getDate() - 7);
    return { from: from.toISOString().split('T')[0], to: today };
  }

  if (period.type === 'month') {
    const y = period.year ?? now.getFullYear();
    const m = period.month ?? (now.getMonth() + 1);
    const from = `${y}-${String(m).padStart(2, '0')}-01`;
    // Calcola l'ultimo giorno del mese
    const lastDay = new Date(y, m, 0).getDate();
    const to = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { from, to };
  }

  if (period.type === 'year') {
    const y = period.year ?? now.getFullYear();
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }

  if (period.type === 'custom' && period.from && period.to) {
    return { from: period.from, to: period.to };
  }

  // 'all' → tutto lo storico
  return { from: '2000-01-01', to: today };
}

function buildPeriodLabel(period: QueryPeriod): string {
  const now = new Date();
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  if (period.type === 'week') return 'This week';
  if (period.type === 'month') {
    const m = period.month ?? (now.getMonth() + 1);
    const y = period.year ?? now.getFullYear();
    const isCurrentMonth = m === (now.getMonth() + 1) && y === now.getFullYear();
    return isCurrentMonth ? 'This month' : `${MONTH_NAMES[m - 1]} ${y}`;
  }
  if (period.type === 'year') {
    const y = period.year ?? now.getFullYear();
    return y === now.getFullYear() ? 'This year' : `Year ${y}`;
  }
  if (period.type === 'custom' && period.from && period.to) {
    return `From ${period.from} to ${period.to}`;
  }
  return 'All time';
}

/**
 * Costruisce i CommonFilters da un QueryIntent già parsato dall'AI.
 * Separare questa responsabilità rende il codice testabile indipendentemente.
 */
function intentToFilters(intent: QueryIntent, resolvedMerchant: string | null): CommonFilters {
  let { from, to } = periodToDateRange(intent.period);

  if (intent.is_scheduled_filter) {
    const today = new Date().toISOString().split('T')[0];
    if (intent.period.type === 'all') {
      from = today;
      to = '2099-12-31';
    } else {
      if (from < today) {
        from = today;
      }
    }
  }

  return {
    date_from: from,
    date_to: to,
    direction: intent.direction === 'both' ? undefined : intent.direction,
    category_key: intent.category_filter || undefined,
    domain_key: (!intent.category_filter && intent.domain_filter) ? intent.domain_filter : undefined,
    merchant_name: resolvedMerchant || intent.merchant_filter || undefined,
    city: intent.city_filter || undefined,
    social_context: intent.social_context_filter || undefined,
    person: intent.person_filter || undefined,
    holiday: intent.holiday_filter || undefined,
    tag: intent.tag_filter || undefined,
    is_recurring: intent.is_recurring_filter || undefined,
    is_scheduled: intent.is_scheduled_filter || undefined,
  };
}

// ─── Main Executor ────────────────────────────────────────────────────────────

export async function executeQueryIntent(intent: QueryIntent): Promise<ExecutionResult> {
  const periodLabel = intent.period_label || buildPeriodLabel(intent.period);

  // ── MERCHANT RESOLUTION ─────────────────────────────────────────────────────
  let resolvedMerchant: string | null = null;
  if (intent.merchant_filter) {
    resolvedMerchant = await MerchantResolver.resolve(intent.merchant_filter);
    console.log(`🔍 [EXECUTOR] Merchant: "${intent.merchant_filter}" → ${resolvedMerchant || 'NOT FOUND'}`);
  }

  const filters = intentToFilters(intent, resolvedMerchant);
  console.log(`⚙️ [EXECUTOR] Archetype: ${intent.archetype} | Period: ${periodLabel} | Filters:`, filters);

  // ── SUBJECT: NET_WORTH ──────────────────────────────────────────────────────
  if (intent.subject === 'net_worth') {
    if (intent.archetype === 'total') {
      const { from, to } = periodToDateRange(intent.period);
      const todayISO = new Date().toISOString().split('T')[0];
      let finalValue: number;
      if (to >= todayISO) {
        finalValue = await NetWorthRepository.getCurrentTotal();
      } else {
        finalValue = (await NetWorthRepository.getNetWorthAtDate(to)) ?? 0;
      }
      
      let comparison: ExecutionResult['comparison'] = undefined;
      if (intent.comparison_period) {
        // Il Net Worth a inizio periodo (from) equivale essenzialmente a quello di fine periodo precedente
        const prevValue = (await NetWorthRepository.getNetWorthAtDate(from)) ?? 0;
        const diff = finalValue - prevValue;
        comparison = {
          prev_total: prevValue,
          diff: diff,
          percentage: prevValue !== 0 ? Math.abs((diff / prevValue) * 100) : 0,
          is_better: diff >= 0,
        };
      }
      
      return { archetype: 'total', period_label: periodLabel, total: finalValue, comparison, intent };
    }
    
    if (intent.archetype === 'timeline') {
      const granularity = intent.period.type === 'year' ? 'month' : 'day';
      const rows = await getTimeSeries(granularity, filters); 
      
      const dataPoints = rows.map(r => ({
         label: r.period,
         date: granularity === 'day' ? r.date : undefined,
         month: granularity === 'month' ? parseInt(r.date.split('-')[1], 10) : undefined,
      }));
      
      const nwHistory = await NetWorthRepository.getNetWorthHistory(dataPoints, granularity === 'day' ? 'daily' : 'monthly');
      const timelineData = rows.map((r, i) => ({ label: r.period, value: nwHistory[i] }));
      
      console.log(`📈 [EXECUTOR] Net Worth Timeline: ${timelineData.length} punti (${granularity})`);
      return { archetype: 'timeline', period_label: periodLabel, timeline_data: timelineData, intent };
    }
    
    const totalNw = await NetWorthRepository.getCurrentTotal();
    return { archetype: 'total', period_label: periodLabel, total: totalNw, intent };
  }

  // ── ARCHETYPE: TEXT ─────────────────────────────────────────────────────────
  if (intent.archetype === 'text') {
    return { archetype: 'text', period_label: periodLabel, intent };
  }

  // ── ARCHETYPE: SUBSCRIPTIONS ────────────────────────────────────────────────
  if (intent.archetype === 'subscriptions') {
    const allSubs = await SubscriptionRepository.getAll();
    console.log(`📅 [EXECUTOR] Subscriptions: ${allSubs.length} trovati`);
    return { archetype: 'subscriptions', period_label: 'Attuali', subscriptions: allSubs, intent };
  }

  // ── ARCHETYPE: TOTAL ────────────────────────────────────────────────────────
  if (intent.archetype === 'total') {
    const agg = intent.aggregation_type || 'total';

    // getTotal fa SUM + COUNT + AVG in una singola query SQL
    const result = await getTotal(filters);

    let finalValue: number;
    if (agg === 'count') finalValue = result.count;
    else if (agg === 'average') finalValue = result.average;
    else finalValue = result.total;

    // Confronto con periodo precedente (solo per 'total')
    let comparison: ExecutionResult['comparison'] = undefined;
    if (intent.comparison_period && agg === 'total') {
      const { from: currFrom, to: currTo } = periodToDateRange(intent.period);

      // Calcola il periodo di confronto
      const now = new Date();
      let prevFrom: string, prevTo: string, prevLabel: string;

      if (intent.comparison_period === 'prev_month') {
        const prevDate = new Date(
          intent.period.year ?? now.getFullYear(),
          (intent.period.month ?? now.getMonth() + 1) - 2,
          1
        );
        const prevY = prevDate.getFullYear();
        const prevM = prevDate.getMonth() + 1;
        prevFrom = `${prevY}-${String(prevM).padStart(2, '0')}-01`;
        const lastDay = new Date(prevY, prevM, 0).getDate();
        prevTo = `${prevY}-${String(prevM).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        prevLabel = buildPeriodLabel({ type: 'month', year: prevY, month: prevM });
      } else {
        const y = (intent.period.year ?? now.getFullYear()) - 1;
        prevFrom = `${y}-01-01`;
        prevTo = `${y}-12-31`;
        prevLabel = `Year ${y}`;
      }

      const compResult = await getComparison(
        { direction: filters.direction, category_key: filters.category_key, domain_key: filters.domain_key, city: filters.city },
        { from: currFrom, to: currTo, label: periodLabel },
        { from: prevFrom, to: prevTo, label: prevLabel }
      );

      const is_better = intent.direction === 'in' ? compResult.diff > 0 : compResult.diff < 0;
      comparison = {
        prev_total: compResult.period_b.total,
        diff: compResult.diff,
        percentage: Math.abs(compResult.percentage_change),
        is_better,
      };
    }

    console.log(`💰 [EXECUTOR] Total (${agg}): ${finalValue.toFixed(2)}`);
    return { archetype: 'total', period_label: periodLabel, total: finalValue, comparison, intent };
  }

  // ── ARCHETYPE: DISTRIBUTION ─────────────────────────────────────────────────
  if (intent.archetype === 'distribution') {
    const groupBy = intent.group_by === 'city' ? 'city'
      : intent.category_filter ? 'category_key'    // zoom su sottocategorie se specificata
      : 'category_key';

    const result = await getDistribution(groupBy as any, filters);

    const items: DistributionItem[] = result.items.slice(0, 8).map((r: DistributionRow) => ({
      category_key: r.key,
      label: r.label,
      value: r.value,
      percentage: r.percentage,
      color: r.color,
    }));

    console.log(`📊 [EXECUTOR] Distribution: ${items.length} gruppi, totale=${result.grand_total.toFixed(2)}`);
    return { archetype: 'distribution', period_label: periodLabel, distribution_items: items, intent };
  }

  // ── ARCHETYPE: LIST ─────────────────────────────────────────────────────────
  if (intent.archetype === 'list') {
    const orderBy = intent.sort_by === 'amount_desc' ? 'amount_desc'
      : intent.sort_by === 'amount_asc' ? 'amount_asc'
      : 'date_desc';

    const result = await getList(filters, intent.limit ?? 20, orderBy);

    console.log(`📋 [EXECUTOR] List: ${result.items.length}/${result.total_count}`);
    return {
      archetype: 'list',
      period_label: periodLabel,
      transactions: result.items,
      transaction_count: result.total_count,
      intent,
    };
  }

  // ── ARCHETYPE: TIMELINE ─────────────────────────────────────────────────────
  if (intent.archetype === 'timeline') {
    const granularity = intent.period.type === 'year' ? 'month'
      : intent.period.type === 'month' ? 'day'
      : 'day';

    const rows = await getTimeSeries(granularity, filters);

    const directionKey = intent.direction === 'in' ? 'income' : 'expense';
    const timelineData = rows.map(r => ({ label: r.period, value: r[directionKey] }));

    console.log(`📈 [EXECUTOR] Timeline: ${timelineData.length} punti (${granularity})`);
    return { archetype: 'timeline', period_label: periodLabel, timeline_data: timelineData, intent };
  }

  return { archetype: 'text', period_label: periodLabel, intent };
}
