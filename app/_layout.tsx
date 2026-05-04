import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Outfit_400Regular, Outfit_700Bold } from '@expo-google-fonts/outfit';
import BottomMenu from '../components/BottomMenu';
import { View } from 'react-native';

SplashScreen.preventAutoHideAsync();

import { useRouter, usePathname } from 'expo-router';

export default function RootLayout() {
  const pathname = usePathname();
  const [loaded, error] = useFonts({
    Outfit_400Regular,
    Outfit_700Bold,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  // Pagine su cui il menu deve sparire
  const hiddenOn = ['/manual-entry', '/expense-detail', '/ai-chat'];
  const showMenu = !hiddenOn.includes(pathname);

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="history" />
        <Stack.Screen name="manual-entry" />
        <Stack.Screen name="expense-detail" />
        <Stack.Screen name="seed-data" />
      </Stack>
      {showMenu && <BottomMenu />}
    </View>
  );
}
