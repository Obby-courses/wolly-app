import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, Pressable, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from '../constants/Theme';
import ChatBubble from '../components/ai/ChatBubble';
import JitTotal from '../components/ai/JitTotal';
import JitDistribution from '../components/ai/JitDistribution';
import JitList from '../components/ai/JitList';
import JitTimeline from '../components/ai/JitTimeline';
import JitSubscriptions from '../components/ai/JitSubscriptions';
import FeedbackBar from '../components/ai/FeedbackBar';
import VoiceInputBar from '../components/ai/VoiceInputBar';
import { askAiChat, AiChatResponse, ChatMessage, aiChatStore } from '../services/aiChat';

// ─── State types ──────────────────────────────────────────────────────────────
interface QAState {
  question: string;
  answer: AiChatResponse | null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
/**
 * AiChatPage — Modello Q&A a risposta singola.
 * Non è una cronologia: ogni nuova domanda sostituisce la coppia precedente.
 * Layout: [domanda utente] → [risposta AI] → [grafico JIT se presente]
 */
import { TextInput } from 'react-native';

export default function AiChatPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ message?: string }>();
  const [qa, setQa] = useState<QAState | null>(aiChatStore.qa);
  const [history, setHistory] = useState<ChatMessage[]>(aiChatStore.history);
  const [isLoading, setIsLoading] = useState(false);
  const [showDebug, setShowDebug] = useState(aiChatStore.showDebug);
  const [debugData, setDebugData] = useState<string | null>(aiChatStore.debugData);
  const [autoSentRef] = useState({ done: false });

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(!aiChatStore.qa);

  // Auto-send message when navigated with params.message
  useEffect(() => {
    if (params.message && !autoSentRef.done) {
      autoSentRef.done = true;
      sendMessage(params.message);
    }
  }, [params.message]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg = text.trim();
    const newQa = { question: userMsg, answer: null };
    setQa(newQa);
    aiChatStore.qa = newQa;
    setIsTyping(false);
    setInputText('');
    
    setDebugData(null);
    aiChatStore.debugData = null;
    
    setIsLoading(true);

    try {
      const response = await askAiChat(userMsg, history);
      const finalQa = { question: userMsg, answer: response };
      setQa(finalQa);
      aiChatStore.qa = finalQa;

      const rawJson = JSON.stringify(response, null, 2);
      setDebugData(rawJson);
      aiChatStore.debugData = rawJson;

      const newHistory: ChatMessage[] = [
        ...history,
        { role: 'user' as const, content: userMsg },
        { role: 'assistant' as const, content: response.text_response }
      ].slice(-10);
      setHistory(newHistory);
      aiChatStore.history = newHistory;

    } catch (e) {
      const errorQa = {
        question: userMsg,
        answer: {
          intent: 'text',
          text_response: 'Mi dispiace, non ho potuto elaborare la risposta. Riprova.',
        } as any,
      };
      setQa(errorQa);
      aiChatStore.qa = errorQa;
    } finally {
      setIsLoading(false);
    }
  };

  const reRunQuery = async (newIntent: any) => {
    if (isLoading || !qa) return;
    setIsLoading(true);
    try {
      const response = await askAiChat(qa.question, history, newIntent);
      const updatedQa = { ...qa, answer: response };
      setQa(updatedQa);
      aiChatStore.qa = updatedQa;
      setDebugData(JSON.stringify(response, null, 2));
    } catch (e) {
      console.error('Re-run error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    aiChatStore.reset();
    setQa(null);
    setHistory([]);
    setDebugData(null);
    setIsTyping(true);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header - Transparent and minimal */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={28} color={COLORS.primary} />
        </Pressable>
        <View style={styles.headerRight}>
          <Pressable
            onPress={handleReset}
            style={[styles.iconBtn, !qa && { opacity: 0 }]}
          >
            <Ionicons name="refresh-outline" size={20} color={COLORS.secondary} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.flex}>
          {isTyping ? (
            <View style={styles.fullScreenInput}>
              <TextInput
                autoFocus
                multiline
                style={styles.bigInput}
                placeholder="Cosa vuoi sapere?"
                placeholderTextColor={COLORS.secondary + '40'}
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={() => sendMessage(inputText)}
                returnKeyType="send"
              />
              {inputText.length > 0 && (
                <Pressable onPress={() => sendMessage(inputText)} style={styles.sendFab}>
                  <Ionicons name="arrow-up" size={32} color="#FFF" />
                </Pressable>
              )}
            </View>
          ) : (
            <View style={styles.qaContainer}>
              {/* Question small at top */}
              <View style={styles.smallQuestionContainer}>
                <Text style={styles.smallQuestionText}>{qa?.question}</Text>
              </View>

              {/* Answer BIG in middle */}
              <View style={styles.mainAnswerArea}>
                {isLoading ? (
                  <View style={styles.loadingWrapper}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Wolly sta analizzando...</Text>
                  </View>
                ) : qa?.answer && (
                  <ScrollView 
                    style={styles.answerScroll}
                    contentContainerStyle={styles.answerScrollContent}
                    showsVerticalScrollIndicator={false}
                  >
                    <Text style={qa.answer.intent === 'text' ? styles.bigAnswerText : styles.answerContextText}>
                      {qa.answer.text_response}
                    </Text>
                    
                    {/* JIT Charts */}
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
                      {qa.answer.intent === 'subscriptions' && qa.answer.subscription_data && (
                        <JitSubscriptions 
                          items={qa.answer.subscription_data.items}
                          totalMonthly={qa.answer.subscription_data.total_monthly}
                        />
                      )}
                    </View>

                    {showDebug && debugData && (
                      <View style={styles.debugBox}>
                        <Text style={styles.debugText}>{debugData}</Text>
                      </View>
                    )}
                  </ScrollView>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Floating actions if not typing */}
        {!isTyping && !isLoading && (
          <View style={styles.bottomActions}>
            <Pressable style={styles.actionCircle} onPress={() => setIsTyping(true)}>
              <Ionicons name="chatbubble-outline" size={24} color={COLORS.primary} />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },

  // ─── Full Screen Input ──────────────────────────────────────────────────
  fullScreenInput: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bigInput: {
    width: '100%',
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 32,
    color: COLORS.primary,
    textAlign: 'center',
    paddingVertical: 40,
  },
  sendFab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    ...SHADOWS.medium,
  },

  // ─── QA Container ─────────────────────────────────────────────────────────
  qaContainer: {
    flex: 1,
  },
  smallQuestionContainer: {
    paddingTop: 20,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
  },
  smallQuestionText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.secondary,
    textAlign: 'center',
    opacity: 0.8,
  },
  mainAnswerArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  answerScroll: {
    flex: 1,
  },
  answerScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  bigAnswerText: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 28,
    color: COLORS.primary,
    textAlign: 'center',
    lineHeight: 38,
  },
  answerContextText: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 18,
    color: COLORS.secondary,
    textAlign: 'center',
    marginBottom: 0,
  },
  jitWrapper: {
    marginTop: 40,
    alignItems: 'center',
    width: '100%',
  },

  // ─── Header & Actions ─────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backBtn: {
    padding: 8,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    padding: 8,
  },
  bottomActions: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  actionCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  loadingWrapper: {
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.secondary,
  },
  debugBox: {
    marginTop: 40,
    padding: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
  },
  debugText: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: COLORS.secondary,
  },
});


