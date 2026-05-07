import { TransactionRepository } from './database/repositories/TransactionRepository';

/**
 * MerchantResolver — Gestisce la risoluzione dei nomi dei negozi.
 * Segue il flusso: Normalizzazione -> Match Locale -> Risoluzione AI.
 */
export class MerchantResolver {
  
  /**
   * Tenta di risolvere un input utente in un merchant esistente nel DB.
   * @param userInput Il nome del negozio inserito dall'utente (es: "McD")
   * @returns Il nome normalizzato presente nel DB, o null se non risolvibile.
   */
  static async resolve(userInput: string): Promise<string | null> {
    if (!userInput) return null;

    const normalizedInput = userInput.trim().toLowerCase();
    const merchants = await TransactionRepository.getUniqueMerchants();

    if (merchants.length === 0) return null;

    // 1. Match Esatto (Case Insensitive)
    const exactMatch = merchants.find(m => m.toLowerCase() === normalizedInput);
    if (exactMatch) return exactMatch;

    // 2. Match Parziale (Inizia con o Contenuto)
    const partialMatch = merchants.find(m => m.toLowerCase().includes(normalizedInput));
    if (partialMatch) return partialMatch;

    // 3. Risoluzione AI (Solo se l'input è abbastanza lungo da avere senso)
    if (normalizedInput.length >= 3) {
      return await this.resolveWithAI(userInput, merchants);
    }

    return null;
  }

  private static async resolveWithAI(userInput: string, merchantList: string[]): Promise<string | null> {
    const apiKey = process.env.EXPO_PUBLIC_GROQ_FINANCE_API;
    if (!apiKey) return null;

    // Limitiamo la lista per non superare i limiti di token, anche se i merchant unici dovrebbero essere gestibili
    const sampleList = merchantList.slice(0, 200).join(', ');

    const systemPrompt = `Sei un esperto di data cleaning. Dato un input dell'utente e una lista di nomi di negozi (merchant) reali dal suo database, trova il match migliore. 
    Se non c'è un match plausibile, rispondi con "NONE".
    Restituisci SOLO il nome del merchant o "NONE".`;

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant', // Usiamo un modello veloce per questo compito granulare
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Input: "${userInput}"\nLista Merchant: [${sampleList}]` }
          ],
          temperature: 0,
          max_tokens: 50,
        }),
      });

      if (!response.ok) return null;
      const data = await response.json();
      const answer = data.choices[0].message.content.trim().replace(/["']/g, '');

      if (answer === 'NONE' || !merchantList.includes(answer)) return null;
      return answer;
    } catch (e) {
      console.error('[MerchantResolver] AI Error:', e);
      return null;
    }
  }
}
