import { TransactionRepository } from './database/repositories/TransactionRepository';

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

export interface AiListPayload {
  title: string;
  items: {
    date: string;
    description: string;
    amount: number;
    category_key: string;
    city?: string;
  }[];
}

export interface AiChatResponse {
  intent: 'text' | 'chart' | 'list';
  text_response: string;
  chart: AiChartPayload | null;
  list: AiListPayload | null;
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

export async function askAiChat(userMessage: string): Promise<AiChatResponse> {
  const apiKey = process.env.EXPO_PUBLIC_GROQ_FINANCE_API;
  if (!apiKey) throw new Error('Missing Groq API Key');

  const financialContext = await buildFinancialContext();
  const now = new Date();
  const currentDateISO = now.toISOString().split('T')[0];

  const systemPrompt = `Sei Wolly, un assistente finanziario personale intelligente e amichevole.
Rispondi SEMPRE in italiano, in modo conciso e utile.
Oggi è ${currentDateISO}.

${financialContext}

Il tuo compito:
1. Analizza la domanda dell'utente. Hai accesso alle ultime 50 transazioni con data, importo, categoria, città e descrizione.
2. Puoi FILTRARE i dati (es. solo spese a "Milano"), ORDINARLI (es. la spesa più alta) e AGGREGARLI per rispondere.
3. Rispondi con un JSON strutturato.

REGOLE:
- Se l'utente chiede un elenco o una ricerca specifica (es. "le mie ultime spese", "cerca sushi") → usa intent "list" e popola l'oggetto "list".
- Se la domanda richiede un'analisi visuale o un confronto → usa intent "chart" (bar, pie o line).
- text_response: sempre presente, molto breve, introduce il risultato.
- chart: null se non richiesto.
- list: null se non richiesto.

FORMATO JSON OUTPUT OBBLIGATORIO:
{
  "intent": "text" | "chart" | "list",
  "text_response": "stringa",
  "chart": {
    "type": "bar" | "pie" | "line",
    "title": "stringa",
    "data": [{ "label": "stringa", "value": numero }]
  } | null,
  "list": {
    "title": "stringa",
    "items": [{ "date": "YYYY-MM-DD", "description": "stringa", "amount": numero, "category_key": "stringa", "city": "stringa" }]
  } | null
}`;

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
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
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
