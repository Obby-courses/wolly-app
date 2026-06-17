import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { getProfile, isBetaExpired } from '../services/profileStore';
import { TYPOGRAPHY, SHADOWS } from '../constants/Theme';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Controlla se c'è già una sessione attiva → redirect corretto
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const profile = await getProfile();
          if (profile) {
            if (profile.role === 'blocked') {
              router.replace('/blocked');
            } else if (profile.role === 'tester' && isBetaExpired(profile)) {
              router.replace('/paywall');
            } else {
              router.replace('/');
            }
          } else {
            router.replace('/blocked');
          }
          return;
        }
      } catch (e) {
        console.warn('[Login] Errore controllo sessione:', e);
      } finally {
        setCheckingSession(false);
      }
    };
    checkExistingSession();
  }, []);

  const handleGoogleLogin = async () => {
    if (!isSupabaseConfigured()) {
      Alert.alert(
        'Configurazione mancante',
        'Supabase non è configurato. Controlla le variabili d\'ambiente.'
      );
      return;
    }

    setIsLoading(true);
    try {
      const redirectUrl = makeRedirectUri({ path: 'auth/callback' });
      console.log('[Google Login] redirectUrl generato:', redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        console.error('[Google Login] Errore signInWithOAuth:', error);
        throw error;
      }
      if (!data?.url) {
        console.error('[Google Login] URL OAuth non ricevuto da Supabase');
        throw new Error('URL OAuth non ricevuto da Supabase');
      }

      console.log('[Google Login] data.url (OAuth):', data.url);

      // Abre il browser in-app per il login Google
      console.log('[Google Login] Apertura WebBrowser session...');
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
      console.log('[Google Login] Risultato WebBrowser:', result);

      if (result.type === 'success' && result.url) {
        console.log('[Google Login] Login successo! Callback URL:', result.url);
        // Estrai i parametri dalla URL di callback e completa la sessione
        const url = new URL(result.url);
        const accessToken = url.searchParams.get('access_token');
        const refreshToken = url.searchParams.get('refresh_token');

        // Supabase Implicit flow — il token è nel fragment (#)
        const fragment = result.url.split('#')[1];
        if (fragment) {
          const params = new URLSearchParams(fragment);
          const access = params.get('access_token');
          const refresh = params.get('refresh_token');
          if (access) {
            console.log('[Google Login] Impostazione sessione da fragment...');
            await supabase.auth.setSession({
              access_token: access,
              refresh_token: refresh ?? '',
            });
            console.log('[Google Login] Sessione impostata con successo.');
            return;
          }
        }

        if (accessToken) {
          console.log('[Google Login] Impostazione sessione da query params...');
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken ?? '',
          });
          console.log('[Google Login] Sessione impostata con successo.');
        } else {
          console.warn('[Google Login] Nessun token ricevuto nella callback URL:', result.url);
        }
      } else {
        console.log('[Google Login] WebBrowser chiuso o annullato:', result.type);
      }
    } catch (e: any) {
      console.error('[Google Login] Errore Google OAuth:', e);
      Alert.alert(
        'Errore di accesso',
        'Impossibile completare il login con Google. Controlla la connessione e riprova.',
      );
    } finally {
      console.log('[Google Login] Fine flusso login. Imposto isLoading a false.');
      setIsLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0A74FF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Half: Light blue background with centered logo */}
      <View style={styles.topHalf}>
        <View style={styles.logoContainer}>
          <LinearGradient
            colors={['#0A74FF', '#005FCC']}
            style={styles.logoBg}
          >
            <Ionicons name="sparkles" size={44} color="#FFFFFF" />
          </LinearGradient>
        </View>
      </View>

      {/* Bottom Half: White background with content */}
      <View style={[styles.bottomHalf, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.textSection}>
          <Text style={styles.appName}>Wolly</Text>
          <Text style={styles.versionText}>Beta v0.0.1</Text>
          <Text style={styles.tagline}>
            L'app per scoprire dove finiscono i tuoi soldi
          </Text>
        </View>

        <View style={styles.bottomSection}>
          <Pressable
            style={({ pressed }) => [styles.googleButton, pressed && styles.googleButtonPressed]}
            onPress={handleGoogleLogin}
            disabled={isLoading}
            accessibilityLabel="Accedi con Google"
            accessibilityRole="button"
            accessibilityHint="Apre il browser per il login con il tuo account Google"
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#1C1C1E" />
            ) : (
              <>
                <View style={styles.googleIconContainer}>
                  <Text style={styles.googleG}>G</Text>
                </View>
                <Text style={styles.googleButtonText}>Continua con Google</Text>
              </>
            )}
          </Pressable>

          <Text style={styles.disclaimer}>
            Continuando accetti i Termini di Utilizzo e la{'\n'}
            Privacy Policy di Wolly.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  topHalf: {
    flex: 1,
    backgroundColor: '#E0F2FE', // Azzurro chiaro premium
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    ...SHADOWS.medium,
  },
  logoBg: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomHalf: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 28,
    paddingTop: 32,
    justifyContent: 'space-between',
  },
  textSection: {
    alignItems: 'center',
    width: '100%',
  },
  appName: {
    fontSize: 38,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#0F172A',
    letterSpacing: -0.5,
    marginBottom: 4,
    textAlign: 'center',
  },
  versionText: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#2563EB',
    marginBottom: 16,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: '#64748B',
    lineHeight: 22,
    textAlign: 'center',
  },
  bottomSection: {
    width: '100%',
    gap: 16,
    alignItems: 'center',
  },
  googleButton: {
    width: '100%',
    height: 54,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    ...SHADOWS.medium,
  },
  googleButtonPressed: {
    backgroundColor: '#F8FAFC',
    transform: [{ scale: 0.98 }],
  },
  googleIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleG: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#FFFFFF',
  },
  googleButtonText: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#1C1C1E',
  },
  disclaimer: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 17,
  },
});
