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

export interface AiChatResponse {
  intent: 'text' | 'chart';
  text_response: string;
  chart: AiChartPayload | null;
}

// ─── Context Builder ──────────────────────────────────────────────────────────

async function buildFinancialContext(): Promise<string> {
  try {
    const now = new Date();
    const thisMonthStats = await TransactionRepository.getDailyStatsForMonth(
      now.getFullYear(),
      now.getMonth() + 1
    );
    const yearStats = await TransactionRepository.getMonthlyStatsForYear(now.getFullYear());
    const catDist = await TransactionRepository.getCategoryDistribution('Mese');

    const monthIncome = thisMonthStats.reduce((a, c) => a + c.income, 0);
    const monthExpense = thisMonthStats.reduce((a, c) => a + c.expense, 0);

    const topCats = catDist
      .slice(0, 5)
      .map((c) => `${c.category_key}: €${c.total.toFixed(2)}`)
      .join(', ');

    const yearSummary = yearStats
      .filter((m) => m.income > 0 || m.expense > 0)
      .map((m) => {
        const months = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
        return `${months[m.month - 1]}: in €${m.income.toFixed(0)}, out €${m.expense.toFixed(0)}`;
      })
      .join(' | ');

    return `
CONTESTO FINANZIARIO UTENTE (aggiornato ora):
- Mese corrente (${now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}): Entrate €${monthIncome.toFixed(2)}, Uscite €${monthExpense.toFixed(2)}, Saldo €${(monthIncome - monthExpense).toFixed(2)}
- Categorie principali questo mese: ${topCats || 'nessuna transazione'}
- Riepilogo annuale per mese: ${yearSummary || 'nessun dato'}
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
1. Analizza la domanda dell'utente nel contesto dei suoi dati finanziari.
2. Rispondi con un JSON strutturato secondo il formato seguente.

REGOLE:
- Se la domanda richiede un'analisi visuale o un confronto tra categorie/periodi → usa intent "chart".
- Se la domanda è generica, un consiglio o una spiegazione → usa intent "text".
- text_response: sempre presente, max 3 frasi, conversazionale.
- chart: null se intent è "text". Se intent è "chart", scegli il tipo più adatto:
  - "bar": confronti tra categorie o periodi
  - "pie": distribuzione percentuale
  - "line": andamento nel tempo
- Per i dati del grafico, usa i dati reali del contesto fornito sopra.

FORMATO JSON OUTPUT OBBLIGATORIO:
{
  "intent": "text" | "chart",
  "text_response": "stringa",
  "chart": {
    "type": "bar" | "pie" | "line",
    "title": "stringa",
    "data": [{ "label": "stringa", "value": numero }]
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
