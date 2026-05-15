import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Outfit_400Regular, Outfit_700Bold } from '@expo-google-fonts/outfit';
import BottomMenu from '../components/BottomMenu';
import TopNavigation from '../components/TopNavigation';
import SwipeNavigator from '../components/SwipeNavigator';
import VoiceChatOverlay from '../components/ai/VoiceChatOverlay';
import { View } from 'react-native';
import { usePathname } from 'expo-router';
import { voiceStore } from '../services/voiceStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const pathname = usePathname();
  const [voiceOpen, setVoiceOpen] = useState(false);

  const [loaded, error] = useFonts({
    Outfit_400Regular,
    Outfit_700Bold,
  });

  useEffect(() => {
    const unsub = voiceStore.subscribe(() => {
      setVoiceOpen(voiceStore.getState().isOpen);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  // Pagine su cui il menu deve apparire (Root tabs)
  const rootPaths = ['/', '/stats', '/subscriptions', '/history', '/settings'];
  const showMenu = rootPaths.includes(pathname);

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {showMenu && <TopNavigation />}
      <SwipeNavigator>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="history" />
          <Stack.Screen name="manual-entry" />
          <Stack.Screen name="expense-detail" />
          <Stack.Screen name="seed-data" />
          <Stack.Screen name="subscriptions" />
        </Stack>
      </SwipeNavigator>

      {/* Voice overlay — always mounted, animates in/out */}
      <VoiceChatOverlay />

      {/* Bottom menu: show on root tabs OR when voice overlay is open (so the mic stays visible) */}
      {(showMenu || voiceOpen) && <BottomMenu />}
    </View>
  );
}
