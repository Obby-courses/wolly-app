import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Controlla se le chiavi Supabase fornite sono quelle segnaposto o vuote
export const isSupabaseConfigured = (): boolean => {
  return (
    !!supabaseUrl &&
    supabaseUrl.trim() !== '' &&
    !supabaseUrl.includes('xyz.supabase.co') &&
    !!supabaseAnonKey &&
    supabaseAnonKey.trim() !== '' &&
    supabaseAnonKey !== 'your_anon_public_key_here'
  );
};

const actualUrl = isSupabaseConfigured() ? supabaseUrl : 'https://placeholder-url-for-supabase.co';
const actualKey = isSupabaseConfigured() ? supabaseAnonKey : 'placeholder-key';

// Istanziazione del client Supabase per la gestione delle chiamate cloud
export const supabase = createClient(actualUrl, actualKey, {
  auth: {
    persistSession: false, // Disabilitiamo la persistenza per il log degli eventi analitici anonimi
  },
});
