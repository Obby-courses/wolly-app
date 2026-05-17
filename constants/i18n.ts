/**
 * i18n.ts
 * Dizionario di traduzione per i valori salvati nel DB (sempre in inglese)
 * verso le label visualizzate all'utente (attualmente: italiano).
 *
 * ARCHITETTURA:
 *   DB / AI / Query: usa SEMPRE i valori inglesi (social_context: "friends")
 *   UI / Risposta AI: visualizza SEMPRE i valori tradotti (display: "Amici")
 *
 * Per aggiungere una nuova lingua, aggiungere un nuovo oggetto `it` → `en` → `<lang>`.
 */

// ─── Social Context ───────────────────────────────────────────────────────────

export const SOCIAL_CONTEXT_LABELS: Record<string, string> = {
  friends:      'Amici',
  family:       'Famiglia',
  colleagues:   'Colleghi',
  couple:       'Coppia',
  strangers:    'Sconosciuti',
  alone:        'Da solo',
};

/** Valori inglesi validi per il DB / AI */
export const SOCIAL_CONTEXT_VALUES = Object.keys(SOCIAL_CONTEXT_LABELS) as string[];

// ─── Location Type ────────────────────────────────────────────────────────────

export const LOCATION_TYPE_LABELS: Record<string, string> = {
  home:            'Casa',
  restaurant:      'Ristorante',
  physical_store:  'Negozio fisico',
  online:          'Online',
  transport:       'Trasporti',
  work:            'Lavoro',
  travel:          'Viaggio',
  abroad:          'Estero',
};

export const LOCATION_TYPE_VALUES = Object.keys(LOCATION_TYPE_LABELS) as string[];

// ─── Time of Day ──────────────────────────────────────────────────────────────

export const TIME_OF_DAY_LABELS: Record<string, string> = {
  morning:    'Mattina',
  afternoon:  'Pomeriggio',
  evening:    'Sera',
  night:      'Notte',
};

export const TIME_OF_DAY_VALUES = Object.keys(TIME_OF_DAY_LABELS) as string[];

// ─── Day of Week ──────────────────────────────────────────────────────────────

export const DAY_OF_WEEK_LABELS: Record<string, string> = {
  monday:    'Lunedì',
  tuesday:   'Martedì',
  wednesday: 'Mercoledì',
  thursday:  'Giovedì',
  friday:    'Venerdì',
  saturday:  'Sabato',
  sunday:    'Domenica',
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Traduce un valore inglese in italiano (o lo restituisce invariato se non trovato).
 * Usare per: social_context, location_type, time_of_day quando mostrati all'utente.
 */
export function translateValue(value: string | null | undefined, dict: Record<string, string>): string {
  if (!value) return '';
  return dict[value.toLowerCase()] ?? value;
}

export function translateSocialContext(value: string | null | undefined): string {
  return translateValue(value, SOCIAL_CONTEXT_LABELS);
}

export function translateLocationType(value: string | null | undefined): string {
  return translateValue(value, LOCATION_TYPE_LABELS);
}

export function translateTimeOfDay(value: string | null | undefined): string {
  return translateValue(value, TIME_OF_DAY_LABELS);
}
