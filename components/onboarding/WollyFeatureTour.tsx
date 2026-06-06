/**
 * WollyFeatureTour
 *
 * Orchestrates the onboarding AI feature tour using SlideCarousel.
 * - Checks camera/microphone permissions to determine slide availability
 * - Persists completion/skip state to AsyncStorage
 * - Shows a completion popup when all slides are done or skipped
 * - Self-hides after dismiss or completion
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { TYPOGRAPHY } from '../../constants/Theme';
import SlideCarousel from '../SlideCarousel';
import WollyFeatureTourSlide from './WollyFeatureTourSlide';
import { aiChatStore } from '../../services/aiChat';
import { voiceStore } from '../../services/voiceStore';
import { parseFromReceipt } from '../../modules/registration/receiptParser';

const STORAGE_KEY = 'wolly_feature_tour_v1';

interface TourState {
  dismissed: boolean;
  completed: { text: boolean; voice: boolean; photo: boolean };
  skipped:   { voice: boolean; photo: boolean };
}

const DEFAULT_STATE: TourState = {
  dismissed: false,
  completed: { text: false, voice: false, photo: false },
  skipped:   { voice: false, photo: false },
};

export default function WollyFeatureTour() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [tourState, setTourState] = useState<TourState>(DEFAULT_STATE);
  const [micAllowed, setMicAllowed] = useState<boolean | null>(null);
  const [camAllowed, setCamAllowed] = useState<boolean | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);
  const completionScale = useRef(new Animated.Value(0.8)).current;
  const completionOpacity = useRef(new Animated.Value(0)).current;

  // ── Load saved state ──────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved: TourState = JSON.parse(raw);
          if (saved.dismissed) return; // never show again
          setTourState(saved);
        }
        // Check permissions (non-blocking – best effort)
        const micPerm = await Audio.getPermissionsAsync().catch(() => null);
        setMicAllowed(micPerm?.status === 'granted');
        const camPerm = await ImagePicker.getCameraPermissionsAsync().catch(() => null);
        setCamAllowed(camPerm?.status === 'granted');

        setVisible(true);
      } catch (_) {
        setVisible(true);
      }
    })();
  }, []);

  const saveState = useCallback(async (next: TourState) => {
    setTourState(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  // ── Check if all done ────────────────────────────────────────────────────
  const checkAllDone = useCallback((state: TourState) => {
    const textDone  = state.completed.text;
    const voiceDone = state.completed.voice || state.skipped.voice || micAllowed === false;
    const photoDone = state.completed.photo || state.skipped.photo || camAllowed === false;
    return textDone && voiceDone && photoDone;
  }, [micAllowed, camAllowed]);

  const handleAllDone = useCallback(async (state: TourState) => {
    const next = { ...state, dismissed: true };
    await saveState(next);
    // Animate completion popup in
    setShowCompletion(true);
    Animated.parallel([
      Animated.spring(completionScale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
      Animated.timing(completionOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [saveState, completionScale, completionOpacity]);

  // ── Slide action handlers ─────────────────────────────────────────────────
  const handleTextCta = useCallback(async () => {
    const next = { ...tourState, completed: { ...tourState.completed, text: true } };
    await saveState(next);
    // Open AI chat
    router.push({ pathname: '/ai-chat', params: { returnTo: '/' } });
    if (checkAllDone(next)) handleAllDone(next);
    else setCurrentSlide(1);
  }, [tourState, saveState, router, checkAllDone, handleAllDone]);

  const handleVoiceCta = useCallback(async () => {
    // Request permission if not yet granted
    const perm = await Audio.requestPermissionsAsync().catch(() => null);
    if (perm?.status !== 'granted') {
      setMicAllowed(false);
      // Mark as skipped since user denied
      const next = { ...tourState, skipped: { ...tourState.skipped, voice: true } };
      await saveState(next);
      if (checkAllDone(next)) handleAllDone(next);
      else setCurrentSlide(2);
      return;
    }
    setMicAllowed(true);
    const next = { ...tourState, completed: { ...tourState.completed, voice: true } };
    await saveState(next);
    // Start voice recording
    voiceStore.startRecording('/');
    if (checkAllDone(next)) handleAllDone(next);
    else setCurrentSlide(2);
  }, [tourState, saveState, checkAllDone, handleAllDone]);

  const handleVoiceSkip = useCallback(async () => {
    const next = { ...tourState, skipped: { ...tourState.skipped, voice: true } };
    await saveState(next);
    if (checkAllDone(next)) handleAllDone(next);
    else setCurrentSlide(2);
  }, [tourState, saveState, checkAllDone, handleAllDone]);

  const handlePhotoCta = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync().catch(() => null);
    if (perm?.status !== 'granted') {
      setCamAllowed(false);
      const next = { ...tourState, skipped: { ...tourState.skipped, photo: true } };
      await saveState(next);
      if (checkAllDone(next)) handleAllDone(next);
      return;
    }
    setCamAllowed(true);
    const next = { ...tourState, completed: { ...tourState.completed, photo: true } };
    await saveState(next);
    if (checkAllDone(next)) handleAllDone(next);
    // Launch camera via receipt parser
    parseFromReceipt(undefined, () => {}).catch(() => {});
  }, [tourState, saveState, checkAllDone, handleAllDone]);

  const handlePhotoSkip = useCallback(async () => {
    const next = { ...tourState, skipped: { ...tourState.skipped, photo: true } };
    await saveState(next);
    if (checkAllDone(next)) handleAllDone(next);
  }, [tourState, saveState, checkAllDone, handleAllDone]);

  // ── Dismiss (X button) ───────────────────────────────────────────────────
  const handleDismiss = useCallback(() => {
    setVisible(false);
  }, []);

  // ── Complete popup close ─────────────────────────────────────────────────
  const handleCompletionClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(completionOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.spring(completionScale, { toValue: 0.85, useNativeDriver: true, tension: 80, friction: 10 }),
    ]).start(() => {
      setShowCompletion(false);
      setVisible(false);
    });
  }, [completionOpacity, completionScale]);

  if (!visible) return null;

  // ── Build slides ──────────────────────────────────────────────────────────
  const slides = [
    {
      key: 'text',
      content: (
        <WollyFeatureTourSlide
          icon="sparkles"
          title="Registra con testo"
          subtitle={"Scrivi \"ho speso 15€ al bar\" nell'AI e lascia fare a Wolly"}
          ctaLabel="Prova ora"
          onCta={handleTextCta}
          completed={tourState.completed.text}
        />
      ),
    },
    {
      key: 'voice',
      content: (
        <WollyFeatureTourSlide
          icon="mic"
          title="Registra con voce"
          subtitle="Tieni premuto il microfono e parla naturalmente"
          ctaLabel="Prova ora"
          onCta={handleVoiceCta}
          onSkip={handleVoiceSkip}
          disabled={micAllowed === false}
          disabledLabel="Abilita il microfono nelle impostazioni per usare la voce"
          completed={tourState.completed.voice}
        />
      ),
    },
    {
      key: 'photo',
      content: (
        <WollyFeatureTourSlide
          icon="camera"
          title="Registra con foto"
          subtitle="Scatta o importa uno scontrino, Wolly lo legge per te"
          ctaLabel="Prova ora"
          onCta={handlePhotoCta}
          onSkip={handlePhotoSkip}
          disabled={camAllowed === false}
          disabledLabel="Abilita la fotocamera nelle impostazioni per usare gli scontrini"
          completed={tourState.completed.photo}
        />
      ),
    },
  ];

  return (
    <>
      <SlideCarousel
        slides={slides}
        storageKey={STORAGE_KEY}
        label="SCOPRI WOLLY AI"
        currentIndex={currentSlide}
        onIndexChange={setCurrentSlide}
        onDismiss={handleDismiss}
        onComplete={() => handleAllDone(tourState)}
      />

      {/* ── Completion popup ── */}
      <Modal
        visible={showCompletion}
        transparent
        animationType="none"
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.completionCard,
              { opacity: completionOpacity, transform: [{ scale: completionScale }] },
            ]}
          >
            {/* Icon */}
            <View style={styles.completionIconWrapper}>
              <LinearGradient
                colors={['#34C759', '#2EAD4E']}
                style={styles.completionIconGradient}
              >
                <Ionicons name="checkmark" size={36} color="#FFFFFF" />
              </LinearGradient>
            </View>

            <Text style={styles.completionTitle}>Sei pronto con Wolly!</Text>
            <Text style={styles.completionBody}>
              Hai scoperto come registrare le tue spese.{'\n'}
              Continua a tracciare ogni movimento.
            </Text>

            <Pressable onPress={handleCompletionClose} style={styles.completionCtaWrapper}>
              <LinearGradient
                colors={['#5CB5FF', '#0078FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.completionCta}
              >
                <Text style={styles.completionCtaText}>Continua</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Completion modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  completionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 28,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  completionIconWrapper: {
    marginBottom: 20,
  },
  completionIconGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionTitle: {
    fontSize: 22,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 10,
  },
  completionBody: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
  },
  completionCtaWrapper: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  completionCta: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 14,
  },
  completionCtaText: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#FFFFFF',
  },
});
