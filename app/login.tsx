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
import { TYPOGRAPHY, SHADOWS } from '../constants/Theme';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Controlla se c'è già una sessione attiva → redirect immediato alla home
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          router.replace('/');
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
      const redirectUrl = makeRedirectUri({ scheme: 'wolly', path: 'auth/callback' });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('URL OAuth non ricevuto da Supabase');

      // Apre il browser in-app per il login Google
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

      if (result.type === 'success' && result.url) {
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
            await supabase.auth.setSession({
              access_token: access,
              refresh_token: refresh ?? '',
            });
            router.replace('/');
            return;
          }
        }

        if (accessToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken ?? '',
          });
          router.replace('/');
        } else {
          // L'utente ha annullato il login o qualcosa è andato storto
          console.warn('[Login] Nessun token ricevuto nella callback URL:', result.url);
        }
      }
      // result.type === 'cancel' → l'utente ha chiuso il browser, non fare nulla
    } catch (e: any) {
      console.error('[Login] Errore Google OAuth:', e);
      Alert.alert(
        'Errore di accesso',
        'Impossibile completare il login con Google. Controlla la connessione e riprova.',
      );
    } finally {
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
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      {/* Background gradient */}
      <LinearGradient
        colors={['#EFF6FF', '#FFFFFF']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.6 }}
      />

      {/* Top: Logo & Branding */}
      <View style={styles.topSection}>
        <View style={styles.logoContainer}>
          <LinearGradient
            colors={['#0A74FF', '#005FCC']}
            style={styles.logoBg}
          >
            <Ionicons name="sparkles" size={36} color="#FFFFFF" />
          </LinearGradient>
        </View>

        <Text style={styles.appName}>Wolly</Text>
        <View style={styles.betaBadge}>
          <Text style={styles.betaBadgeText}>Beta v.0.0.1</Text>
        </View>

        <Text style={styles.tagline}>
          Il tuo assistente finanziario{'\n'}personale basato sull'AI
        </Text>
      </View>

      {/* Center: Features highlight */}
      <View style={styles.featuresSection}>
        {[
          { icon: 'shield-checkmark-outline', text: 'Dati protetti sul tuo dispositivo' },
          { icon: 'mic-outline', text: 'Registra le spese con la voce' },
          { icon: 'bar-chart-outline', text: 'Statistiche e analisi avanzate' },
        ].map((item, i) => (
          <View key={i} style={styles.featureRow}>
            <View style={styles.featureIconBg}>
              <Ionicons name={item.icon as any} size={18} color="#0A74FF" />
            </View>
            <Text style={styles.featureText}>{item.text}</Text>
          </View>
        ))}
      </View>

      {/* Bottom: Login Button */}
      <View style={styles.bottomSection}>
        <Pressable
          style={({ pressed }) => [styles.googleButton, pressed && styles.googleButtonPressed]}
          onPress={handleGoogleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#1C1C1E" />
          ) : (
            <>
              {/* Google "G" logo SVG-like using text */}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  topSection: {
    alignItems: 'center',
    paddingTop: 40,
  },
  logoContainer: {
    marginBottom: 16,
    ...SHADOWS.medium,
  },
  logoBg: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: 36,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  betaBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginTop: 6,
    marginBottom: 16,
  },
  betaBadgeText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#2563EB',
    letterSpacing: 0.3,
  },
  tagline: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
  featuresSection: {
    width: '100%',
    gap: 12,
    paddingVertical: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 12,
  },
  featureIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: '#334155',
    flex: 1,
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
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 17,
  },
});
