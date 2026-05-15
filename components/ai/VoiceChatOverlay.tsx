import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator,
  Animated, ScrollView, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING } from '../../constants/Theme';
import JitTotal from './JitTotal';
import JitDistribution from './JitDistribution';
import JitList from './JitList';
import JitTimeline from './JitTimeline';
import { voiceStore } from '../../services/voiceStore';

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
    return unsub;
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

  // Inactivity timeout: auto-close after 7s of no activity
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    const { isOpen, isRecording, isLoading, qa } = voiceState;
    
    // Solo se aperto e non sta caricando o registrando, e non c'è già una risposta
    if (isOpen && !isRecording && !isLoading && !qa?.answer) {
      timer = setTimeout(() => {
        voiceStore.close();
      }, 7000); // 7 secondi di inattività
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [voiceState]);

  const handleClose = async () => {
    await voiceStore.cancelRecording();
    voiceStore.close();
  };

  const { isRecording, isLoading, qa } = voiceState;

  return (
    <Animated.View
      style={[
        styles.overlay,
        { transform: [{ translateY: slideAnim }] },
      ]}
      // Leave bottom area for BottomMenu's mic button
      pointerEvents={voiceState.isOpen ? 'auto' : 'none'}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={handleClose} style={styles.closeBtn}>
          <Ionicons name="close" size={28} color={COLORS.primary} />
        </Pressable>
      </View>

      {/* Content area — leave bottom padding for mic button */}
      <View style={styles.content}>
        <View style={styles.qaContainer}>
          {qa ? (
            <>
              <View style={styles.smallQuestionContainer}>
                <Text style={styles.smallQuestionText}>{qa.question}</Text>
              </View>
              <View style={styles.mainAnswerArea}>
                {isLoading ? (
                  <View style={styles.loadingWrapper}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                  </View>
                ) : qa.answer && (
                  <ScrollView
                    style={styles.answerScroll}
                    contentContainerStyle={styles.answerScrollContent}
                    showsVerticalScrollIndicator={false}
                  >
                    <Text style={styles.answerContextText}>{qa.answer.text_response}</Text>
                    <View style={styles.jitWrapper}>
                      {qa.answer.intent === 'total' && qa.answer.total_data && (
                        <JitTotal
                          value={qa.answer.total_data.value}
                          comparison={qa.answer.total_data.comparison}
                          periodLabel={qa.answer.total_data.period_label}
                        />
                      )}
                      {qa.answer.intent === 'distribution' && qa.answer.distribution_data && (
                        <JitDistribution {...qa.answer.distribution_data} />
                      )}
                      {qa.answer.intent === 'list' && qa.answer.list_data && (
                        <JitList
                          title={qa.answer.list_data.title}
                          items={qa.answer.list_data.items}
                          totalCount={qa.answer.list_data.total_count}
                        />
                      )}
                      {qa.answer.intent === 'timeline' && qa.answer.timeline_data && (
                        <JitTimeline {...qa.answer.timeline_data} />
                      )}
                    </View>
                  </ScrollView>
                )}
              </View>
            </>
          ) : (
            <View style={styles.emptyCenter}>
              <Text style={styles.emptyTitle}>
                {isRecording ? 'Ti ascolto...' : 'Tieni premuto per iniziare'}
              </Text>
            </View>
          )}
        </View>
      </View>
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
    backgroundColor: COLORS.background,
    zIndex: 100,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    alignItems: 'flex-end',
  },
  closeBtn: { padding: 8 },
  content: {
    flex: 1,
    // Bottom padding so content doesn't sit under the mic button (60px icon + 34px safe area + 8px top)
    paddingBottom: 110,
  },
  qaContainer: { flex: 1 },
  emptyCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 24,
    color: COLORS.secondary,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  },
  smallQuestionContainer: {
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    paddingBottom: 10,
  },
  smallQuestionText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: 14,
    color: COLORS.secondary,
    textAlign: 'center',
  },
  mainAnswerArea: { flex: 1, paddingHorizontal: SPACING.lg },
  answerScroll: { flex: 1 },
  answerScrollContent: { paddingVertical: 20 },
  answerContextText: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 22,
    color: COLORS.primary,
    textAlign: 'center',
    lineHeight: 30,
  },
  jitWrapper: { marginTop: 30, alignItems: 'center' },
  loadingWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
