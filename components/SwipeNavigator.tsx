import React, { useRef } from 'react';
import { View, PanResponder, Dimensions } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { voiceStore } from '../services/voiceStore';

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.15; // Più sensibile (era 0.25)

const ROUTES = ['/', '/stats', '/subscriptions', '/history', '/settings'];

export default function SwipeNavigator({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const rawPathname = usePathname();
  
  // Normalizziamo il percorso
  const pathname = rawPathname === '/' ? '/' : rawPathname.replace(/\/$/, '');
  
  // USIAMO UN REF per il pathname attuale.
  // Il PanResponder viene creato una volta sola, quindi le variabili catturate 
  // inizialmente diventano vecchie (stale). Usando un ref, leggiamo sempre il valore reale.
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        if (voiceStore.getState().isOpen) return false;
        // Inizia a rispondere dopo soli 10px di movimento (era 30)
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
      },
      onPanResponderRelease: (evt, gestureState) => {
        const currentPath = pathRef.current;
        let currentIndex = ROUTES.indexOf(currentPath);
        
        if (currentIndex === -1) {
          currentIndex = ROUTES.findIndex(r => r !== '/' && currentPath.startsWith(r));
        }

        if (currentIndex === -1) return;

        // Sensibilità estrema: scatta se superi la soglia O se il movimento è veloce (flick)
        const isFastSwipe = Math.abs(gestureState.vx) > 0.3;
        const isFarEnough = Math.abs(gestureState.dx) > 50;

        if (isFastSwipe || isFarEnough) {
          if (gestureState.dx < 0) {
            // Swipe verso SINISTRA -> vai a DESTRA
            if (currentIndex < ROUTES.length - 1) {
              router.replace(ROUTES[currentIndex + 1] as any);
            }
          } else {
            // Swipe verso DESTRA -> vai a SINISTRA
            if (currentIndex > 0) {
              router.replace(ROUTES[currentIndex - 1] as any);
            }
          }
        }
      },
    })
  ).current;

  // Abilitiamo lo swipe solo sulle pagine principali
  const isRootPath = ROUTES.includes(pathname);

  if (!isRootPath) return <View style={{ flex: 1 }}>{children}</View>;

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      {children}
    </View>
  );
}
