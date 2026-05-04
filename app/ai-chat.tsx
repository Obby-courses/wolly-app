import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, KeyboardAvoidingView, Platform,
  Pressable, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from '../constants/Theme';
import ChatBubble from '../components/ai/ChatBubble';
import InlineChart from '../components/ai/InlineChart';
import VoiceInputBar from '../components/ai/VoiceInputBar';
import { askAiChat, AiChatResponse } from '../services/aiChat';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  aiResponse?: AiChatResponse;
}

// ─── Suggested Prompts ────────────────────────────────────────────────────────
const SUGGESTIONS = [
  'Come sto andando questo mese?',
  'Mostrami le spese per categoria',
  'Dove spendo di più?',
  'Confronta entrate e uscite',
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AiChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      text: text.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    scrollToBottom();

    try {
      const response = await askAiChat(text.trim());
      const assistantMsg: Message = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        text: response.text_response,
        aiResponse: response,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          text: 'Errore nella risposta. Riprova.',
        },
      ]);
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  }, [isLoading]);

  const renderItem = ({ item }: { item: Message }) => (
    <View>
      <ChatBubble role={item.role} text={item.text} />
      {item.role === 'assistant' && item.aiResponse?.chart && (
        <InlineChart payload={item.aiResponse.chart} />
      )}
    </View>
  );

  const isEmpty = messages.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>W</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Wolly AI</Text>
            <Text style={styles.headerSubtitle}>Il tuo consulente finanziario</Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Chat list */}
        {isEmpty ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrapper}>
              <Ionicons name="chatbubbles-outline" size={48} color={COLORS.secondary} />
            </View>
            <Text style={styles.emptyTitle}>Ciao! Sono Wolly 👋</Text>
            <Text style={styles.emptySubtitle}>
              Puoi chiedermi qualsiasi cosa sui tuoi dati finanziari. Posso rispondere con testi o grafici.
            </Text>
            {/* Suggested prompts */}
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((s, i) => (
                <Pressable key={i} style={styles.suggestionChip} onPress={() => sendMessage(s)}>
                  <Text style={styles.suggestionText}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={scrollToBottom}
            ListFooterComponent={
              isLoading ? (
                <View style={styles.thinkingBubble}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>W</Text>
                  </View>
                  <View style={styles.thinkingDots}>
                    <ActivityIndicator size="small" color={COLORS.secondary} />
                    <Text style={styles.thinkingText}>Sto analizzando…</Text>
                  </View>
                </View>
              ) : null
            }
          />
        )}

        {/* Input bar */}
        <VoiceInputBar
          onSubmit={sendMessage}
          isLoading={isLoading}
          placeholder="Chiedi a Wolly…"
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  // Header
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
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    color: '#FFF',
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: TYPOGRAPHY.sizes.lg,
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
  // List
  listContent: { paddingTop: SPACING.lg, paddingBottom: SPACING.lg },
  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  emptyIconWrapper: {
    width: 90,
    height: 90,
    borderRadius: 45,
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
    marginBottom: SPACING.xl,
  },
  suggestions: { gap: SPACING.sm, width: '100%' },
  suggestionChip: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    ...SHADOWS.soft,
  },
  suggestionText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.primary,
  },
  // Thinking indicator
  thinkingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: TYPOGRAPHY.sizes.sm,
    fontFamily: TYPOGRAPHY.fontBold,
  },
  thinkingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  thinkingText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.secondary,
  },
});
