import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView,
  Platform, Pressable, ActivityIndicator, Keyboard, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from '../constants/Theme';
import AiResponseView from '../components/ai/AiResponseView';
import { askAiChat, AiChatResponse, ChatMessage, aiChatStore } from '../services/aiChat';
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

export default function AiChatPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ message?: string; returnTo?: string }>();
  const [qa, setQa] = useState<QAState | null>(aiChatStore.qa);
  const [history, setHistory] = useState<ChatMessage[]>(aiChatStore.history);
  const [isLoading, setIsLoading] = useState(false);
  const [showDebug, setShowDebug] = useState(aiChatStore.showDebug);
  const [debugData, setDebugData] = useState<string | null>(aiChatStore.debugData);
  const [autoSentRef] = useState({ done: false });

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(aiChatStore.getIsTyping());

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
          params: { 
            data: JSON.stringify(parsed),
            returnTo: params.returnTo || '/'
          },
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
    <LinearGradient colors={['#0A74FF', '#0857C3']} style={styles.gradientRoot}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerTop}>
          <Pressable
            onPress={() => {
              if (isTyping && qa) {
                Keyboard.dismiss();
                aiChatStore.setIsTyping(false);
              } else {
                router.back();
              }
            }}
            style={styles.closeBtnTop}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </Pressable>
        </View>

        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <View style={styles.qaContainer}>
            {/* Answer area */}
            <View style={styles.mainAnswerArea}>
              {isLoading ? (
                <View style={styles.loadingWrapper}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                  <Text style={styles.loadingText}>Wolly sta analizzando...</Text>
                </View>
              ) : qa?.answer ? (
                <AiResponseView
                  question={qa.question}
                  answer={qa.answer}
                  onRerun={reRunQuery}
                  scrollable={true}
                />
              ) : null}
            </View>

            {/* Bottom Bar Input */}
            <View style={styles.bottomBarContainer}>
              <View style={[styles.inputBoxRound, isLoading && { opacity: 0.6 }]}>
                <TextInput
                  autoFocus={isTyping}
                  multiline={false}
                  maxLength={500}
                  style={styles.bottomInput}
                  placeholder="Chiedi a Wolly..."
                  placeholderTextColor="#9CA3AF"
                  value={inputText}
                  onChangeText={setInputText}
                  editable={!isLoading}
                  onFocus={() => {
                    if (!isLoading) {
                      aiChatStore.setIsTyping(true);
                    }
                  }}
                  returnKeyType="send"
                  onSubmitEditing={() => {
                    if (inputText.trim().length > 0) {
                      Keyboard.dismiss();
                      sendMessage(inputText);
                    }
                  }}
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientRoot: { flex: 1 },
  safe: { flex: 1, backgroundColor: 'transparent' },
  flex: { flex: 1 },

  fullScreenInputContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
  },
  headerTop: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  closeBtnTop: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
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
    color: '#FFFFFF',
    textAlign: 'center',
    paddingVertical: 40,
  },
  // ─── QA Container & Bottom Bar ──────────────────────────────────────────
  qaContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  bottomBarContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: 'transparent',
  },
  inputBoxRound: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 16,
    justifyContent: 'center',
    borderWidth: 0,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  bottomInput: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: 18,
    color: '#1C1C1E',
    maxHeight: 120,
    minHeight: 40,
    paddingTop: Platform.OS === 'ios' ? 4 : 2,
    paddingBottom: Platform.OS === 'ios' ? 4 : 2,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    marginBottom: 2,
  },

  mainAnswerArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  loadingWrapper: {
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.sizes.base,
    color: '#FFFFFF',
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


