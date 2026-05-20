import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, View, Pressable, Platform, Text,
  Animated, PanResponder, Alert, Keyboard,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SPACING, TYPOGRAPHY } from '../constants/Theme';
import { parseFromReceipt } from '../modules/registration/receiptParser';
import { voiceStore } from '../services/voiceStore';
import { Audio } from 'expo-av';
import { networkStore } from '../services/networkStore';

const CANCEL_THRESHOLD_X = -50;
const MIN_RECORDING_DURATION = 500;
const MIC_SIZE = 40;

const NAV_ITEMS = [
  { path: '/', icon: 'home', label: 'Home' },
  { path: '/stats', icon: 'pie-chart', label: 'Stats' },
  { path: '/subscriptions', icon: 'card', label: 'Abbonamenti' },
  { path: '/settings', icon: 'settings', label: 'Impostazioni' }
];

export default function BottomMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<any>(null);

  // States mirroring network and voice stores
  const [voiceState, setVoiceState] = useState(voiceStore.getState());
  const [isOffline, setIsOffline] = useState(networkStore.getState().isOffline);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const unsubVoice = voiceStore.subscribe(() => setVoiceState(voiceStore.getState()));
    const unsubNet = networkStore.subscribe(() => setIsOffline(networkStore.getState().isOffline));
    Audio.requestPermissionsAsync().catch(() => {});

    // Gestione visibilità tastiera per nascondere il menu
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );

    return () => {
      unsubVoice();
      unsubNet();
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // Expand animation values
  const expandAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(expandAnim, {
      toValue: isExpanded ? 1 : 0,
      useNativeDriver: true,
      tension: 60,
      friction: 8,
    }).start();
  }, [isExpanded]);

  // Rec pulse animation
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

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });

  // Pulse animation for wipe/swipe cancel icon
  const chevronTranslateX = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (voiceState.isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(chevronTranslateX, { toValue: -6, duration: 600, useNativeDriver: true }),
          Animated.timing(chevronTranslateX, { toValue: 0, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      chevronTranslateX.setValue(0);
    }
  }, [voiceState.isRecording]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 3500);
  };

  const handleCamera = async () => {
    try {
      setIsProcessing(true);
      const parsed = await parseFromReceipt(true, undefined);
      if (parsed === null) return;

      if (parsed && parsed.amount > 0) {
        // Collapser menu immediately
        setIsExpanded(false);
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

  const handleOfflinePress = () => {
    router.push({
      pathname: '/expense-detail',
      params: {
        data: JSON.stringify({
          amount: 0,
          date: new Date().toISOString(),
          category_key: 'default',
          direction: 'out',
          tags: [],
          input_method: 'manual'
        })
      }
    });
  };

  const handleVoiceClose = async () => {
    await voiceStore.cancelRecording();
    voiceStore.close();
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

      onPanResponderMove: (_, { dx }) => {
        voiceStore.setIsSlidingToCancel(dx < CANCEL_THRESHOLD_X);
      },

      onPanResponderRelease: async () => {
        if (isReleasingRef.current) return;
        isReleasingRef.current = true;

        const state = voiceStore.getState();
        const duration = Date.now() - state.recordingStartTime;

        // Se scivola a sinistra per annullare
        if (state.isSlidingToCancel) {
          voiceStore.cancelRecording();
          voiceStore.close();
          setIsExpanded(false); // Collapsa anche il menu
          return;
        }

        // Tap veloce: annulla e chiude
        if (duration < MIN_RECORDING_DURATION) {
          voiceStore.cancelRecording();
          voiceStore.close();
          setIsExpanded(false);
          return;
        }

        // Ottiene il file
        const result = await voiceStore.stopAndGetUri();
        if (!result || !result.uri) {
          voiceStore.close();
          setIsExpanded(false);
          return;
        }

        // Delega l'elaborazione vocale allo store
        voiceStore.processVoiceInput(result.uri);
        setIsExpanded(false); // Chiude menu dopo invio
      },

      onPanResponderTerminate: async () => {
        await voiceStore.cancelRecording();
        voiceStore.close();
        setIsExpanded(false);
      },
    })
  ).current;

  const { isRecording, isOpen, isSlidingToCancel } = voiceState;

  // Path helpers
  const isTextChat = pathname === '/ai-chat';
  const isVoiceChat = pathname === '/voice-chat' || isOpen;

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  // Render navigation item
  const renderNavItem = (item: typeof NAV_ITEMS[0]) => {
    const active = isActive(item.path);
    return (
      <Pressable
        key={item.path}
        onPress={() => {
          if (isTextChat || isVoiceChat) {
            voiceStore.close(); // Chiude eventuale overlay vocale
          }
          router.replace(item.path as any);
        }}
        style={styles.navItem}
      >
        <Ionicons
          name={item.icon as any}
          size={24}
          color={active ? '#000000' : '#8E8E93'}
          style={!active && { opacity: 0.4 }}
        />
      </Pressable>
    );
  };

  // Interpolations for horizontal slide menu [Back] [Foto] [Chat] [Audio]
  // Spacing: width 40, gap 8 -> step is 48
  const backTranslateX = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -144],
  });
  const fotoTranslateX = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -96],
  });
  const chatTranslateX = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -48],
  });
  const toolOpacity = expandAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0, 1],
  });

  // Nascondiamo il menu sotto la tastiera se attiva
  if (isKeyboardVisible) return null;

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        <View style={styles.row}>
          
          {/* LEFT SIDE: Navigation Icons OR Dynamic Cancel text */}
          <View style={styles.leftContainer}>
            {isVoiceChat && isRecording ? (
              // Pulse/Slide arrow with "Wipe per annullare" text when recording
              <View style={styles.cancelContainer}>
                <Animated.View style={{ transform: [{ translateX: chevronTranslateX }] }}>
                  <Ionicons
                    name="chevron-back"
                    size={16}
                    color={isSlidingToCancel ? COLORS.danger : COLORS.secondary}
                  />
                </Animated.View>
                <Text style={[styles.cancelText, isSlidingToCancel && { color: COLORS.danger }]}>
                  {isSlidingToCancel ? 'Rilascia per annullare' : 'Wipe per annullare'}
                </Text>
              </View>
            ) : (
              // Standard Navigation Tabs
              <View style={styles.leftNav}>
                {NAV_ITEMS.map((item) => renderNavItem(item))}
              </View>
            )}
          </View>

          {/* RIGHT SIDE: Dynamic Actions */}
          <View style={styles.rightContainer}>
            {isVoiceChat ? (
              // 1. Voice Chat active state: [X] and [Rec]
              <View style={styles.voiceActionsRow}>
                <Pressable onPress={handleVoiceClose} style={styles.closeBtn}>
                  <Ionicons name="close" size={24} color="#1C1C1E" />
                </Pressable>
                <Animated.View
                  {...micPanResponder.panHandlers}
                  style={[
                    styles.toolBtn,
                    isSlidingToCancel && styles.micBtnCancel,
                    isRecording && !isSlidingToCancel && { transform: [{ scale: pulseScale }] }
                  ]}
                >
                  <Ionicons name="mic" size={20} color="#FFF" />
                </Animated.View>
              </View>
            ) : isTextChat ? (
              // 2. Text AI Chat active state: just [X]
              <Pressable onPress={() => router.back()} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#1C1C1E" />
              </Pressable>
            ) : isOffline ? (
              // 3. Offline Idle state: Rounded rectangle "Nuova spesa"
              <Pressable onPress={handleOfflinePress} style={styles.offlineBtn}>
                <Ionicons name="add" size={18} color="#FFF" />
                <Text style={styles.offlineBtnText}>Nuova spesa</Text>
              </Pressable>
            ) : (
              // 4. Online Idle state: Animated Expandable tools [Back] [Foto] [Chat] [Audio]
              <View style={styles.expandedWrapper}>
                
                {/* Back tool button */}
                <Animated.View
                  pointerEvents={isExpanded ? 'auto' : 'none'}
                  style={[
                    styles.toolBtn,
                    styles.backBtn,
                    {
                      position: 'absolute',
                      right: 0,
                      transform: [{ translateX: backTranslateX }],
                      opacity: toolOpacity,
                    },
                  ]}
                >
                  <Pressable style={styles.pressable} onPress={() => setIsExpanded(false)}>
                    <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
                  </Pressable>
                </Animated.View>

                {/* Foto tool button */}
                <Animated.View
                  pointerEvents={isExpanded ? 'auto' : 'none'}
                  style={[
                    styles.toolBtn,
                    {
                      position: 'absolute',
                      right: 0,
                      transform: [{ translateX: fotoTranslateX }],
                      opacity: toolOpacity,
                    },
                  ]}
                >
                  <Pressable style={styles.pressable} onPress={handleCamera} disabled={isProcessing}>
                    <Ionicons name="camera" size={20} color="#FFF" />
                  </Pressable>
                </Animated.View>

                {/* Chat tool button */}
                <Animated.View
                  pointerEvents={isExpanded ? 'auto' : 'none'}
                  style={[
                    styles.toolBtn,
                    {
                      position: 'absolute',
                      right: 0,
                      transform: [{ translateX: chatTranslateX }],
                      opacity: toolOpacity,
                    },
                  ]}
                >
                  <Pressable style={styles.pressable} onPress={() => router.push('/ai-chat')}>
                    <Ionicons name="chatbubble-ellipses" size={20} color="#FFF" />
                  </Pressable>
                </Animated.View>

                {/* Audio button (or Collapsed '+' button) */}
                {isExpanded ? (
                  <Animated.View
                    {...micPanResponder.panHandlers}
                    style={[
                      styles.toolBtn,
                      isRecording && styles.micBtnActive,
                      isSlidingToCancel && styles.micBtnCancel,
                      isRecording && !isSlidingToCancel && { transform: [{ scale: pulseScale }] },
                    ]}
                  >
                    <Ionicons name="mic" size={20} color="#FFF" />
                  </Animated.View>
                ) : (
                  <Pressable
                    style={styles.toolBtn}
                    onPress={() => setIsExpanded(true)}
                  >
                    <Ionicons name="add" size={24} color="#FFF" />
                  </Pressable>
                )}

              </View>
            )}
          </View>

        </View>

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
  container: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
    position: 'relative',
    height: 48,
  },
  leftContainer: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  rightContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 48,
  },
  leftNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  navItem: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.brandBlue,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
    ...SHADOWS.soft,
  },
  offlineBtnText: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  expandedWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    width: 40,
    height: 40,
  },
  pressable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBtn: {
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: MIC_SIZE / 2,
    backgroundColor: COLORS.brandBlue,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.soft,
  },
  backBtn: {
    backgroundColor: '#F2F2F7',
  },
  micBtnActive: {
    backgroundColor: COLORS.brandBlue,
  },
  micBtnCancel: {
    backgroundColor: COLORS.danger,
  },
  cancelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
  },
  cancelText: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 13,
    color: COLORS.secondary,
  },
  voiceActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
