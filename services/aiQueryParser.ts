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
  subject?: 'transactions' | 'net_worth'; // Default: 'transactions'
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
  social_context_filter?: string; // contesto sociale (es: "friends", "family", "colleagues", "couple", "strangers", "alone")
  person_filter?: string;         // persona specifica (es: "Marco", "Stefano")
  holiday_filter?: string;        // festività (es: "Natale", "Pasqua")
  tag_filter?: string;            // tag specifico (es: "viaggio", "trasferta")
  is_recurring_filter?: boolean;  // true se si parla di spese ricorrenti o abbonamenti, altrimenti null
  is_scheduled_filter?: boolean;  // true se si parla di spese programmate una tantum o future, altrimenti null
  _tokens?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ─── Prompt Builder (Dinamico) ───────────────────────────────────────────────

function buildParserPrompt(currentDateISO: string, cities: string[], socialContexts: string[], people: string[], holidays: string[], tags: string[]): string {
  const domainList = DOMAINS_CONFIG.map(d => d.key).join(', ');
  const categoryList = DOMAINS_CONFIG.flatMap(d => 
    d.categories.map(c => `${c.key}→${d.key}`)
  ).join(', ');
  const cityList = cities.length > 0 ? cities.join(', ') : 'nessuna città ancora registrata';
  const socialList = socialContexts.length > 0 ? socialContexts.join(', ') : 'friends, family, colleagues, couple, strangers, alone';
  const peopleList = people.length > 0 ? people.join(', ') : 'nessuna persona ancora registrata';
  const holidayList = holidays.length > 0 ? holidays.join(', ') : 'nessuna festività ancora registrata (es: Natale, Pasqua)';
  const tagList = tags.length > 0 ? tags.join(', ') : 'nessun tag ancora registrato (es: viaggio, trasferta)';

  const tagMatchBlock = tags.length > 0
    ? `
⚠️ PRIORITÀ ASSOLUTA — VALORI DEFINITI DALL'UTENTE NEL DATABASE:
L'utente ha registrato nelle sue transazioni i seguenti TAG personalizzati: [${tags.join(', ')}].
Se la domanda dell'utente contiene una parola che corrisponde esattamente (o in modo molto simile, es: singolare/plurale, minuscolo/maiuscolo) a uno di questi tag, DEVI impostare tag_filter con quel valore e NON usare merchant_filter, category_filter o domain_filter.
Questi tag sono concetti PERSONALI dell'utente, non nomi di negozi, film, brand o categorie di sistema.
Esempio critico: se i tag registrati includono "wolly" e l'utente chiede "quanto ho speso per wolly", la risposta corretta è tag_filter="wolly", NON merchant_filter="wolly" (anche se "wolly" potrebbe sembrare un nome di brand o personaggio).
`
    : '';

  return `Sei un parser di query finanziarie. La tua UNICA funzione è trasformare la domanda dell'utente in un oggetto JSON che descrive COME filtrare i dati. NON calcoli, NON numeri, solo filtri.
Oggi è ${currentDateISO}.
${tagMatchBlock}
TASSONOMIA DISPONIBILE:
- DOMINI (domain_filter): ${domainList}
- CATEGORIE (category_filter): ${categoryList}
- CITTÀ CONOSCIUTE (city_filter): ${cityList}
- CONTESTI SOCIALI (social_context_filter): ${socialList} (Usa rigorosamente uno di questi valori in inglese se menzionato: friends, family, colleagues, couple, strangers, alone)
- PERSONE CONOSCIUTE (person_filter): ${peopleList}
- FESTIVITÀ CONOSCIUTE (holiday_filter): ${holidayList}
- TAG REGISTRATI DALL'UTENTE (tag_filter — PRIORITÀ MASSIMA): ${tagList}

L'AI funge da estrattore rigido. Trasforma la frase in un JSON con i seguenti parametri logici:
1. SOGGETTO (subject): Usa "net_worth" SOLO ED ESCLUSIVAMENTE se la domanda contiene esplicitamente le parole "patrimonio", "ricchezza", o "bilancio totale". In TUTTI gli altri casi (inclusi "stipendio", "guadagnato", "entrate", "spese"), DEVI usare "transactions".
2. COSA: category_filter, domain_filter, merchant_filter, holiday_filter o tag_filter.
3. QUANDO: period (mese, settimana, anno, custom).
4. COME: aggregation_type (total, average, count).

ARCHETIPI:
- "total": Valore unico calcolato (es: "quanto ho speso?", "a quanto ammonta il mio patrimonio", "media spesa", "quante volte")
- "distribution": Proporzioni (es: "dove spendo di più?", "spese per categoria")
- "list": Transazioni specifiche (es: "mostrami le spese", "cosa ho comprato")
- "timeline": Andamento nel tempo (es: "trend delle spese", "andamento patrimonio", "mese per mese")
- "text": Domanda conversazionale senza dati (es: "cosa è la diversificazione?")
- "subscriptions": Gestione abbonamenti e proiezioni future

DIRECTION: "out" (spese), "in" (entrate), "both" (entrambi). Default: "out". Se subject="net_worth", usa "both".

AGGREGATION_TYPE: 
- "total": Somma degli importi (Default).
- "average": Media degli importi (es: "quanto spendo in media...", "media mensile").
- "count": Conteggio delle transazioni (es: "quante volte...", "numero di spese").

FORMATO JSON OBBLIGATORIO:
{
  "subject": "transactions"|"net_worth",
  "archetype": "total"|"distribution"|"list"|"timeline"|"text"|"subscriptions",
  "direction": "out"|"in"|"both",
  "aggregation_type": "total"|"average"|"count",
  "period": {
    "type": "week"|"month"|"year"|"custom"|"all",
    "year": number|null,
    "month": number|null,
    "from": "YYYY-MM-DD"|null,
    "to": "YYYY-MM-DD"|null
  },
  "category_filter": string|null,
  "domain_filter": string|null,
  "merchant_filter": string|null,
  "period_label": "English readable string (e.g. 'April 2026', 'Yesterday', 'Last 12 months')",
  "city_filter": string|null,
  "group_by": "category"|"city"|null,
  "social_context_filter": string|null,
  "person_filter": string|null,
  "holiday_filter": string|null,
  "tag_filter": string|null,
  "sort_by": "date"|"amount_desc"|"amount_asc"|null,
  "limit": number|null,
  "comparison_period": "prev_month"|"prev_year"|null,
  "is_recurring_filter": boolean|null,
  "is_scheduled_filter": boolean|null
}

REGOLE CRITICHE PER DATE E PERIODI:
- Se l'utente si riferisce a un intervallo personalizzato o relativo (es: "ieri", "l'altro ieri", "ultimi 5 giorni", "ultimi 12 mesi", "ultimo anno"):
  * Imposta "type": "custom".
  * Calcola rigorosamente le date "from" e "to" basandoti su oggi (${currentDateISO}).
  * Esempio "ieri" (se oggi è 2026-05-17) → "from": "2026-05-16", "to": "2026-05-16", "period_label": "Yesterday".
  * Esempio "l'altro ieri" (se oggi è 2026-05-17) → "from": "2026-05-15", "to": "2026-05-15", "period_label": "Day before yesterday".
  * Esempio "nell'ultimo anno" o "negli ultimi 12 mesi" (se oggi è 2026-05-17) → "from": "2025-05-17", "to": "2026-05-17", "period_label": "Last 12 months".
  * NOTA: "nell'ultimo anno" NON significa anno solare concluso 2025! Significa ultimi 365 giorni (type: "custom", from: 1 anno fa, to: oggi).
- Se l'utente specifica un anno o mese preciso (es: "nel 2025", "a marzo 2025"):
  * Imposta "type": "year" o "month" con "year" e "month" numerici appropriati, e "from"/"to" a null.
  * Esempio "nel 2025" → "type": "year", "year": 2025, "month": null, "from": null, "to": null.

REGOLE PER ORDINE, LIMITI E CONFRONTI:
- Se l'utente chiede ordinamento o valori estremi (es: "le spese più alte", "i più economici", "i più recenti"):
  * Per "più alti", "più costosi", "top acquisti" → sort_by="amount_desc"
  * Per "più bassi", "più economici" → sort_by="amount_asc"
  * Per "più recenti", "ultimi acquisti" → sort_by="date" (o null, default)
- Se l'utente specifica una quantità numerica di elementi (es: "le ultime 5 spese", "mostrami 10 transazioni"):
  * Imposta "limit" al numero richiesto (es: 5 o 10). Se non specificato, lascia null o ometti.
- Se l'utente chiede un confronto rispetto a un altro periodo (es: "rispetto al mese scorso", "in confronto all'anno scorso"):
  * Per "mese scorso", "mese precedente" → comparison_period="prev_month"
  * Per "anno scorso", "anno precedente" → comparison_period="prev_year"

ALTRE REGOLE GENERALI:
- Se l'utente nomina una festività (es: "Natale", "Pasqua", "Ferragosto") → holiday_filter="nome festività"
- REGOLA CRITICA TAG vs MERCHANT: Se una parola della domanda corrisponde a un tag registrato dall'utente (lista sopra), usa SEMPRE tag_filter. Usa merchant_filter SOLO per nomi di negozi/brand che NON appaiono nei tag registrati.
- Se l'utente nomina un negozio specifico non presente nei tag (es: "Coca Cola", "Esselunga", "Amazon") → merchant_filter="nome negozio"
- Se l'utente chiede "quante volte" → aggregation_type="count", archetype="total"
- Se l'utente chiede "media" o "in media" → aggregation_type="average", archetype="total"
- DISTINZIONE CRITICA: 
  a) "Quali sono le spese/acquisti più alti/onerosi?" o "Mostrami i top acquisti" → archetype="list", sort_by="amount_desc" (Vuole vedere le singole transazioni costose).
  b) "Dove spendo di più?", "In quali categorie spendo?" → archetype="distribution", group_by="category" (Vuole vedere le proporzioni per settore).
- Default automatici se mancano parametri: tutto (null filters) · se l'archetipo è 'list' imposta il periodo a "all" (tutta la storia) per mostrare lo storico completo ed evitare liste vuote, per altri archetipi usa il mese corrente · totale.
- GESTIONE PERIODICHE E RICORRENTI (is_recurring_filter): Se l'utente chiede una statistica storica o un importo speso/guadagnato di transazioni periodiche (es. "Quanto ho speso di abbonamenti nel 2026?", "quanto guadagno di stipendio al mese?", "elenco spese periodiche") → imposta archetype="total" o "list" (a seconda della domanda), is_recurring_filter=true e subject="transactions". Le periodiche includono sia uscite (abbonamenti, bollette, affitto) che entrate (stipendio, rendita, pensione).
- Se invece l'utente chiede l'elenco generale o la proiezione/configurazione delle periodiche attive (es. "quali abbonamenti ho?", "mostrami le periodiche attive", "quanto mi costano gli abbonamenti al mese?", "quali entrate periodiche ho?") → imposta archetype="subscriptions", is_recurring_filter=true e subject="transactions".
- GESTIONE SPESE PROGRAMMATE E FUTURE (is_scheduled_filter): Se l'utente chiede informazioni su spese/entrate programmate, pianificate, impegni futuri o transazioni future (es. "quali spese ho programmato?", "cosa ho pianificato di spendere?", "spese future", "impegni di giugno 2026") → imposta is_scheduled_filter=true e subject="transactions". Se chiede una lista imposta archetype="list", se chiede il totale imposta archetype="total".
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

    if (data.usage) {
      intent._tokens = {
        prompt_tokens: data.usage.prompt_tokens,
        completion_tokens: data.usage.completion_tokens,
        total_tokens: data.usage.total_tokens
      };
    }

    // ── Deterministic tag override ────────────────────────────────────────────
    // Se l'LLM non ha rilevato un tag ma la query dell'utente contiene una
    // parola che corrisponde esattamente (case-insensitive) a un tag del DB,
    // forziamo tag_filter e azzeriamo i filtri conflittuali.
    if (!intent.tag_filter && tags.length > 0) {
      const lowerMsg = userMessage.toLowerCase();
      const matchedTag = tags.find((t) => {
        const lt = t.toLowerCase();
        // Match parola intera nel messaggio
        return new RegExp(`(?:^|[\\s,;:!?'"])${lt}(?:[\\s,;:!?'"]|$)`).test(lowerMsg);
      });
      if (matchedTag) {
        console.log(`🏷️ [PARSER] Deterministic tag override: "${matchedTag}" (was merchant: ${intent.merchant_filter ?? 'none'})`);
        intent.tag_filter = matchedTag;
        // Rimuove filtri che potrebbero aver "catturato" il tag per errore
        if (intent.merchant_filter?.toLowerCase() === matchedTag.toLowerCase()) {
          intent.merchant_filter = undefined;
        }
        if (intent.category_filter?.toLowerCase() === matchedTag.toLowerCase()) {
          intent.category_filter = undefined;
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    console.log(`✅ [PARSER] Intent: ${intent.archetype} | ${intent.direction} | ${intent.period.type} ${intent.period.year || ''}${intent.period.month ? '/' + intent.period.month : ''}`);
    if (intent.tag_filter) console.log(`   Tag: ${intent.tag_filter}`);
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
      period_label: 'This month',
    };
  }
}
