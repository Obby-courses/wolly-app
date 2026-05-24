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
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING } from '../../constants/Theme';
import { AiChatResponse } from '../../services/aiChat';
import { QueryIntent } from '../../services/aiQueryParser';
import { Ionicons } from '@expo/vector-icons';

import JitTotal        from './JitTotal';
import JitDistribution from './JitDistribution';
import JitList         from './JitList';
import JitTimeline     from './JitTimeline';
import JitSubscriptions from './JitSubscriptions';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Props ────────────────────────────────────────────────────────────────────

interface AiResponseViewProps {
  /** Testo della domanda utente (mostrato piccolo in cima) */
  question: string;
  /** Risposta completa dell'AI */
  answer: AiChatResponse;
  /**
   * Callback per rieseguire la query con un intent modificato
   * (non più utilizzato per la FeedbackBar in quanto rimossa, mantenuta per firma retrocompatibile).
   */
  onRerun?: (newIntent: QueryIntent) => void;
  /** Stile opzionale per il testo della risposta (es: font size) */
  textStyle?: object;
  /** Se true, wrappa il contenuto in un ScrollView */
  scrollable?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

function renderFormattedText(text: string, queryIntent: QueryIntent | undefined, hasChart: boolean) {
  if (!text) return null;

  const escapeRegExp = (str: string) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  // Mappa dei Merchant (negozi/merchant) -> cart icon
  const merchantSet = new Set<string>(['eurospin', 'esselunga', 'amazon', 'netflix', 'spotify', 'coop', 'conad', 'carrefour', 'lidl', 'starbucks', 'mcdonald', 'mcdonalds', 'apple', 'uber', 'shein', 'zara', 'h&m']);
  if (queryIntent?.merchant_filter) {
    const cleanMerchant = queryIntent.merchant_filter.toLowerCase().trim();
    if (cleanMerchant.length > 1) {
      merchantSet.add(cleanMerchant);
    }
  }

  const merchantPatterns = Array.from(merchantSet).map(m => escapeRegExp(m));
  const merchantRegexStr = `\\b(?:${merchantPatterns.join('|')})\\b`;

  // Pattern degli Importi (Metriche e valori monetari) -> cash icon
  const amountRegexStr = '\\b\\d+(?:[.,]\\d+)?\\s*(?:€|euro|eur|euri)\\b|\\b(?:€|euro|eur)\\s*\\d+(?:[.,]\\d+)?\\b';

  // Costruisce la regex combinata che cattura solo metriche e merchant (escludendo le dimensioni filtrate come città, tag, categorie)
  const regex = new RegExp(`(${amountRegexStr}|${merchantRegexStr})`, 'gi');

  const parts = text.split(regex);
  return (
    <Text style={{ textAlign: hasChart ? 'left' : 'center' }}>
      {parts.map((part, index) => {
        if (index % 2 === 0) {
          // Testo naturale (leggermente grigio)
          return <Text key={index} style={{ color: '#8E8E93' }}>{part}</Text>;
        } else {
          // Metrica o Merchant evidenziato (nero in grassetto con icona iOS a sinistra)
          const isAmt = /\d/.test(part) || /€|euro|eur/i.test(part);
          const iconName = isAmt ? 'cash-sharp' : 'cart-sharp';
          const iconColor = isAmt ? '#34C759' : '#FF2D55'; // Verde per cash/metriche, Rosa/Rosso per merchant

          return (
            <Text key={index} style={{ color: '#1C1C1E', fontWeight: 'bold' }}>
              <Ionicons name={iconName} size={14} color={iconColor} />
              {' '}{part}
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

  // Definiamo se sono presenti grafici/visualizzazioni complesse (distribution e timeline sono i grafici principali)
  const hasChart = ['distribution', 'timeline'].includes(answer.intent);

  // Calcolo dinamico della dimensione del testo per i casi senza grafici (massimo risalto e leggibilità premium)
  const textLength = answer.text_response?.length || 0;
  let dynamicFontSize = 20;
  if (textLength < 40) {
    dynamicFontSize = 34;
  } else if (textLength < 80) {
    dynamicFontSize = 28;
  } else if (textLength < 150) {
    dynamicFontSize = 22;
  } else {
    dynamicFontSize = 18;
  }
  const dynamicLineHeight = dynamicFontSize * 1.38;

  const body = (
    <View style={hasChart ? styles.leftContainer : styles.centeredContainer}>
      {/* Domanda utente — in grigio, centrata o a sinistra in base al layout */}
      <View style={hasChart ? styles.questionContainerLeft : styles.questionContainerCenter}>
        <Text style={hasChart ? styles.questionTextLeft : styles.questionTextCenter}>{question}</Text>
      </View>

      {/* Testo risposta principale in grassetto, con dimensione e allineamento dinamici */}
      <Text
        style={[
          hasChart ? styles.answerLeft : styles.answerCenter,
          { fontSize: hasChart ? 18 : dynamicFontSize, lineHeight: hasChart ? 26 : dynamicLineHeight },
          textStyle,
        ]}
      >
        {renderFormattedText(answer.text_response, answer.queryIntent, hasChart)}
      </Text>

      {/* ── JIT Widgets ──────────────────────────────────────────────────── */}
      <View style={hasChart ? styles.jitWrapperLeft : styles.jitWrapperCenter}>

        {answer.intent === 'total' && answer.total_data && (
          <JitTotal
            value={answer.total_data.value}
            comparison={answer.total_data.comparison}
            periodLabel={answer.total_data.period_label}
          />
        )}

        {hasChart && answer.intent === 'distribution' && answer.distribution_data && (
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

        {hasChart && answer.intent === 'timeline' && answer.timeline_data && (
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
    </View>
  );

  if (!scrollable) {
    return <View style={styles.container}>{body}</View>;
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={hasChart ? styles.scrollContentLeft : styles.scrollContentCenter}
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
  scrollContentLeft: {
    flexGrow: 1,
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 32,
  },
  scrollContentCenter: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 32,
  },
  leftContainer: {
    width: '100%',
    alignItems: 'flex-start',
  },
  centeredContainer: {
    width: '100%',
    minHeight: SCREEN_HEIGHT * 0.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  questionContainerLeft: {
    alignItems: 'flex-start',
    marginBottom: 8,
    width: '100%',
  },
  questionContainerCenter: {
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
  },
  questionTextLeft: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: 13,
    color: COLORS.secondary,
    textAlign: 'left',
    opacity: 0.8,
  },
  questionTextCenter: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: 14,
    color: COLORS.secondary,
    textAlign: 'center',
    opacity: 0.8,
  },
  answerLeft: {
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.secondary,
    textAlign: 'left',
    marginTop: 4,
  },
  answerCenter: {
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.secondary,
    textAlign: 'center',
    marginTop: 8,
  },
  jitWrapperLeft: {
    marginTop: 32,
    alignItems: 'flex-start',
    width: '100%',
  },
  jitWrapperCenter: {
    marginTop: 24,
    alignItems: 'center',
    width: '100%',
  },
});
