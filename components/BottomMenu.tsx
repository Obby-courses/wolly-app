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
import { aiChatStore } from '../services/aiChat';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const CANCEL_THRESHOLD_Y = -50;
const MIN_RECORDING_DURATION = 500;

const NAV_ITEMS = [
  { path: '/', iconOutline: 'home-outline', iconSharp: 'home', id: 'home' },
  { path: '/stats', iconOutline: 'pie-chart-outline', iconSharp: 'pie-chart', id: 'stats' },
  { isPlus: true, id: 'plus' },
  { path: '/subscriptions', iconOutline: 'calendar-outline', iconSharp: 'calendar', id: 'subs' },
  { path: '/settings', iconOutline: 'settings-outline', iconSharp: 'settings', id: 'settings' }
];

export default function BottomMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<any>(null);

  const [voiceState, setVoiceState] = useState(voiceStore.getState());
  const [isOffline, setIsOffline] = useState(networkStore.getState().isOffline);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const unsubVoice = voiceStore.subscribe(() => setVoiceState(voiceStore.getState()));
    const unsubNet = networkStore.subscribe(() => setIsOffline(networkStore.getState().isOffline));
    Audio.requestPermissionsAsync().catch(() => {});

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

  useEffect(() => {
    Keyboard.dismiss();
  }, [pathname]);

  const chevronTranslateY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (voiceState.isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(chevronTranslateY, { toValue: -6, duration: 600, useNativeDriver: true }),
          Animated.timing(chevronTranslateY, { toValue: 0, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      chevronTranslateY.setValue(0);
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
        router.push({ pathname: '/expense-detail', params: { data: JSON.stringify(parsed) } });
      } else {
        Alert.alert("Scontrino non riconosciuto", "La foto non sembra contenere uno scontrino valido o leggibile. Riprova.", [{ text: "OK" }]);
      }
    } catch (error) {
      console.error('Error parsing camera/receipt:', error);
      Alert.alert("Scontrino non riconosciuto", "La foto non sembra contenere uno scontrino valido o leggibile. Riprova.", [{ text: "OK" }]);
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

  const holdTimeoutRef = useRef<any>(null);
  const tapTimeoutRef = useRef<any>(null);
  const lastTapTimeRef = useRef(0);
  const isDoubleTapRef = useRef(false);
  const hasStartedRecordingRef = useRef(false);
  const isReleasingRef = useRef(false);
  
  const progressAnim = useRef(new Animated.Value(1)).current;

  const handleAutoSend = async () => {
    if (isReleasingRef.current) return;
    isReleasingRef.current = true;

    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }

    const state = voiceStore.getState();
    if (!state.isRecording) return;

    const result = await voiceStore.stopAndGetUri();
    if (!result || !result.uri) {
      voiceStore.close();
      return;
    }

    analytics.trackEvent('voice_rec_stop_auto_15s', { screen: pathname });
    voiceStore.processVoiceInput(result.uri);
  };

  useEffect(() => {
    if (voiceState.isRecording) {
      progressAnim.setValue(1);
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: 15000,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) handleAutoSend();
      });
    } else {
      progressAnim.setValue(1);
      progressAnim.stopAnimation();
    }
  }, [voiceState.isRecording]);

  const primaryPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: () => {
        isReleasingRef.current = false;
        hasStartedRecordingRef.current = false;
        
        const now = Date.now();
        if (now - lastTapTimeRef.current < 300) {
           if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
           isDoubleTapRef.current = true;
           analytics.trackClick('btn_camera_scontrino_open', pathname);
           handleCamera();
           return;
        }
        isDoubleTapRef.current = false;
        lastTapTimeRef.current = now;

        holdTimeoutRef.current = setTimeout(() => {
          if (isDoubleTapRef.current) return;
          hasStartedRecordingRef.current = true;
          voiceStore.startRecording();
          analytics.trackClick('btn_voice_rec_start', pathname);
        }, 300);
      },

      onPanResponderMove: (_, { dy }) => {
        if (hasStartedRecordingRef.current) {
          voiceStore.setIsSlidingToCancel(dy < CANCEL_THRESHOLD_Y);
        } else if (dy < -15) {
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

        if (isDoubleTapRef.current) return;

        if (!hasStartedRecordingRef.current) {
           tapTimeoutRef.current = setTimeout(() => {
              analytics.trackClick('btn_ai_chat_open', pathname);
              if (pathname !== '/ai-chat') {
                router.push('/ai-chat');
              }
           }, 300);
           return;
        }

        const state = voiceStore.getState();
        const duration = Date.now() - state.recordingStartTime;

        if (state.isSlidingToCancel) {
          analytics.trackEvent('voice_rec_cancelled', { screen: pathname });
          voiceStore.cancelRecording();
          voiceStore.close();
          return;
        }

        if (duration < MIN_RECORDING_DURATION) {
          analytics.trackEvent('voice_rec_aborted_too_short', { screen: pathname });
          voiceStore.cancelRecording();
          voiceStore.close();
          return;
        }

        const result = await voiceStore.stopAndGetUri();
        if (!result || !result.uri) {
          voiceStore.close();
          return;
        }

        analytics.trackClick('btn_voice_rec_stop', pathname);
        voiceStore.processVoiceInput(result.uri);
      },

      onPanResponderTerminate: async () => {
        if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
        if (hasStartedRecordingRef.current) {
          await voiceStore.cancelRecording();
          voiceStore.close();
        }
      },
    })
  ).current;

  const { isRecording, isOpen, isSlidingToCancel } = voiceState;
  const isVoiceChat = isOpen;

  const isActive = (path?: string) => {
    if (!path) return false;
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  const PROGRESS_RADIUS = 28;
  const PROGRESS_STROKE_WIDTH = 4;
  const PROGRESS_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RADIUS;

  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [PROGRESS_CIRCUMFERENCE, 0],
  });

  if (isKeyboardVisible) return null;

  return (
    <View style={styles.wrapper}>
      {isVoiceChat && isRecording && (
        <View style={styles.cancelAbsoluteContainer}>
          <Animated.View style={{ transform: [{ translateY: chevronTranslateY }] }}>
            <Ionicons
              name="chevron-up"
              size={20}
              color={isSlidingToCancel ? COLORS.danger : COLORS.secondary}
            />
          </Animated.View>
          <Text style={[styles.cancelText, isSlidingToCancel && { color: COLORS.danger }]}>
            {isSlidingToCancel ? 'Rilascia per annullare' : 'Swipe su per annullare'}
          </Text>
        </View>
      )}

      <View style={styles.container}>
        {isOffline ? (
          <View style={styles.rowCenter}>
            <Pressable onPress={handleOfflinePress} style={styles.offlineBtn}>
              <Ionicons name="add" size={18} color="#FFF" />
              <Text style={styles.offlineBtnText}>Nuova spesa offline</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.navRow}>
            {NAV_ITEMS.map((item) => {
              if (item.isPlus) {
                return (
                  <View key="plus" style={styles.navItemPlusWrapper}>
                    <View style={styles.micWrapper}>
                      {isVoiceChat && isRecording && (
                        <View style={styles.progressCircleContainer}>
                          <Svg width={64} height={64} viewBox="0 0 64 64">
                            <Circle cx="32" cy="32" r={PROGRESS_RADIUS} fill="none" stroke="#E5E5EA" strokeWidth={PROGRESS_STROKE_WIDTH} />
                            <AnimatedCircle cx="32" cy="32" r={PROGRESS_RADIUS} fill="none" stroke={COLORS.brandBlue} strokeWidth={PROGRESS_STROKE_WIDTH} strokeDasharray={`${PROGRESS_CIRCUMFERENCE} ${PROGRESS_CIRCUMFERENCE}`} strokeDashoffset={strokeDashoffset} strokeLinecap="round" transform="rotate(-90 32 32)" />
                          </Svg>
                        </View>
                      )}
                      <Animated.View
                        {...primaryPanResponder.panHandlers}
                        style={[
                          styles.toolBtn,
                          isVoiceChat ? styles.toolBtnBig : styles.toolBtnNormal,
                          isSlidingToCancel && styles.micBtnCancel
                        ]}
                      >
                        <Ionicons 
                          name={isVoiceChat ? "mic" : "add"} 
                          size={isVoiceChat ? 28 : 28} 
                          color="#FFF" 
                        />
                      </Animated.View>
                    </View>
                  </View>
                );
              }

              if (isVoiceChat) {
                return <View key={item.id} style={styles.navItem} />;
              }

              const active = isActive(item.path);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    if (pathname === item.path) return;
                    router.replace(item.path as any);
                  }}
                  style={styles.navItem}
                >
                  <Ionicons
                    name={active ? (item.iconSharp as any) : (item.iconOutline as any)}
                    size={28}
                    color={active ? '#000000' : '#8E8E93'}
                  />
                </Pressable>
              );
            })}
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
    bottom: 0, left: 0, right: 0,
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
    minHeight: 80,
  },
  cancelAbsoluteContainer: {
    position: 'absolute',
    top: -60,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 102,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 16,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  navItemPlusWrapper: {
    flex: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBtnNormal: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.brandBlue,
  },
  toolBtnBig: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.brandBlue,
    ...SHADOWS.soft,
  },
  micBtnCancel: {
    backgroundColor: COLORS.danger,
  },
  cancelText: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 13,
    color: COLORS.secondary,
    marginTop: 4,
  },
  progressCircleContainer: {
    position: 'absolute',
    width: 64, height: 64,
    alignItems: 'center', justifyContent: 'center',
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  offlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.brandBlue,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 6,
    ...SHADOWS.soft,
  },
  offlineBtnText: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  toast: {
    position: 'absolute',
    bottom: 95,
    left: SPACING.lg, right: SPACING.lg,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
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
