import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator,
  Animated, Dimensions, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, TYPOGRAPHY, SPACING } from '../../constants/Theme';
import { voiceStore } from '../../services/voiceStore';
import { askAiChat } from '../../services/aiChat';
import { QueryIntent } from '../../services/aiQueryParser';

// Componente condiviso — identico a quello usato nella chat testuale
import AiResponseView from './AiResponseView';

const { height: SCREEN_H } = Dimensions.get('window');

export default function VoiceChatOverlay() {
  const insets = useSafeAreaInsets();
  const [voiceState, setVoiceState] = useState(voiceStore.getState());
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const isVisible = useRef(false);

  // Subscribe to store
  useEffect(() => {
    const unsub = voiceStore.subscribe(() => {
      setVoiceState(voiceStore.getState());
    });
    return () => { unsub(); };
  }, []);

  // Animate in/out based on isOpen
  useEffect(() => {
    if (voiceState.isOpen && !isVisible.current) {
      isVisible.current = true;
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
    } else if (!voiceState.isOpen && isVisible.current) {
      isVisible.current = false;
      Animated.timing(slideAnim, {
        toValue: SCREEN_H,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [voiceState.isOpen]);

  // Inactivity timeout: auto-close after 7s if no answer yet
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const { isOpen, isRecording, isLoading, qa } = voiceState;
    if (isOpen && !isRecording && !isLoading && !qa?.answer) {
      timer = setTimeout(() => voiceStore.close(), 7000);
    }
    return () => { if (timer) clearTimeout(timer); };
  }, [voiceState]);

  const handleClose = async () => {
    await voiceStore.cancelRecording();
    voiceStore.close();
  };

  /**
   * Riesegue la query con un intent modificato dall'utente via FeedbackBar.
   * Identico a reRunQuery in ai-chat.tsx — stessa logica, stessa pipeline.
   */
  const handleRerun = async (newIntent: QueryIntent) => {
    if (!voiceState.qa) return;
    voiceStore.setIsLoading(true);
    try {
      const response = await askAiChat(voiceState.qa.question, [], newIntent);
      voiceStore.setQa({ question: voiceState.qa.question, answer: response });
    } catch (e) {
      console.error('[VoiceChatOverlay] rerun error:', e);
    } finally {
      voiceStore.setIsLoading(false);
    }
  };

  const { isRecording, isLoading, qa } = voiceState;

  return (
    <Animated.View
      style={[
        styles.overlay,
        { transform: [{ translateY: slideAnim }] },
      ]}
      pointerEvents={voiceState.isOpen ? 'auto' : 'none'}
    >
      <LinearGradient
        colors={['#5CB5FF', '#0078FF']}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Spacer per respiro visivo in alto */}
      <View style={{ height: insets.top + 16 }} />

      {qa && (
        <View style={{ alignItems: 'center', width: '100%', marginBottom: 16 }}>
          <Pressable onPress={handleClose} style={styles.topCloseBtn}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </Pressable>
        </View>
      )}

      {/* Content area — scrollabile, senza vincolo di viewport */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {qa ? (
          <>
            {isLoading ? (
              <View style={styles.loadingWrapper}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.loadingText}>Wolly sta analizzando...</Text>
              </View>
            ) : qa.answer && (
              /* ── STESSO componente usato nella chat testuale ── */
              <AiResponseView
                question={qa.question}
                answer={qa.answer}
                onRerun={handleRerun}
                scrollable={false}
              />
            )}
          </>
        ) : (
          <View style={styles.emptyCenter}>
            <Text style={styles.emptyTitle}>
              {isRecording ? 'In ascolto...' : 'Tieni premuto per iniziare'}
            </Text>
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 100,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    alignItems: 'flex-end',
  },
  closeBtn: { padding: 8 },
  topCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    flexGrow: 1,
    paddingBottom: 120, // spazio per il pulsante microfono fisso in basso
    paddingHorizontal: 4,
  },
  emptyCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 24,
    color: '#FFFFFF',
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  },
  loadingWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
