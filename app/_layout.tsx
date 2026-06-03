import { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Outfit_400Regular, Outfit_700Bold } from '@expo-google-fonts/outfit';
import BottomMenu from '../components/BottomMenu';
import TopNavigation from '../components/TopNavigation';
import SwipeNavigator from '../components/SwipeNavigator';
import VoiceChatOverlay from '../components/ai/VoiceChatOverlay';
import { View, LogBox } from 'react-native';
import { usePathname } from 'expo-router';
import { voiceStore } from '../services/voiceStore';
import { networkStore } from '../services/networkStore';

import { popupStore } from '../services/popupStore';
import RemotePopupModal from '../components/RemotePopupModal';
import { supabase } from '../services/supabase';
import { getProfile, hasFullAccess, isBetaExpired } from '../services/profileStore';
import type { UserProfile } from '../services/profileStore';

SplashScreen.preventAutoHideAsync();

LogBox.ignoreLogs([
  '[expo-av]: Expo AV has been deprecated',
]);

// Schermate che non richiedono autenticazione o controllo del profilo
const PUBLIC_ROUTES = ['/login', '/blocked', '/paywall', '/onboarding'];

export default function RootLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  const [loaded, error] = useFonts({
    Outfit_400Regular,
    Outfit_700Bold,
  });

  // ── Controllo sessione e profilo all'avvio ────────────────────────────────
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
          // Nessuna sessione → porta al login
          router.replace('/login');
          return;
        }

        // Sessione trovata → carica profilo e verifica ruolo
        const profile = await getProfile();

        if (!profile) {
          // Profilo non trovato (non in whitelist / non esistente nel DB)
          router.replace('/blocked');
          return;
        }

        if (profile.role === 'blocked') {
          router.replace('/blocked');
          return;
        }

        if (profile.role === 'beta_tester' && isBetaExpired(profile)) {
          router.replace('/paywall');
          return;
        }

        // Tutto ok → continua normalmente (l'utente era già sulla home o ci andrà)
      } catch (e) {
        console.error('[Layout] Errore controllo auth:', e);
        // In caso di errore di rete, lascia l'utente dove si trova
      } finally {
        setAuthChecked(true);
      }
    };

    checkAuth();
  }, []);

  // ── Listener cambio sessione (login/logout in tempo reale) ───────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setTimeout(async () => {
        if (event === 'SIGNED_OUT') {
          router.replace('/login');
          return;
        }

        if (event === 'SIGNED_IN' && session?.user) {
          // Nuovo login → ricontrolla profilo (attende eventuali trigger remoti)
          const profile = await getProfile(true);
          if (!profile) {
            router.replace('/blocked');
            return;
          }

          if (profile.role === 'blocked') {
            router.replace('/blocked');
            return;
          }
          if (profile.role === 'beta_tester' && isBetaExpired(profile)) {
            router.replace('/paywall');
            return;
          }
          // Accesso valido: vai alla home
          router.replace('/');
        }
      }, 0);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    networkStore.loadInitialState();
    popupStore.initialize(); // Inizializza pop-up da locale e Supabase
    const unsub = voiceStore.subscribe(() => {
      setVoiceOpen(voiceStore.getState().isOpen);
    });
    return () => {
      unsub();
    };
  }, []);

  // Controlla popup attivi ad ogni cambio rotta
  useEffect(() => {
    if (pathname) {
      popupStore.checkRoute(pathname);
    }
  }, [pathname]);

  useEffect(() => {
    if ((loaded || error) && authChecked) {
      SplashScreen.hideAsync().catch(() => {
        // Ignora silenziosamente l'errore se lo splash screen è già stato nascosto
        // o se non è supportato nel controller corrente (frequente in Expo Go durante i refresh)
      });
    }
  }, [loaded, error, authChecked]);

  if (!loaded && !error) {
    return null;
  }

  // Pagine principali (Root tabs) su cui il menu inferiore è visibile
  const tabPaths = ['/', '/stats', '/subscriptions', '/settings'];
  const showBottomMenu = tabPaths.includes(pathname) || pathname.startsWith('/stats/');

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <SwipeNavigator>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" options={{ animation: 'fade' }} />
          <Stack.Screen name="blocked" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="paywall" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="manual-entry" />
          <Stack.Screen name="expense-detail" />
          <Stack.Screen name="seed-data" />
          <Stack.Screen name="subscriptions" />
          <Stack.Screen name="ai-chat" options={{ animation: 'none' }} />
        </Stack>
      </SwipeNavigator>

      {/* Remote Popup Modal Overlay */}
      <RemotePopupModal />

      {/* Voice overlay — always mounted, animates in/out */}
      <VoiceChatOverlay />

      {/* Bottom menu: sempre visibile sulle schede principali e sulle chat AI */}
      {(showBottomMenu || voiceOpen) && <BottomMenu />}
    </View>
  );
}
