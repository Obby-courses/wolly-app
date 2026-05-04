import { TransactionRepository } from './database/repositories/TransactionRepository';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AiChatResponse {
  intent: 'total' | 'distribution' | 'list' | 'timeline' | 'text';
  text_response: string;
  
  // Archetipo QUANTO
  total_data?: {
    value: number;
    comparison?: {
      diff: number;
      percentage: number;
      is_better: boolean; // true se spesa diminuita o entrata aumentata
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
    }[];
  };

  // Archetipo QUANDO
  timeline_data?: {
    type: 'bar_vertical' | 'heatmap_calendar';
    title: string;
    data: { label: string; value: number; intensity?: number }[];
    granularity: 'weekday' | 'day';
  };
}

// ─── Context Builder ──────────────────────────────────────────────────────────

async function buildFinancialContext(): Promise<string> {
  try {
    const now = new Date();
    const thisMonthStats = await TransactionRepository.getDailyStatsForMonth(
      now.getFullYear(),
      now.getMonth() + 1
    );
    const recentTx = await TransactionRepository.getRecentForAi(50);
    const catDist = await TransactionRepository.getCategoryDistribution('Mese');

    const monthIncome = thisMonthStats.reduce((a, c) => a + c.income, 0);
    const monthExpense = thisMonthStats.reduce((a, c) => a + c.expense, 0);

    const topCats = catDist
      .slice(0, 5)
      .map((c) => `${c.category_key}: €${c.total.toFixed(2)}`)
      .join(', ');

    const txHistory = recentTx
      .map(t => `[${t.date}] ${t.direction === 'in' ? '+' : '-'}€${t.amount.toFixed(2)} | ${t.category_key} | ${t.city || 'N/A'} | ${t.description}`)
      .join('\n');

    return `
CONTESTO FINANZIARIO UTENTE (aggiornato ora):
- Mese corrente (${now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}): Entrate €${monthIncome.toFixed(2)}, Uscite €${monthExpense.toFixed(2)}, Saldo €${(monthIncome - monthExpense).toFixed(2)}
- Categorie principali (questo mese): ${topCats || 'nessuna'}

ULTIME 50 TRANSAZIONI (Formato: [Data] Importo | Categoria | Città | Nota):
${txHistory || 'Nessuna transazione recente.'}
    `.trim();
  } catch (e) {
    console.error('[aiChat] Failed to build context:', e);
    return 'CONTESTO: nessun dato disponibile nel database.';
  }
}

// ─── Main AI Chat Function ────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function askAiChat(userMessage: string, history: ChatMessage[] = []): Promise<AiChatResponse> {
  const apiKey = process.env.EXPO_PUBLIC_GROQ_FINANCE_API;
  if (!apiKey) throw new Error('Missing Groq API Key');

  const financialContext = await buildFinancialContext();
  const now = new Date();
  const currentDateISO = now.toISOString().split('T')[0];

  const systemPrompt = `Sei Wolly, un assistente finanziario personale intelligente e amichevole.
Rispondi SEMPRE in italiano, in modo conciso e utile.
Oggi è ${currentDateISO}.

${financialContext}

Il tuo compito è analizzare la domanda dell'utente e rispondere usando uno dei 4 ARCHEIPI definiti:

1. QUANTO (Risposta numerica)
   - Trigger: quanto, totale, speso, guadagnato, costo.
   - JSON: popola "total_data". Includi sempre "comparison" rispetto al periodo precedente.

2. COME (Distribuzione)
   - Trigger: come, dove, distribuzione, percentuale, di più.
   - JSON: popola "distribution_data". Max 5 voci + "Altro".

3. COSA (Lista)
   - Trigger: cosa, quali, lista, mostrami, transazioni.
   - JSON: popola "list_data". Max 5 item.

4. QUANDO (Timeline)
   - Trigger: quando, giorni, andamento, trend.
   - JSON: popola "timeline_data" con type "bar_vertical" (per giorni settimana) o "heatmap_calendar" (per mese).

REGOLE:
- FOCUS ASSOLUTO: Rispondi SOLO a ciò che l'utente ha chiesto. Non includere metriche, dati o analisi extra non richiesti.
- PERIODO TEMPORALE: Specifica SEMPRE chiaramente il periodo preso in analisi nella "text_response" (es. "A maggio...", "Nell'ultima settimana...", "Dall'inizio dell'anno...").
- Se l'utente chiede un totale, non mostrare la lista. Se chiede la lista, non mostrare la distribuzione, a meno che non sia strettamente necessario per la risposta.
- text_response: max 1-2 frasi, dritta al punto, includendo il periodo.
- Usa SOLO i dati reali forniti nel contesto sopra.
- Se la domanda non rientra negli archetipi, usa intent "text" e rispondi in modo conciso.

FORMATO JSON OBBLIGATORIO:
{
  "intent": "total" | "distribution" | "list" | "timeline" | "text",
  "text_response": "stringa",
  "total_data": { ... } | null,
  "distribution_data": { ... } | null,
  "list_data": { ... } | null,
  "timeline_data": { ... } | null
}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-5).map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: userMessage },
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

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
        max_tokens: 800,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`Groq API Error: ${response.status}`);

    const data = await response.json();
    const parsed: AiChatResponse = JSON.parse(data.choices[0].message.content);
    return parsed;
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error('[aiChat] Error:', error.message);
    return {
      intent: 'text',
      text_response: 'Mi dispiace, non sono riuscito a elaborare la tua richiesta. Riprova tra un momento.',
      chart: null,
    };
  }
}
