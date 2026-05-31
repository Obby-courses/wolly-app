/**
 * queryHandler.ts
 * Branch B della pipeline vocale.
 *
 * Responsabilità UNICA: dato un testo trascritto classificato come "query",
 * chiama askAiChat e aggiorna il VoiceChatOverlay con la risposta.
 *
 * Non tocca la registrazione audio. Non conosce il routing.
 * Non dipende da inputRouter. È testabile con qualsiasi stringa.
 */

import { voiceStore } from '../voiceStore';
import { aiChatStore, askAiChat } from '../aiChat';
import { withTimeout } from './voiceUtils';

const QUERY_TIMEOUT_MS = 15_000;

export async function handleQueryVoice(text: string): Promise<void> {
  // 1. Mostra spinner — la domanda è nota, la risposta ancora no
  voiceStore.setQa({ question: text, answer: null });

  try {
    console.log(
      `[queryHandler] 🤖 Avvio analisi AI (contesto: ${aiChatStore.history.length} messaggi):`,
      text
    );

    const response = await withTimeout(
      askAiChat(text, aiChatStore.history, undefined, 'voice'),
      QUERY_TIMEOUT_MS,
      'Timeout analisi AI (15s)'
    );

    // Risposta vuota → fallback leggibile
    if (!response || !response.text_response) {
      voiceStore.setQa({
        question: text,
        answer: {
          intent: 'text',
          text_response: 'Non ho capito la richiesta, prova a essere più specifico.',
        },
      });
      setTimeout(() => voiceStore.close(), 3_000);
      return;
    }

    console.log(`[queryHandler] ✅ Risposta AI: "${response.text_response}"`);

    // 2. Aggiorna la memoria contestuale globale
    aiChatStore.history.push({ role: 'user', content: text });
    aiChatStore.history.push({ role: 'assistant', content: response.text_response });

    // 3. Mostra la risposta nell'overlay
    voiceStore.setQa({ question: text, answer: response });

  } catch (err: any) {
    console.error('[queryHandler] ❌ Errore:', err.message);

    voiceStore.setQa({
      question: text,
      answer: {
        intent: 'text',
        text_response: "Si è verificato un errore nell'analisi AI. Riprova tra un momento.",
      },
    });

    setTimeout(() => voiceStore.close(), 3_000);
  }
}
