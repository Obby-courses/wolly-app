import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from '../../constants/Theme';

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  text: string;
}

/**
 * ChatBubble — Bolla di conversazione per la pagina AI Chat.
 * Modulare: nessuna logica AI interna, solo rendering UI.
 * Stili centralizzati tramite Theme.ts.
 */
export default function ChatBubble({ role, text }: ChatBubbleProps) {
  const isUser = role === 'user';

  return (
    <View style={[styles.wrapper, isUser ? styles.wrapperUser : styles.wrapperAssistant]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>W</Text>
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <Text style={[styles.text, isUser ? styles.textUser : styles.textAssistant]}>
          {text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  wrapperUser: {
    justifyContent: 'flex-end',
  },
  wrapperAssistant: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
    flexShrink: 0,
  },
  avatarText: {
    color: '#FFF',
    fontSize: TYPOGRAPHY.sizes.sm,
    fontFamily: TYPOGRAPHY.fontBold,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 20,
    padding: SPACING.md,
    paddingHorizontal: SPACING.lg,
    ...SHADOWS.soft,
  },
  bubbleUser: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  text: {
    fontSize: TYPOGRAPHY.sizes.base,
    lineHeight: 22,
  },
  textUser: {
    color: '#FFFFFF',
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  textAssistant: {
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
});
