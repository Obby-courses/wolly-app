import { ParsedExpense, RawParsingResult } from '../modules/registration/types';
import uuid from 'react-native-uuid';
import { parseFromManual } from '../modules/registration/manualParser';
import { DOMAINS_CONFIG, ALL_CATEGORIES, getDomainForCategory } from '../constants/categories';

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
  const currentDayNames = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
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
- entrata -> [salario_fatture, interessi_dividendi, vendita, entrate_affitto, quote_sovvenzioni, entrata_prestiti, assegni_buoni, lotteria_vincite, rimborsi, regali]

 REGOLE CRITICHE:
1. category_key: Scegli SEMPRE la categoria specifica più precisa (es: "cultura_eventi", NON "vita_intrattenimento").
2. domain_key: Inserisci il dominio di appartenenza della categoria scelta (es: "vita_intrattenimento" per "cultura_eventi").
3. NET_AMOUNT: Deve essere UGUALE ad amount se non ci sono rimborsi (refund) o divisioni (split). NON sottrarre l'IVA.
4. IMPORTO (amount): Cerca il "TOTALE" finale. Esempio Scontrini: se vedi "Totale 19,00" e "Contanti 20,00", l'amount è 19,00.
5. SCONTRINI (receipt): "social_context": null, "is_social": false.
6. BRAND: SUBDUED -> category_key: "abbigliamento_scarpe", domain_key: "acquisti".
7. DATA E ORA: Se l'input contiene riferimenti temporali relativi (es. "poco fa", "stasera", "ieri"), calcola la data/ora reale partendo da ${currentDateISO} ${currentTime}. 
   - "date": deve essere sempre "YYYY-MM-DD". Default: ${currentDateISO}.
   - "time": deve essere sempre "HH:mm". Default: ${currentTime} se non specificato diversamente.
8. DIRECTION: Deduci da contesto ("pagato", "speso" → "out"; "ricevuto", "stipendio", "rimborso" → "in"). Default: "out".
9. VENDITORE vs GEOGRAFIA: 
   - location_name: Estrai il nome del brand o negozio (es: "Esselunga", "Amazon", "McDonald's"). Se è un acquisto online, metti is_online = true e location_type = "online".
   - city e address: Estrai città e indirizzo se menzionati esplicitamente (es: "a Milano", "in via Torino"). 
   - FALLBACK GEOGRAFICO: Se la città/indirizzo NON sono detti esplicitamente, usa questi dati del telefono dell'utente: Città: ${locationContext?.city || 'non disponibile'}, Indirizzo: ${locationContext?.address || 'non disponibile'}.
10. PERSONE: Estrai nomi propri menzionati in people_mentioned. Deduci social_context: "amici", "famiglia", "colleghi", "coppia". Se non specificato o se è "da solo", metti null. DIVIETO: NON usare mai la stringa "solo".
11. LOCATION TYPE: Deduci location_type tra: "casa", "ristorante", "negozio_fisico", "online", "trasporti", "lavoro", "viaggio", "estero".
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
  "time_of_day": "mattina"|"pomeriggio"|"sera"|"notte"|null,
  "is_weekend": boolean,
  "day_of_week": string|null,
  "social_context": string|null,
  "people_mentioned": string[],
  "group_size": number|null,
  "is_social": boolean,
  "location_type": string|null,
  "location_name": string|null,
  "city": string|null,
  "address": string|null,
  "is_travel": boolean,
  "is_online": boolean,
  "reason": string|null,
  "description": "string",
  "refund": null,
  "split": null,
  "suggest_subscription": boolean,
  "subscription_name": string|null,
  "subscription_amount": number|null,
  "subscription_frequency": "monthly"|"weekly"|"biweekly"|"yearly"|null,
  "subscription_day": number|null
}

REGOLA ABBONAMENTO: Imposta "suggest_subscription": true SOLO se l'importo ha pattern da servizio in abbonamento (es. importi fissi come 9.99, 15.99, nomi noti come Netflix, Spotify, Amazon Prime, Adobe, palestra, affitto, assicurazione, etc.). In tutti gli altri casi imposta false e gli altri campi abbonamento a null.
`;

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
        const validCategory = ALL_CATEGORIES.find(c => c.key === result.category_key);

        if (!validCategory) {
          console.log("⚠️  [VALIDATION WARNING]: category_key non trovata in categories.ts!");
          console.log(`   - Richiesta: ${result.category_key} (dominio atteso: ${(result as any).domain_key})`);

          // Fallback: prova a usare domain_key come categoria generica
          const fallbackDomain = DOMAINS_CONFIG.find(d => d.key === (result as any).domain_key);
          if (fallbackDomain && fallbackDomain.categories.length > 0) {
            result.category_key = fallbackDomain.categories[0].key;
            console.log(`   - Fallback a: ${result.category_key}`);
          } else {
            result.category_key = 'tempo_libero';
          }
        } else {
          // Assicura che domain_key sia sempre corretto (ridondanza)
          (result as any).domain_key = validCategory.domain_key;
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
              const days = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
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

        // --- LOGICA PASTO (MEAL TYPE) ---
        // Una transazione in un bar o ristorante tra 07:00–10:30 è colazione. 
        // Tra 12:00–14:30 è pranzo. Tra 19:00–22:30 è cena.
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
            } else if (totalMinutes >= 19 * 60 && totalMinutes <= 22 * 60 + 30) {
              mealTypeLabel = 'Cena';
            }

            if (mealTypeLabel) {
              result.description = result.description 
                ? `${result.description} (${mealTypeLabel})` 
                : mealTypeLabel;
            }
          }
        }

        // Extract subscription suggestion from AI response
        const subscriptionSuggestion: SubscriptionSuggestion = {
          suggest_subscription: !!(result as any).suggest_subscription,
          subscription_name: (result as any).subscription_name || undefined,
          subscription_amount: (result as any).subscription_amount || undefined,
          subscription_frequency: (result as any).subscription_frequency || undefined,
          subscription_day: (result as any).subscription_day || undefined,
        };

        if (subscriptionSuggestion.suggest_subscription) {
          console.log(`📅 [SUBSCRIPTION SUGGESTION]: ${subscriptionSuggestion.subscription_name} ${subscriptionSuggestion.subscription_frequency}`);
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
  } catch (error) {
    console.error('Error parsing with semantic AI, falling back:', error);
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
      time_of_day: 'pomeriggio',
      is_weekend: false,
      day_of_week: currentDayName,
      social_context: null,
      people_mentioned: [],
      group_size: null,
      is_social: false,
      location_type: 'negozio_fisico',
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
      split: null
    };
  }
}
