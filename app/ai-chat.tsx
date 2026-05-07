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
export default function AiChatPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ message?: string }>();
  const [qa, setQa] = useState<QAState | null>(aiChatStore.qa);
  const [history, setHistory] = useState<ChatMessage[]>(aiChatStore.history);
  const [isLoading, setIsLoading] = useState(false);
  const [showDebug, setShowDebug] = useState(aiChatStore.showDebug);
  const [debugData, setDebugData] = useState<string | null>(aiChatStore.debugData);
  const [autoSentRef] = useState({ done: false });

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
  };

  const isEmpty = !qa;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>W</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Wolly AI</Text>
            <Text style={styles.headerSubtitle}>Il tuo consulente finanziario</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Pressable 
            onPress={() => {
              const newVal = !showDebug;
              setShowDebug(newVal);
              aiChatStore.showDebug = newVal;
            }} 
            style={styles.iconBtn}
          >
            <Ionicons name="bug-outline" size={20} color={showDebug ? COLORS.accent : COLORS.secondary} />
          </Pressable>
          <Pressable
            onPress={handleReset}
            style={[styles.resetBtn, isEmpty && { opacity: 0 }]}
            disabled={isEmpty}
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
          {/* ─── Stato vuoto ─────────────────────────────────────────── */}
          {isEmpty && (
            <View style={styles.emptyContent}>
              <View style={styles.emptyIconWrapper}>
                <Text style={styles.wollyEmoji}>✦</Text>
              </View>
              <Text style={styles.emptyTitle}>Wolly è pronto</Text>
              <Text style={styles.emptySubtitle}>
                Usa il microfono o scrivi per fare domande sui tuoi dati.
              </Text>
            </View>
          )}

          {/* ─── Q&A View Centrata ────────────────────────────────────── */}
          {qa && (
            <View style={styles.qaContainer}>
              {/* Domanda in alto centrata */}
              <View style={styles.questionSection}>
                <Text style={styles.questionLabel}>LA TUA DOMANDA</Text>
                <Text style={styles.questionText}>{qa.question}</Text>
              </View>

              {/* Risposta al centro (50% altezza circa) */}
              <View style={styles.answerSection}>
                {isLoading ? (
                  <View style={styles.loadingWrapper}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                    <Text style={styles.loadingText}>Analisi in corso...</Text>
                  </View>
                ) : qa.answer && (
                  <ScrollView 
                    contentContainerStyle={styles.answerScrollContent}
                    showsVerticalScrollIndicator={false}
                  >
                    {qa.answer.queryIntent && qa.answer.intent !== 'text' && (
                      <FeedbackBar 
                        intent={qa.answer.queryIntent} 
                        onUpdate={reRunQuery} 
                      />
                    )}

                    {qa.answer.analysis_steps && qa.answer.analysis_steps.length > 0 && (
                      <View style={styles.stepsContainer}>
                        {qa.answer.analysis_steps.map((step, idx) => (
                          <View key={idx} style={styles.stepItem}>
                            <Ionicons name="checkmark-circle" size={12} color={COLORS.success} />
                            <Text style={styles.stepText}>{step}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    <Text style={styles.answerText}>{qa.answer.text_response}</Text>
                    
                    {qa.answer.intent === 'total' && qa.answer.total_data && (
                      <JitTotal 
                        value={qa.answer.total_data.value} 
                        comparison={qa.answer.total_data.comparison} 
                        periodLabel={qa.answer.total_data.period_label} 
                      />
                    )}

                    {qa.answer.intent === 'distribution' && qa.answer.distribution_data && (
                      <JitDistribution 
                        title={qa.answer.distribution_data.title} 
                        items={qa.answer.distribution_data.items} 
                      />
                    )}

                    {qa.answer.intent === 'list' && qa.answer.list_data && (
                      <JitList 
                        title={qa.answer.list_data.title} 
                        items={qa.answer.list_data.items} 
                        totalCount={qa.answer.list_data.total_count} 
                      />
                    )}

                    {qa.answer.intent === 'timeline' && qa.answer.timeline_data && (
                      <JitTimeline 
                        type={qa.answer.timeline_data.type} 
                        title={qa.answer.timeline_data.title} 
                        data={qa.answer.timeline_data.data} 
                        granularity={qa.answer.timeline_data.granularity} 
                      />
                    )}

                    {qa.answer.intent === 'subscriptions' && qa.answer.subscription_data && (
                      <JitSubscriptions 
                        items={qa.answer.subscription_data.items}
                        totalMonthly={qa.answer.subscription_data.total_monthly}
                      />
                    )}

                    {showDebug && debugData && (
                      <View style={styles.debugBox}>
                        <Text style={styles.debugTitle}>AI RAW JSON (Debug)</Text>
                        <Text style={styles.debugText}>{debugData}</Text>
                      </View>
                    )}
                  </ScrollView>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Input bar sempre visibile in fondo */}
        <VoiceInputBar
          onSubmit={sendMessage}
          isLoading={isLoading}
          onBack={() => router.back()}
          placeholder="Chiedi a Wolly…"
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },

  // ─── Header ───────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    zIndex: 10,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  resetBtn: { width: 40, alignItems: 'flex-end' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: TYPOGRAPHY.sizes.base,
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.primary,
  },
  headerSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.secondary,
  },

  // ─── Empty state ──────────────────────────────────────────────────────────
  emptyContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  emptyIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
    ...SHADOWS.soft,
  },
  wollyEmoji: {
    fontSize: 36,
    color: '#FFFFFF',
  },
  emptyTitle: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: TYPOGRAPHY.sizes.xl,
    color: COLORS.primary,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  chipText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.primary,
    flex: 1,
  },

  // ─── Q&A Container ────────────────────────────────────────────────────────
  qaContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  questionSection: {
    paddingTop: SPACING.xxl,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
  },
  questionLabel: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 10,
    color: COLORS.secondary,
    letterSpacing: 1.5,
    marginBottom: SPACING.sm,
  },
  questionText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.sizes.lg,
    color: COLORS.primary,
    textAlign: 'center',
    lineHeight: 24,
  },
  answerSection: {
    flex: 1,
    maxHeight: '60%', // Circa il 50-60% centrale
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    marginVertical: SPACING.xl,
  },
  answerScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  answerText: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: TYPOGRAPHY.sizes.xl,
    color: COLORS.primary,
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: SPACING.xl,
  },
  chartWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  loadingWrapper: {
    alignItems: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.secondary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBtn: {
    padding: 8,
  },
  stepsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: SPACING.lg,
    opacity: 0.7,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  stepText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: 10,
    color: COLORS.secondary,
  },
  debugBox: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    width: '100%',
  },
  debugTitle: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 10,
    color: COLORS.accent,
    marginBottom: 8,
  },
  debugText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    color: '#94A3B8',
  },
});
