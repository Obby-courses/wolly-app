/**
 * firebase.ts
 *
 * PRIVACY AUDIT — Wolly Beta (2026-06)
 *
 * Firebase Analytics è stato disabilitato nella fase beta per ridurre la
 * superficie GDPR e la complessità del doppio sistema di identità
 * (Firebase UID ↔ Supabase UUID).
 *
 * Tutte le funzioni sono stub no-op: non inviano dati, non profilano,
 * non richiedono consenso aggiuntivo.
 *
 * Quando sarà necessario riattivare Firebase Analytics (post-beta),
 * rimuovere i commenti "DISABLED" e ripristinare le implementazioni.
 */

/**
 * [DISABLED] Logs a custom event to Firebase Analytics.
 * Kept as a no-op stub to avoid breaking existing call-sites.
 */
export const logCustomEvent = async (
  _eventName: string,
  _params?: Record<string, any>
): Promise<void> => {
  // Firebase Analytics disabled in beta — nessun dato inviato
};

/**
 * [DISABLED] Tracks a screen view in Firebase Analytics.
 * Kept as a no-op stub to avoid breaking existing call-sites.
 */
export const logScreenView = async (
  _screenName: string,
  _screenClass?: string
): Promise<void> => {
  // Firebase Analytics disabled in beta — nessun dato inviato
};

/**
 * [DISABLED] Sets user properties for Firebase Analytics.
 * Removed: profilazione utente non necessaria in fase beta.
 */
export const setUserProperties = async (
  _properties: Record<string, string | null>
): Promise<void> => {
  // Firebase Analytics disabled in beta — nessun dato inviato
};

/**
 * [DISABLED] Sets the user ID for Firebase Analytics.
 * Removed: collegare Firebase UID a Supabase UUID crea profilazione
 * cross-platform e aumenta la superficie GDPR inutilmente in beta.
 */
export const setAnalyticsUserId = async (
  _userId: string | null
): Promise<void> => {
  // Firebase Analytics disabled in beta — nessun dato inviato
};
