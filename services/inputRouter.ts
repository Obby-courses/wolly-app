/**
 * InputRouter — Router deterministico zero-latency.
 * Non chiama alcuna API. Usa solo pattern regex per smistare l'input.
 *
 * Route:
 *  - 'expense'  → contiene importo o verbo di spesa → parseExpenseWithAI → /expense-detail
 *  - 'query'    → contiene keyword interrogativa o analitica → /ai-chat
 *  - 'unknown'  → nessun segnale finanziario → mostra toast
 */

export type RouteResult = 'expense' | 'query' | 'advice' | 'unknown';

// ─── Pattern per ADVICE (consigli finanziari bloccati) ─────────────────────────
const ADVICE_PATTERNS = [
  /\b(consigli[oi]|suggeriment[oi]|raccomandazion[ei])\s+finanziari[oi]?\b/i,
  /\bcome\s+(investire|comprare\s+azioni|fare\s+trading|investo)\b/i,
  /\b(dove|in\s+cosa)\s+(conviene\s+investire|metto\s+i\s+miei\s+soldi|investo)\b/i,
  /\bconsigliami\s+(un\s+investimento|come\s+risparmiare|su\s+cosa\s+comprare)\b/i,
  /\b(azioni|criptovalute|bitcoin|borsa)\s+da\s+comprare\b/i,
  /\bconsigli[o]?\s+(di|su)\s+risparmio\b/i,
];

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
  /\b(quanto|quante|quanti|quanta|quant'era|quant'è)\b/i,
  /\b(come\s+ho\s+speso|dove\s+spendo|cosa\s+ho\s+speso)\b/i,
  /\b(mostrami|dimmi|analizza|fammi\s+vedere|mostra)\b/i,
  /\b(media|totale|somma|conteggio|confronta|comparazione)\b/i,
  /\b(abbonament[io]|spes[ae]|entrat[ae]|uscit[ae]|prevision[ei]|prossim[oaei]|futur[oaei]|programmat[oaei])\b/i,
  /\b(questo\s+mese|quest'anno|questa\s+settimana|nel\s+mese|nell'anno)\b/i,
  /\b(categoria|categorie|distribuzione|grafico|andamento)\b/i,
  /\bqual[ei]?\b/i,
  /\bwolly\b/i,
];

// Pattern interrogativi o analitici STRETTI (che definiscono una query anche se c'è un importo)
const STRICT_QUERY_PATTERNS = [
  /\b(quanto|quante|quanti|quanta|quant'era|quant'è)\b/i,
  /\b(come\s+ho\s+speso|dove\s+spendo|cosa\s+ho\s+speso)\b/i,
  /\b(mostrami|dimmi|analizza|fammi\s+vedere|mostra)\b/i,
  /\b(media|somma|conteggio|confronta|comparazione|grafico|andamento|distribuzione)\b/i,
  /\bqual[ei]?\b/i,
];

// ─── Router ───────────────────────────────────────────────────────────────────

export function routeInput(text: string): RouteResult {
  const t = text.trim();
  if (!t || t.length < 2) return 'unknown';

  const isAdvice = ADVICE_PATTERNS.some(p => p.test(t));
  if (isAdvice) return 'advice';

  const hasAmount = AMOUNT_PATTERNS.some(p => p.test(t));
  const hasExpenseVerb = EXPENSE_VERB_PATTERNS.some(p => p.test(t));
  const hasQuery = QUERY_PATTERNS.some(p => p.test(t));
  const hasStrictQuery = STRICT_QUERY_PATTERNS.some(p => p.test(t));

  // Regola 1: se c'è un importo e NON c'è un intento interrogativo/analitico stretto, è SEMPRE una spesa (registrazione)
  if (hasAmount && !hasStrictQuery) return 'expense';

  // Regola 2: importo + verbo di spesa (precedenza massima)
  if (hasAmount && hasExpenseVerb) return 'expense';

  // Regola 3: keyword interrogativa/analitica
  if (hasQuery) return 'query';

  // Regola 4: solo verbo di spesa senza importo → query (per sicurezza, non expense)
  if (hasExpenseVerb && !hasAmount) return 'query';

  // Regola 5: nessun segnale → unknown
  return 'unknown';
}
