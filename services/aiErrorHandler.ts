import { router } from 'expo-router';

let isModalActive = false;

/**
 * Reindirizza l'utente alla schermata di errore dedicata in caso di superamento limiti.
 * Utilizza una variabile di controllo per evitare aperture multiple simultanee.
 */
export function showAiLimitAlert(type: 'user' | 'global') {
  if (isModalActive) return;
  isModalActive = true;

  router.push({
    pathname: '/ai-limit',
    params: { type }
  });

  // Resetta il flag dopo un intervallo di sicurezza per permettere future aperture
  setTimeout(() => {
    isModalActive = false;
  }, 2000);
}

/**
 * Controlla se l'errore o il codice di stato HTTP è associato al superamento dei limiti.
 * Se lo è, naviga alla schermata corretta e ritorna true.
 */
export function handleAiResponseError(status: number | undefined, errorMessage: string | undefined): boolean {
  if (status === 429 || errorMessage?.includes('soglia') || errorMessage?.includes('429') || errorMessage?.includes('limit exceeded')) {
    showAiLimitAlert('user');
    return true;
  }
  if (status === 503 || errorMessage?.includes('globale') || errorMessage?.includes('503') || errorMessage?.includes('budget exceeded')) {
    showAiLimitAlert('global');
    return true;
  }
  return false;
}
