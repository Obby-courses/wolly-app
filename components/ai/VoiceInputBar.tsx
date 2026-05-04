import React, { useState, useRef } from 'react';
import {
  View, TextInput, Pressable, Text, StyleSheet,
  Animated, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from '../../constants/Theme';
import { startRecording, stopRecording } from '../../modules/registration/voiceParser';
import { transcribeAudio } from '../../services/groq';

interface VoiceInputBarProps {
  onSubmit: (text: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

const RECORDING_LIMIT = 15000;

/**
 * VoiceInputBar — Barra di input riutilizzabile con supporto testo + microfono.
 * Modulare: non sa nulla di chat o AI, espone solo i dati via onSubmit.
 */
export default function VoiceInputBar({
  onSubmit,
  isLoading = false,
  placeholder = 'Chiedi qualcosa...',
}: VoiceInputBarProps) {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const recordingProgress = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<any>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    onSubmit(trimmed);
    setText('');
  };

  const handleStartRecording = async () => {
    if (isRecording || isLoading) return;
    try {
      const rec = await startRecording();
      setRecording(rec);
      setIsRecording(true);
      recordingProgress.setValue(0);
      Animated.timing(recordingProgress, {
        toValue: 1,
        duration: RECORDING_LIMIT,
        useNativeDriver: false,
      }).start();
      timerRef.current = setTimeout(() => handleStopRecording(rec), RECORDING_LIMIT);
    } catch (e) {
      console.error('[VoiceInputBar] start error:', e);
    }
  };

  const handleStopRecording = async (recOverride?: Audio.Recording | null) => {
    const currentRec = recOverride || recording;
    if (!currentRec) return;

    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    recordingProgress.stopAnimation();
    setIsRecording(false);
    setRecording(null);
    setIsTranscribing(true);

    try {
      const uri = await stopRecording(currentRec);
      const transcribed = await transcribeAudio(uri);
      if (transcribed?.trim()) {
        onSubmit(transcribed.trim());
      }
    } catch (e) {
      console.error('[VoiceInputBar] transcription error:', e);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleCancelRecording = async () => {
    if (!recording) { setIsRecording(false); return; }
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    recordingProgress.stopAnimation();
    recordingProgress.setValue(0);
    const cur = recording;
    setRecording(null);
    setIsRecording(false);
    try { await cur.stopAndUnloadAsync(); } catch (_) {}
  };

  const busy = isRecording || isTranscribing || isLoading;

  return (
    <View style={styles.wrapper}>
      {/* Cancel button when recording */}
      {isRecording && (
        <Pressable onPress={handleCancelRecording} style={styles.sideBtn}>
          <Ionicons name="close" size={22} color={COLORS.danger} />
        </Pressable>
      )}

      <View style={styles.inputBox}>
        {busy ? (
          <View style={styles.progressWrapper}>
            <Animated.View
              style={[
                styles.progressBar,
                {
                  width: (isTranscribing || isLoading)
                    ? '100%'
                    : recordingProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                  backgroundColor: (isTranscribing || isLoading)
                    ? COLORS.accent
                    : recordingProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [COLORS.success, COLORS.danger],
                      }),
                },
              ]}
            />
            <View style={styles.progressLabel}>
              <View style={[styles.dot, { backgroundColor: isTranscribing || isLoading ? COLORS.accent : COLORS.danger }]} />
              <Text style={styles.progressText}>
                {isLoading ? 'Wolly sta pensando…' : isTranscribing ? 'Trascrizione…' : 'Registrazione…'}
              </Text>
            </View>
          </View>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder={placeholder}
              placeholderTextColor={COLORS.secondary}
              value={text}
              onChangeText={setText}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              multiline={false}
            />
            {text.length > 0 && (
              <Pressable onPress={handleSend} style={styles.actionBtn}>
                <Ionicons name="send" size={20} color={COLORS.accent} />
              </Pressable>
            )}
          </>
        )}
      </View>

      {/* Mic / Stop button */}
      <Pressable
        onPress={() => isRecording ? handleStopRecording() : handleStartRecording()}
        disabled={isTranscribing || isLoading}
        style={[
          styles.sideBtn,
          isRecording && styles.sideBtnActive,
        ]}
      >
        {isTranscribing || isLoading ? (
          <ActivityIndicator size="small" color={COLORS.accent} />
        ) : isRecording ? (
          <View style={styles.stopSquare} />
        ) : (
          <Ionicons name="mic-outline" size={24} color={COLORS.secondary} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  sideBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  sideBtnActive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  stopSquare: {
    width: 14,
    height: 14,
    backgroundColor: COLORS.danger,
    borderRadius: 2,
  },
  inputBox: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.primary,
    height: '100%',
  },
  actionBtn: {
    padding: SPACING.sm,
  },
  progressWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 23,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  progressBar: {
    height: '100%',
    opacity: 0.3,
  },
  progressLabel: {
    position: 'absolute',
    left: SPACING.lg,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  progressText: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.primary,
  },
});
