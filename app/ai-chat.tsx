import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, Pressable, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from '../constants/Theme';
import ChatBubble from '../components/ai/ChatBubble';
import InlineChart from '../components/ai/InlineChart';
import VoiceInputBar from '../components/ai/VoiceInputBar';
import { askAiChat, AiChatResponse } from '../services/aiChat';

// ─── Suggested Prompts ────────────────────────────────────────────────────────
const SUGGESTIONS = [
  'Come sto andando questo mese?',
  'Mostrami le spese per categoria',
  'Dove spendo di più?',
  'Confronta entrate e uscite di quest\'anno',
];

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
  const [qa, setQa] = useState<QAState | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    // Mostra subito la domanda, azzera la risposta precedente
    setQa({ question: text.trim(), answer: null });
    setIsLoading(true);

    try {
      const response = await askAiChat(text.trim());
      setQa({ question: text.trim(), answer: response });
    } catch (e) {
      setQa({
        question: text.trim(),
        answer: {
          intent: 'text',
          text_response: 'Mi dispiace, non ho potuto elaborare la risposta. Riprova.',
          chart: null,
        },
      });
    } finally {
      setIsLoading(false);
    }
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
        {/* Tasto reset — torna alla schermata vuota */}
        <Pressable
          onPress={() => setQa(null)}
          style={[styles.resetBtn, isEmpty && { opacity: 0 }]}
          disabled={isEmpty}
        >
          <Ionicons name="refresh-outline" size={20} color={COLORS.secondary} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={isEmpty ? styles.emptyContent : styles.qaContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ─── Stato vuoto ─────────────────────────────────────────── */}
          {isEmpty && (
            <>
              <View style={styles.emptyIconWrapper}>
                <Ionicons name="chatbubbles-outline" size={52} color={COLORS.secondary} />
              </View>
              <Text style={styles.emptyTitle}>Ciao! Sono Wolly 👋</Text>
              <Text style={styles.emptySubtitle}>
                Chiedimi qualcosa sui tuoi dati finanziari.{'\n'}
                Posso risponderti con testo o grafici.
              </Text>
              <View style={styles.suggestions}>
                {SUGGESTIONS.map((s, i) => (
                  <Pressable key={i} style={styles.chip} onPress={() => sendMessage(s)}>
                    <Text style={styles.chipText}>{s}</Text>
                    <Ionicons name="arrow-forward" size={14} color={COLORS.secondary} />
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {/* ─── Q&A View ────────────────────────────────────────────── */}
          {qa && (
            <>
              {/* Domanda utente */}
              <ChatBubble role="user" text={qa.question} />

              {/* Risposta AI o loader */}
              {isLoading ? (
                <View style={styles.thinkingRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>W</Text>
                  </View>
                  <View style={styles.thinkingBubble}>
                    <ActivityIndicator size="small" color={COLORS.secondary} />
                    <Text style={styles.thinkingText}>Sto analizzando i tuoi dati…</Text>
                  </View>
                </View>
              ) : qa.answer && (
                <>
                  <ChatBubble role="assistant" text={qa.answer.text_response} />
                  {qa.answer.chart && (
                    <InlineChart payload={qa.answer.chart} />
                  )}
                </>
              )}
            </>
          )}
        </ScrollView>

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
    ...SHADOWS.soft,
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
    paddingBottom: SPACING.huge,
  },
  emptyIconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
    ...SHADOWS.soft,
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
    marginBottom: SPACING.xxl,
  },
  suggestions: { gap: SPACING.sm, width: '100%' },
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

  // ─── Q&A state ────────────────────────────────────────────────────────────
  qaContent: {
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.huge,
  },

  // ─── Thinking indicator ───────────────────────────────────────────────────
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  thinkingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  thinkingText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.secondary,
  },
});
