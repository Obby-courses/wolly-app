/**
 * voiceProcessor.ts
 * Orchestrator della pipeline vocale — Step 2 (dopo la registrazione audio).
 *
 * Responsabilità:
 *   1. Trascrive l'audio (STT)
 *   2. Valida la trascrizione (anti-allucinazione)
 *   3. Smista al branch corretto (expense | query | unknown)
 *
 * Non gestisce mai la registrazione audio (quello è voiceStore).
 * Non gestisce mai il rendering (quello è VoiceChatOverlay).
 * Non contiene logica di business — delega ai branch handler.
 */

import { voiceStore } from '../voiceStore';
import { routeInput } from '../inputRouter';
import { isValidTranscription } from './voiceUtils';
import { handleExpenseVoice } from './expenseHandler';
import { handleQueryVoice } from './queryHandler';

export async function processVoiceInput(uri: string): Promise<void> {
  const startTime = Date.now();

  console.log('\n' + '='.repeat(60));
  console.log('🎤 [voiceProcessor] INIZIO PIPELINE VOCALE');

  // ── STEP 1: Trascrizione STT ────────────────────────────────────────────────
  voiceStore.setIsLoading(true);
  voiceStore.setQa({ question: 'Trascrizione in corso...', answer: null });

  let transcription: string;

  try {
    const { transcribeAudio } = require('../stt');
    transcription = await transcribeAudio(uri);
    console.log(`📝 [${Date.now() - startTime}ms] Trascrizione: "${transcription}"`);
  } catch (err: any) {
    console.error(`❌ [voiceProcessor] Errore STT: ${err.message || err}`);
    voiceStore.setIsLoading(false);
    
    const isAbort = err.message === 'Aborted' || err.name === 'AbortError';
    voiceStore.setQa({
      question: 'Errore di Trascrizione',
      answer: {
        intent: 'text',
        text_response: isAbort
          ? '⚠️ La trascrizione vocale ha impiegato troppo tempo (timeout). Riprova con una connessione migliore o accorcia il messaggio.'
          : `❌ Non è stato possibile trascrivere l'audio: ${err.message || 'Errore di connessione'}.`
      }
    });
    
    // Mostra l'errore per 5 secondi prima di chiudere
    setTimeout(() => voiceStore.close(), 5000);
    return;
  }

  // ── STEP 2: Validazione ─────────────────────────────────────────────────────
  if (!isValidTranscription(transcription)) {
    console.log(`🛑 [${Date.now() - startTime}ms] ANNULLATO: Trascrizione non valida o silenzio.`);
    console.log('='.repeat(60) + '\n');
    voiceStore.close();
    return;
  }

  // ── STEP 3: Routing deterministico ─────────────────────────────────────────
  const route = routeInput(transcription);
  console.log(`🛤️ [${Date.now() - startTime}ms] Route: ${route.toUpperCase()}`);

  voiceStore.setIsLoading(false); // I branch gestiscono il proprio loading state

  // ── STEP 4: Dispatch al branch corretto ────────────────────────────────────
  switch (route) {
    case 'expense':
      await handleExpenseVoice(transcription);
      break;

    case 'query':
      await handleQueryVoice(transcription);
      break;

    case 'advice':
      console.log(`[voiceProcessor] 🚫 Intercettato consiglio finanziario.`);
      voiceStore.setQa({
        question: transcription,
        answer: {
          intent: 'text',
          text_response: 'Non posso aiutarti con questo. Posso tracciare le tue spese ed analizzare lo storico dei tuoi dati personali, ma non posso fornire consigli finanziari o di investimento.',
        },
      });
      // Lascia visualizzare il messaggio per 4 secondi e poi chiudi l'overlay
      setTimeout(() => voiceStore.close(), 4_000);
      break;

    case 'unknown':
    default:
      console.log(`[voiceProcessor] ⚠️ Route "unknown" — chiusura overlay.`);
      voiceStore.close();
      break;
  }

  console.log(`✅ [voiceProcessor] Pipeline completata in ${Date.now() - startTime}ms`);
  console.log('='.repeat(60) + '\n');
}
