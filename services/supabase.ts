import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
const supabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();

// Pulisci le virgolette se presenti per errore
const cleanUrl = supabaseUrl.replace(/['\"]/g, '');
const cleanKey = supabaseAnonKey.replace(/['\"]/g, '');

// Controlla se le chiavi Supabase fornite sono quelle segnaposto o vuote e se l'URL è formalmente valido
export const isSupabaseConfigured = (): boolean => {
  const isValidUrl = cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://');
  return (
    !!cleanUrl &&
    cleanUrl !== '' &&
    !cleanUrl.includes('xyz.supabase.co') &&
    isValidUrl &&
    !!cleanKey &&
    cleanKey !== '' &&
    cleanKey !== 'your_anon_public_key_here'
  );
};

const actualUrl = isSupabaseConfigured() ? cleanUrl : 'https://placeholder-url-for-supabase.co';
const actualKey = isSupabaseConfigured() ? cleanKey : 'placeholder-key';

let client: any;
try {
  client = createClient(actualUrl, actualKey, {
    auth: {
      // persistSession: true — necessario per mantenere la sessione Google tra un avvio e l'altro
      persistSession: true,
      storage: AsyncStorage,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
} catch (e) {
  console.warn('[Supabase Init Warning] Errore durante l\'inizializzazione di Supabase:', e);
  // Fallback sicuro per evitare crash all'avvio dell'applicazione
  client = createClient('https://placeholder-url-for-supabase.co', 'placeholder-key', {
    auth: {
      persistSession: true,
      storage: AsyncStorage,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
}

export const supabase = client;
