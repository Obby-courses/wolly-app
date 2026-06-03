import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from '../constants/Theme';

export default function TermsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
          <Text style={styles.backLabel}>Indietro</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Termini di Utilizzo Beta</Text>
        {/* Spacer per centrare il titolo */}
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Badge versione */}
        <View style={styles.versionBadge}>
          <Ionicons name="git-branch-outline" size={13} color="#0A74FF" />
          <Text style={styles.versionText}>Versione Beta: 1.0 (3 giugno 2026)</Text>
        </View>

        <Text style={styles.introText}>
          Benvenuto su Wolly. I presenti Termini di Utilizzo regolano l'accesso e l'uso dell'applicazione
          in versione Beta. Ti invitiamo a leggerli attentamente prima di procedere.
        </Text>

        {/* ─── 1. OGGETTO E NATURA BETA ─── */}
        <Section title="1. Natura del Software Beta" icon="construct-outline" iconColor="#0A74FF" iconBg="#EFF6FF">
          <InfoBox type="warning">
            ⚠️ Wolly è attualmente distribuito come software in versione Beta. Viene fornito
            esclusivamente a scopo di test, valutazione e raccolta di feedback.
          </InfoBox>
          <BulletItem>
            <Text style={styles.bulletText}>
              <Text style={styles.bold}>Presenza di bug</Text>: Trattandosi di una versione preliminare,
              l'applicazione potrebbe presentare bug, errori, anomalie di funzionamento, o subire interruzioni improvvise.
            </Text>
          </BulletItem>
          <BulletItem>
            <Text style={styles.bulletText}>
              <Text style={styles.bold}>Nessuna garanzia</Text>: Il servizio è fornito "così com'è" e "come disponibile",
              senza alcuna garanzia di funzionamento, continuità o idoneità a scopi specifici.
            </Text>
          </BulletItem>
        </Section>

        {/* ─── 2. LIMITAZIONE DI RESPONSABILITÀ ─── */}
        <Section title="2. Limitazione di Responsabilità" icon="alert-circle-outline" iconColor="#EF4444" iconBg="#FEE2E2">
          <BulletItem>
            <Text style={styles.bulletText}>
              In nessun caso lo sviluppatore potrà essere ritenuto responsabile per danni diretti, indiretti,
              speciali, accidentali o consequenziali (inclusi, a titolo esemplificativo, perdita di dati, errori di calcolo finanziario
              o malfunzionamento del dispositivo) derivanti dall'uso o dall'impossibilità di usare l'applicazione.
            </Text>
          </BulletItem>
          <BulletItem>
            <Text style={styles.bulletText}>
              L'utente è l'unico responsabile della verifica e dell'accuratezza dei dati inseriti e dei calcoli
              presentati dall'applicazione per la gestione del proprio budget.
            </Text>
          </BulletItem>
        </Section>

        {/* ─── 3. ESCLUSIONE CONSULENZA FINANZIARIA ─── */}
        <Section title="3. Nessuna Consulenza Finanziaria" icon="trending-up-outline" iconColor="#059669" iconBg="#ECFDF5">
          <InfoBox>
            💡 I contenuti generati dall'assistente IA di Wolly, i report, le risposte e le analisi
            visualizzate nell'applicazione hanno scopo puramente informativo e illustrativo.
          </InfoBox>
          <BulletItem>
            <Text style={styles.bulletText}>
              <Text style={styles.bold}>Non è consulenza</Text>: Nessun dato o risposta IA costituisce, né può essere inteso come,
              una consulenza finanziaria, legale, fiscale o d'investimento.
            </Text>
          </BulletItem>
          <BulletItem>
            <Text style={styles.bulletText}>
              Ti invitiamo a consultare professionisti qualificati prima di prendere qualsiasi decisione finanziaria o di investimento rilevante.
            </Text>
          </BulletItem>
        </Section>

        {/* ─── 4. REQUISITI DI ACCESSO ─── */}
        <Section title="4. Requisiti e Account" icon="person-outline" iconColor="#8B5CF6" iconBg="#F3EFFF">
          <BulletItem>
            <Text style={styles.bulletText}>
              <Text style={styles.bold}>Età minima</Text>: L'uso dell'applicazione è consentito esclusivamente a utenti
              che abbiano compiuto almeno 14 anni.
            </Text>
          </BulletItem>
          <BulletItem>
            <Text style={styles.bulletText}>
              <Text style={styles.bold}>Account Google</Text>: L'accesso alla demo richiede l'autenticazione tramite
              un account Google valido.
            </Text>
          </BulletItem>
        </Section>

        {/* ─── 5. SOSPENSIONE E MODIFICHE ─── */}
        <Section title="5. Sospensione e Modifiche del Servizio" icon="stop-circle-outline" iconColor="#F59E0B" iconBg="#FFFBEB">
          <BulletItem>
            <Text style={styles.bulletText}>
              Lo sviluppatore si riserva il diritto unilaterale di modificare, sospendere, interrompere temporaneamente
              o definitivamente l'accesso alla versione Beta dell'applicazione (o a singole funzionalità, come l'assistente IA)
              in qualsiasi momento e senza preavviso.
            </Text>
          </BulletItem>
          <BulletItem>
            <Text style={styles.bulletText}>
              Gli account utente contrassegnati come abusivi, o che superano le soglie di utilizzo previste (ad esempio,
              il limite di 500 richieste mensili all'IA), possono essere sospesi o limitati per preservare la stabilità del servizio.
            </Text>
          </BulletItem>
        </Section>

        {/* ─── 6. FEEDBACK E PROPRIETÀ INTELLETTUALE ─── */}
        <Section title="6. Feedback e Proprietà" icon="chatbubble-outline" iconColor="#EC4899" iconBg="#FDF2F8">
          <Text style={styles.bodyText}>
            L'invio di suggerimenti, segnalazioni di bug o feedback attribuisce allo sviluppatore il diritto gratuito
            e perpetuo di utilizzare tali informazioni per migliorare l'applicazione, senza alcun obbligo di compenso o attribuzione.
          </Text>
          <Text style={[styles.bodyText, { marginTop: 8 }]}>
            Tutti i marchi, la grafica, i loghi e il codice sorgente di Wolly sono di proprietà esclusiva dello sviluppatore.
          </Text>
        </Section>

        {/* ─── 7. MODIFICHE AI TERMINI ─── */}
        <Section title="7. Modifiche ai Termini" icon="document-text-outline" iconColor="#06B6D4" iconBg="#ECFEFF">
          <Text style={styles.bodyText}>
            Questi termini possono essere aggiornati periodicamente per riflettere modifiche normative, evoluzioni tecniche
            o cambi nel modello di servizio.
          </Text>
          <Text style={[styles.bodyText, { marginTop: 8 }]}>
            L'uso continuato dell'app dopo la pubblicazione delle modifiche costituisce accettazione dei nuovi termini.
          </Text>
        </Section>

        {/* ─── 8. CONTATTI ─── */}
        <Section title="8. Contatti" icon="mail-outline" iconColor="#8E8E93" iconBg="#F2F2F7">
          <Text style={styles.bodyText}>
            Per qualsiasi comunicazione, segnalazione o richiesta relativa ai presenti Termini di Utilizzo,
            puoi scrivere a:
          </Text>
          <View style={styles.emailRow}>
            <Ionicons name="mail" size={16} color="#0A74FF" />
            <Text style={styles.emailText}>obbycourses@gmail.com</Text>
          </View>
        </Section>

        {/* Footer legale */}
        <View style={styles.legalFooter}>
          <Text style={styles.legalFooterText}>
            Grazie per aver partecipato alla beta di Wolly e per aiutarci a renderla un'app migliore!
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Sub-componenti ─────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  iconColor,
  iconBg,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  children: React.ReactNode;
}) {
  return (
    <View style={sectionStyles.wrapper}>
      <View style={sectionStyles.titleRow}>
        <View style={[sectionStyles.iconBadge, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={16} color={iconColor} />
        </View>
        <Text style={sectionStyles.title}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function BulletItem({ children }: { children: React.ReactNode }) {
  return (
    <View style={bulletStyles.row}>
      <View style={bulletStyles.dot} />
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

function InfoBox({
  children,
  type = 'info',
}: {
  children: React.ReactNode;
  type?: 'info' | 'warning';
}) {
  const bg = type === 'warning' ? '#FFFBEB' : '#F0F7FF';
  const border = type === 'warning' ? '#FDE68A' : '#BFDBFE';
  return (
    <View style={[infoBoxStyles.box, { backgroundColor: bg, borderColor: border }]}>
      <Text style={infoBoxStyles.text}>{children}</Text>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    ...SHADOWS.soft,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minWidth: 80,
  },
  backLabel: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: '#0A74FF',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
  },
  headerSpacer: {
    minWidth: 80,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 12,
  },
  versionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 4,
  },
  versionText: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#0A74FF',
  },
  introText: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.primary,
    lineHeight: 21,
    marginBottom: 4,
  },
  bodyText: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
    lineHeight: 21,
  },
  bold: {
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
  },
  bulletText: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
    lineHeight: 21,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  emailText: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#0A74FF',
  },
  legalFooter: {
    marginTop: 8,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
  },
  legalFooterText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
    textAlign: 'center',
    lineHeight: 16,
  },
});

const sectionStyles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    ...SHADOWS.soft,
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  iconBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
  },
});

const bulletStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0A74FF',
    marginTop: 8,
  },
});

const infoBoxStyles = StyleSheet.create({
  box: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginVertical: 2,
  },
  text: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
    lineHeight: 19,
  },
});
