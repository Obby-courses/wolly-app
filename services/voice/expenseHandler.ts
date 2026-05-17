/**
 * expenseHandler.ts
 * Branch A della pipeline vocale.
 *
 * Responsabilità UNICA: dato un testo trascritto classificato come "expense",
 * chiama il parser AI, poi naviga verso /expense-detail.
 *
 * Non tocca la registrazione audio. Non conosce il routing.
 * Non dipende da inputRouter. È testabile con qualsiasi stringa.
 */

import { voiceStore } from '../voiceStore';
import { withTimeout } from './voiceUtils';
import { parseExpenseWithAI } from '../groqParser';
import { router } from 'expo-router';

const PARSE_TIMEOUT_MS = 15_000;

export async function handleExpenseVoice(text: string): Promise<void> {
  // 1. Feedback immediato all'utente
  voiceStore.setQa({
    question: text,
    answer: { intent: 'text', text_response: 'Sto registrando la tua spesa...' },
  });

  try {
    console.log('[expenseHandler] 🧾 Avvio parsing spesa:', text);

    const parsed = await withTimeout(
      parseExpenseWithAI(text, 'voice'),
      PARSE_TIMEOUT_MS,
      'Timeout parsing spesa (15s)'
    );

    console.log(`[expenseHandler] ✅ Parsing completato → €${parsed.amount} in ${parsed.category_key}`);

    // 2. Chiude l'overlay e naviga
    voiceStore.close();
    router.push({
      pathname: '/expense-detail',
      params: { data: JSON.stringify(parsed) },
    });
  } catch (err: any) {
    console.error('[expenseHandler] ❌ Errore:', err.message);

    voiceStore.setQa({
      question: text,
      answer: {
        intent: 'text',
        text_response: 'Errore nel parsing della spesa. Riprova tra un momento.',
      },
    });

    // Auto-close dopo 3s in caso di errore
    setTimeout(() => voiceStore.close(), 3_000);
  }
}
