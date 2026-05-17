/**
 * voiceUtils.ts
 * Utility condivise tra i moduli della pipeline vocale.
 */

/**
 * Avvolge una Promise con un timeout deterministico.
 * Se la promise non si risolve entro `ms` millisecondi, rigetta con `errorMessage`.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMessage = `Timeout superato (${ms}ms)`
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(errorMessage)), ms)
  );
  return Promise.race([promise, timeout]);
}

/**
 * Detecta trascrizioni vuote, silenzio o allucinazioni di Whisper.
 * Restituisce true se il testo è valido per essere processato.
 */
export function isValidTranscription(text: string): boolean {
  if (!text || !text.trim()) return false;

  const t = text.trim().toLowerCase();

  // Allucinazioni comuni di Whisper su silenzio o audio non chiaro
  const HALLUCINATIONS = [
    '...',
    'grazie.',
    'sottotitoli',
    'sottotitoli a cura di',
    'traduzione',
    'copyright',
    'amara.org',
  ];

  if (HALLUCINATIONS.some(h => t.includes(h))) return false;

  // Troppo corta (≤ 2 parole)
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length <= 2) return false;

  return true;
}
