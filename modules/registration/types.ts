export type TimeOfDay = 'mattina' | 'pomeriggio' | 'sera' | 'notte' | null;
export type SocialContext = 'solo' | 'coppia' | 'amici' | 'famiglia' | 'colleghi' | 'sconosciuti' | null;
export type LocationType = 'casa' | 'ristorante' | 'negozio_fisico' | 'online' | 'trasporti' | 'lavoro' | 'viaggio' | 'estero' | null;
export type EmotionalCategory = 'necessità' | 'cura_di_sé' | 'amicizie' | 'passioni' | 'impulso' | 'ansia' | 'obiettivi';

export interface Refund {
  amount: number;
  from: string;
  expected_date: string | null;
  status: 'pending' | 'received';
}

export interface Split {
  total_people: number;
  user_share: number;
  pending_from: string[];
}

export interface ParsedExpense {
  // Layer 1 — Economico
  id: string;
  created_at: string;
  amount: number;
  net_amount: number;
  currency: string;
  payment_method: string | null;
  direction: 'in' | 'out';

  // Layer 2 — Classificazione
  category_key: string;
  subcategory_key: string;
  category_confidence: number;

  // Layer 3 — Temporale
  date: string; // ISO date string or DD/MM/YYYY
  time: string | null; // HH:mm format
  time_of_day: TimeOfDay;
  is_weekend: boolean;
  day_of_week: string; // lunedì ... domenica

  // Layer 4 — Sociale
  social_context: SocialContext;
  people_mentioned: string[];
  group_size: number | null;
  is_social: boolean;

  // Layer 5 — Situazionale
  location_type: LocationType;
  location_name: string | null;
  city: string | null;
  address: string | null;
  is_travel: boolean;
  is_online: boolean;
  is_recurring_pattern: boolean;

  // Input & Relations
  refund: Refund | null;
  split: Split | null;
  reason: string | null;
  description: string;
  input_method: 'voice' | 'receipt' | 'manual';
  raw_input: string;

  // Sync
  is_deleted: boolean;
  synced_at: string | null;
}

export interface RawParsingResult {
  amount: number;
  net_amount: number;
  currency: string;
  payment_method: string | null;
  direction: 'in' | 'out';
  category_key: string;
  subcategory_key: string;
  category_confidence: number;
  date: string | null; 
  time: string | null;
  time_of_day: TimeOfDay;
  is_weekend: boolean;
  day_of_week: string;
  social_context: SocialContext;
  people_mentioned: string[];
  group_size: number | null;
  is_social: boolean;
  location_type: LocationType;
  location_name: string | null;
  city: string | null;
  address: string | null;
  is_travel: boolean;
  is_online: boolean;
  is_recurring_pattern: boolean;
  reason: string | null;
  description: string;
  refund: Refund | null;
  split: Split | null;
}
