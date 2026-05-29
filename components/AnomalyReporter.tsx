import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, Pressable, TextInput,
  Modal, ActivityIndicator, Alert, Platform, KeyboardAvoidingView, Keyboard
} from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SHADOWS, SPACING } from '../constants/Theme';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { voiceStore } from '../services/voiceStore';
import Constants from 'expo-constants';

interface AnomalyReporterProps {
  forcePosition?: 'left' | 'right';
  inline?: boolean;
  isWhite?: boolean;
  renderTrigger?: (open: () => void) => React.ReactNode;
}

export default function AnomalyReporter({ forcePosition, inline = false, isWhite = false, renderTrigger }: AnomalyReporterProps = {}) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [modalVisible, setModalVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [section, setSection] = useState('generale');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(voiceStore.getState().isOpen);
  const appVersion = Constants.expoConfig?.version || '0.2.0';

  const sectionLabels: Record<string, string> = {
    generale: "Generale / Altro",
    home: "Schermata Home",
    transazioni: "Transazioni (Spese/Guadagni)",
    statistiche: "Statistiche e Grafici",
    abbonamenti: "Abbonamenti",
    ai_chat: "Assistente IA (Chat/Voce)",
    impostazioni: "Impostazioni",
  };

  const SECTIONS = [
    { label: "Generale / Altro", value: "generale" },
    { label: "Schermata Home", value: "home" },
    { label: "Transazioni (Spese/Guadagni)", value: "transazioni" },
    { label: "Statistiche e Grafici", value: "statistiche" },
    { label: "Abbonamenti", value: "abbonamenti" },
    { label: "Assistente IA (Chat/Voce)", value: "ai_chat" },
    { label: "Impostazioni", value: "impostazioni" },
  ];

  useEffect(() => {
    const unsub = voiceStore.subscribe(() => {
      setVoiceOpen(voiceStore.getState().isOpen);
    });
    return () => {
      unsub();
    };
  }, []);

  // Logica di posizionamento condizionale del pulsante:
  // In expense-detail (Modifica transazione) e nelle rotte di transazione ci sono già pulsanti
  // nell'angolo in alto a destra. Spostiamo il tasto bug a sinistra per evitare sovrapposizioni.
  const isDetailScreen = pathname.includes('/expense-detail') || pathname.includes('/transaction');
  
  // Se siamo in una delle schermate con pulsante integrato in linea (testata),
  // nascondiamo il pulsante fluttuante globale.
  const isSubscriptionsScreen = pathname === '/subscriptions';
  if (!renderTrigger && !inline && (isDetailScreen || isSubscriptionsScreen)) {
    return null;
  }

  // Allineiamo a sinistra se specificato esplicitamente o se siamo in una schermata di dettaglio transazione
  const alignLeft = forcePosition === 'left' || (forcePosition === undefined && isDetailScreen);

  const handleOpen = () => {
    if (!isSupabaseConfigured()) {
      Alert.alert(
        'Supabase Non Configurato',
        'Per poter segnalare anomalie o tracciare i KPI, configura le credenziali di Supabase nel file `.env`:\n\n' +
        '1. Imposta EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY con le tue chiavi reali.\n' +
        '2. Ferma il server Expo corrente (Ctrl+C) e riavvialo cancellando la cache:\n' +
        'npx expo start --clear\n\n' +
        'Se hai già modificato il file .env, il riavvio completo di Metro risolverà il problema.',
        [{ text: 'Ho Capito' }]
      );
      return;
    }
    setMessage('');
    setSection('generale');
    setShowDropdown(false);
    setIsSuccess(false);
    setModalVisible(true);
  };

  const handleClose = () => {
    Keyboard.dismiss();
    setShowDropdown(false);
    setIsSuccess(false);
    setModalVisible(false);
  };

  const handleSend = async () => {
    if (!isSupabaseConfigured()) {
      Alert.alert(
        'Errore di Configurazione',
        'Supabase non risulta configurato correttamente nel file `.env`.'
      );
      return;
    }

    const cleanMsg = message.trim();
    if (!cleanMsg) {
      Alert.alert('Attenzione', 'Inserisci una descrizione per segnalare l\'anomalia.');
      return;
    }

    setIsSending(true);
    Keyboard.dismiss();

    const normalizePageRoute = (path: string): string => {
      if (path.includes('/expense-detail') || path.includes('/transaction/')) {
        return '/transaction/';
      }
      return path;
    };

    try {
      const sectionDbLabels: Record<string, string> = {
        generale: "Generale",
        home: "Home",
        transazioni: "Transazioni",
        statistiche: "Statistiche",
        abbonamenti: "Abbonamenti",
        ai_chat: "Assistente IA",
        impostazioni: "Impostazioni",
      };

      const sectionLabel = sectionDbLabels[section] || section;

      const insertData: any = {
        page_route: voiceOpen ? '/voice-chat' : normalizePageRoute(pathname),
        message: `[Sezione: ${sectionLabel}] ${cleanMsg}`,
        device_os: Platform.OS,
        app_version: appVersion,
        section: section,
      };

      let { error } = await supabase.from('anomaly_reports').insert(insertData);

      // Fallback: se la colonna "section" non esiste su Supabase, rimuovila e riprova
      if (error && (
        error.message.includes('column') || 
        error.message.includes('find the table') || 
        error.message.includes('schema cache') || 
        error.message.includes('does not exist')
      )) {
        console.warn('[AnomalyReporter] Fallback: Riprovo l\'inserimento senza colonna "section"...');
        delete insertData.section;
        const retry = await supabase.from('anomaly_reports').insert(insertData);
        error = retry.error;
      }

      if (error) {
        throw new Error(error.message);
      }

      setIsSuccess(true);
      setTimeout(() => {
        setModalVisible(false);
        setIsSuccess(false);
      }, 2000);
    } catch (err: any) {
      console.error('[AnomalyReporter Error] Errore di invio:', err);
      Alert.alert(
        'Errore di Invio',
        'Impossibile inviare la segnalazione a causa di un problema di rete. Riprova più tardi.'
      );
    } finally {
      setIsSending(false);
    }
  };

  let triggerElement: React.ReactNode = null;

  if (renderTrigger) {
    triggerElement = renderTrigger(handleOpen);
  } else if (inline) {
    triggerElement = (
      <Pressable
        onPress={handleOpen}
        style={{
          padding: 8,
          borderRadius: 10,
          backgroundColor: isWhite ? 'rgba(255, 255, 255, 0.15)' : 'rgba(239, 68, 68, 0.1)', // sfumato bianco o rosso opaco premium
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 6,
        }}
      >
        <Ionicons name="flag" size={18} color={isWhite ? '#FFFFFF' : '#EF4444'} />
      </Pressable>
    );
  } else {
    triggerElement = (
      <Pressable
        onPress={handleOpen}
        style={[
          styles.bugButton,
          {
            top: Platform.OS === 'ios' ? insets.top + 4 : insets.top + 12,
          },
          alignLeft
            ? { left: Platform.OS === 'ios' ? 52 : 56 }
            : { right: 16 }
        ]}
      >
        <Ionicons name="flag" size={16} color="#FFF" />
      </Pressable>
    );
  }

  return (
    <>
      {triggerElement}

      {/* Unified Banner / Modal di segnalazione */}
      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={handleClose}
      >
        <Pressable style={styles.overlay} onPress={handleClose}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoid}
          >
            {/* Impediamo al tocco sulla card di chiudere il modal */}
            <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
              {isSuccess ? (
                <View style={styles.successContainer}>
                  <Ionicons name="checkmark-circle" size={80} color="#34C759" style={styles.successIcon} />
                  <Text style={styles.successTitle}>Inviato con successo!</Text>
                  <Text style={styles.successSubtitle}>Grazie per averci aiutato a migliorare Wolly 💙</Text>
                </View>
              ) : (
                <>
                  {/* Header - Rimosso il pulsante X di chiusura */}
                  <View style={styles.cardHeader}>
                    <Ionicons name="flag" size={22} color={COLORS.danger} style={{ marginRight: 8 }} />
                    <Text style={styles.cardTitle}>Segnala un'Anomalia</Text>
                  </View>

                  <Text style={styles.cardSubtitle}>
                    Aiutaci a migliorare Wolly. Scegli la sezione dell'app ed inserisci una descrizione.
                  </Text>

                  {/* Menu a tendina nativo iOS/Android per scegliere la sezione */}
                  <Text style={styles.fieldLabel}>Sezione dell'App</Text>
                  
                  <Pressable 
                    style={styles.dropdownTrigger} 
                    onPress={() => {
                      Keyboard.dismiss();
                      setShowDropdown(!showDropdown);
                    }}
                  >
                    <Text style={styles.dropdownTriggerText}>
                      {sectionLabels[section] || "Seleziona..."}
                    </Text>
                    <Ionicons 
                      name={showDropdown ? "chevron-up" : "chevron-down"} 
                      size={16} 
                      color={COLORS.primary} 
                    />
                  </Pressable>

                  {showDropdown && (
                    <View style={styles.dropdownMenu}>
                      {SECTIONS.map((item) => (
                        <Pressable
                          key={item.value}
                          style={[
                            styles.dropdownItem,
                            section === item.value && styles.dropdownItemActive
                          ]}
                          onPress={() => {
                            setSection(item.value);
                            setShowDropdown(false);
                          }}
                        >
                          <Text style={[
                            styles.dropdownItemText,
                            section === item.value && styles.dropdownItemTextActive
                          ]}>
                            {item.label}
                          </Text>
                          {section === item.value && (
                            <Ionicons name="checkmark" size={16} color={COLORS.primary} />
                          )}
                        </Pressable>
                      ))}
                    </View>
                  )}

                  {/* Messaggio Input */}
                  <Text style={styles.fieldLabel}>Descrizione</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="es. Il grafico delle spese non mostra le colonne corrette..."
                    placeholderTextColor={COLORS.secondary + '60'}
                    value={message}
                    onChangeText={setMessage}
                    multiline={true}
                    numberOfLines={4}
                    maxLength={500}
                    autoFocus={true}
                    textAlignVertical="top"
                  />

                  {/* Bottoni d'azione - Grandi uguali, occupano tutto lo spazio orizzontale */}
                  <View style={styles.actionsRow}>
                    <Pressable
                      onPress={handleClose}
                      disabled={isSending}
                      style={[styles.btn, styles.btnCancel]}
                    >
                      <Text style={styles.btnCancelText}>Annulla</Text>
                    </Pressable>

                    <Pressable
                      onPress={handleSend}
                      disabled={isSending}
                      style={[styles.btn, styles.btnSend, isSending && { opacity: 0.7 }]}
                    >
                      {isSending ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text style={styles.btnSendText}>Invia</Text>
                      )}
                    </Pressable>
                  </View>
                </>
              )}

            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bugButton: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(239, 68, 68, 0.9)', // Sfondo rosso opaco premium
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    ...SHADOWS.soft,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)', // Sfumatura scura delicata premium
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  keyboardAvoid: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.medium,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
    flex: 1,
  },
  cardSubtitle: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
    marginBottom: 6,
    marginLeft: 2,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 14,
  },
  dropdownTriggerText: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.primary,
  },
  dropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 6,
    marginBottom: 14,
    ...SHADOWS.soft,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dropdownItemActive: {
    backgroundColor: '#F3F4F6',
  },
  dropdownItemText: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
  },
  dropdownItemTextActive: {
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
  },
  successContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  successIcon: {
    marginBottom: 16,
    shadowColor: '#34C759',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  successTitle: {
    fontSize: 19,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  textInput: {
    height: 100,
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 12,
    fontSize: 14,
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.fontFamily,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginTop: 6,
  },
  btn: {
    flex: 1, // fa sì che i bottoni siano grandi uguali occupando tutto orizzontalmente
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancel: {
    backgroundColor: '#F3F4F6',
  },
  btnCancelText: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.secondary,
  },
  btnSend: {
    backgroundColor: COLORS.primary,
    ...SHADOWS.soft,
  },
  btnSendText: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#FFF',
  },
});
