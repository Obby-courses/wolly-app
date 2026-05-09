import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, View, Pressable, Dimensions, TextInput, 
  KeyboardAvoidingView, Platform, Text, Animated, 
  ActivityIndicator, PanResponder 
} from 'react-native';
import { useRouter, usePathname, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SPACING, TYPOGRAPHY } from '../constants/Theme';
import { startRecording, stopRecording, parseFromVoice } from '../modules/registration/voiceParser';
import { transcribeAudio } from '../services/groq';
import { parseFromReceipt } from '../modules/registration/receiptParser';
import { parseExpenseWithAI } from '../services/groqParser';
import { getCurrentLocationContext } from '../services/location';
import { routeInput } from '../services/inputRouter';

const { width } = Dimensions.get('window');
const RECORDING_LIMIT = 15000; // 15 secondi
const CANCEL_THRESHOLD = -80; // Pixel di scorrimento a sinistra per annullare

export default function BottomMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ menu?: string }>();
  const [inputText, setInputText] = useState('');
  const [isExpanded, setIsExpanded] = useState(params.menu === 'expanded' || pathname === '/ai-chat');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSlidingToCancel, setIsSlidingToCancel] = useState(false);
  
  const recordingRef = useRef<any>(null);
  const lastStartTime = useRef<number>(0);
  const recordingProgress = useRef(new Animated.Value(0)).current;
  const slideX = useRef(new Animated.Value(0)).current;
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  
  const timerRef = useRef<any>(null);
  const toastTimerRef = useRef<any>(null);
  const isStartingRecording = useRef(false);

  // Gestione espansione automatica su AI Chat
  useEffect(() => {
    if (pathname === '/ai-chat') {
      setIsExpanded(true);
    } else {
      setIsExpanded(false);
    }
  }, [pathname]);

  const isActive = (path: string) => pathname === path;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 3500);
  };

  const navigateByRoute = async (text: string) => {
    const route = routeInput(text);
    if (route === 'expense') {
      const locContext = await getCurrentLocationContext();
      const parsed = await parseExpenseWithAI(text, 'text', locContext);
      router.push({ pathname: '/expense-detail', params: { data: JSON.stringify(parsed) } });
    } else if (route === 'query') {
      router.push({ pathname: '/ai-chat', params: { message: text } });
    } else {
      showToast("Non ho capito 😅  Prova: \"Ho speso 5€ al bar\" o \"Quanto ho speso questo mese?\"");
    }
  };

  const handleSend = async () => {
    if (inputText.trim()) {
      try {
        setIsProcessing(true);
        const text = inputText.trim();
        setInputText('');
        setIsExpanded(false);
        await navigateByRoute(text);
        setIsProcessing(false);
      } catch (error) {
        console.error('Error routing text:', error);
        setIsProcessing(false);
      }
    }
  };

  const handleCamera = async () => {
    try {
      setIsProcessing(true);
      const locContext = await getCurrentLocationContext();
      const parsed = await parseFromReceipt(true, locContext);
      if (parsed) {
        setIsProcessing(false);
        router.push({ 
          pathname: '/expense-detail', 
          params: { data: JSON.stringify(parsed) } 
        });
        setIsExpanded(false);
      } else {
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Error parsing camera/receipt:', error);
      setIsProcessing(false);
    }
  };

  const handleStartRecording = async () => {
    if (isRecording || isProcessing || isStartingRecording.current) return;
    
    isStartingRecording.current = true;
    lastStartTime.current = Date.now();
    
    // Sicurezza: pulizia preventiva
    if (recordingRef.current) {
      try { await recordingRef.current.stopAndUnloadAsync(); } catch(e){}
      recordingRef.current = null;
    }

    setIsRecording(true);
    setIsSlidingToCancel(false);
    slideX.setValue(0);
    
    try {
      const rec = await startRecording();
      recordingRef.current = rec;
      
      recordingProgress.setValue(0);
      Animated.timing(recordingProgress, {
        toValue: 1,
        duration: RECORDING_LIMIT,
        useNativeDriver: false,
      }).start();

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        handleStopRecording();
      }, RECORDING_LIMIT);

    } catch (error) {
      console.error('Error starting voice record:', error);
      setIsRecording(false);
      recordingRef.current = null;
    } finally {
      isStartingRecording.current = false;
    }
  };

  const handleStopRecording = async () => {
    const duration = Date.now() - lastStartTime.current;
    
    // Se il tocco è stato troppo breve (< 200ms), annulla invece di processare
    if (duration < 200) {
      await handleCancelRecording();
      return;
    }

    const currentRecording = recordingRef.current;
    if (!currentRecording) {
      setIsRecording(false);
      setIsProcessing(false);
      return;
    }

    setIsProcessing(true);
    setIsRecording(false);
    setIsSlidingToCancel(false);
    
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    recordingProgress.stopAnimation();
    recordingRef.current = null;
    
    try {
      const uri = await stopRecording(currentRecording);
      const transcribedText = await transcribeAudio(uri);
      if (!transcribedText) {
        setIsProcessing(false);
        showToast('Non sono riuscito a capire l\'audio. Riprova.');
        return;
      }
      await navigateByRoute(transcribedText);
      setIsProcessing(false);
    } catch (error) {
      console.error('Error stopping voice record:', error);
      setIsProcessing(false);
      setIsRecording(false);
      recordingRef.current = null;
    }
  };

  const handleCancelRecording = async () => {
    const currentRecording = recordingRef.current;
    
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    recordingProgress.stopAnimation();
    recordingProgress.setValue(0);

    recordingRef.current = null;
    setIsRecording(false);
    setIsSlidingToCancel(false);
    slideX.setValue(0);

    if (currentRecording) {
      try {
        await currentRecording.stopAndUnloadAsync();
      } catch (e) {
        console.error('Error cancelling recording:', e);
      }
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        handleStartRecording();
      },
      onPanResponderMove: (evt, gestureState) => {
        if (!isRecording) return;
        
        // Tracciamo lo scorrimento a sinistra
        if (gestureState.dx < 0) {
          slideX.setValue(gestureState.dx);
          if (gestureState.dx < CANCEL_THRESHOLD) {
            setIsSlidingToCancel(true);
          } else {
            setIsSlidingToCancel(false);
          }
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx < CANCEL_THRESHOLD) {
          handleCancelRecording();
        } else {
          handleStopRecording();
        }
      },
      onPanResponderTerminate: () => {
        handleCancelRecording();
      },
    })
  ).current;

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {isExpanded ? (
        <View style={styles.navWrapper}>
          {/* 1. Icona sinistra (Back o Annulla) */}
          <Pressable 
            onPress={() => isRecording ? handleCancelRecording() : setIsExpanded(false)} 
            style={styles.navIcon}
          >
            <Ionicons name={isRecording ? "close" : "chevron-back"} size={24} color={COLORS.primary} />
          </Pressable>

          {/* 2. Campo di Testo centrale */}
          <View style={styles.inputContainer}>
            {isRecording ? (
              <View style={styles.recordingOverlay}>
                <View style={styles.recordingIndicatorRow}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingText}>Registrazione...</Text>
                </View>
                <Animated.Text 
                  style={[
                    styles.cancelHint,
                    isSlidingToCancel && styles.cancelHintActive,
                    { 
                      transform: [{ translateX: slideX }],
                      opacity: slideX.interpolate({
                        inputRange: [CANCEL_THRESHOLD, 0],
                        outputRange: [0.5, 1]
                      })
                    }
                  ]}
                >
                  {isSlidingToCancel ? "Rilascia per annullare" : "< Scorri qui per annullare"}
                </Animated.Text>
              </View>
            ) : isProcessing ? (
              <View style={styles.processingWrapper}>
                <ActivityIndicator size="small" color={COLORS.accent} />
                <Text style={styles.processingText}>Wolly sta pensando...</Text>
              </View>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Parla o scrivi..."
                  placeholderTextColor={COLORS.secondary}
                  value={inputText}
                  onChangeText={setInputText}
                  onSubmitEditing={handleSend}
                />
                {inputText.length > 0 && (
                  <Pressable onPress={handleSend} style={styles.actionIcon}>
                    <Ionicons name="send" size={22} color={COLORS.accent} />
                  </Pressable>
                )}
              </>
            )}
          </View>
          
          {/* 3. Tasto Audio (Mic) con PanResponder */}
          <View
            {...panResponder.panHandlers}
            style={[
              styles.navIcon, 
              isRecording && styles.recordingActiveButton,
              isSlidingToCancel && { backgroundColor: COLORS.danger + '20' }
            ]}
          >
            <Ionicons 
              name={isRecording ? "mic" : "mic-outline"} 
              size={28} 
              color={isRecording ? COLORS.danger : COLORS.secondary} 
            />
          </View>

          {/* 4. Tasto Foto */}
          <Pressable
            onPress={handleCamera}
            disabled={isProcessing || isRecording}
            style={[styles.navIcon, (isProcessing || isRecording) && { opacity: 0.5 }]}
          >
            <Ionicons name="camera-outline" size={28} color={COLORS.secondary} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.menuBar}>
          <Pressable onPress={() => router.push('/')} style={styles.menuItem}>
            <Ionicons name="home-outline" size={24} color={isActive('/') ? COLORS.primary : COLORS.secondary} />
          </Pressable>

          <Pressable onPress={() => router.push('/stats')} style={styles.menuItem}>
            <Ionicons name="pie-chart-outline" size={24} color={isActive('/stats') ? COLORS.primary : COLORS.secondary} />
          </Pressable>

          {/* Center Plus Button */}
          <Pressable onPress={() => setIsExpanded(true)} style={styles.fab}>
            <View style={styles.fabInner}>
              <Ionicons name="add" size={32} color="#FFF" />
            </View>
          </Pressable>

          <Pressable onPress={() => router.push('/history')} style={styles.menuItem}>
            <Ionicons name="list-outline" size={24} color={isActive('/history') ? COLORS.primary : COLORS.secondary} />
          </Pressable>

          <Pressable onPress={() => router.push('/settings')} style={styles.menuItem}>
            <Ionicons name="settings-outline" size={24} color={isActive('/settings') ? COLORS.primary : COLORS.secondary} />
          </Pressable>
        </View>
      )}

      {toastMsg && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toastMsg}</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    width: '100%',
    paddingHorizontal: SPACING.md,
  },
  navWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    gap: SPACING.xs,
  },
  navIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.soft,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 28,
    paddingHorizontal: SPACING.md,
    height: 56,
    alignItems: 'center',
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    height: '100%',
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.primary,
  },
  actionIcon: {
    padding: 6,
  },
  // --- Recording UI ---
  recordingOverlay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recordingIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.danger,
  },
  recordingText: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.danger,
  },
  cancelHint: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.secondary,
  },
  cancelHintActive: {
    color: COLORS.danger,
    fontFamily: TYPOGRAPHY.fontBold,
  },
  processingWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  processingText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.secondary,
  },
  recordingActiveButton: {
    borderColor: COLORS.danger,
    transform: [{ scale: 1.1 }],
    backgroundColor: '#FFF',
  },

  // --- Normal Menu Bar Styles ---
  menuBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 32,
    height: 64,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  menuItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: '100%',
  },
  fab: {
    marginTop: -32,
  },
  fabInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.medium,
    borderWidth: 4,
    borderColor: COLORS.background,
  },
  toast: {
    position: 'absolute',
    bottom: 80,
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
    fontSize: TYPOGRAPHY.sizes.sm,
    color: '#F1F5F9',
    textAlign: 'center',
    lineHeight: 20,
  },
});
