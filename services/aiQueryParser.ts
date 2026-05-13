import { ChatMessage } from './aiChat';
import { DOMAINS_CONFIG } from '../constants/categories';
import { TransactionRepository } from './database/repositories/TransactionRepository';

// ─── QueryIntent — Struttura restituita dalla Fase 1 ─────────────────────────

export interface QueryPeriod {
  type: 'week' | 'month' | 'year' | 'custom' | 'all';
  year?: number;      // es. 2026
  month?: number;     // 1-12
  from?: string;      // ISO date YYYY-MM-DD
  to?: string;        // ISO date YYYY-MM-DD
}

export interface QueryIntent {
  archetype: 'total' | 'distribution' | 'list' | 'timeline' | 'text' | 'subscriptions';
  direction: 'out' | 'in' | 'both';
  aggregation_type: 'total' | 'average' | 'count';
  period: QueryPeriod;
  category_filter?: string;    // category_key specifico (es: "ristorante_fast_food")
  domain_filter?: string;      // domain_key (es: "cibo_bevande") — usato se non c'è category_filter
  merchant_filter?: string;    // filtro per nome negozio (es: "McDonald's")
  sort_by?: 'date' | 'amount_desc' | 'amount_asc';
  limit?: number;              // per archetype=list, quante righe mostrare
  comparison_period?: 'prev_month' | 'prev_year';
  period_label?: string;       // label leggibile generata dall'IA (es: "Questo mese")
  city_filter?: string;        // città specifica (es: "Torino", "Milano")
  group_by?: 'category' | 'city'; // come raggruppare i dati (default: category)
  social_context_filter?: string; // contesto sociale (es: "Amici", "Famiglia")
  person_filter?: string;         // persona specifica (es: "Marco", "Stefano")
  holiday_filter?: string;        // festività (es: "Natale", "Pasqua")
  tag_filter?: string;            // tag specifico (es: "viaggio", "trasferta")
}

// ─── Prompt Builder (Dinamico) ───────────────────────────────────────────────

function buildParserPrompt(currentDateISO: string, cities: string[], socialContexts: string[], people: string[], holidays: string[], tags: string[]): string {
  const domainList = DOMAINS_CONFIG.map(d => d.key).join(', ');
  const categoryList = DOMAINS_CONFIG.flatMap(d => 
    d.categories.map(c => `${c.key}→${d.key}`)
  ).join(', ');
  const cityList = cities.length > 0 ? cities.join(', ') : 'nessuna città ancora registrata';
  const socialList = socialContexts.length > 0 ? socialContexts.join(', ') : 'nessun contesto ancora registrato (es: Amici, Famiglia)';
  const peopleList = people.length > 0 ? people.join(', ') : 'nessuna persona ancora registrata';
  const holidayList = holidays.length > 0 ? holidays.join(', ') : 'nessuna festività ancora registrata (es: Natale, Pasqua)';
  const tagList = tags.length > 0 ? tags.join(', ') : 'nessun tag ancora registrato (es: viaggio, trasferta)';

  return `Sei un parser di query finanziarie. La tua UNICA funzione è trasformare la domanda dell'utente in un oggetto JSON che descrive COME filtrare i dati. NON calcoli, NON numeri, solo filtri.
Oggi è ${currentDateISO}.

TASSONOMIA DISPONIBILE:
- CATEGORIE (category_filter): ${categoryList}
- CITTÀ CONOSCIUTE (city_filter): ${cityList}
- CONTESTI SOCIALI (social_context_filter): ${socialList}
- PERSONE CONOSCIUTE (person_filter): ${peopleList}
- FESTIVITÀ CONOSCIUTE (holiday_filter): ${holidayList}
- TAG REGISTRATI (tag_filter): ${tagList}

L'AI funge da estrattore rigido. Trasforma la frase in un JSON con tre parametri logici:
1. COSA: category_filter, domain_filter, merchant_filter, holiday_filter o tag_filter.
2. QUANDO: period (mese, settimana, anno, custom).
3. COME: aggregation_type (total, average, count).

ARCHETIPI:
- "total": Valore unico calcolato (es: "quanto ho speso?", "media spesa", "quante volte")
- "distribution": Proporzioni (es: "dove spendo di più?", "spese per categoria")
- "list": Transazioni specifiche (es: "mostrami le spese", "cosa ho comprato")
- "timeline": Andamento nel tempo (es: "trend", "mese per mese")
- "text": Domanda conversazionale senza dati (es: "cosa è la diversificazione?")
- "subscriptions": Gestione abbonamenti e proiezioni future

DIRECTION: "out" (spese), "in" (entrate), "both" (entrambi). Default: "out".

AGGREGATION_TYPE: 
- "total": Somma degli importi (Default).
- "average": Media degli importi (es: "quanto spendo in media...", "media mensile").
- "count": Conteggio delle transazioni (es: "quante volte...", "numero di spese").

FORMATO JSON OBBLIGATORIO:
{
  "archetype": "total"|"distribution"|"list"|"timeline"|"text"|"subscriptions",
  "direction": "out"|"in"|"both",
  "aggregation_type": "total"|"average"|"count",
  "period": { "type": "week"|"month"|"year"|"custom"|"all", "year": number|null, "month": number|null },
  "category_filter": string|null,
  "domain_filter": string|null,
  "merchant_filter": string|null,
  "period_label": "stringa leggibile (es: 'Aprile 2026')",
  "city_filter": string|null,
  "group_by": "category"|"city"|null,
  "social_context_filter": string|null,
  "person_filter": string|null,
  "holiday_filter": string|null,
  "tag_filter": string|null
}

REGOLE:
- Se l'utente nomina una festività (es: "Natale", "Pasqua", "Ferragosto") → holiday_filter="nome festività"
- Se l'utente nomina un tag o una tipologia (es: "viaggio", "trasferta") → tag_filter="tag"
- Se l'utente nomina un negozio specifico (es: "Coca Cola", "Esselunga", "Amazon") → merchant_filter="nome negozio"
- Se l'utente chiede "quante volte" → aggregation_type="count", archetype="total"
- Se l'utente chiede "media" o "in media" → aggregation_type="average", archetype="total"
- DISTINZIONE CRITICA: 
  a) "Quali sono le spese/acquisti più alti/onerosi?" o "Mostrami i top acquisti" → archetype="list", sort_by="amount_desc" (Vuole vedere le singole transazioni costose).
  b) "Dove spendo di più?", "In quali categorie spendo?" → archetype="distribution", group_by="category" (Vuole vedere le proporzioni per settore).
- Default automatici se mancano parametri: tutto (null filters) · questo_mese · totale.
- REGOLA MANDATORIA: Se l'utente nomina "abbonamenti", "costi fissi", "ricorrenze", "Netflix", "Spotify", "Amazon Prime", "palestra", "affitto" o chiede proiezioni future basate su abbonamenti (es. "quanto spenderò tra un anno in abbonamenti?") → archetype="subscriptions" SEMPRE.
- Esempio: "Quanto spenderò in abbonamenti quest'anno?" → archetype="subscriptions", period.type="year"
- Restituisci SOLO il JSON, nessun testo extra.`;
}

// ─── Main Parser ──────────────────────────────────────────────────────────────

export async function parseQueryIntent(
  userMessage: string,
  history: ChatMessage[]
): Promise<QueryIntent> {
  const apiKey = process.env.EXPO_PUBLIC_GROQ_FINANCE_API;
  if (!apiKey) throw new Error('Missing Groq API Key');

  const now = new Date();
  const currentDateISO = now.toISOString().split('T')[0];
  
  // Fetch dynamic data
  const [cities, socialContexts, people, holidays, tags] = await Promise.all([
    TransactionRepository.getDistinctCities(),
    TransactionRepository.getDistinctSocialContexts(),
    TransactionRepository.getDistinctPeople(),
    TransactionRepository.getDistinctHolidays(),
    TransactionRepository.getDistinctTags()
  ]);

  const messages = [
    { role: 'system', content: buildParserPrompt(currentDateISO, cities, socialContexts, people, holidays, tags) },
    // Includi solo gli ultimi 2 messaggi per dare contesto minimo alla conversazione
    ...history.slice(-2).map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: userMessage },
  ];

  console.log(`🔍 [PARSER] Input: "${userMessage}"`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        max_tokens: 300,
        response_format: { type: 'json_object' },
        temperature: 0,  // deterministico
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`Groq API Error: ${response.status}`);

    const data = await response.json();
    const raw = data.choices[0].message.content;
    console.log(`📄 [PARSER] Raw AI Response: ${raw}`);
    const intent: QueryIntent = JSON.parse(raw);

    console.log(`✅ [PARSER] Intent: ${intent.archetype} | ${intent.direction} | ${intent.period.type} ${intent.period.year || ''}${intent.period.month ? '/' + intent.period.month : ''}`);
    if (intent.category_filter) console.log(`   Category: ${intent.category_filter}`);
    if (intent.domain_filter) console.log(`   Domain: ${intent.domain_filter}`);
    if (intent.city_filter) console.log(`   City: ${intent.city_filter}`);
    if (intent.social_context_filter) console.log(`   Social: ${intent.social_context_filter}`);
    if (intent.person_filter) console.log(`   Person: ${intent.person_filter}`);

    return intent;
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error('[PARSER] Error:', error.message);
    // Fallback: risposta testuale generica
    return {
      archetype: 'text',
      direction: 'out',
      aggregation_type: 'total',
      period: { type: 'month', year: now.getFullYear(), month: now.getMonth() + 1 },
      period_label: 'Questo mese',
    };
  }
}
