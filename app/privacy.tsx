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

export default function PrivacyScreen() {
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
        <Text style={styles.headerTitle}>Informativa Privacy</Text>
        {/* Spacer per centrare il titolo */}
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Badge aggiornamento */}
        <View style={styles.updateBadge}>
          <Ionicons name="time-outline" size={13} color="#0A74FF" />
          <Text style={styles.updateText}>Ultimo aggiornamento: 3 giugno 2026</Text>
        </View>

        {/* ─── 1. CHI SIAMO ─── */}
        <Section title="1. Chi Siamo" icon="person-circle-outline" iconColor="#0A74FF" iconBg="#EFF6FF">
          <Row label="Titolare del trattamento" value="Alessandro Gentile" />
          <Row label="Email" value="obbycourses@gmail.com" />
          <Row label="Indirizzo" value="Monza, Italia" />
          <InfoBox>
            Sono uno sviluppatore indipendente che sviluppa e gestisce Wolly, un'app per la
            gestione personale delle finanze, attualmente in fase di beta testing.
          </InfoBox>
        </Section>

        {/* ─── 2. DATI RACCOLTI ─── */}
        <Section title="2. Dati Raccolti" icon="list-outline" iconColor="#8B5CF6" iconBg="#F3EFFF">
          <SectionSubtitle>A) Dati che ci fornisci volontariamente</SectionSubtitle>
          <BulletItem>
            <Text style={styles.bulletText}><Text style={styles.bold}>Email</Text> — fornita tramite il tuo account Google al momento dell'accesso.</Text>
          </BulletItem>

          <SectionSubtitle>B) Dati raccolti automaticamente</SectionSubtitle>
          <BulletItem>
            <Text style={styles.bulletText}><Text style={styles.bold}>Indirizzo IP</Text> — tramite Supabase, solo per sicurezza e prevenzione abusi.</Text>
          </BulletItem>
          <BulletItem>
            <Text style={styles.bulletText}><Text style={styles.bold}>Log AI anonimi</Text> — numero di richieste all'IA (senza il testo), per monitorare i costi del servizio. Non includono device ID né user ID.</Text>
          </BulletItem>
          <BulletItem>
            <Text style={styles.bulletText}><Text style={styles.bold}>Dati finanziari</Text> — transazioni, patrimonio, abbonamenti — salvati <Text style={styles.bold}>esclusivamente in locale</Text> sul dispositivo (SQLite). Non vengono mai inviati al cloud.</Text>
          </BulletItem>

          <InfoBox>
            🔒 Non raccogliamo informazioni sul modello del dispositivo, sistema operativo,
            comportamento di navigazione o dati di utilizzo dettagliati.
          </InfoBox>
        </Section>

        {/* ─── 3. FINALITÀ ─── */}
        <Section title="3. Finalità del Trattamento" icon="shield-checkmark-outline" iconColor="#059669" iconBg="#ECFDF5">
          <TableHeader col1="Finalità" col2="Base giuridica" />
          <TableRow col1="Accesso all'app" col2="Esecuzione contratto" />
          <TableRow col1="Autenticazione Google" col2="Consenso esplicito" />
          <TableRow col1="Log anonimi AI" col2="Interesse legittimo (costi)" isLast />
        </Section>

        {/* ─── 4. CONSERVAZIONE ─── */}
        <Section title="4. Conservazione dei Dati" icon="calendar-outline" iconColor="#F59E0B" iconBg="#FFFBEB">
          <BulletItem>
            <Text style={styles.bulletText}><Text style={styles.bold}>Email</Text> — conservata fino alla cancellazione dell'account.</Text>
          </BulletItem>
          <BulletItem>
            <Text style={styles.bulletText}><Text style={styles.bold}>Log AI anonimi</Text> — conservati per 90 giorni, poi eliminati automaticamente.</Text>
          </BulletItem>
          <BulletItem>
            <Text style={styles.bulletText}><Text style={styles.bold}>Dati finanziari</Text> — solo locali, rimangono sul dispositivo finché non cancelli l'app o richiedi la cancellazione dell'account.</Text>
          </BulletItem>
          <InfoBox>
            Dopo la cancellazione dell'account, tutti i dati cloud vengono eliminati entro 48 ore.
          </InfoBox>
        </Section>

        {/* ─── 5. CONDIVISIONE ─── */}
        <Section title="5. Con Chi Condividiamo i Dati" icon="share-social-outline" iconColor="#EC4899" iconBg="#FDF2F8">
          <InfoBox>❌ Non vendiamo mai i tuoi dati a terzi.</InfoBox>
          <Text style={[styles.bodyText, { marginBottom: 10 }]}>Condividiamo i dati esclusivamente con i seguenti fornitori tecnici:</Text>
          <TableHeader col1="Fornitore" col2="Finalità" />
          <TableRow col1="Supabase (USA)" col2="Autenticazione e database cloud" />
          <TableRow col1="Google OAuth" col2="Accesso con account Google" />
          <TableRow col1="Groq (USA)" col2="Elaborazione richieste AI (solo transito)" isLast />
        </Section>

        {/* ─── 6. TRASFERIMENTO EXTRA-UE ─── */}
        <Section title="6. Trasferimento Dati Extra-UE" icon="globe-outline" iconColor="#06B6D4" iconBg="#ECFEFF">
          <InfoBox type="warning">
            ⚠️ Alcuni fornitori (Supabase, Google, Groq) hanno server negli USA. Il trasferimento è
            garantito da Clausole Contrattuali Standard UE e dalle certificazioni DPF (Data Privacy Framework).
          </InfoBox>
          <BulletItem>
            <Text style={styles.bulletText}><Text style={styles.bold}>Supabase</Text>: Privacy Policy su supabase.com/privacy</Text>
          </BulletItem>
          <BulletItem>
            <Text style={styles.bulletText}><Text style={styles.bold}>Google</Text>: policies.google.com/privacy</Text>
          </BulletItem>
          <BulletItem>
            <Text style={styles.bulletText}><Text style={styles.bold}>Groq</Text>: groq.com/privacy</Text>
          </BulletItem>
        </Section>

        {/* ─── 7. DIRITTI UTENTE ─── */}
        <Section title="7. I Tuoi Diritti (GDPR)" icon="hand-left-outline" iconColor="#0A74FF" iconBg="#EFF6FF">
          <BulletItem><Text style={styles.bulletText}><Text style={styles.bold}>Accesso</Text> — Puoi chiederci quali dati abbiamo su di te.</Text></BulletItem>
          <BulletItem><Text style={styles.bulletText}><Text style={styles.bold}>Cancellazione</Text> — "Diritto all'oblio": elimina tutto tramite Impostazioni → Elimina account.</Text></BulletItem>
          <BulletItem><Text style={styles.bulletText}><Text style={styles.bold}>Rettifica</Text> — Puoi richiedere la correzione di dati errati.</Text></BulletItem>
          <BulletItem><Text style={styles.bulletText}><Text style={styles.bold}>Portabilità</Text> — Ricevi una copia dei tuoi dati in formato leggibile.</Text></BulletItem>
          <BulletItem><Text style={styles.bulletText}><Text style={styles.bold}>Opposizione</Text> — Puoi opporti al trattamento in qualsiasi momento.</Text></BulletItem>

          {/* CTA contatto */}
          <View style={styles.contactBox}>
            <Ionicons name="mail-outline" size={18} color="#0A74FF" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.contactTitle}>Come esercitare i tuoi diritti</Text>
              <Text style={styles.contactSub}>
                Scrivi a{' '}
                <Text style={styles.contactEmail}>obbycourses@gmail.com</Text>
                {'\n'}con oggetto "DIRITTI PRIVACY". Risposta entro 30 giorni.
              </Text>
            </View>
          </View>
        </Section>

        {/* ─── 8. SICUREZZA ─── */}
        <Section title="8. Sicurezza dei Dati" icon="lock-closed-outline" iconColor="#34C759" iconBg="#EDFAF1">
          <BulletItem><Text style={styles.bulletText}>Crittografia TLS per tutti i dati in transito.</Text></BulletItem>
          <BulletItem><Text style={styles.bulletText}>Database cloud con autenticazione sicura (Row Level Security su Supabase).</Text></BulletItem>
          <BulletItem><Text style={styles.bulletText}>Dati finanziari mai trasmessi al cloud.</Text></BulletItem>
          <BulletItem><Text style={styles.bulletText}>Accesso ai dati cloud limitato al solo sviluppatore.</Text></BulletItem>
          <InfoBox type="warning">
            Nessun sistema è sicuro al 100%. In caso di violazione significativa, sarai notificato entro 72 ore.
          </InfoBox>
        </Section>

        {/* ─── 9. COOKIE ─── */}
        <Section title="9. Cookie e Tracciamento" icon="radio-button-off-outline" iconColor="#8E8E93" iconBg="#F2F2F7">
          <BulletItem><Text style={styles.bulletText}>Nessun cookie di profilazione o marketing.</Text></BulletItem>
          <BulletItem><Text style={styles.bulletText}>Usiamo solo token tecnici di sessione (Supabase Auth), necessari per il funzionamento dell'accesso.</Text></BulletItem>
          <BulletItem><Text style={styles.bulletText}>Firebase Analytics: <Text style={styles.bold}>disabilitato</Text> in questa versione beta.</Text></BulletItem>
        </Section>

        {/* ─── 10. MINORI ─── */}
        <Section title="10. Dati dei Minori" icon="happy-outline" iconColor="#F59E0B" iconBg="#FFFBEB">
          <InfoBox>
            Wolly non è destinata a minori di 14 anni. Non raccogliamo consapevolmente dati di minori.
            Se ritieni che un minore abbia fornito dati, contattaci immediatamente per la cancellazione.
          </InfoBox>
        </Section>

        {/* ─── 11. AGGIORNAMENTI ─── */}
        <Section title="11. Aggiornamenti" icon="refresh-outline" iconColor="#0A74FF" iconBg="#EFF6FF">
          <Text style={styles.bodyText}>
            Questa informativa può essere aggiornata quando cambiano le leggi, le funzionalità dell'app
            o i fornitori di servizi. La data in cima al documento indica l'ultima revisione.
          </Text>
          <Text style={[styles.bodyText, { marginTop: 8 }]}>
            Per cambiamenti significativi, ti notificheremo tramite l'app o via email.
          </Text>
        </Section>

        {/* ─── 12. CONTATTI ─── */}
        <Section title="12. Contattaci" icon="chatbubble-ellipses-outline" iconColor="#EC4899" iconBg="#FDF2F8">
          <Row label="Email" value="obbycourses@gmail.com" />
          <Row label="Sviluppatore" value="Alessandro Gentile" />
          <Row label="Sede" value="Monza, Italia" />
        </Section>

        {/* Footer legale */}
        <View style={styles.legalFooter}>
          <Text style={styles.legalFooterText}>
            Documento redatto in conformità al Regolamento UE 2016/679 (GDPR)
            e al D.Lgs. 196/2003 (Codice Privacy italiano).
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

function SectionSubtitle({ children }: { children: string }) {
  return <Text style={sectionStyles.subtitle}>{children}</Text>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value}>{value}</Text>
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

function TableHeader({ col1, col2 }: { col1: string; col2: string }) {
  return (
    <View style={tableStyles.header}>
      <Text style={[tableStyles.col, tableStyles.headerText, { flex: 1 }]}>{col1}</Text>
      <Text style={[tableStyles.col, tableStyles.headerText, { flex: 1.5 }]}>{col2}</Text>
    </View>
  );
}

function TableRow({
  col1,
  col2,
  isLast,
}: {
  col1: string;
  col2: string;
  isLast?: boolean;
}) {
  return (
    <View style={[tableStyles.row, isLast && tableStyles.rowLast]}>
      <Text style={[tableStyles.col, tableStyles.cell, { flex: 1 }]}>{col1}</Text>
      <Text style={[tableStyles.col, tableStyles.cellMuted, { flex: 1.5 }]}>{col2}</Text>
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
  updateBadge: {
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
  updateText: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#0A74FF',
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
  contactBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  contactTitle: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
  },
  contactSub: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
    marginTop: 3,
    lineHeight: 18,
  },
  contactEmail: {
    color: '#0A74FF',
    fontFamily: TYPOGRAPHY.fontBold,
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
  subtitle: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 4,
  },
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  label: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
  },
  value: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 8,
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

const tableStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  col: {
    paddingHorizontal: 2,
  },
  headerText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cell: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
  },
  cellMuted: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
  },
});
