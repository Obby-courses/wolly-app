import { ParsedExpense, RawParsingResult } from '../modules/registration/types';
import uuid from 'react-native-uuid';
import { parseFromManual } from '../modules/registration/manualParser';
import { DOMAINS_CONFIG, ALL_CATEGORIES, getDomainForCategory } from '../constants/categories';
import { COMUNI_ITALIANI } from '../constants/comuni';
import { supabase } from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TransactionRepository } from './database/repositories/TransactionRepository';

// ── Distanza di Levenshtein (inline, nessuna dipendenza npm) ───────────────────────
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (__, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Confronta ogni elemento di `inputs` con la lista `known`.
 * Se la distanza di Levenshtein è ≤ maxDist, restituisce il valore del DB.
 * Altrimenti mantiene l'originale.
 */
function normalizeToKnownValues(
  inputs: string[],
  known: string[],
  maxDist = 2
): string[] {
  return inputs.map(input => {
    const lower = input.toLowerCase();
    let bestMatch = input;
    let bestDist = Infinity;
    for (const k of known) {
      const d = levenshtein(lower, k.toLowerCase());
      if (d < bestDist) {
        bestDist = d;
        bestMatch = k;
      }
    }
    if (bestDist <= maxDist && bestMatch !== input) {
      console.log(`🔄 [NORMALIZE] "${input}" → "${bestMatch}" (dist=${bestDist})`);
      return bestMatch;
    }
    return input;
  });
}

export interface SubscriptionSuggestion {
  suggest_subscription: boolean;
  subscription_name?: string;
  subscription_amount?: number;
  subscription_frequency?: 'monthly' | 'weekly' | 'biweekly' | 'yearly';
  subscription_day?: number; // day-of-month or day-of-week
}

export type ParsedExpenseWithSuggestion = ParsedExpense & { subscription?: SubscriptionSuggestion };

export async function parseExpenseWithAI(
  text: string, 
  context: 'voice' | 'receipt' | 'manual' | 'text', 
  locationContext?: { city: string | null; address: string | null }
): Promise<ParsedExpenseWithSuggestion> {
  const apiKey = process.env.EXPO_PUBLIC_GROQ_FINANCE_API;
  if (!apiKey) throw new Error('Missing Groq API Key (EXPO_PUBLIC_GROQ_FINANCE_API)');

  const now = new Date();
  const currentTimestamp = now.toISOString();
  const currentDayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const currentDayName = currentDayNames[now.getDay()];

  const currentDateISO = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

  const systemPrompt = `Sei l'Analista Finanziario Senior di Wolly. Il tuo compito è estrarre dati strutturati con precisione millimetrica.
REQUISITO: Restituisci SOLO un oggetto JSON valido.

CONTESTO TEMPORALE (TELEFONO UTENTE):
- Data di oggi: ${currentDateISO} (${currentDayName})
- Ora attuale: ${currentTime}

TASSONOMIA UFFICIALE:
Ogni transazione ha una CATEGORIA specifica (voce dettagliata) che appartiene univocamente a un DOMINIO (macro-gruppo).
Restituisci SEMPRE un category_key specifico. Il domain_key si deduce automaticamente.

DOMINI e relative CATEGORIE (domain_key -> [category_key1, category_key2, ...]):
- cibo_bevande -> [alimentari, ristorante_fast_food, bar_caffe]
- acquisti -> [abbigliamento_scarpe, gioielli_accessori, salute_bellezza, bambini, casa_giardino, animali, elettronica_accessori, regali_gioia, cancelleria_attrezzi, tempo_libero, drogheria_farmacia]
- alloggio -> [affitto, mutuo, energia_utenze, manutenzione_riparazioni, assicurazione_proprieta]
- trasporti -> [trasporto_pubblico, taxi, lunga_distanza, viaggi_lavoro]
- veicolo -> [carburante, parcheggio, manutenzione_veicoli, noleggio, assicurazione_veicolo, leasing]
- vita_intrattenimento -> [assistenza_sanitaria, wellness_bellezza, sport_fitness, cultura_eventi, eventi_vita, hobby, formazione_sviluppo, libri_audio_abbonamenti, tv_streaming, vacanze_viaggi_hotel, beneficienza_regali, alcool_tabacco, lotteria_azzardo]
- comunicazione_pc -> [telefono_cellulare, internet, software_app_giochi, servizi_postali]
- spese_finanziarie -> [tasse, assicurazioni, prestiti_interessi, multe, consulenza, commissioni, mantenimento]
- investimenti -> [immobili, veicoli_beni_immobili, investimenti_finanziari, risparmi, collezioni]
- entrata -> [salario_fatture, interessi_dividendi, vendita, entrate_affitto, quote_sovvenzioni, entrata_prestiti, assegni_buoni, lotteria_azzardo, rimborsi, regali]

  REGOLE CRITICHE:
1. category_key: Scegli la categoria specifica più precisa.
   - ASSENZA DI INFORMAZIONI: Se l'input dell'utente NON contiene alcun segnale, negozio, brand o contesto che permetta di dedurre la categoria (es. solo "Spesi 10€", "Ho pagato 50 euro", "Registra 15€"), NON inventare una categoria a caso! In questo caso specifico di assenza totale di contesto, devi valorizzare obbligatoriamente:
     "category_key": "altro_altro",
     "domain_key": "altro"
2. domain_key: Inserisci il dominio di appartenenza della categoria scelta (es: "vita_intrattenimento" per "cultura_eventi").
3. NET_AMOUNT: Deve essere UGUALE ad amount se non ci sono rimborsi (refund) o divisioni (split). NON sottrarre l'IVA.
4. IMPORTO (amount): Cerca il "TOTALE" finale. Esempio Scontrini: se vedi "Totale 19,00" e "Contanti 20,00", l'amount è 19,00.
5. SCONTRINI (receipt): "social_context": null, "is_social": false.
6. BRAND: SUBDUED -> category_key: "abbigliamento_scarpe", domain_key: "acquisti".
7. DATA E ORA: Se l'input contiene riferimenti temporali relativi (es. "poco fa", "stasera", "ieri"), calcola la data/ora reale partendo da ${currentDateISO} ${currentTime}. 
   - "date": deve essere sempre "YYYY-MM-DD". Default: ${currentDateISO}.
   - "time": deve essere sempre "HH:mm". Default: ${currentTime} se non specificato diversamente.
8. DIRECTION: Deduci da contesto ("pagato", "speso" → "out"; "ricevuto", "stipendio", "rimborso" → "in"). Se l'input contiene solo un importo e un negozio/categoria (es: "50€ al bar", "10 euro da Esselunga", "15€ di sigarette") senza verbi specifici, assumi SEMPRE che sia una spesa ("out"). Default: "out".
9. VENDITORE:
   - location_name: Estrai il nome del brand o negozio (es: "Esselunga", "Amazon", "McDonald's"). Se è un acquisto online, metti is_online = true e location_type = "online".
   - city e address: Estrai città e indirizzo se menzionati esplicitamente (es: "a Milano", "in via Torino"). 
10. PERSONE: Estrai nomi propri menzionati in people_mentioned. Deduci social_context: "friends", "family", "colleagues", "couple", "strangers", "alone". Se non specificato, usa null.
11. LOCATION TYPE: Deduci location_type tra: "home", "restaurant", "physical_store", "online", "transport", "work", "travel", "abroad".
  "amount": number,
  "net_amount": number,
  "currency": "EUR",
  "payment_method": null,
  "direction": "in"|"out",
  "domain_key": "string",
  "category_key": "string",
  "category_confidence": number,
  "date": "YYYY-MM-DD"|null,
  "time": "HH:mm"|null,
  "time_of_day": "morning"|"afternoon"|"evening"|"night"|null,
  "is_weekend": boolean,
  "day_of_week": string|null,
  "social_context": "friends"|"couple"|"family"|"colleagues"|"strangers"|"alone"|null,
  "people_mentioned": string[],
  "group_size": number|null,
  "is_social": boolean,
  "location_type": "home"|"restaurant"|"physical_store"|"online"|"transport"|"work"|"travel"|"abroad"|null,
  "location_name": string|null,
  "city": string|null,
  "address": string|null,
  "is_travel": boolean,
  "is_online": boolean,
  "reason": string|null,
  "description": "string",
  "refund": null,
  "split": null,
  "holiday": string|null,
  "tags": string[]|null,
  "suggest_subscription": boolean,
  "subscription_name": string|null,
  "subscription_amount": number|null,
  "subscription_frequency": "monthly"|"weekly"|"biweekly"|"yearly"|null,
  "subscription_day": number|null
}

REGOLE AGGIUNTIVE:
12. HOLIDAY: Estrai il nome della festività (es: "Natale", "Pasqua", "Ferragosto") SOLO se menzionata esplicitamente. Altrimenti null.
13. TAGS: Non inventare o dedurre mai dei tag. Inserisci dei tag in "tags" SOLO ed esclusivamente se l'utente ha esplicitamente richiesto di usare un tag (es. "aggiungi tag lavoro", "tag trasferta", o l'uso esplicito del termine "tag" o "#"). NON inserire mai tag che fanno riferimento a categorie, brand, negozi, metodi di pagamento, città o festività che sono già rappresentati in altri campi del JSON (es. NO tag "abbonamento", NO tag "netflix", NO tag "milano", NO tag "ristorante", NO tag "spesa"). Se non ci sono tag richiesti esplicitamente dall'utente, imposta "tags" a null o array vuoto.
14. AMBIGUITÀ VIAGGIO: Se l'utente dice "viaggio di lavoro" o "viaggio" senza specificare cosa ha comprato (es: "5€ viaggio"), NON usare categorie di trasporto. Usa category_key: "tempo_libero". Inserisci "viaggio" o "viaggio di lavoro" nel campo tags SOLO se l'utente ha usato esplicitamente la parola "tag viaggio" o "#viaggio".
15. VALIDITÀ SCONTRINO (receipt): Se l'input (sotto forma di testo estratto da scontrino) non contiene alcuna informazione riconducibile ad acquisti, spese, transazioni finanziarie o importi monetari validi, imposta sempre "amount": 0.
16. ABBONAMENTI STREAMING E APP: Per abbonamenti TV, serie, film, o streaming video (es. Netflix, Disney, Disney+, Disney Plus, Prime Video, Amazon Prime Video, DAZN, YouTube Premium) usa SEMPRE category_key: "tv_streaming" e domain_key: "vita_intrattenimento". Per abbonamenti musicali o audio (es. Spotify, Apple Music, Audible) usa category_key: "libri_audio_abbonamenti" e domain_key: "vita_intrattenimento". Per app/software/cloud generici (es. Microsoft 365, Office, Adobe, iCloud, Google One, Chat GPT, ChatGPT) usa category_key: "software_app_giochi" e domain_key: "comunicazione_pc".
17. GELATERIE E GELATO: Se l'acquisto o il luogo citato fa riferimento a un "gelato" o a una "gelateria" (es. "cono", "coppetta", "gelato al cioccolato"), assegna sempre category_key: "bar_caffe" (dominio: "cibo_bevande") anziché "alimentari", a meno che il luogo d'acquisto (location_name) non sia esplicitamente identificabile come un supermercato (es. Esselunga, Conad, Coop, Carrefour, Lidl, ecc.).

REGOLA PERIODICA: Imposta "suggest_subscription": true se l'importo ha pattern da pagamento periodico/ricorrente. Questo include:
  - USCITE periodiche: abbonamenti (Netflix, Spotify, Amazon Prime, Adobe, palestra), affitto pagato, assicurazione, bollette, rate, importi fissi ricorrenti (9.99, 15.99, etc.)
  - ENTRATE periodiche: stipendio, salario, rendita, affitto ricevuto, pensione, borsa di studio mensile, entrate fisse ricorrenti
  In tutti gli altri casi imposta false e gli altri campi abbonamento a null.
  Se "suggest_subscription" è true, "subscription_name" NON deve mai essere null o vuoto. Se il nome dell'abbonamento o stipendio non è specificato esplicitamente dall'utente, deducilo sempre dalla categoria o dal contesto (ad es. "Palestra" se inerente a sport/palestre, "Bolletta" se inerente a utenze/bollette/luce/gas, "Affitto" per spese di casa/affitto, "Stipendio" per entrate ricorrenti, "Abbonamento" o nome servizio come "Netflix" o "Spotify" per tv/musica/streaming).
`;

  // ─── Anti-abuso: limite mensile 500 richieste per device (locale per Privacy) ────────────────────
  try {
    const firstDayOfMonth = new Date();
    const currentMonthKey = `${firstDayOfMonth.getFullYear()}-${(firstDayOfMonth.getMonth() + 1).toString().padStart(2, '0')}`;
    
    const usageStr = await AsyncStorage.getItem('wolly_ai_usage_monthly');
    let localCount = 0;
    
    if (usageStr) {
      const usageData = JSON.parse(usageStr);
      if (usageData.month === currentMonthKey) {
        localCount = usageData.count || 0;
      }
    }
    
    const MONTHLY_LIMIT = 500;
    if (localCount >= MONTHLY_LIMIT) {
      const { Alert } = await import('react-native');
      Alert.alert(
        '⚡ Limite mensile raggiunto',
        `Hai effettuato ${localCount} analisi AI questo mese. Il limite è di ${MONTHLY_LIMIT} richieste. Riprova il mese prossimo!`,
      );
      throw new Error(`[Anti-abuso] Limite mensile raggiunto: ${localCount}/${MONTHLY_LIMIT}`);
    }
  } catch (abuseError: any) {
    if (abuseError.message?.startsWith('[Anti-abuso]')) throw abuseError;
    // Errore nel controllo anti-abuso → non blocchiamo (fail open per UX)
    console.warn('[groqParser] Controllo anti-abuso fallito (ignorato):', abuseError);
  }

  try {
    let retries = 2;
    let lastError;

    while (retries >= 0) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Analizza questo input finanziario (${context}): '${text}'` }
            ],
            max_tokens: 1000,
            response_format: { type: 'json_object' }
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`Groq API Error: ${response.status}`);

        const data = await response.json();
        const result: RawParsingResult = JSON.parse(data.choices[0].message.content);

        // --- LOG DI DEBUG IN TERMINALE ---
        console.log(" \n" + "=".repeat(50));
        console.log("🔍 [AI PARSING DEBUG]");
        console.log(`📝 INPUT: "${text}"`);
        console.log(`💰 IMPORTO: ${result.amount} ${result.currency} (${result.direction === 'in' ? 'Entrata' : 'Uscita'})`);
        console.log(`🏠 DOMINIO: ${(result as any).domain_key || 'non specificato'}`);
        console.log(`📂 CATEGORIA: ${result.category_key}`);
        console.log(`🎯 CONFIDENCE: ${(result.category_confidence * 100).toFixed(0)}%`);
        console.log(`📍 LOCATION: ${result.location_name || 'non rilevata'} (${result.location_type || '?'})`);

        // Validazione Tassonomia - ora category_key è la voce specifica
        const isAltro = result.category_key === 'altro_altro';
        const validCategory = isAltro ? null : ALL_CATEGORIES.find(c => c.key === result.category_key);

        if (!validCategory && !isAltro) {
          console.log("⚠️  [VALIDATION WARNING]: category_key non trovata in categories.ts!");
          console.log(`   - Richiesta: ${result.category_key} (dominio atteso: ${(result as any).domain_key})`);

          // Fallback: prova a usare domain_key come categoria generica o verifica se è solo un dominio generico valido
          const fallbackDomain = DOMAINS_CONFIG.find(d => d.key === (result as any).domain_key || d.key === result.category_key);
          if (fallbackDomain && fallbackDomain.categories.length > 0) {
            result.category_key = fallbackDomain.categories[0].key;
            console.log(`   - Fallback a: ${result.category_key}`);
          } else {
            result.category_key = 'altro_altro';
            console.log(`   - Fallback ad altro_altro (non classificata)`);
          }
        } else if (isAltro) {
          (result as any).domain_key = 'altro';
          console.log("✅ [VALIDATION SUCCESS]: Categoria 'altro_altro' rilevata correttamente.");
        } else {
          // Assicura che domain_key sia sempre corretto (ridondanza)
          (result as any).domain_key = validCategory!.domain_key;
          console.log("✅ [VALIDATION SUCCESS]: Categoria valida.");
        }
        // Manteniamo subcategory_key = category_key per compatibilità DB
        result.subcategory_key = result.category_key;

        console.log("=".repeat(50) + "\n");

        // Calcolo programmatico del giorno della settimana
        let finalDayOfWeek = result.day_of_week;
        if (result.date) {
          try {
            const parsedDate = new Date(result.date);
            if (!isNaN(parsedDate.getTime())) {
              const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
              finalDayOfWeek = days[parsedDate.getDay()];
            }
          } catch (e) {
            console.warn("Could not parse date for day_of_week calculation", e);
          }
        }

        // FORCE NULL on social context for receipts in JS
        if (context === 'receipt') {
          result.social_context = null;
          result.is_social = false;
          result.people_mentioned = [];
          result.group_size = null;
        }

        // --- VALIDAZIONE CITTÀ (COMUNI ITALIANI) ---
        if (result.city && typeof result.city === 'string' && result.city.trim() !== '') {
          const cleanCity = result.city.trim().toLowerCase();
          const exactMatch = COMUNI_ITALIANI.find(c => c.n.toLowerCase() === cleanCity);
          if (exactMatch) {
            console.log(`📍 [City Match] Trovata corrispondenza esatta per: ${result.city} -> ${exactMatch.n}`);
            result.city = exactMatch.n;
            if (!result.address || result.address.trim() === '') {
              result.address = `${exactMatch.r}, Italia`;
            }
          } else {
            const partialMatch = COMUNI_ITALIANI.find(c => 
              c.n.toLowerCase().includes(cleanCity) || cleanCity.includes(c.n.toLowerCase())
            );
            if (partialMatch) {
              console.log(`📍 [City Match] Trovata corrispondenza parziale per: ${result.city} -> ${partialMatch.n}`);
              result.city = partialMatch.n;
              if (!result.address || result.address.trim() === '') {
                result.address = `${partialMatch.r}, Italia`;
              }
            }
          }
        }

        // --- NORMALIZZAZIONE TAG & PERSONE (Levenshtein) ---
        // Solo per input vocali: confronta tag/persone estratti dall'AI con quelli
        // già nel DB. Se la distanza è ≤ 2 caratteri, usa il valore esistente.
        // Questo corregge varianti fonetiche (es. "Stefen" → "Stefano", "woly" → "wolly").
        if (context === 'voice') {
          try {
            const [knownTags, knownPeople] = await Promise.all([
              TransactionRepository.getDistinctTags(),
              TransactionRepository.getDistinctPeople(),
            ]);
            if (knownTags.length > 0 && Array.isArray(result.tags) && result.tags.length > 0) {
              result.tags = normalizeToKnownValues(result.tags, knownTags);
            }
            if (knownPeople.length > 0 && Array.isArray(result.people_mentioned) && result.people_mentioned.length > 0) {
              result.people_mentioned = normalizeToKnownValues(result.people_mentioned, knownPeople);
            }
          } catch (e) {
            console.warn('[groqParser] Normalizzazione tag/persone fallita (ignorata):', e);
          }
        }
        // ─────────────────────────────────────────────────────────────────────────

        // --- LOGICA PASTO (MEAL TYPE) ---
        // Una transazione in un bar o ristorante tra 07:00–10:30 è colazione. 
        // Tra 12:00–14:30 è pranzo.
        if (result.category_key === 'ristorante_fast_food' || result.category_key === 'bar_caffe') {
          const time = result.time || (result.date === currentDateISO ? now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0') : null);
          
          if (time) {
            const [hours, minutes] = time.split(':').map(Number);
            const totalMinutes = hours * 60 + minutes;
            let mealTypeLabel = '';

            if (totalMinutes >= 7 * 60 && totalMinutes <= 10 * 60 + 30) {
              mealTypeLabel = 'Colazione';
            } else if (totalMinutes >= 12 * 60 && totalMinutes <= 14 * 60 + 30) {
              mealTypeLabel = 'Pranzo';
            }

            if (mealTypeLabel) {
              result.description = result.description 
                ? `${result.description} (${mealTypeLabel})` 
                : mealTypeLabel;
            }
          }
        }

        // Extract subscription suggestion from AI response
        let subName = (result as any).subscription_name;
        if (!!(result as any).suggest_subscription && (!subName || subName.trim() === '')) {
          if (result.category_key) {
            const lowerCat = result.category_key.toLowerCase();
            if (lowerCat.includes('bollette') || lowerCat.includes('utenze') || lowerCat.includes('energia') || lowerCat.includes('gas') || lowerCat.includes('luce')) {
              subName = 'Bolletta';
            } else if (lowerCat.includes('affitto') || lowerCat.includes('casa') || lowerCat.includes('mutuo')) {
              subName = 'Affitto';
            } else if (lowerCat.includes('sport') || lowerCat.includes('fitness') || lowerCat.includes('palestra')) {
              subName = 'Palestra';
            } else if (lowerCat.includes('stipendio') || lowerCat.includes('stipendi') || lowerCat.includes('entrata_ricorrente') || lowerCat.includes('entrate')) {
              subName = 'Stipendio';
            } else if (lowerCat.includes('tv') || lowerCat.includes('streaming') || lowerCat.includes('film') || lowerCat.includes('video')) {
              subName = 'Abbonamento Streaming';
            } else if (lowerCat.includes('music') || lowerCat.includes('spotify') || lowerCat.includes('audio') || lowerCat.includes('libri')) {
              subName = 'Abbonamento Audio';
            } else if (lowerCat.includes('software') || lowerCat.includes('app') || lowerCat.includes('cloud')) {
              subName = 'Abbonamento Software';
            } else {
              const parts = result.category_key.split('_');
              subName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
            }
          }
          if (!subName && result.description) {
            subName = result.description;
          }
          if (!subName) {
            subName = 'Abbonamento';
          }
        }

        const subscriptionSuggestion: SubscriptionSuggestion = {
          suggest_subscription: !!(result as any).suggest_subscription,
          subscription_name: subName ? subName.trim() : undefined,
          subscription_amount: (result as any).subscription_amount || undefined,
          subscription_frequency: (result as any).subscription_frequency || undefined,
          subscription_day: (result as any).subscription_day || undefined,
        };

        if (subscriptionSuggestion.suggest_subscription) {
          console.log(`📅 [SUBSCRIPTION SUGGESTION]: ${subscriptionSuggestion.subscription_name} ${subscriptionSuggestion.subscription_frequency}`);
        }

        // --- TRACKING: PARSING_LOGS ---
        const endTime = new Date();
        let logId: string | undefined;
        let statusCode = '200';
        
        const tokenUsage = data.usage ? {
          prompt: data.usage.prompt_tokens,
          completion: data.usage.completion_tokens,
          total: data.usage.total_tokens
        } : null;

        let computedCost = 0.0;
        if (tokenUsage) {
          // Llama 3.3 70b Versatile Groq Pricing: $0.59 / 1M prompt, $0.79 / 1M completion
          computedCost = (tokenUsage.prompt * 0.59 + tokenUsage.completion * 0.79) / 1000000;
        }
        if (context === 'receipt') computedCost += 0.0015; // Stimiamo 0.0015 per OCR esterno eventuale

        // Incrementa contatore locale per controllo anti-abuso (GDPR compliant)
        try {
          const firstDayOfMonth = new Date();
          const currentMonthKey = `${firstDayOfMonth.getFullYear()}-${(firstDayOfMonth.getMonth() + 1).toString().padStart(2, '0')}`;
          const usageStr = await AsyncStorage.getItem('wolly_ai_usage_monthly');
          let currentUsage = { month: currentMonthKey, count: 1 };
          if (usageStr) {
            const parsed = JSON.parse(usageStr);
            if (parsed.month === currentMonthKey) {
              currentUsage.count = (parsed.count || 0) + 1;
            }
          }
          await AsyncStorage.setItem('wolly_ai_usage_monthly', JSON.stringify(currentUsage));
        } catch (e) {
          console.warn('[groqParser] Failed to increment AI usage counter:', e);
        }

        try {
          const { data: logData, error: logError } = await supabase.from('parsing_logs').insert({
            method_used: context === 'receipt' ? 'photo' : context,
            start_time: currentTimestamp,
            end_time: endTime.toISOString(),
            status_code: statusCode,
            tokens: tokenUsage,
            cost_usd: computedCost,
            app_version: '0.0.1',
            // GDPR: device_id rimosso — log completamente anonimi
          }).select('id').single();
          
          if (logError) {
            console.error('❌ [Tracking] Errore inserimento Supabase:', JSON.stringify(logError, null, 2));
          }
          
          if (logData) logId = logData.id;
        } catch (e) {
          console.warn('❌ [Tracking] Failed to write parsing_log to Supabase', e);
        }

        return {
          id: uuid.v4().toString(),
          created_at: currentTimestamp,
          ...result,
          is_weekend: false,
          day_of_week: finalDayOfWeek || currentDayName,
          date: result.date || currentTimestamp.split('T')[0],
          input_method: context,
          raw_input: text,
          is_deleted: false,
          is_recurring_pattern: false,
          synced_at: null,
          subscription: subscriptionSuggestion,
          log_id: logId,
        };
      } catch (error: any) {
        lastError = error;
        if (error.name === 'AbortError') {
          console.warn(`Groq request timed out, retrying... (${retries} left)`);
        } else {
          console.warn(`Groq request failed: ${error.message}, retrying... (${retries} left)`);
        }
        retries--;
        // Wait 1s before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw lastError; // Se finiamo i tentativi, andiamo al catch esterno
  } catch (error: any) {
    console.error('Error parsing with semantic AI, falling back:', error);
    
    // Track Fallback / Error
    const endTime = new Date();
    let logId: string | undefined;
    try {
      const { data: logData, error: logError } = await supabase.from('parsing_logs').insert({
        method_used: context === 'receipt' ? 'photo' : context,
        start_time: currentTimestamp,
        end_time: endTime.toISOString(),
        status_code: error.name === 'AbortError' ? 'timeout' : '500',
        tokens: null,
        cost_usd: 0,
        app_version: '0.0.1',
        // GDPR: device_id rimosso — log completamente anonimi
      }).select('id').single();
      
      if (logError) {
        console.error('❌ [Tracking] Errore inserimento Supabase Fallback:', JSON.stringify(logError, null, 2));
      }

      if (logData) logId = logData.id;
    } catch (e) {
      console.warn('❌ [Tracking] Failed to write fallback parsing_log', e);
    }

    const isAmount = text.match(/[\d,.]+/);
    const amount = isAmount ? parseFloat(isAmount[0].replace(',', '.')) : 0;

    return {
      id: uuid.v4().toString(),
      created_at: currentTimestamp,
      amount: amount,
      net_amount: amount,
      currency: 'EUR',
      payment_method: null,
      direction: 'out',
      category_key: 'tempo_libero',
      subcategory_key: 'tempo_libero',
      category_confidence: 0.5,
      date: currentTimestamp.split('T')[0],
      time: null,
      time_of_day: 'afternoon',
      is_weekend: false,
      day_of_week: currentDayName,
      social_context: null,
      people_mentioned: [],
      group_size: null,
      is_social: false,
      location_type: 'physical_store',
      location_name: null,
      city: null,
      address: null,
      is_travel: false,
      is_online: false,
      is_recurring_pattern: false,
      reason: null,
      description: text.substring(0, 30),
      input_method: context as any,
      raw_input: text,
      is_deleted: false,
      synced_at: null,
      refund: null,
      split: null,
      holiday: null,
      tags: null,
      log_id: logId
    };
  }
}
