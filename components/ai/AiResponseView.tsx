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
import { Ionicons } from '@expo/vector-icons';
import { DOMAINS_CONFIG } from '../../constants/categories';

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

function renderFormattedText(text: string, queryIntent?: QueryIntent) {
  if (!text) return null;

  const escapeRegExp = (str: string) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const boldTerms = new Set<string>();

  // Merchants / Shops (metriche/valori)
  const merchants = ['esselunga', 'coop', 'conad', 'carrefour', 'lidl', 'amazon', 'netflix', 'spotify', 'starbucks', 'mcdonald', 'mcdonalds', 'apple', 'uber', 'shein', 'zara', 'h&m'];
  merchants.forEach(m => boldTerms.add(m));
  if (queryIntent?.merchant_filter) boldTerms.add(queryIntent.merchant_filter.toLowerCase());

  // Social Context / People
  const social = ['friends', 'amici', 'family', 'famiglia', 'colleagues', 'colleghi', 'couple', 'coppia', 'alone', 'solo', 'strangers', 'sconosciuti'];
  social.forEach(s => boldTerms.add(s));
  if (queryIntent?.social_context_filter) boldTerms.add(queryIntent.social_context_filter.toLowerCase());
  if (queryIntent?.person_filter) boldTerms.add(queryIntent.person_filter.toLowerCase());

  // Tags
  const tags = ['vacanza', 'lavoro', 'weekend', 'regalo', 'trasferta', 'impulsivo', 'personale'];
  tags.forEach(t => boldTerms.add(t));
  if (queryIntent?.tag_filter) boldTerms.add(queryIntent.tag_filter.toLowerCase());

  // Holidays
  const holidays = ['natale', 'pasqua', 'capodanno', 'ferragosto', 'halloween', 'compleanno'];
  holidays.forEach(h => boldTerms.add(h));
  if (queryIntent?.holiday_filter) boldTerms.add(queryIntent.holiday_filter.toLowerCase());

  // Subscriptions / Recurring
  const subscriptions = ['abbonamento', 'abbonamenti', 'ricorrente', 'mensile', 'annuale', 'netflix', 'spotify', 'prime', 'disney+'];
  subscriptions.forEach(s => boldTerms.add(s));

  const termList = Array.from(boldTerms)
    .filter(t => t && t.trim().length > 1)
    .sort((a, b) => b.length - a.length);

  const patterns: string[] = [];
  if (termList.length > 0) {
    patterns.push('\\b(?:' + termList.map(t => escapeRegExp(t)).join('|') + ')\\b');
  }
  patterns.push('\\b\\d+(?:[.,]\\d+)?\\s*€');
  patterns.push('€\\s*\\d+(?:[.,]\\d+)?');
  patterns.push('\\b\\d+(?:[.,]\\d+)?\\s*(?:euro|eur|EURO|EUR)\\b');
  patterns.push('\\b20\\d{2}\\b');

  const finalRegex = new RegExp('(' + patterns.join('|') + ')', 'gi');

  const parts = text.split(finalRegex);
  return (
    <Text style={{ textAlign: 'left' }}>
      {parts.map((part, index) => {
        if (index % 2 === 0) {
          // Testo naturale (azzurro opaco)
          return <Text key={index} style={{ color: '#BADBFF' }}>{part}</Text>;
        } else {
          // Voce evidenziata/metrica (bianco bold)
          return (
            <Text key={index} style={{ color: '#FFFFFF', fontWeight: 'bold' }}>
              {part}
            </Text>
          );
        }
      })}
    </Text>
  );
}

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

      {/* FeedbackBar — hidden per richiesta utente */}

      {/* Testo risposta principale */}
      <Text style={[isTextOnly ? styles.bigAnswerText : styles.answerContextText, textStyle]}>
        {renderFormattedText(answer.text_response, answer.queryIntent)}
      </Text>

      {/* ── JIT Widgets ──────────────────────────────────────────────────── */}
      <View style={styles.jitWrapper}>

        {/* disattivato momentaneamente il grafico display big, number per richiesta utente
        {answer.intent === 'total' && answer.total_data && (
          <JitTotal
            value={answer.total_data.value}
            comparison={answer.total_data.comparison}
            periodLabel={answer.total_data.period_label}
          />
        )}
        */}

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
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 32,
  },
  questionContainer: {
    alignItems: 'flex-start',
    marginBottom: 8,
    width: '100%',
  },
  questionText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: 14,
    color: '#BADBFF',
    textAlign: 'left',
    opacity: 0.8,
  },
  bigAnswerText: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 45,
    color: '#FFFFFF',
    textAlign: 'left',
    lineHeight: 56,
    marginTop: 8,
  },
  answerContextText: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 45,
    color: '#BADBFF',
    textAlign: 'left',
    lineHeight: 56,
    marginTop: 4,
  },
  jitWrapper: {
    marginTop: 32,
    alignItems: 'flex-start',
    width: '100%',
  },
});
