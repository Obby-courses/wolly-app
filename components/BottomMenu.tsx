import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, View, Pressable, Platform, Text,
  KeyboardAvoidingView, Animated, PanResponder, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SPACING, TYPOGRAPHY } from '../constants/Theme';
import { parseFromReceipt } from '../modules/registration/receiptParser';
import { voiceStore } from '../services/voiceStore';
import { askAiChat } from '../services/aiChat';
import { Audio } from 'expo-av';
import { networkStore } from '../services/networkStore';

const CANCEL_THRESHOLD_Y = -60;
const MIN_RECORDING_DURATION = 500;
const MIC_SIZE = 56;

const RANDOM_QUESTIONS = [
  "Cosa ho speso nell'ultimo periodo?",
  "Quanto ho speso al ristorante questo mese?",
  "Qual è stata la mia spesa più alta oggi?",
  "Quanto ho risparmiato rispetto alla settimana scorsa?",
  "Mostrami le ultime transazioni al supermercato",
];

export default function BottomMenu() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<any>(null);

  // Mirror voiceStore state
  const [voiceState, setVoiceState] = useState(voiceStore.getState());
  const [isOffline, setIsOffline] = useState(networkStore.getState().isOffline);
  
  useEffect(() => {
    const unsubVoice = voiceStore.subscribe(() => setVoiceState(voiceStore.getState()));
    const unsubNet = networkStore.subscribe(() => setIsOffline(networkStore.getState().isOffline));
    // Chiediamo i permessi subito all'avvio per non interrompere il gesto dopo
    Audio.requestPermissionsAsync().catch(() => {});
    return () => {
      unsubVoice();
      unsubNet();
    };
  }, []);

  // Pulse animation for recording state
  const pulse = useRef(new Animated.Value(0)).current;
  const pulseAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (voiceState.isRecording) {
      pulseAnimRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 600, useNativeDriver: true }),
        ])
      );
      pulseAnimRef.current.start();
    } else {
      pulseAnimRef.current?.stop();
      pulse.setValue(0);
    }
  }, [voiceState.isRecording]);

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  const showToast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 3500);
  };

  const handleCamera = async () => {
    try {
      setIsProcessing(true);
      const parsed = await parseFromReceipt(true, undefined);
      
      if (parsed === null) {
        // L'utente ha annullato la fotocamera
        return;
      }

      if (parsed && parsed.amount > 0) {
        router.push({ pathname: '/expense-detail', params: { data: JSON.stringify(parsed) } });
      } else {
        Alert.alert(
          "Scontrino non riconosciuto",
          "La foto non sembra contenere uno scontrino valido o leggibile. Riprova.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error('Error parsing camera/receipt:', error);
      Alert.alert(
        "Scontrino non riconosciuto",
        "La foto non sembra contenere uno scontrino valido o leggibile. Riprova.",
        [{ text: "OK" }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Mic PanResponder ──────────────────────────────────────────────────────────
  const isReleasingRef = useRef(false);

  const micPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: () => {
        isReleasingRef.current = false;
        voiceStore.startRecording(); 
      },

      onPanResponderTerminationRequest: () => false,

      onPanResponderMove: (_, { dy }) => {
        voiceStore.setIsSlidingToCancel(dy < CANCEL_THRESHOLD_Y);
      },

      onPanResponderRelease: async () => {
        if (isReleasingRef.current) return;
        isReleasingRef.current = true;

        const state = voiceStore.getState();
        const duration = Date.now() - state.recordingStartTime;

        // Se scivola per annullare
        if (state.isSlidingToCancel) {
          voiceStore.cancelRecording(); // asincrono, non blocca la UI
          voiceStore.close();
          return;
        }

        // Tap veloce: annulla e torna SUBITO indietro senza aspettare l'engine audio
        if (duration < MIN_RECORDING_DURATION) {
          voiceStore.cancelRecording();
          voiceStore.close();
          return;
        }

        // Ottiene il file (questo ferma la registrazione a livello di sistema)
        const result = await voiceStore.stopAndGetUri();
        if (!result || !result.uri) {
          voiceStore.close();
          return;
        }

        // Delega l'elaborazione (STT -> AI) allo store in modo modulare
        voiceStore.processVoiceInput(result.uri);
      },

      onPanResponderTerminate: async () => {
        await voiceStore.cancelRecording();
        voiceStore.close();
      },
    })
  ).current;

  const { isRecording, isOpen, isSlidingToCancel } = voiceState;

  // ─────────────────────────────────────────────────────────────────────────────
  // SINGLE render tree — the mic element is ALWAYS the same instance.
  // Chat + Camera icons fade out when overlay opens; cancel hint fades in.
  // This keeps the PanResponder gesture alive through the state change.
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.wrapper}>
      {/* RACCORDO VISIVO A DUE LAYER (Effetto "Corna") */}
      <View style={styles.hornsContainer} pointerEvents="none">
        {/* Corno Sinistro */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, width: 40, height: 40, overflow: 'hidden' }}>
          <View style={{
            position: 'absolute',
            width: 160,
            height: 160,
            borderRadius: 80,
            borderWidth: 40,
            borderColor: COLORS.surface,
            left: -40,
            top: -80,
          }} />
        </View>

        {/* Corno Destro */}
        <View style={{ position: 'absolute', bottom: 0, right: 0, width: 40, height: 40, overflow: 'hidden' }}>
          <View style={{
            position: 'absolute',
            width: 160,
            height: 160,
            borderRadius: 80,
            borderWidth: 40,
            borderColor: COLORS.surface,
            left: -80,
            top: -80,
          }} />
        </View>
      </View>

      <View style={styles.container}>

      {/* Cancel hint — ABSOLUTE so it doesn't move the mic button below */}
      {isOpen && isRecording && (
        <View style={styles.cancelHintContainer}>
          <Ionicons
            name="chevron-up"
            size={18}
            color={isSlidingToCancel ? COLORS.danger : COLORS.secondary}
          />
          <Text style={[styles.cancelHintText, isSlidingToCancel && { color: COLORS.danger }]}>
            {isSlidingToCancel ? 'Rilascia per annullare' : 'Scorri su per annullare'}
          </Text>
        </View>
      )}

      {isOffline ? (
        <View style={styles.row}>
          <Pressable
            onPress={() => router.push({ 
              pathname: '/expense-detail', 
              params: { data: JSON.stringify({ amount: 0, date: new Date().toISOString(), category_key: 'altro_altro', direction: 'out', tags: [], input_method: 'manual' }) } 
            })}
            style={[styles.micBtn, { backgroundColor: COLORS.primary }]}
          >
            <Ionicons name="add" size={36} color="#FFF" />
          </Pressable>
        </View>
      ) : (
        <View style={styles.row}>
          {/* Left: Chat icon — hidden when overlay is open */}
          <Pressable
            onPress={() => router.push('/ai-chat')}
            style={[styles.sideIcon, isOpen && styles.hidden]}
            pointerEvents={isOpen ? 'none' : 'auto'}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={26} color={COLORS.secondary} />
          </Pressable>

          {/* Center: Mic — ALWAYS rendered, same element, same position */}
          <Animated.View
            {...micPanResponder.panHandlers}
            style={[
              styles.micBtn,
              isOpen && styles.micBtnActive,
              isSlidingToCancel && styles.micBtnCancel,
              isRecording && !isSlidingToCancel && { transform: [{ scale: pulseScale }] },
            ]}
          >
            <Ionicons
              name={isRecording ? 'mic' : 'mic-outline'}
              size={32}
              color={
                isSlidingToCancel
                  ? COLORS.danger
                  : isOpen
                  ? '#FFF'
                  : COLORS.primary
              }
            />
          </Animated.View>

          {/* Right: Camera icon — hidden when overlay is open */}
          <Pressable
            onPress={handleCamera}
            disabled={isProcessing || isOpen}
            style={[styles.sideIcon, (isOpen || isProcessing) && styles.hidden]}
            pointerEvents={isOpen ? 'none' : 'auto'}
          >
            <Ionicons name="camera-outline" size={26} color={COLORS.secondary} />
          </Pressable>
        </View>
      )}

      {toastMsg && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toastMsg}</Text>
        </View>
      )}
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 101,
  },
  hornsContainer: {
    height: 40,
    width: '100%',
    backgroundColor: 'transparent',
  },
  container: {
    backgroundColor: COLORS.surface,
    paddingTop: 4,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelHintContainer: {
    position: 'absolute',
    top: -45,
    alignItems: 'center',
    gap: 4,
    zIndex: 110,
  },
  cancelHintText: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 13,
    color: COLORS.secondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.lg,
    zIndex: 102,
  },
  sideIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.soft,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  hidden: {
    opacity: 0,
    // pointerEvents handled via prop
  },
  micBtn: {
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: MIC_SIZE / 2,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.medium,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  micBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  micBtnCancel: {
    backgroundColor: COLORS.danger + '20',
    borderColor: COLORS.danger,
  },
  toast: {
    position: 'absolute',
    bottom: 95,
    left: SPACING.lg,
    right: SPACING.lg,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    ...SHADOWS.medium,
    alignItems: 'center',
  },
  toastText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: 14,
    color: '#F1F5F9',
    textAlign: 'center',
    lineHeight: 20,
  },
});
