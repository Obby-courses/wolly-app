import { TransactionRepository } from './database/repositories/TransactionRepository';
import { SubscriptionRepository, Subscription } from './database/repositories/SubscriptionRepository';
import { DOMAINS_CONFIG, ALL_CATEGORIES } from '../constants/categories';
import { QueryIntent, QueryPeriod } from './aiQueryParser';
import { MerchantResolver } from './merchantResolver';

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
  intent: QueryIntent; // NUOVO: Serve per la Feedback Bar
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
  timeline_data?: { label: string; value: number }[];
  // Archetipo: ABBONAMENTI
  subscriptions?: Subscription[];
}

// ─── Category Color Map ───────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
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
  if (cat) return CATEGORY_COLORS[cat.domain_key] || '#8B9AB1';
  return CATEGORY_COLORS[category_key] || '#8B9AB1';
}

function getCategoryLabel(category_key: string): string {
  const cat = ALL_CATEGORIES.find(c => c.key === category_key);
  if (cat) return cat.label;
  const domain = DOMAINS_CONFIG.find(d => d.key === category_key);
  if (domain) return domain.label;
  return category_key;
}

// ─── Period Resolver ──────────────────────────────────────────────────────────

function periodToRepoArgs(period: QueryPeriod): {
  timeRange: 'Settimana' | 'Mese' | 'Anno' | 'Tutto';
  baseDate: string;
} {
  const now = new Date();
  const todayISO = now.toISOString().split('T')[0];

  if (period.type === 'week') {
    return { timeRange: 'Settimana', baseDate: todayISO };
  }
  if (period.type === 'month') {
    const y = period.year ?? now.getFullYear();
    const m = period.month ?? (now.getMonth() + 1);
    const baseDate = `${y}-${String(m).padStart(2, '0')}-01`;
    return { timeRange: 'Mese', baseDate };
  }
  if (period.type === 'year') {
    const y = period.year ?? now.getFullYear();
    return { timeRange: 'Anno', baseDate: `${y}-01-01` };
  }
  if (period.type === 'custom' && period.from) {
    // custom: usiamo Tutto ma filtriamo manualmente dopo
    return { timeRange: 'Tutto', baseDate: todayISO };
  }
  return { timeRange: 'Tutto', baseDate: todayISO };
}

function buildPeriodLabel(period: QueryPeriod): string {
  const now = new Date();
  const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

  if (period.type === 'week') return 'Questa settimana';
  if (period.type === 'month') {
    const m = period.month ?? (now.getMonth() + 1);
    const y = period.year ?? now.getFullYear();
    const isCurrentMonth = m === (now.getMonth() + 1) && y === now.getFullYear();
    return isCurrentMonth ? 'Questo mese' : `${monthNames[m - 1]} ${y}`;
  }
  if (period.type === 'year') {
    const y = period.year ?? now.getFullYear();
    return y === now.getFullYear() ? 'Quest\'anno' : `Anno ${y}`;
  }
  if (period.type === 'custom' && period.from && period.to) {
    return `Dal ${period.from} al ${period.to}`;
  }
  return 'Tutta la storia';
}

// ─── Comparison Helper ────────────────────────────────────────────────────────

async function fetchComparisonTotal(
  period: QueryPeriod,
  comparisonType: 'prev_month' | 'prev_year',
  direction: 'in' | 'out',
  categoryFilter?: string,
  domainFilter?: string,
  cityFilter?: string,
  socialContextFilter?: string,
  personFilter?: string,
  holidayFilter?: string,
  tagFilter?: string
): Promise<number> {
  const now = new Date();
  let compPeriod: QueryPeriod;

  if (comparisonType === 'prev_month') {
    const prevDate = new Date(now.getFullYear(), (period.month ?? now.getMonth() + 1) - 2, 1);
    compPeriod = { type: 'month', year: prevDate.getFullYear(), month: prevDate.getMonth() + 1 };
  } else {
    const y = period.year ?? now.getFullYear();
    compPeriod = { type: 'year', year: y - 1 };
  }

  const { timeRange, baseDate } = periodToRepoArgs(compPeriod);
  const dist = await TransactionRepository.getCategoryDistribution(timeRange, direction, baseDate, {
    city: cityFilter,
    socialContext: socialContextFilter,
    personName: personFilter,
    holiday: holidayFilter,
    tag: tagFilter
  });

  if (categoryFilter) {
    return dist.find(d => d.category_key === categoryFilter)?.total ?? 0;
  }
  if (domainFilter) {
    return dist.filter(d => {
      const cat = ALL_CATEGORIES.find(c => c.key === d.category_key);
      return cat?.domain_key === domainFilter;
    }).reduce((a, c) => a + c.total, 0);
  }
  return dist.reduce((a, c) => a + c.total, 0);
}

// ─── Main Executor ────────────────────────────────────────────────────────────

export async function executeQueryIntent(intent: QueryIntent): Promise<ExecutionResult> {
  const periodLabel = intent.period_label || buildPeriodLabel(intent.period);
  const { timeRange, baseDate } = periodToRepoArgs(intent.period);
  const direction = intent.direction === 'both' ? 'out' : intent.direction;

  // ── RISOLUZIONE MERCHANT (Fase Critica) ─────────────────────────────────────
  let resolvedMerchant: string | null = null;
  if (intent.merchant_filter) {
    resolvedMerchant = await MerchantResolver.resolve(intent.merchant_filter);
    console.log(`🔍 [EXECUTOR] Merchant Resolution: "${intent.merchant_filter}" -> ${resolvedMerchant || 'NOT FOUND'}`);
  }

  // ── ARCHETYPE: TEXT ─────────────────────────────────────────────────────────
  if (intent.archetype === 'text') {
    return { archetype: 'text', period_label: periodLabel, intent };
  }

  // ── ARCHETYPE: SUBSCRIPTIONS ────────────────────────────────────────────────
  if (intent.archetype === 'subscriptions') {
    const allSubs = await SubscriptionRepository.getAll();
    const active = allSubs.filter(s => s.is_active);
    console.log(`📅 [EXECUTOR] Subscriptions: ${active.length} active found`);
    return {
      archetype: 'subscriptions',
      period_label: 'Attuali',
      subscriptions: allSubs,
      intent
    };
  }

  // ── ARCHETYPE: TOTAL (Aggregato Unico) ──────────────────────────────────────
  if (intent.archetype === 'total') {
    const directions: ('in' | 'out')[] = intent.direction === 'both' ? ['in', 'out'] : [intent.direction];
    
    // Per calcolare AVG o COUNT, dobbiamo recuperare le transazioni filtrate
    const filters = {
      direction: intent.direction !== 'both' ? intent.direction : undefined,
      category_key: intent.category_filter,
      merchant_name: resolvedMerchant || intent.merchant_filter || undefined, // FIX: Fallback al nome originale
      city: intent.city_filter,
      social_context: intent.social_context_filter,
      person: intent.person_filter,
      holiday: intent.holiday_filter,
      tag: intent.tag_filter,
    };
    
    const transactions = await TransactionRepository.getFilteredTransactions(timeRange, filters, 'date', baseDate);
    
    // Filtraggio extra per Domain (se applicabile)
    let finalTransactions = transactions;
    if (!intent.category_filter && intent.domain_filter) {
      finalTransactions = transactions.filter(t => {
        const cat = ALL_CATEGORIES.find(c => c.key === t.category_key);
        return cat?.domain_key === intent.domain_filter;
      });
    }

    let finalValue = 0;
    const agg = intent.aggregation_type || 'total';

    if (agg === 'count') {
      finalValue = finalTransactions.length;
    } else if (agg === 'average') {
      const sum = finalTransactions.reduce((a, c) => a + c.amount, 0);
      finalValue = finalTransactions.length > 0 ? sum / finalTransactions.length : 0;
    } else {
      // Sum
      finalValue = finalTransactions.reduce((a, c) => a + c.amount, 0);
    }

    // Comparison (solo per Somma totale per ora)
    let comparison: ExecutionResult['comparison'] = undefined;
    if (intent.comparison_period && agg === 'total') {
      const prevTotal = await fetchComparisonTotal(
        intent.period, intent.comparison_period, direction,
        intent.category_filter, intent.domain_filter, intent.city_filter, intent.social_context_filter, intent.person_filter, intent.holiday_filter, intent.tag_filter
      );
      const diff = finalValue - prevTotal;
      const percentage = prevTotal > 0 ? Math.abs((diff / prevTotal) * 100) : 0;
      const is_better = direction === 'out' ? diff < 0 : diff > 0;
      comparison = { prev_total: prevTotal, diff, percentage, is_better };
    }

    console.log(`💰 [EXECUTOR] Total (${agg}): ${finalValue.toFixed(2)} (${periodLabel})`);
    return { archetype: 'total', period_label: periodLabel, total: finalValue, comparison, intent };
  }

  // ── ARCHETYPE: DISTRIBUTION ─────────────────────────────────────────────────
  if (intent.archetype === 'distribution') {
    if (intent.group_by === 'city') {
      const dist = await TransactionRepository.getCityDistribution(timeRange, direction, baseDate, {
        category_key: intent.category_filter,
        socialContext: intent.social_context_filter,
        personName: intent.person_filter,
        merchantName: resolvedMerchant || intent.merchant_filter || undefined,
        holiday: intent.holiday_filter,
        tag: intent.tag_filter
      });
      const grandTotal = dist.reduce((a, c) => a + c.total, 0);
      const items: DistributionItem[] = dist.slice(0, 8).map(d => ({
        category_key: d.city,
        label: d.city,
        value: d.total,
        percentage: grandTotal > 0 ? Math.round((d.total / grandTotal) * 100) : 0,
        color: '#FF6B35',
      }));
      console.log(`📊 [EXECUTOR] City Distribution: ${items.length} cities`);
      return { archetype: 'distribution', period_label: periodLabel, distribution_items: items, intent };
    }

    const dist = await TransactionRepository.getCategoryDistribution(timeRange, direction, baseDate, {
      city: intent.city_filter,
      socialContext: intent.social_context_filter,
      personName: intent.person_filter,
      merchantName: resolvedMerchant || intent.merchant_filter || undefined,
      holiday: intent.holiday_filter,
      tag: intent.tag_filter
    });

    let filtered = dist;
    if (intent.category_filter) {
      filtered = dist.filter(d => d.category_key === intent.category_filter);
    } else if (intent.domain_filter) {
      filtered = dist.filter(d => {
        const cat = ALL_CATEGORIES.find(c => c.key === d.category_key);
        return cat?.domain_key === intent.domain_filter;
      });
    }

    const grandTotal = filtered.reduce((a, c) => a + c.total, 0);
    const items: DistributionItem[] = filtered.slice(0, 8).map(d => ({
      category_key: d.category_key,
      label: getCategoryLabel(d.category_key),
      value: d.total,
      percentage: grandTotal > 0 ? Math.round((d.total / grandTotal) * 100) : 0,
      color: getCategoryColor(d.category_key),
    }));

    return { archetype: 'distribution', period_label: periodLabel, distribution_items: items, intent };
  }

  // ── ARCHETYPE: LIST ─────────────────────────────────────────────────────────
  if (intent.archetype === 'list') {
    const filters: any = {
      direction: intent.direction !== 'both' ? intent.direction : undefined,
      category_key: intent.category_filter,
      merchant_name: resolvedMerchant || intent.merchant_filter || undefined, // FIX: Fallback al nome originale
      city: intent.city_filter,
      social_context: intent.social_context_filter,
      person: intent.person_filter,
    };

    const sortBy = intent.sort_by === 'amount_desc' ? 'amount_desc'
      : intent.sort_by === 'amount_asc' ? 'amount_asc'
      : 'date';

    const allTx = await TransactionRepository.getFilteredTransactions(timeRange, filters, sortBy, baseDate);

    let tx = allTx;
    if (!intent.category_filter && intent.domain_filter) {
      tx = allTx.filter(t => {
        const cat = ALL_CATEGORIES.find(c => c.key === t.category_key);
        return cat?.domain_key === intent.domain_filter;
      });
    }

    const limit = intent.limit ?? 20;
    return {
      archetype: 'list',
      period_label: periodLabel,
      transactions: tx.slice(0, limit),
      transaction_count: tx.length,
      intent,
    };
  }

  // ── ARCHETYPE: TIMELINE ─────────────────────────────────────────────────────
  if (intent.archetype === 'timeline') {
    const now = new Date();
    let timelineData: { label: string; value: number }[] = [];

    if (intent.period.type === 'year') {
      const y = intent.period.year ?? now.getFullYear();
      const monthly = await TransactionRepository.getMonthlyStatsForYear(y);
      const monthLabels = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
      timelineData = monthly.map((m, i) => ({
        label: monthLabels[i],
        value: direction === 'in' ? m.income : m.expense,
      }));
    } else if (intent.period.type === 'month') {
      const y = intent.period.year ?? now.getFullYear();
      const m = intent.period.month ?? (now.getMonth() + 1);
      const daily = await TransactionRepository.getDailyStatsForMonth(y, m);
      timelineData = daily.map(d => ({
        label: `${d.day}`,
        value: direction === 'in' ? d.income : d.expense,
      }));
    }

    console.log(`📈 [EXECUTOR] Timeline: ${timelineData.length} points`);
    return { archetype: 'timeline', period_label: periodLabel, timeline_data: timelineData, intent };
  }

  return { archetype: 'text', period_label: periodLabel, intent };
}
