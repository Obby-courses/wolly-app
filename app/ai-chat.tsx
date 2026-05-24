import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView,
  Platform, Pressable, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from '../constants/Theme';
import AiResponseView from '../components/ai/AiResponseView';
import { askAiChat, AiChatResponse, ChatMessage, aiChatStore } from '../services/aiChat';
import CustomKeyboard from '../components/CustomKeyboard';
import { analytics, ANALYTICS_SCREENS } from '../services/analytics';
import { routeInput } from '../services/inputRouter';

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
  const [isTyping, setIsTyping] = useState(aiChatStore.getIsTyping());
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  useEffect(() => {
    analytics.trackScreen(ANALYTICS_SCREENS.AI_CHAT);
    // Imposta la modalità di digitazione iniziale in base alla presenza di risposte
    aiChatStore.setIsTyping(!aiChatStore.qa);

    // Reset completo dello stato per far ripartire la chat da zero alla prossima apertura
    return () => {
      aiChatStore.reset();
    };
  }, []);

  // Sincronizza lo stato di digitazione con il database dell'AI chat
  useEffect(() => {
    const unsub = aiChatStore.subscribe(() => {
      setIsTyping(aiChatStore.getIsTyping());
    });
    return () => {
      unsub();
    };
  }, []);

  // Auto-send message when navigated with params.message
  useEffect(() => {
    if (params.message && !autoSentRef.done) {
      autoSentRef.done = true;
      sendMessage(params.message);
    }
  }, [params.message]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    analytics.trackClick('btn_ai_chat_send_message', ANALYTICS_SCREENS.AI_CHAT, {
      message_length: text.length
    });

    const userMsg = text.trim();

    // Controlla se l'input contiene una spesa da registrare (parsing deterministico)
    const route = routeInput(userMsg);
    if (route === 'expense') {
      setIsLoading(true);
      setInputText('');
      aiChatStore.setIsTyping(false);
      try {
        const { parseExpenseWithAI } = require('../services/groqParser');
        const parsed = await parseExpenseWithAI(userMsg, 'text');
        router.push({
          pathname: '/expense-detail',
          params: { data: JSON.stringify(parsed) },
        });
        // Resettiamo lo stato QA se l'utente esce dalla chat per inserire la spesa
        setQa(null);
        aiChatStore.qa = null;
        return;
      } catch (err) {
        console.error('[ai-chat] Error parsing expense:', err);
      } finally {
        setIsLoading(false);
      }
    }

    const newQa = { question: userMsg, answer: null };
    setQa(newQa);
    aiChatStore.qa = newQa;
    aiChatStore.setIsTyping(false);
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
    aiChatStore.setIsTyping(true);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Spacer per respiro visivo in alto */}
      <View style={{ height: 16 }} />

      <View style={styles.flex}>
        <View style={styles.flex}>
          {isTyping ? (
            <View style={styles.fullScreenInputContainer}>
              <View style={styles.fullScreenInput}>
                <TextInput
                  autoFocus
                  multiline={false}
                  showSoftInputOnFocus={false}
                  style={styles.bigInput}
                  placeholder="Cosa vuoi sapere?"
                  placeholderTextColor={COLORS.secondary + '40'}
                  value={inputText}
                  onChangeText={setInputText}
                  onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                  selection={selection}
                  onSubmitEditing={() => sendMessage(inputText)}
                  returnKeyType="send"
                />
              </View>
              
              {/* Tastiera virtuale personalizzata posizionata esattamente sopra il BottomMenu */}
              <View style={{ paddingBottom: Platform.OS === 'ios' ? 74 : 60 }}>
                <CustomKeyboard
                  value={inputText}
                  onChangeText={setInputText}
                  selection={selection}
                  onSelectionChange={setSelection}
                  onSubmit={() => sendMessage(inputText)}
                />
              </View>
            </View>
          ) : (
            <View style={styles.qaContainer}>
              {/* Answer area */}
              <View style={styles.mainAnswerArea}>
                {isLoading ? (
                  <View style={styles.loadingWrapper}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Wolly sta analizzando...</Text>
                  </View>
                ) : qa?.answer && (
                  <AiResponseView
                    question={qa.question}
                    answer={qa.answer}
                    onRerun={reRunQuery}
                    scrollable={true}
                  />
                )}
              </View>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },

  fullScreenInputContainer: {
    flex: 1,
    width: '100%',
  },

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
    bottom: 100,
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


