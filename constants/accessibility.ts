/**
 * Accessibility utilities for Wolly
 * Centralized hitSlop values and helpers to ensure WCAG 2.1 AA compliance.
 * Minimum touch target: 44x44px
 */

/** Standard hitSlop to bring small elements to 44x44 minimum touch area */
export const HIT_SLOP_SM = { top: 10, bottom: 10, left: 10, right: 10 };
export const HIT_SLOP_MD = { top: 12, bottom: 12, left: 12, right: 12 };
export const HIT_SLOP_LG = { top: 16, bottom: 16, left: 16, right: 16 };

/** Maximum values for text inputs */
export const INPUT_MAX_LENGTH = {
  /** Descrizione / Nota libera */
  note: 500,
  /** Nome negozio / venditore */
  vendor: 100,
  /** Nome abbonamento / periodica */
  subscriptionName: 80,
  /** Nome persona (social tag) */
  personName: 50,
  /** Tag personalizzato */
  tag: 30,
  /** Ricerca città */
  citySearch: 60,
  /** Indirizzo specifico */
  address: 150,
} as const;
