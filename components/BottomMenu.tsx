import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Pressable, Dimensions, TextInput, KeyboardAvoidingView, Platform, Text, Animated, ActivityIndicator } from 'react-native';
import { useRouter, usePathname, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SPACING, TYPOGRAPHY } from '../constants/Theme';
import { startRecording, stopRecording, parseFromVoice } from '../modules/registration/voiceParser';
import { parseFromReceipt } from '../modules/registration/receiptParser';
import { parseExpenseWithAI } from '../services/groqParser';
import { getCurrentLocationContext } from '../services/location';

const { width } = Dimensions.get('window');
const RECORDING_LIMIT = 15000; // 15 secondi

export default function BottomMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ menu?: string }>();
  const [inputText, setInputText] = useState('');
  const [isExpanded, setIsExpanded] = useState(params.menu === 'expanded');
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingProgress] = useState(new Animated.Value(0));
  const timerRef = React.useRef<any>(null);

  // Aggiorna lo stato se il parametro cambia (es. quando torniamo indietro)
  useEffect(() => {
    if (params.menu === 'expanded') {
      setIsExpanded(true);
    }
  }, [params.menu]);

   const isActive = (path: string) => pathname === path;

  const handleSend = async () => {
    if (inputText.trim()) {
      try {
        setIsProcessing(true);
        const locContext = await getCurrentLocationContext();
        const parsed = await parseExpenseWithAI(inputText, 'text', locContext);
        
        setIsProcessing(false);
        router.push({ 
          pathname: '/expense-detail', 
          params: { data: JSON.stringify(parsed) } 
        });
        
        setInputText('');
        setIsExpanded(false);
      } catch (error) {
        console.error('Error parsing text:', error);
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
    // Evita clic multipli durante l'avvio
    if (isRecording || recording || isProcessing) return;
    
    setIsRecording(true); // Imposta subito lo stato UI
    
    try {
      const rec = await startRecording();
      setRecording(rec);
      
      // Avvia animazione progress bar
      recordingProgress.setValue(0);
      Animated.timing(recordingProgress, {
        toValue: 1,
        duration: RECORDING_LIMIT,
        useNativeDriver: false,
      }).start();

      // Timeout per stop automatico dopo 15 secondi
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        handleStopRecording(rec);
      }, RECORDING_LIMIT);

    } catch (error) {
      console.error('Error starting voice record:', error);
      setIsRecording(false);
      setRecording(null);
    }
  };

  const handleStopRecording = async (recordingOverride?: any) => {
    const currentRecording = recordingOverride || recording;
    
    // Se non abbiamo una registrazione attiva, resettiamo e usciamo
    if (!currentRecording) {
      setIsRecording(false);
      setIsProcessing(false);
      return;
    }

    // Forza subito lo stato di caricamento UI
    setIsProcessing(true);
    setIsRecording(false);
    
    // Ferma timer e animazione subito
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    recordingProgress.stopAnimation();

    // Reset stati locali prima del parsing
    setRecording(null);
    
    try {
      const uri = await stopRecording(currentRecording);
      const locContext = await getCurrentLocationContext();
      const parsed = await parseFromVoice(uri, locContext);
      
      setIsProcessing(false);
      router.push({ 
        pathname: '/expense-detail', 
        params: { data: JSON.stringify(parsed) } 
      });
    } catch (error) {
      console.error('Error stopping voice record:', error);
      setIsProcessing(false);
      // Pulizia di sicurezza
      setIsRecording(false);
      setRecording(null);
    }
  };

  const handleCancelRecording = async () => {
    if (!recording) {
      setIsRecording(false);
      return;
    }
    
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    recordingProgress.stopAnimation();
    recordingProgress.setValue(0);

    const currentRecording = recording;
    setRecording(null);
    setIsRecording(false);

    try {
      await currentRecording.stopAndUnloadAsync();
    } catch (e) {
      console.error('Error cancelling recording:', e);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {isExpanded ? (
        <View style={styles.navWrapper}>
          {/* Icona sinistra (Back o Annulla) */}
          <Pressable 
            onPress={() => isRecording ? handleCancelRecording() : setIsExpanded(false)} 
            style={styles.navIcon}
          >
            <Ionicons name={isRecording ? "close" : "chevron-back"} size={24} color={COLORS.primary} />
          </Pressable>

          {/* WhatsApp-style Input Bar */}
          <View style={styles.inputContainer}>
            {(isRecording || isProcessing) ? (
              <View style={styles.progressBarWrapper}>
                <Animated.View 
                  style={[
                    styles.progressBar, 
                    { 
                      width: isProcessing ? '100%' : recordingProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%']
                      }),
                      backgroundColor: isProcessing ? COLORS.accent : recordingProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['#FFF', COLORS.danger]
                      })
                    }
                  ]} 
                />
              </View>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Scrivi spesa..."
                  placeholderTextColor={COLORS.secondary}
                  value={inputText}
                  onChangeText={setInputText}
                  onSubmitEditing={handleSend}
                />
                <View style={styles.inputActions}>
                  {inputText.length > 0 ? (
                    <Pressable onPress={handleSend} style={styles.actionIcon}>
                      <Ionicons name="send" size={22} color={COLORS.accent} />
                    </Pressable>
                  ) : (
                    <Pressable onPress={handleCamera} style={styles.actionIcon}>
                      <Ionicons name="camera-outline" size={24} color={COLORS.secondary} />
                    </Pressable>
                  )}
                </View>
              </>
            )}

            {(isRecording || isProcessing) && (
               <View style={styles.recordingIndicatorSection}>
                 <View style={styles.recordingDot} />
                 <Text style={styles.recordingText}>
                   {isProcessing ? "Analisi in corso..." : "Registrazione..."}
                 </Text>
               </View>
            )}
          </View>
          
          {/* Tasto Azione Destra: Registrazione / Stop / Caricamento */}
          <Pressable 
            onPress={() => isRecording ? handleStopRecording() : handleStartRecording()}
            style={[
              styles.navIcon, 
              isRecording && styles.recordingActiveButton,
              isProcessing && { borderColor: COLORS.accent }
            ]}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={COLORS.accent} />
            ) : isRecording ? (
              <View style={styles.stopSquare} />
            ) : (
              <Ionicons name="mic-outline" size={28} color={COLORS.secondary} />
            )}
          </Pressable>
        </View>
      ) : (
        <View style={styles.menuBar}>
          {/* Home Button */}
          <View style={styles.menuItem}>
            <Pressable 
              onPress={() => router.push('/')}
              style={styles.menuItemInner}
            >
              <Ionicons 
                name={isActive('/') ? "home" : "home-outline"} 
                size={28} 
                color={isActive('/') ? COLORS.primary : COLORS.secondary} 
              />
            </Pressable>
          </View>

          {/* Stats Button */}
          <View style={styles.menuItem}>
            <Pressable 
              onPress={() => router.push('/stats')}
              style={styles.menuItemInner}
            >
              <Ionicons 
                name={isActive('/stats') ? "pie-chart" : "pie-chart-outline"} 
                size={28} 
                color={isActive('/stats') ? COLORS.primary : COLORS.secondary} 
              />
            </Pressable>
          </View>

          {/* Add Button - Center FAB */}
          <View style={styles.menuItem}>
            <Pressable 
              onPress={() => setIsExpanded(true)}
              style={styles.fab}
            >
              <Ionicons name="add" size={36} color="#FFF" />
            </Pressable>
          </View>

          {/* History Button */}
          <View style={styles.menuItem}>
            <Pressable 
              onPress={() => router.push('/history')}
              style={styles.menuItemInner}
            >
              <Ionicons 
                name={isActive('/history') ? "list" : "list-outline"} 
                size={28} 
                color={isActive('/history') ? COLORS.primary : COLORS.secondary} 
              />
            </Pressable>
          </View>

          {/* AI Chat Button */}
          <View style={styles.menuItem}>
            <Pressable 
              onPress={() => router.push('/ai-chat')}
              style={styles.menuItemInner}
            >
              <Ionicons 
                name={isActive('/ai-chat') ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"} 
                size={26} 
                color={isActive('/ai-chat') ? COLORS.accent : COLORS.secondary} 
              />
            </Pressable>
          </View>
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
  // --- Expanded Chat Bar Styles ---
  navWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  navIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
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
    borderRadius: 30,
    marginHorizontal: SPACING.md,
    paddingHorizontal: SPACING.md,
    height: 60,
    alignItems: 'center',
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  input: {
    flex: 1,
    height: '100%',
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.primary,
  },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  actionIcon: {
    padding: 6,
  },
  // --- Recording UI ---
  progressBarWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  progressBar: {
    height: '100%',
  },
  recordingIndicatorSection: {
    position: 'absolute',
    left: 25,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.danger,
    marginRight: 8,
  },
  recordingText: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.primary,
  },
  recordingActiveButton: {
    backgroundColor: '#FEE2E2', // Rosa molto chiaro
    borderColor: '#FCA5A5',
  },
  stopSquare: {
    width: 16,
    height: 16,
    backgroundColor: COLORS.danger,
    borderRadius: 2,
  },
  // --- Classic Menu Styles ---
  menuBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    width: '100%',
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  menuItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.medium,
  }
});
