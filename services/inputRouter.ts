/**
 * InputRouter — Router deterministico zero-latency.
 * Non chiama alcuna API. Usa solo pattern regex per smistare l'input.
 *
 * Route:
 *  - 'expense'  → contiene importo o verbo di spesa → parseExpenseWithAI → /expense-detail
 *  - 'query'    → contiene keyword interrogativa o analitica → /ai-chat
 *  - 'unknown'  → nessun segnale finanziario → mostra toast
 */

export type RouteResult = 'expense' | 'query' | 'unknown';

// ─── Pattern per EXPENSE (registrazione) ─────────────────────────────────────

// Importi numerici: "5€", "€5", "5 euro", "cinque euro", "12,50", ecc.
const AMOUNT_PATTERNS = [
  /\d+([.,]\d+)?\s*€/i,
  /€\s*\d+/i,
  /\d+\s*(euro|eur)\b/i,
  /\b(uno|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|venti|trenta|quaranta|cinquanta|sessanta|settanta|ottanta|novanta|cento)\s*(euro|€)/i,
];

// Verbi di spesa/acquisto che implicano una registrazione
const EXPENSE_VERB_PATTERNS = [
  /\bho\s+(speso|pagato|comprato|acquistato|preso|mangiato|bevuto|preso)\b/i,
  /\b(speso|pagato|comprato|acquistato)\b/i,
  /\bricevuto\s+\d+/i,
  /\bguadagnato\s+\d+/i,
  /\bentrata\s+di\s+\d+/i,
];

// ─── Pattern per QUERY (analisi AI) ───────────────────────────────────────────

const QUERY_PATTERNS = [
  /\b(quanto|quante|quanti|quanta)\b/i,
  /\b(come\s+ho\s+speso|dove\s+spendo|cosa\s+ho\s+speso)\b/i,
  /\b(mostrami|dimmi|analizza|fammi\s+vedere|mostra)\b/i,
  /\b(media|totale|somma|conteggio|confronta|comparazione)\b/i,
  /\b(abbonament[io]|spese?|entrate?|uscite?)\b/i,
  /\b(questo\s+mese|quest'anno|questa\s+settimana|nel\s+mese|nell'anno)\b/i,
  /\b(categoria|categorie|distribuzione|grafico|andamento)\b/i,
  /\bwolly\b/i,
];

// ─── Router ───────────────────────────────────────────────────────────────────

export function routeInput(text: string): RouteResult {
  const t = text.trim();
  if (!t || t.length < 2) return 'unknown';

  const hasAmount = AMOUNT_PATTERNS.some(p => p.test(t));
  const hasExpenseVerb = EXPENSE_VERB_PATTERNS.some(p => p.test(t));
  const hasQuery = QUERY_PATTERNS.some(p => p.test(t));

  // Regola 1: importo + verbo di spesa → expense (precedenza massima)
  if (hasAmount && hasExpenseVerb) return 'expense';

  // Regola 2: solo importo numerico → expense
  if (hasAmount && !hasQuery) return 'expense';

  // Regola 3: keyword interrogativa/analitica → query
  if (hasQuery) return 'query';

  // Regola 4: solo verbo di spesa senza importo → query (per sicurezza, non expense)
  if (hasExpenseVerb && !hasAmount) return 'query';

  // Regola 5: nessun segnale → unknown
  return 'unknown';
}
