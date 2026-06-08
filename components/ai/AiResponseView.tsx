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

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Animated } from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING } from '../../constants/Theme';
import { AiChatResponse } from '../../services/aiChat';
import { QueryIntent } from '../../services/aiQueryParser';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

function renderFormattedText(text: string, queryIntents: QueryIntent[], fontSize: number) {
  if (!text) return null;

  // Rimuoviamo le doppie virgolette dal testo per evitare che vengano visualizzate intorno a categorie/domini
  const cleanText = text.replace(/"/g, '');

  const escapeRegExp = (str: string) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const boldTerms = new Set<string>();

  // Categorie & Domini (vengono visualizzati in bianco bold senza virgolette)
  queryIntents.forEach(queryIntent => {
    if (queryIntent.category_filter) boldTerms.add(queryIntent.category_filter.toLowerCase().replace(/_/g, ' '));
    if (queryIntent.domain_filter) boldTerms.add(queryIntent.domain_filter.toLowerCase().replace(/_/g, ' '));
    if (queryIntent.merchant_filter) boldTerms.add(queryIntent.merchant_filter.toLowerCase());
    if (queryIntent.social_context_filter) {
      const filterLower = queryIntent.social_context_filter.toLowerCase();
      boldTerms.add(filterLower);
      if (filterLower === 'alone') {
        boldTerms.add('da solo');
        boldTerms.add('da sola');
        boldTerms.add('solo');
      }
    }
    if (queryIntent.person_filter) boldTerms.add(queryIntent.person_filter.toLowerCase());
    if (queryIntent.tag_filter) boldTerms.add(queryIntent.tag_filter.toLowerCase());
    if (queryIntent.holiday_filter) boldTerms.add(queryIntent.holiday_filter.toLowerCase());
  });

  DOMAINS_CONFIG.forEach(d => {
    boldTerms.add(d.label.toLowerCase());
    d.categories.forEach(c => {
      boldTerms.add(c.label.toLowerCase());
      c.label.split(',').forEach(p => {
        const clean = p.trim().toLowerCase();
        if (clean.length > 3) boldTerms.add(clean);
      });
    });
  });

  // Merchants / Shops (metriche/valori)
  const merchants = ['esselunga', 'coop', 'conad', 'carrefour', 'lidl', 'amazon', 'netflix', 'spotify', 'starbucks', 'mcdonald', 'mcdonalds', 'apple', 'uber', 'shein', 'zara', 'h&m'];
  merchants.forEach(m => boldTerms.add(m));

  // Social Context / People
  const social = ['friends', 'amici', 'family', 'famiglia', 'colleagues', 'colleghi', 'couple', 'coppia', 'alone', 'strangers', 'sconosciuti'];
  social.forEach(s => boldTerms.add(s));

  // Tags
  const tags = ['vacanza', 'lavoro', 'weekend', 'regalo', 'trasferta', 'impulsivo', 'personale'];
  tags.forEach(t => boldTerms.add(t));

  // Holidays
  const holidays = ['natale', 'pasqua', 'capodanno', 'ferragosto', 'halloween', 'compleanno'];
  holidays.forEach(h => boldTerms.add(h));

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
  patterns.push('[+-]?\\s*\\b\\d+(?:[.,]\\d+)?\\s*€');
  patterns.push('[+-]?\\s*€\\s*[+-]?\\s*\\d+(?:[.,]\\d+)?');
  patterns.push('[+-]?\\s*\\b\\d+(?:[.,]\\d+)?\\s*(?:euro|eur|EURO|EUR)\\b');
  patterns.push('\\b20\\d{2}\\b');

  const finalRegex = new RegExp('(' + patterns.join('|') + ')', 'gi');

  const parts = cleanText.split(finalRegex);
  return (
    <Text style={{ textAlign: 'left', fontSize, lineHeight: fontSize * 1.25 }}>
      {parts.map((part, index) => {
        if (index % 2 === 0) {
          // Testo naturale (azzurro opaco)
          return <Text key={index} style={{ color: '#BADBFF', fontSize }}>{part}</Text>;
        } else {
          // Voce evidenziata/metrica (bianco bold)
          return (
            <Text key={index} style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize }}>
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

  const insets = useSafeAreaInsets();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(10);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  }, [answer.text_response]);

  // Calcolo dinamico del font size
  const { width, height } = Dimensions.get('window');
  // Padding orizzontale di sicurezza (24px per lato)
  const availableWidth = width - 48;

  const words = answer.text_response.split(/[\s,.\n]+/);
  const maxWordLength = Math.max(...words.map(w => w.length), 1);
  // Fattore larghezza carattere (circa 0.58 del font size per Outfit Bold)
  const charWidthFactor = 0.58;
  const maxFontForWord = availableWidth / (maxWordLength * charWidthFactor);

  const totalLength = answer.text_response.length || 1;
  // Vincolo per assicurare che il blocco di testo non superi metà del viewport in altezza (height * 0.5)
  const maxFontForHalfViewport = Math.sqrt((height * 0.5 * availableWidth) / (totalLength * 0.68));

  let dynamicFontSize: number;

  if (!scrollable) {
    // OVERLAY VOCALE — scroll libero: usa solo il limite della parola più lunga.
    // Il testo può crescere quanto vuole, l'utente scorre.
    dynamicFontSize = Math.min(48, maxFontForWord, maxFontForHalfViewport);
    dynamicFontSize = Math.max(22, Math.floor(dynamicFontSize));
  } else {
    // CHAT TESTUALE — prova a far stare tutto senza scroll (comportamento precedente).
    const verticalOffsets = insets.top + insets.bottom + 200;
    const availableHeight = height - verticalOffsets;
    let widgetHeight = 0;
    if (answer.intent === 'distribution') widgetHeight = 280;
    else if (answer.intent === 'list') widgetHeight = 240;
    else if (answer.intent === 'timeline') widgetHeight = 200;
    else if (answer.intent === 'subscriptions') widgetHeight = 220;
    const targetTextHeight = Math.max(80, availableHeight - 30 - widgetHeight);
    const maxFontForHeight = Math.sqrt((targetTextHeight * availableWidth) / (totalLength * 0.65));
    dynamicFontSize = Math.min(45, maxFontForWord, maxFontForHeight, maxFontForHalfViewport);
    dynamicFontSize = Math.max(18, Math.floor(dynamicFontSize));
  }

  const renderJitWidget = (sub: AiChatResponse, index: number) => {
    return (
      <View key={index} style={{ width: '100%', marginBottom: 16 }}>
        {sub.intent === 'distribution' && sub.distribution_data && (
          <JitDistribution
            title={sub.distribution_data.title}
            items={sub.distribution_data.items}
          />
        )}

        {sub.intent === 'list' && sub.list_data && (
          <JitList
            title={sub.list_data.title}
            items={sub.list_data.items}
            totalCount={sub.list_data.total_count}
          />
        )}

        {sub.intent === 'timeline' && sub.timeline_data && (
          <JitTimeline
            type={sub.timeline_data.type}
            title={sub.timeline_data.title}
            data={sub.timeline_data.data}
            granularity={sub.timeline_data.granularity}
          />
        )}

        {sub.intent === 'subscriptions' && sub.subscription_data && (
          <JitSubscriptions
            items={sub.subscription_data.items}
            totalMonthly={sub.subscription_data.total_monthly}
          />
        )}
      </View>
    );
  };

  const intentsToHighlight: QueryIntent[] = [];
  if (answer.queryIntent) intentsToHighlight.push(answer.queryIntent);
  if (answer.subResponses) {
    answer.subResponses.forEach(sub => {
      if (sub.queryIntent) intentsToHighlight.push(sub.queryIntent);
    });
  }

  const body = (
    <>
      {/* Domanda utente — piccola in cima */}
      <View style={styles.questionContainer}>
        <Text style={styles.questionText}>{question}</Text>
      </View>

      {/* FeedbackBar — hidden per richiesta utente */}

      {/* Testo risposta principale con font size dinamico */}
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], width: '100%' }}>
        <Text style={[
          isTextOnly ? styles.bigAnswerText : styles.answerContextText, 
          textStyle, 
          { fontSize: dynamicFontSize, lineHeight: dynamicFontSize * 1.25 }
        ]}>
          {renderFormattedText(answer.text_response, intentsToHighlight, dynamicFontSize)}
        </Text>
      </Animated.View>

      {/* ── JIT Widgets ──────────────────────────────────────────────────── */}
      <View style={styles.jitWrapper}>
        {answer.subResponses && answer.subResponses.length > 0 ? (
          answer.subResponses.map((sub, idx) => renderJitWidget(sub, idx))
        ) : (
          renderJitWidget(answer, 0)
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
