/**
 * AiResponseView.tsx
 * ─────────────────────────────────────────────────────────────────
 * Componente condiviso che renderizza la risposta AI in modo IDENTICO
 * sia dalla chat testuale (ai-chat.tsx) sia dall'overlay vocale
 * (VoiceChatOverlay.tsx).
 *
 * FLUSSO:
 *   askAiChat() → AiChatResponse → <AiResponseView /> → JIT widget corretto
 *
 * In questo modo qualsiasi correzione visiva o nuovo archetipo viene
 * applicata automaticamente a entrambi i canali (voce + testo).
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING } from '../../constants/Theme';
import { AiChatResponse } from '../../services/aiChat';
import { QueryIntent } from '../../services/aiQueryParser';

import JitTotal        from './JitTotal';
import JitDistribution from './JitDistribution';
import JitList         from './JitList';
import JitTimeline     from './JitTimeline';
import JitSubscriptions from './JitSubscriptions';
import FeedbackBar     from './FeedbackBar';

// ─── Props ────────────────────────────────────────────────────────────────────

interface AiResponseViewProps {
  /** Testo della domanda utente (mostrato piccolo in cima) */
  question: string;
  /** Risposta completa dell'AI */
  answer: AiChatResponse;
  /**
   * Callback per rieseguire la query con un intent modificato
   * (passata a FeedbackBar). Se undefined, FeedbackBar non viene mostrata.
   */
  onRerun?: (newIntent: QueryIntent) => void;
  /** Stile opzionale per il testo della risposta (es: font size) */
  textStyle?: object;
  /** Se true, wrappa il contenuto in un ScrollView */
  scrollable?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AiResponseView({
  question,
  answer,
  onRerun,
  textStyle,
  scrollable = true,
}: AiResponseViewProps) {

  const isTextOnly = answer.intent === 'text' || answer.intent === 'advice';

  const body = (
    <>
      {/* Domanda utente — piccola in cima */}
      <View style={styles.questionContainer}>
        <Text style={styles.questionText}>{question}</Text>
      </View>

      {/* FeedbackBar — solo per intent con dati e se onRerun è disponibile */}
      {!isTextOnly && onRerun && answer.queryIntent && (
        <FeedbackBar
          intent={answer.queryIntent}
          onUpdate={onRerun}
        />
      )}

      {/* Testo risposta principale */}
      <Text style={[isTextOnly ? styles.bigAnswerText : styles.answerContextText, textStyle]}>
        {answer.text_response}
      </Text>

      {/* ── JIT Widgets ──────────────────────────────────────────────────── */}
      <View style={styles.jitWrapper}>

        {answer.intent === 'total' && answer.total_data && (
          <JitTotal
            value={answer.total_data.value}
            comparison={answer.total_data.comparison}
            periodLabel={answer.total_data.period_label}
          />
        )}

        {answer.intent === 'distribution' && answer.distribution_data && (
          <JitDistribution
            title={answer.distribution_data.title}
            items={answer.distribution_data.items}
          />
        )}

        {answer.intent === 'list' && answer.list_data && (
          <JitList
            title={answer.list_data.title}
            items={answer.list_data.items}
            totalCount={answer.list_data.total_count}
          />
        )}

        {answer.intent === 'timeline' && answer.timeline_data && (
          <JitTimeline
            type={answer.timeline_data.type}
            title={answer.timeline_data.title}
            data={answer.timeline_data.data}
            granularity={answer.timeline_data.granularity}
          />
        )}

        {answer.intent === 'subscriptions' && answer.subscription_data && (
          <JitSubscriptions
            items={answer.subscription_data.items}
            totalMonthly={answer.subscription_data.total_monthly}
          />
        )}

      </View>
    </>
  );

  if (!scrollable) {
    return <View style={styles.container}>{body}</View>;
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {body}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 32,
  },
  questionContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  questionText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: 13,
    color: COLORS.secondary,
    textAlign: 'center',
    opacity: 0.8,
  },
  bigAnswerText: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 26,
    color: COLORS.primary,
    textAlign: 'center',
    lineHeight: 36,
    marginTop: 8,
  },
  answerContextText: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 18,
    color: COLORS.secondary,
    textAlign: 'center',
    marginTop: 4,
  },
  jitWrapper: {
    marginTop: 32,
    alignItems: 'center',
    width: '100%',
  },
});
