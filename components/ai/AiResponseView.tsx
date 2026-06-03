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

  // 1. Cities (città) -> location pin icon
  const cities = new Set<string>(['milano', 'roma', 'torino', 'napoli', 'venezia', 'firenze', 'bologna', 'palermo', 'genova', 'bari']);
  if (queryIntent?.city_filter) cities.add(queryIntent.city_filter.toLowerCase());

  // 2. Tags (tag) -> flag icon
  const tags = new Set<string>(['vacanza', 'lavoro', 'weekend', 'regalo', 'trasferta', 'impulsivo', 'personale']);
  if (queryIntent?.tag_filter) tags.add(queryIntent.tag_filter.toLowerCase());

  // 3. Categories & Domains (categorie tutte uguali) -> folder icon
  const categories = new Set<string>();
  if (queryIntent?.category_filter) categories.add(queryIntent.category_filter.toLowerCase().replace(/_/g, ' '));
  if (queryIntent?.domain_filter) categories.add(queryIntent.domain_filter.toLowerCase().replace(/_/g, ' '));
  DOMAINS_CONFIG.forEach(d => {
    categories.add(d.label.toLowerCase());
    d.categories.forEach(c => {
      categories.add(c.label.toLowerCase());
      c.label.split(',').forEach(p => {
        const clean = p.trim().toLowerCase();
        if (clean.length > 3) categories.add(clean);
      });
    });
  });

  // 4. Merchants / Shops (negozi/merchant) -> cart icon
  const merchants = new Set<string>(['esselunga', 'coop', 'conad', 'carrefour', 'lidl', 'amazon', 'netflix', 'spotify', 'starbucks', 'mcdonald', 'mcdonalds', 'apple', 'uber', 'shein', 'zara', 'h&m']);
  if (queryIntent?.merchant_filter) merchants.add(queryIntent.merchant_filter.toLowerCase());

  // 5. Payment Methods (metodi di pagamento) -> card icon
  const paymentMethods = new Set<string>(['carta', 'bancomat', 'contanti', 'carta di credito', 'apple pay', 'google pay', 'paypal', 'bonifico']);

  // 6. Social Context / People (persone e contesti sociali) -> people icon
  const socialContexts = new Set<string>(['friends', 'amici', 'family', 'famiglia', 'colleagues', 'colleghi', 'couple', 'coppia', 'alone', 'solo', 'strangers', 'sconosciuti']);
  if (queryIntent?.social_context_filter) socialContexts.add(queryIntent.social_context_filter.toLowerCase());
  if (queryIntent?.person_filter) socialContexts.add(queryIntent.person_filter.toLowerCase());

  // 7. Holidays (festività) -> gift icon
  const holidays = new Set<string>(['natale', 'pasqua', 'capodanno', 'ferragosto', 'halloween', 'compleanno']);
  if (queryIntent?.holiday_filter) holidays.add(queryIntent.holiday_filter.toLowerCase());

  // 8. Subscriptions / Recurring (abbonamenti e ricorrenti) -> repeat icon
  const subscriptions = new Set<string>(['abbonamento', 'abbonamenti', 'ricorrente', 'mensile', 'annuale', 'netflix', 'spotify', 'prime', 'disney+']);

  // 9. Amounts / Financial terms (importi e voci finanziarie) -> cash/money icon
  const amounts = new Set<string>(['euro', 'eur', 'totale', 'totali', 'somma', 'media', 'medie', 'speso', 'spesa', 'spese', 'guadagno', 'guadagni', 'entrate']);

  const allTerms = [
    ...Array.from(cities).map(t => ({ text: t, type: 'city', icon: 'location-sharp', color: '#0A74FF' })),
    ...Array.from(tags).map(t => ({ text: t, type: 'tag', icon: 'flag-sharp', color: '#AF52DE' })),
    ...Array.from(categories).map(t => ({ text: t, type: 'category', icon: 'folder-sharp', color: '#34C759' })),
    ...Array.from(merchants).map(t => ({ text: t, type: 'merchant', icon: 'cart-sharp', color: '#FF2D55' })),
    ...Array.from(paymentMethods).map(t => ({ text: t, type: 'payment', icon: 'card-sharp', color: '#FF9500' })),
    ...Array.from(socialContexts).map(t => ({ text: t, type: 'social', icon: 'people-sharp', color: '#5AC8FA' })),
    ...Array.from(holidays).map(t => ({ text: t, type: 'holiday', icon: 'gift-sharp', color: '#FF3B30' })),
    ...Array.from(subscriptions).map(t => ({ text: t, type: 'subscription', icon: 'repeat-sharp', color: '#5856D6' })),
    ...Array.from(amounts).map(t => ({ text: t, type: 'amount', icon: 'cash-sharp', color: '#FFCC00' }))
  ]
    .filter(t => t.text && t.text.trim().length > 1)
    .sort((a, b) => b.text.length - a.text.length);

  if (allTerms.length === 0) {
    return <Text style={{ color: '#BADBFF' }}>{text}</Text>;
  }

  // Build combined regex using escaped patterns
  const patterns = allTerms.map(t => escapeRegExp(t.text));
  const regex = new RegExp('\\b(' + patterns.join('|') + ')\\b', 'gi');

  const parts = text.split(regex);
  return (
    <Text style={{ textAlign: 'left' }}>
      {parts.map((part, index) => {
        if (index % 2 === 0) {
          // Testo naturale (azzurro opaco)
          return <Text key={index} style={{ color: '#BADBFF' }}>{part}</Text>;
        } else {
          // Voce evidenziata (bianco bold)
          const lowerPart = part.toLowerCase();
          const match = allTerms.find(t => t.text === lowerPart || lowerPart.includes(t.text) || t.text.includes(lowerPart));
          
          if (match) {
            return (
              <Text key={index} style={{ color: '#FFFFFF', fontWeight: 'bold' }}>
                {part}
              </Text>
            );
          }
          return <Text key={index} style={{ color: '#BADBFF' }}>{part}</Text>;
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
    fontSize: 34,
    color: '#FFFFFF',
    textAlign: 'left',
    lineHeight: 44,
    marginTop: 8,
  },
  answerContextText: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 24,
    color: '#BADBFF',
    textAlign: 'left',
    lineHeight: 32,
    marginTop: 4,
  },
  jitWrapper: {
    marginTop: 32,
    alignItems: 'flex-start',
    width: '100%',
  },
});
