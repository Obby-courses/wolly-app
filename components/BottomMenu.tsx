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
import { analytics } from '../services/analytics';

const CANCEL_THRESHOLD_X = -50;
const MIN_RECORDING_DURATION = 500;
const MIC_SIZE = 40;

const NAV_ITEMS = [
  { path: '/', icon: 'home-sharp', label: 'Home' },
  { path: '/stats', icon: 'pie-chart-sharp', label: 'Stats' },
  { path: '/subscriptions', icon: 'card-sharp', label: 'Abbonamenti' },
  { path: '/settings', icon: 'settings-sharp', label: 'Impostazioni' }
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

  // Reset expanded state and dismiss keyboard on page change
  useEffect(() => {
    setIsExpanded(false);
    Keyboard.dismiss();
  }, [pathname]);

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

  const handleCamera = () => {
    Alert.alert(
      "Carica Scontrino",
      "Scegli da dove acquisire lo scontrino",
      [
        {
          text: "Scatta Foto",
          onPress: () => executeReceiptParsing(true),
        },
        {
          text: "Scegli dalla Galleria",
          onPress: () => executeReceiptParsing(false),
        },
        {
          text: "Annulla",
          style: "cancel",
        }
      ]
    );
  };

  const executeReceiptParsing = async (useCamera: boolean) => {
    try {
      setIsProcessing(true);
      const parsed = await parseFromReceipt(useCamera, undefined);
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

  // ── primaryPanResponder (Gestisce sia TAP che HOLD per la registrazione immediata) ──
  const holdTimeoutRef = useRef<any>(null);
  const hasStartedRecordingRef = useRef(false);
  const isReleasingRef = useRef(false);

  const primaryPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: () => {
        isReleasingRef.current = false;
        hasStartedRecordingRef.current = false;

        if (isTextChat) return;

        // Rileviamo se l'utente tiene premuto: avvia la registrazione dopo 150ms
        holdTimeoutRef.current = setTimeout(() => {
          hasStartedRecordingRef.current = true;
          voiceStore.startRecording();
          analytics.trackClick('btn_voice_rec_start', pathname);
        }, 150);
      },

      onPanResponderTerminationRequest: () => false,

      onPanResponderMove: (_, { dx }) => {
        if (hasStartedRecordingRef.current) {
          voiceStore.setIsSlidingToCancel(dx < CANCEL_THRESHOLD_X);
        } else if (dx < -15) {
          // Se l'utente trascina subito a sinistra di oltre 15px, forziamo l'avvio della registrazione
          if (holdTimeoutRef.current) {
            clearTimeout(holdTimeoutRef.current);
            holdTimeoutRef.current = null;
          }
          hasStartedRecordingRef.current = true;
          voiceStore.startRecording();
          voiceStore.setIsSlidingToCancel(true);
        }
      },

      onPanResponderRelease: async () => {
        if (isReleasingRef.current) return;
        isReleasingRef.current = true;

        if (holdTimeoutRef.current) {
          clearTimeout(holdTimeoutRef.current);
          holdTimeoutRef.current = null;
        }

        // Caso 1: Semplice TAP rapido (minore di 150ms)
        if (!hasStartedRecordingRef.current) {
          if (!isExpanded && !isVoiceChat) {
            setIsExpanded(true);
          } else if (isExpanded) {
            setIsExpanded(false);
          }
          return;
        }

        // Caso 2: HOLD (registrazione avviata)
        const state = voiceStore.getState();
        const duration = Date.now() - state.recordingStartTime;

        // Se scivola a sinistra per annullare
        if (state.isSlidingToCancel) {
          analytics.trackEvent('voice_rec_cancelled', { screen: pathname });
          voiceStore.cancelRecording();
          voiceStore.close();
          setIsExpanded(false);
          return;
        }

        // Tap veloce (sicurezza sulla durata minima)
        if (duration < MIN_RECORDING_DURATION) {
          analytics.trackEvent('voice_rec_aborted_too_short', { screen: pathname });
          voiceStore.cancelRecording();
          voiceStore.close();
          setIsExpanded(false);
          return;
        }

        // Ottiene il file audio
        const result = await voiceStore.stopAndGetUri();
        if (!result || !result.uri) {
          voiceStore.close();
          setIsExpanded(false);
          return;
        }

        analytics.trackClick('btn_voice_rec_stop', pathname);
        // Elabora l'input vocale
        voiceStore.processVoiceInput(result.uri);
        setIsExpanded(false);
      },

      onPanResponderTerminate: async () => {
        if (holdTimeoutRef.current) {
          clearTimeout(holdTimeoutRef.current);
          holdTimeoutRef.current = null;
        }
        if (hasStartedRecordingRef.current) {
          await voiceStore.cancelRecording();
          voiceStore.close();
          setIsExpanded(false);
        }
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
          if (pathname === item.path) return;
          let btnKey = '';
          if (item.path === '/') btnKey = 'btn_tab_home';
          else if (item.path === '/stats') btnKey = 'btn_tab_stats';
          else if (item.path === '/subscriptions') btnKey = 'btn_tab_subscriptions';
          else if (item.path === '/settings') btnKey = 'btn_tab_settings';
          if (btnKey) {
            analytics.trackClick(btnKey, pathname);
          }
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
  // Spacing: width 80, gap 8 -> step is 88
  const backTranslateX = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -264],
  });
  const fotoTranslateX = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -176],
  });
  const chatTranslateX = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -88],
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
          
          {/* LEFT SIDE: Navigation Icons OR Close button in voice chat / Plus button in text chat */}
          <View style={styles.leftContainer}>
            {isVoiceChat ? (
              // In voice chat, close button X is moved to the far left corner
              <Pressable onPress={handleVoiceClose} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#1C1C1E" />
              </Pressable>
            ) : isTextChat && !isExpanded ? (
              // In text chat active and not expanded, show the plus (+) button in the bottom-left corner
              <Pressable
                onPress={() => setIsExpanded(true)}
                style={styles.toolBtn}
              >
                <Ionicons name="add" size={24} color="#FFF" />
              </Pressable>
            ) : (
              // Standard Navigation Tabs (mostra solo la pagina corrente se espanso per pulizia visiva)
              <View style={styles.leftNav}>
                {NAV_ITEMS.map((item) => {
                  if (isExpanded) {
                    return isActive(item.path) ? renderNavItem(item) : null;
                  }
                  return renderNavItem(item);
                })}
              </View>
            )}
          </View>

          {/* RIGHT SIDE: Dynamic Actions */}
          <View style={styles.rightContainer}>
            {isVoiceChat ? (
              // 1. Voice Chat active state: persistent primary button and cancel text next to it
              <View style={styles.voiceActionsRow}>
                {isRecording && (
                  // Pulse/Slide arrow with "Wipe per annullare" text when recording (brought close to Rec button)
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
                )}
                <Animated.View
                  key="persistent-primary-btn"
                  {...primaryPanResponder.panHandlers}
                  style={[
                    styles.toolBtn,
                    isSlidingToCancel && styles.micBtnCancel
                  ]}
                >
                  <Ionicons name="mic" size={22} color="#FFF" />
                </Animated.View>
              </View>
            ) : isTextChat && !isExpanded ? (
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
              // 4. Online Idle state: Animated Expandable tools and persistent primary button
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
                  <Pressable 
                    style={styles.pressable} 
                    onPress={() => {
                      analytics.trackClick('btn_camera_scontrino_open', pathname);
                      handleCamera();
                    }} 
                    disabled={isProcessing}
                  >
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
                  <Pressable 
                    style={styles.pressable} 
                    onPress={() => {
                      analytics.trackClick('btn_ai_chat_open', pathname);
                      if (pathname === '/ai-chat') return;
                      router.push('/ai-chat');
                    }}
                  >
                    <Ionicons name="chatbubble-ellipses" size={20} color="#FFF" />
                  </Pressable>
                </Animated.View>

                {/* Persistent primary button inside expandedWrapper */}
                <Animated.View
                  key="persistent-primary-btn"
                  {...primaryPanResponder.panHandlers}
                  style={[
                    styles.toolBtn,
                    isExpanded && styles.micBtnActive,
                    isSlidingToCancel && styles.micBtnCancel,
                  ]}
                >
                  <Ionicons
                    name={isExpanded ? "mic" : "add"}
                    size={22}
                    color="#FFF"
                  />
                </Animated.View>

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
    minWidth: 80,
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
    width: 80,
    height: 40,
  },
  pressable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBtn: {
    width: 80,
    height: 40,
    borderRadius: 20,
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
    gap: 8,
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
