import { ParsedExpense, RawParsingResult } from '../modules/registration/types';
import uuid from 'react-native-uuid';
import { parseFromManual } from '../modules/registration/manualParser';

export async function parseExpenseWithAI(text: string, context: 'voice' | 'receipt' | 'manual'): Promise<ParsedExpense> {
  const apiKey = process.env.EXPO_PUBLIC_GROQ_FINANCE_API;
  if (!apiKey) throw new Error('Missing Groq API Key (EXPO_PUBLIC_GROQ_FINANCE_API)');

  const now = new Date();
  const currentTimestamp = now.toISOString();
  const currentDayNames = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
  const currentDayName = currentDayNames[now.getDay()];

  const systemPrompt = `Sei l'Analista Finanziario Senior di Filo. Il tuo compito è estrarre dati strutturati con precisione millimetrica.
REQUISITO: Restituisci SOLO un oggetto JSON valido.

TASSONOMIA UFFICIALE (Usa SOLO queste coppie CHIAVE_CATEGORIA -> CHIAVE_SOTTOCATEGORIA):
- cibo_bevande -> [alimentari, ristorante_fast_food, bar_caffe]
- acquisti -> [abbigliamento_scarpe, gioielli_accessori, salute_bellezza, bambini, casa_giardino, animali, elettronica_accessori, regali_gioia, cancelleria_attrezzi, tempo_libero, drogheria_farmacia]
- alloggio -> [affitto, mutuo, energia_utenze, manutenzione_riparazioni, assicurazione_proprieta]
- trasporti -> [trasporto_pubblico, taxi, lunga_distanza, viaggi_lavoro]
- veicolo -> [carburante, parcheggio, manutezione_veicoli, noleggio, assicurazione_veicolo, leasing]
- vita_intrattenimento -> [assistenza_sanitaria, wellness_bellezza, sport_fitness, cultura_eventi, eventi_vita, hobby, formazione_sviluppo, libri_audio_abbonamenti, tv_streaming, vacanze_viaggi_hotel, beneficienza_regali, alcool_tabacco, lotteria_azzardo]
- comunicazione_pc -> [telefono_cellulare, internet, software_app_giochi, servizi_postali]
- spese_finanziarie -> [tasse, assicurazioni, prestiti_interessi, multe, consulenza, commissioni, mantenimento]
- investimenti -> [immobili, veicoli_beni_immobili, investimenti_finanziari, risparmi, collezioni]
- entrata -> [salario_fatture, interessi_dividendi, vendita, entrate_affitto, quote_sovvenzioni, entrata_prestiti, assegni_buoni, lotteria_azzardo, rimborsi, regali]

 REGOLE CRITICHE:
1. DIVIETO USCITE/ENTRATE: Le chiavi "USCITE" ed "ENTRATE" sono solo titoli di sezione. NON usarle mai come category_key o subcategory_key.
2. NET_AMOUNT: Deve essere UGUALE ad amount se non ci sono rimborsi (refund) o divisioni (split). NON sottrarre l'IVA.
3. IMPORTO (amount): Cerca il "TOTALE" finale. Esempio Scontrini: se vedi "Totale 19,00" e "Contanti 20,00", l'amount è 19,00.
4. SCONTRINI (receipt): "social_context": null, "is_social": false. (Forzato anche via codice).
5. BRAND: SUBDUED -> category: "acquisti", subcategory: "abbigliamento_scarpe".

DATE FORMAT: "YYYY-MM-DD".

JSON OUTPUT FORMAT:
{
  "amount": number,
  "net_amount": number,
  "currency": "EUR",
  "payment_method": "contanti"|"carta"|"bancomat"|string|null,
  "direction": "in"|"out",
  "category_key": "string",
  "subcategory_key": "string",
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
  "location_type": "ristorante_fast_food"|"negozio_fisico"|"casa"|"online"|"trasporti"|"lavoro"|"viaggio"|"estero"|null,
  "location_name": string|null,
  "city": string|null,
  "address": string|null,
  "is_travel": boolean,
  "is_online": boolean,
  "is_recurring_pattern": boolean,
  "reason": string|null,
  "description": "string",
  "refund": null,
  "split": null
}
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

        return {
          id: uuid.v4().toString(),
          created_at: currentTimestamp,
          ...result,
          day_of_week: finalDayOfWeek || currentDayName,
          date: result.date || currentTimestamp.split('T')[0],
          input_method: context,
          raw_input: text,
          is_deleted: false,
          synced_at: null
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
    const amount = isAmount ? parseFloat(isAmount[0].replace(',','.')) : 0;
    
    return {
      id: uuid.v4().toString(),
      created_at: currentTimestamp,
      amount: amount,
      net_amount: amount,
      currency: 'EUR',
      payment_method: null,
      direction: 'out',
      category_key: 'acquisti',
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
      input_method: context,
      raw_input: text,
      is_deleted: false,
      synced_at: null,
      refund: null,
      split: null
    };
  }
}
