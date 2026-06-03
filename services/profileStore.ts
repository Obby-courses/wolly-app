/**
 * profileStore.ts
 * Servizio centralizzato per la gestione del profilo utente remoto (Supabase).
 *
 * Il profilo è legato all'account Google (auth.uid()).
 * Viene caricato al login e invalidato al logout.
 * Fornisce helper per il controllo dei ruoli e dei permessi.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from './supabase';

// ─── Tipi ─────────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'beta_tester' | 'user' | 'blocked';
export type UserPlan = 'free' | 'premium' | 'lifetime';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  plan: UserPlan;
  beta_expires_at: string | null;
  created_at: string;
}

// ─── Costanti ────────────────────────────────────────────────────────────────

const CACHE_KEY = '@wolly_user_profile';

// ─── Cache locale ─────────────────────────────────────────────────────────────

/**
 * Salva il profilo in AsyncStorage come fallback offline.
 */
async function cacheProfile(profile: UserProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.warn('[profileStore] Impossibile salvare il profilo in cache:', e);
  }
}

/**
 * Legge il profilo dalla cache locale (AsyncStorage).
 * Usato come fallback se Supabase non è raggiungibile.
 */
export async function getCachedProfile(): Promise<UserProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

/**
 * Cancella il profilo dalla cache locale (usato al logout).
 */
export async function clearProfile(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch (e) {
    console.warn('[profileStore] Impossibile cancellare il profilo dalla cache:', e);
  }
}

// ─── Fetch remoto ─────────────────────────────────────────────────────────────

/**
 * Recupera il profilo dell'utente corrente da Supabase.
 * In caso di errore di rete, ritorna il profilo dalla cache locale.
 * Ritorna null se l'utente non è autenticato o se non esiste un profilo.
 */
export async function getProfile(shouldRetry: boolean = false): Promise<UserProfile | null> {
  if (!isSupabaseConfigured()) {
    console.warn('[profileStore] Supabase non configurato — impossibile caricare il profilo.');
    return null;
  }

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const maxAttempts = shouldRetry ? 3 : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (!error && data) {
        const profile = data as UserProfile;
        // Aggiorna la cache con i dati più recenti
        await cacheProfile(profile);
        return profile;
      }

      // Se c'è un errore e non è l'ultimo tentativo, attendiamo e riproviamo
      if (error && attempt < maxAttempts) {
        console.log(`[profileStore] Profilo non trovato (tentativo ${attempt}/${maxAttempts}), attesa trigger...`);
        await delay(600);
        continue;
      }

      if (error) {
        console.warn('[profileStore] Errore fetch profilo dopo tentativi:', error.message);
        // Fallback alla cache locale
        return await getCachedProfile();
      }
    } catch (e) {
      if (attempt < maxAttempts) {
        await delay(600);
        continue;
      }
      console.warn('[profileStore] Errore di rete — uso cache locale:', e);
      return await getCachedProfile();
    }
  }

  return null;
}

// ─── Helper per controllo accessi ─────────────────────────────────────────────

/**
 * Verifica se la beta è scaduta per un utente beta_tester.
 */
export function isBetaExpired(profile: UserProfile): boolean {
  if (!profile.beta_expires_at) return false;
  return new Date(profile.beta_expires_at) < new Date();
}

/**
 * Verifica se l'utente ha accesso completo all'app (non bloccato, beta valida).
 * Gli admin hanno sempre accesso completo.
 */
export function hasFullAccess(profile: UserProfile): boolean {
  if (profile.role === 'blocked') return false;
  if (profile.role === 'admin') return true;
  if (profile.role === 'beta_tester' && isBetaExpired(profile)) return false;
  return true;
}

/**
 * Verifica se l'utente può usare le funzionalità AI (voce, chat, parsing).
 */
export function canUseAI(profile: UserProfile): boolean {
  if (profile.role === 'blocked') return false;
  if (profile.role === 'admin') return true;
  if (profile.role === 'beta_tester') return !isBetaExpired(profile);
  // role === 'user': richiede piano premium
  return profile.plan === 'premium' || profile.plan === 'lifetime';
}

/**
 * Restituisce un'etichetta leggibile per il ruolo.
 */
export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    admin: 'Amministratore',
    beta_tester: 'Beta Tester',
    user: 'Utente',
    blocked: 'Sospeso',
  };
  return labels[role] ?? role;
}

/**
 * Restituisce il colore badge per il ruolo.
 */
export function getRoleColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    admin: '#7C3AED',
    beta_tester: '#0A74FF',
    user: '#059669',
    blocked: '#EF4444',
  };
  return colors[role] ?? '#8E8E93';
}
