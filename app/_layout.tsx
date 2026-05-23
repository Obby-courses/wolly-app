import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Outfit_400Regular, Outfit_700Bold } from '@expo-google-fonts/outfit';
import BottomMenu from '../components/BottomMenu';
import TopNavigation from '../components/TopNavigation';
import SwipeNavigator from '../components/SwipeNavigator';
import VoiceChatOverlay from '../components/ai/VoiceChatOverlay';
import AnomalyReporter from '../components/AnomalyReporter';
import { View } from 'react-native';
import { usePathname } from 'expo-router';
import { voiceStore } from '../services/voiceStore';
import { networkStore } from '../services/networkStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const pathname = usePathname();
  const [voiceOpen, setVoiceOpen] = useState(false);

  const [loaded, error] = useFonts({
    Outfit_400Regular,
    Outfit_700Bold,
  });

  useEffect(() => {
    networkStore.loadInitialState();
    const unsub = voiceStore.subscribe(() => {
      setVoiceOpen(voiceStore.getState().isOpen);
    });
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  // Pagine principali (Root tabs) su cui il menu inferiore è visibile
  const tabPaths = ['/', '/stats', '/subscriptions', '/settings'];
  const showBottomMenu = [...tabPaths, '/ai-chat', '/voice-chat'].includes(pathname) || pathname.startsWith('/stats/');

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <SwipeNavigator>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="manual-entry" />
          <Stack.Screen name="expense-detail" />
          <Stack.Screen name="seed-data" />
          <Stack.Screen name="subscriptions" />
        </Stack>
      </SwipeNavigator>

      {/* Voice overlay — always mounted, animates in/out */}
      <VoiceChatOverlay />

      {/* Centralized Anomaly/Bug reporter button & modal */}
      <AnomalyReporter />

      {/* Bottom menu: sempre visibile sulle schede principali e sulle chat AI */}
      {(showBottomMenu || voiceOpen) && <BottomMenu />}
    </View>
  );
}
