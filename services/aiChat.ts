import { parseQueryIntent, QueryIntent } from './aiQueryParser';
import { executeQueryIntent, ExecutionResult, DistributionItem } from './queryExecutor';
import { SubscriptionRepository, Subscription } from './database/repositories/SubscriptionRepository';
import { translateSocialContext, translateLocationType, translateTimeOfDay } from '../constants/i18n';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface AiChartPayload {
  type: 'bar' | 'pie' | 'line';
  title: string;
  data: ChartDataPoint[];
}

export interface AiChatResponse {
  intent: string;
  queryIntent?: QueryIntent; // PER FEEDBACK BAR
  text_response: string;
  analysis_steps?: string[];
  chart?: AiChartPayload | null;

  // Archetipo QUANTO
  total_data?: {
    value: number;
    comparison?: {
      diff: number;
      percentage: number;
      is_better: boolean;
    };
    period_label: string;
  };

  // Archetipo COME
  distribution_data?: {
    title: string;
    items: { label: string; value: number; percentage: number; color: string }[];
  };

  // Archetipo COSA
  list_data?: {
    title: string;
    total_count: number;
    items: {
      id: string;
      date: string;
      time?: string;
      description: string;
      amount: number;
      category_key: string;
      is_impulsive?: boolean;
      subscription_name?: string;
    }[];
  };

  // Archetipo QUANDO
  timeline_data?: {
    type: 'month' | 'year' | 'bar_vertical' | 'heatmap_calendar';
    title: string;
    data: any[];
    granularity: string;
  };

  // Archetipo ABBONAMENTI
  subscription_data?: {
    total_monthly: number;
    active_count: number;
    items: Subscription[];
  };
}

// ─── Global Chat Store ────────────────────────────────────────────────────────

export class AiChatStore {
  private static instance: AiChatStore;
  public qa: { question: string; answer: AiChatResponse | null } | null = null;
  public history: ChatMessage[] = [];
  public debugData: string | null = null;
  public showDebug: boolean = false;
  private isTyping: boolean = true;
  private listeners = new Set<() => void>();

  private constructor() {}

  public static getInstance(): AiChatStore {
    if (!AiChatStore.instance) {
      AiChatStore.instance = new AiChatStore();
    }
    return AiChatStore.instance;
  }

  public getIsTyping() {
    return this.isTyping;
  }

  public setIsTyping(val: boolean) {
    this.isTyping = val;
    this.notify();
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  public reset() {
    this.qa = null;
    this.history = [];
    this.debugData = null;
    this.isTyping = true;
    this.notify();
  }
}

export const aiChatStore = AiChatStore.getInstance();

// ─── Chat Message ─────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Response Builder (codice TS, niente AI) ─────────────────────────────────
function buildAnalysisSteps(intent: QueryIntent, extra?: string[]): string[] {
  const steps = [
    `Periodo: ${intent.period_label || 'Non specificato'}`,
    `Direzione: ${intent.direction === 'both' ? 'Tutte' : intent.direction === 'in' ? 'Entrate' : 'Uscite'}`,
  ];

  if (intent.category_filter) steps.push(`Categoria: ${intent.category_filter}`);
  if (intent.domain_filter) steps.push(`Dominio: ${intent.domain_filter}`);
  if (intent.merchant_filter) steps.push(`Merchant: ${intent.merchant_filter}`);
  if (intent.city_filter) steps.push(`Città: ${intent.city_filter}`);
  if (intent.social_context_filter) steps.push(`Contesto: ${intent.social_context_filter}`);
  if (intent.person_filter) steps.push(`Persona: ${intent.person_filter}`);

  if (extra) steps.push(...extra);
  return steps;
}

function formatLabelItalian(label: string): string {
  const labelLower = (label || '').toLowerCase().trim();
  if (/^\d{4}$/.test(labelLower)) {
    return `il ${labelLower}`;
  }
  if (labelLower === 'tutto' || labelLower === 'tutti' || labelLower === 'sempre') {
    return 'tutte le transazioni';
  }
  if (labelLower === 'ieri' || labelLower === 'oggi' || labelLower === "l'altro ieri" || labelLower.startsWith('questo') || labelLower.startsWith('quest\'') || labelLower.startsWith('questa')) {
    return labelLower;
  }
  
  if (labelLower.startsWith('ultimo ') || labelLower.startsWith('ultimi ') || labelLower.startsWith('ultima ') || labelLower.startsWith('ultime ')) {
    if (labelLower.startsWith('ultimo ')) {
      return `l'${labelLower}`;
    }
    if (labelLower.startsWith('ultima ')) {
      return `l'${labelLower}`;
    }
    if (labelLower.startsWith('ultimi ')) {
      return `gli ${labelLower}`;
    }
    if (labelLower.startsWith('ultime ')) {
      return `le ${labelLower}`;
    }
  }

  return labelLower;
}

function formatTimeIntroduction(label: string, verb: string): string {
  const labelLower = (label || '').toLowerCase().trim();
  
  // Anno preciso, es: 2026
  if (/^\d{4}$/.test(labelLower)) {
    return `nel ${labelLower} hai ${verb}`;
  }
  
  // Giorni relativi senza preposizioni
  if (labelLower === 'ieri' || labelLower === 'oggi' || labelLower === "l'altro ieri") {
    return `${labelLower} hai ${verb}`;
  }
  
  // Periodi relativi con questo/questa
  if (labelLower.startsWith('questo') || labelLower.startsWith('quest\'') || labelLower.startsWith('questa')) {
    return `${labelLower} hai ${verb}`;
  }
  
  // Tutto il tempo / storico completo
  if (labelLower === 'tutto' || labelLower === 'tutti' || labelLower === 'sempre') {
    return `in totale hai ${verb}`;
  }
  
  // Ultimo/a/i/e...
  if (labelLower.startsWith('ultimo ') || labelLower.startsWith('ultimi ') || labelLower.startsWith('ultima ') || labelLower.startsWith('ultime ')) {
    if (labelLower.startsWith('ultimo ')) {
      return `nell'${labelLower} hai ${verb}`;
    }
    if (labelLower.startsWith('ultima ')) {
      return `nell'${labelLower} hai ${verb}`;
    }
    if (labelLower.startsWith('ultimi ')) {
      return `negli ${labelLower} hai ${verb}`;
    }
    if (labelLower.startsWith('ultime ')) {
      return `nelle ${labelLower} hai ${verb}`;
    }
  }
  
  // Mesi specifici (es. "aprile", "maggio 2026")
  const mesi = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const startsWithMonth = mesi.some(m => labelLower.startsWith(m));
  if (startsWithMonth) {
    // Fonetica per vocali: aprile, agosto, ottobre
    if (labelLower.startsWith('aprile') || labelLower.startsWith('agosto') || labelLower.startsWith('ottobre')) {
      return `ad ${labelLower} hai ${verb}`;
    }
    return `a ${labelLower} hai ${verb}`;
  }

  // Fallback generico
  return `per quanto riguarda ${labelLower} hai ${verb}`;
}

function formatTimelineIntroduction(label: string): string {
  const labelLower = (label || '').toLowerCase().trim();
  
  if (/^\d{4}$/.test(labelLower)) {
    return `del ${labelLower}`;
  }
  
  if (labelLower === 'ieri' || labelLower === 'oggi' || labelLower === "l'altro ieri") {
    return `di ${labelLower}`;
  }
  
  if (labelLower.startsWith('questo') || labelLower.startsWith('quest\'') || labelLower.startsWith('questa')) {
    return `di ${labelLower}`;
  }
  
  if (labelLower === 'tutto' || labelLower === 'tutti' || labelLower === 'sempre') {
    return `dell'intero periodo`;
  }
  
  if (labelLower.startsWith('ultimo ') || labelLower.startsWith('ultimi ') || labelLower.startsWith('ultima ') || labelLower.startsWith('ultime ')) {
    if (labelLower.startsWith('ultimo ')) {
      return `dell'${labelLower}`;
    }
    if (labelLower.startsWith('ultima ')) {
      return `dell'${labelLower}`;
    }
    if (labelLower.startsWith('ultimi ')) {
      return `degli ${labelLower}`;
    }
    if (labelLower.startsWith('ultime ')) {
      return `delle ${labelLower}`;
    }
  }

  return `di ${labelLower}`;
}

function getSocialContextItalianLabel(context: string): string {
  const ctx = context.toLowerCase();
  if (ctx === 'friends') return ' con amici';
  if (ctx === 'family') return ' con la famiglia';
  if (ctx === 'colleagues') return ' con i colleghi';
  if (ctx === 'couple') return ' in coppia';
  if (ctx === 'strangers') return ' con sconosciuti';
  if (ctx === 'alone') return ' da solo';
  return ` con contesto ${context}`;
}

function buildResponseFromResult(intent: QueryIntent, result: ExecutionResult): AiChatResponse {
  const label = result.period_label;

  // ── SUBSCRIPTIONS ────────────────────────────────────────────────────────────
  if (result.archetype === 'subscriptions' && result.subscriptions) {
    const subs = result.subscriptions;
    const active = subs.filter(s => s.is_active);
    const total = active.reduce((acc, s) => {
      let val = s.amount;
      if (s.frequency === 'weekly') val *= 4.33;
      else if (s.frequency === 'biweekly') val *= 2.17;
      else if (s.frequency === 'yearly') val /= 12;
      return acc + val;
    }, 0);

    // Trova il più costoso per dare una risposta più intelligente
    const mostExpensive = [...active].sort((a, b) => b.amount - a.amount)[0];
    let extraText = '';
    if (mostExpensive) {
      extraText = ` Il più costoso è ${mostExpensive.name} (€${mostExpensive.amount.toFixed(2)}).`;
    }

    const isYearly = intent.period.type === 'year';
    const displayAmount = isYearly ? total * 12 : total;
    const periodName = isYearly ? 'all\'anno' : 'al mese';

    return {
      intent: 'subscriptions',
      text_response: `Hai ${active.length} abbonamenti attivi.${extraText}`,
      analysis_steps: buildAnalysisSteps(intent, [
        `Trovati ${subs.length} abbonamenti nel database`,
        `${active.length} abbonamenti risultano attivi`,
        `Costo ${periodName}: €${displayAmount.toFixed(2)}`,
        mostExpensive ? `Top spesa: ${mostExpensive.name}` : 'Nessuna spesa attiva',
      ]),
      subscription_data: {
        total_monthly: total,
        active_count: active.length,
        items: subs,
      },
    };
  }


  // ── TOTAL ────────────────────────────────────────────────────────────────────
  if (result.archetype === 'total' && result.total !== undefined) {
    const value = result.total;
    const dirLabel = intent.direction === 'in' ? 'guadagnato' : 'speso';
    const filterLabel = intent.category_filter
      ? ` in "${intent.category_filter.replace(/_/g, ' ')}"`
      : intent.domain_filter
      ? ` in "${intent.domain_filter.replace(/_/g, ' ')}"`
      : '';
    
    const cityLabel = intent.city_filter ? ` a ${intent.city_filter}` : '';
    const socialLabel = intent.social_context_filter ? getSocialContextItalianLabel(intent.social_context_filter) : '';

    let compText = '';
    if (result.comparison) {
      const c = result.comparison;
      const pct = Math.abs(c.percentage).toFixed(0);
      const diffVal = Math.abs(c.diff).toFixed(2);
      if (c.diff > 0) {
        compText = `, ovvero €${diffVal} (+${pct}%) in più rispetto al periodo precedente`;
      } else if (c.diff < 0) {
        compText = `, ovvero €${diffVal} (-${pct}%) in meno rispetto al periodo precedente`;
      }
    }

    const timeIntro = formatTimeIntroduction(label, dirLabel);
    let text_response = `Dunque, ${timeIntro}${filterLabel}${cityLabel}${socialLabel} complessivamente €${value.toFixed(2)}${compText}.`;
    
    if (intent.subject === 'net_worth') {
      text_response = `Il tuo patrimonio totale (per quanto riguarda il periodo indicato, ${label}) ammonta a €${value.toFixed(2)}${compText}.`;
    }

    return {
      intent: 'total',
      text_response,
      analysis_steps: buildAnalysisSteps(intent, [
        `Totale calcolato dal DB: €${value.toFixed(2)}`,
      ]),
      total_data: {
        value,
        comparison: result.comparison ? {
          diff: result.comparison.diff,
          percentage: result.comparison.percentage,
          is_better: result.comparison.is_better,
        } : undefined,
        period_label: label,
      },
    };
  }

  // ── DISTRIBUTION ─────────────────────────────────────────────────────────────
  if (result.archetype === 'distribution' && result.distribution_items) {
    const items = result.distribution_items;
    const top = items[0];
    const unitLabel = intent.group_by === 'city' ? 'La città' : 'La categoria';
    const topText = top ? ` ${unitLabel} principale è "${top.label}" con €${top.value.toFixed(2)} (${top.percentage}%).` : '';
    const formattedLabel = formatLabelItalian(label);

    return {
      intent: 'distribution',
      text_response: `Ecco come sono state distribuite le tue ${intent.direction === 'in' ? 'entrate' : 'spese'} per quanto riguarda ${formattedLabel}.${topText}`,
      analysis_steps: buildAnalysisSteps(intent, [
        `Raggruppato per ${intent.group_by || 'categoria'}`,
        `${items.length} voci trovate`,
        `Ordinate per importo decrescente`,
      ]),
      distribution_data: {
        title: `Distribuzione ${intent.direction === 'in' ? 'entrate' : 'spese'} — ${label}`,
        items: items.map(i => ({
          label: i.label,
          value: i.value,
          percentage: i.percentage,
          color: i.color,
        })),
      },
    };
  }

  // ── LIST ─────────────────────────────────────────────────────────────────────
  if (result.archetype === 'list' && result.transactions) {
    const tx = result.transactions;
    const count = result.transaction_count ?? tx.length;
    const formattedLabel = formatLabelItalian(label);

    return {
      intent: 'list',
      text_response: `Per quanto riguarda ${formattedLabel}, ho trovato ${count} transazioni in totale. Ecco le più rilevanti:`,
      analysis_steps: buildAnalysisSteps(intent, [
        `${count} transazioni trovate`,
      ]),
      list_data: {
        title: `Transazioni — ${label}`,
        total_count: count,
        items: tx.map((t: any) => ({
          id: t.id,
          date: t.date,
          time: t.time,
          description: t.description,
          amount: t.direction === 'in' ? t.amount : -t.amount,
          category_key: t.category_key,
          is_impulsive: false,
          subscription_name: t.subscription_name ? ` (${t.subscription_name})` : undefined,
        })),
      },
    };
  }

  // ── TIMELINE ─────────────────────────────────────────────────────────────────
  if (result.archetype === 'timeline' && result.timeline_data) {
    const isMonthly = intent.period.type === 'year';
    const formattedIntro = formatTimelineIntroduction(label);
    
    let text_response = `Dando un'occhiata all'andamento ${formattedIntro}, ecco come si sono evolute le tue ${intent.direction === 'in' ? 'entrate' : 'spese'}:`;
    let chartTitle = `Andamento — ${label}`;

    if (intent.subject === 'net_worth') {
      text_response = `Ecco l'andamento del tuo patrimonio ${formattedIntro}:`;
      chartTitle = `Andamento Patrimonio — ${label}`;
    }

    return {
      intent: 'timeline',
      text_response,
      analysis_steps: [
        `Periodo: ${label}`,
        `Granularità: ${isMonthly ? 'mensile' : 'giornaliera'}`,
      ],
      timeline_data: {
        type: 'bar_vertical',
        title: chartTitle,
        data: result.timeline_data,
        granularity: isMonthly ? 'weekday' : 'day',
      },
    };
  }

  // ── SUBSCRIPTIONS ────────────────────────────────────────────────────────────
  if (result.archetype === 'subscriptions' && result.subscriptions) {
    const subs = result.subscriptions;
    const activeCount = subs.filter(s => s.is_active).length;
    
    // Normalized monthly total cost
    let totalMonthly = 0;
    for (const sub of subs) {
      if (!sub.is_active) continue;
      let monthly = sub.amount;
      switch (sub.frequency) {
        case 'weekly':    monthly = sub.amount * 4.33; break;
        case 'biweekly':  monthly = sub.amount * 2.17; break;
        case 'yearly':    monthly = sub.amount / 12;   break;
        default:          monthly = sub.amount;        break;
      }
      totalMonthly += monthly;
    }

    return {
      intent: 'subscriptions',
      text_response: `Attualmente hai ${activeCount} abbonamenti attivi, per un costo mensile complessivo stimato di circa €${totalMonthly.toFixed(2)}. Ecco l'elenco completo:`,
      analysis_steps: buildAnalysisSteps(intent, [
        `Abbonamenti totali nel DB: ${subs.length}`,
        `Abbonamenti attivi: ${activeCount}`,
        `Costo mensile stimato: €${totalMonthly.toFixed(2)}`,
      ]),
      subscription_data: {
        total_monthly: totalMonthly,
        active_count: activeCount,
        items: subs,
      },
    };
  }

  // ── TEXT fallback ─────────────────────────────────────────────────────────────
  return {
    intent: 'text',
    text_response: 'Non ho trovato dati per questa richiesta. Prova a riformulare la domanda.',
  };
}

// ─── Text-only AI response (per domande conversazionali) ─────────────────────


// ─── Main Orchestrator ────────────────────────────────────────────────────────

export async function askAiChat(
  userMessage: string, 
  history: ChatMessage[] = [],
  preParsedIntent?: QueryIntent
): Promise<AiChatResponse> {
  console.log('\n' + '='.repeat(60));
  console.log('🤖 [WOLLY AI — NUOVA ARCHITETTURA]');
  console.log(`📝 INPUT: "${userMessage}"`);
  console.log('-'.repeat(60));

  try {
    let intent: QueryIntent;
    
    if (preParsedIntent) {
      console.log('⚡ [EXECUTOR] Usando intento pre-parificato (Feedback Bar)');
      intent = preParsedIntent;
    } else {
      // ── FASE 1: AI Parser ───────────────────────────────────────────────────
      intent = await parseQueryIntent(userMessage, history);
    }

    console.log('🔍 [PARSER] DETTAGLI INTENT:');
    console.log(`   • Archetipo: ${intent.archetype}`);
    console.log(`   • Periodo: ${intent.period.type} (${intent.period.year || ''}${intent.period.month ? '/' + intent.period.month : ''})`);
    console.log(`   • Filtri: ${intent.category_filter || intent.domain_filter || 'Nessuno'}`);
    if (intent.city_filter) console.log(`   • Città: ${intent.city_filter}`);
    if (intent.social_context_filter) console.log(`   • Contesto: ${intent.social_context_filter}`);
    if (intent.merchant_filter) console.log(`   • Merchant: ${intent.merchant_filter}`);

    // ── FASE 2: Esecuzione DB ───────────────────────────────────────────────
    const result = await executeQueryIntent(intent);
    console.log('⚙️ [EXECUTOR] RISULTATO DB:');
    if (result.total !== undefined) console.log(`   • Totale: €${result.total.toFixed(2)}`);
    if (result.distribution_items) console.log(`   • Distribuzione: ${result.distribution_items.length} categorie`);
    if (result.transactions) console.log(`   • Transazioni: ${result.transactions.length} righe`);
    if (result.subscriptions) console.log(`   • Abbonamenti: ${result.subscriptions.length} trovati`);

    // ── FASE 3: Composizione ────────────────────────────────────────────────
    let finalResponse: AiChatResponse;

    if (result.archetype === 'text') {
      console.log('💬 [ORCHESTRATOR] Domanda testuale → Blocco risposta');
      finalResponse = { 
        intent: 'text', 
        text_response: 'Non posso aiutarti con questo. Sono qui solo per analizzare i tuoi dati finanziari.', 
        queryIntent: intent 
      };
    } else {
      console.log(`✅ [ORCHESTRATOR] Dati pronti → composizione TS (archetype: ${result.archetype})`);
      finalResponse = buildResponseFromResult(intent, result);
      finalResponse.queryIntent = intent; // Assicuriamoci che sia presente
    }

    if (finalResponse.analysis_steps && finalResponse.analysis_steps.length > 0) {
      console.log('🧠 [RAGIONAMENTO]:');
      finalResponse.analysis_steps.forEach(step => console.log(`   • ${step}`));
    }

    console.log(`📤 RISPOSTA FINALE: "${finalResponse.text_response}"`);
    console.log('='.repeat(60) + '\n');

    return finalResponse;

  } catch (error: any) {
    console.error('[aiChat] Error:', error.message);
    console.log('='.repeat(60) + '\n');
    return {
      intent: 'text',
      text_response: 'Mi dispiace, non sono riuscito a elaborare la tua richiesta. Riprova tra un momento.',
    };
  }
}
