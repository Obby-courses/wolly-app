---
# Filo — Product Spec & Development Rules

## Cos'è Filo
Filo non è un'app di budgeting. È un decision layer pre-acquisto.
Interviene prima che l'utente spenda, non dopo.
Tono AI: amico diretto, mai giudicante, un po' cinico. Mai formale.
Esempio tono: "Questo mese hai già speso €340 in impulso. Coincidenza?"
Mai scrivere: "Hai superato il budget" · "Ottimo lavoro!" · "Ti consiglio di..."
Nessun colore rosso nell'app. Mai.

## Stack
- Framework: React Native + Expo (Expo Go compatible)
- Target: iOS first (Expo Go per development), Android second
- Database fase 1: locale con AsyncStorage (nessun cloud)
- Database fase 2 (futuro): Supabase — lo schema locale è già pronto per migrazione
- Pagamenti (futuro): Stripe
- Voice: Groq Whisper API
- OCR: Google Vision API
- AI Parser: OpenAI GPT-4o mini

## Regole di sviluppo — SEMPRE rispettare
1. Modulare: ogni feature è un file/modulo indipendente
2. Non distruttivo: mai modificare funzioni esistenti, solo estendere
3. Un problema per prompt: ogni sessione Cursor risolve una macro-area
4. Nessun salvataggio dentro i parser — i parser restituiscono solo dati
5. Tipi TypeScript su tutto — niente any
6. Commenti solo dove la logica non è ovvia
7. Ogni modulo esporta funzioni pure testabili

## Struttura cartelle (da rispettare sempre)
/app
  index.tsx              → home placeholder
  test-registration.tsx  → screen di test parsing (rimossa in produzione)
/modules
  /registration
    voiceParser.ts       → Groq Whisper + GPT-4o mini
    receiptParser.ts     → Google Vision + GPT-4o mini
    manualParser.ts      → parsing keyword-based senza AI
    expenseParser.ts     → funzione shared parseExpenseText (GPT-4o mini)
    types.ts             → tipo ParsedExpense
/services
  groq.ts                → client Groq API
  openai.ts              → client OpenAI API
  googleVision.ts        → client Google Vision API
/constants
  categoryKeywords.ts    → mappa keyword → categoria emotiva
  emotionalCategories.ts → lista categorie con label italiano
/storage
  localExpenses.ts       → AsyncStorage read/write (fase 1)
  schema.ts              → struttura dati locale (pronta per Supabase)

## Stato moduli
- [x] Registrazione — parsing (questo prompt)
- [ ] Registrazione — salvataggio locale
- [ ] Gestione e raccolta
- [ ] Wishlist
- [ ] Programmazione spese
- [ ] Money Wrapped

## Categorie emotive
necessità · cura_di_sé · amicizie · passioni · impulso · ansia · obiettivi

## Schema ParsedExpense (locale, pronto per Supabase)
Questo tipo è la struttura centrale. Tutto il parsing produce questo output.
{
  id: string (uuid generato lato client)
  amount: number (importo lordo pagato)
  net_amount: number (importo reale a carico dell'utente)
  description: string
  category_emotional: EmotionalCategory
  is_impulsive: boolean
  refund: { amount: number, from: string, expected_date: string | null } | null
  split: { total_people: number, user_share: number } | null
  input_method: 'voice' | 'receipt' | 'manual'
  raw_input: string (testo originale per debug)
  created_at: string (ISO timestamp)
  is_deleted: boolean (per futura sync Supabase)
  synced_at: string | null (null finché non va su cloud)
}
---
