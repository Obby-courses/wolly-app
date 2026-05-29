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
  const [isSending, setIsSending] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(voiceStore.getState().isOpen);
  const appVersion = Constants.expoConfig?.version || '0.2.0';

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
    setModalVisible(true);
  };

  const handleClose = () => {
    Keyboard.dismiss();
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
      const { error } = await supabase.from('anomaly_reports').insert({
        page_route: voiceOpen ? '/voice-chat' : normalizePageRoute(pathname),
        message: cleanMsg,
        device_os: Platform.OS,
        app_version: appVersion,
      });

      if (error) {
        throw new Error(error.message);
      }

      Alert.alert(
        'Segnalazione Inviata',
        'Grazie per il supporto! 💙\nLa tua segnalazione aiuterà a migliorare Wolly.',
        [{ text: 'Ottimo', onPress: () => setModalVisible(false) }]
      );
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

  if (renderTrigger) {
    return (
      <>
        {renderTrigger(handleOpen)}

        {/* Banner / Modal di segnalazione */}
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
                
                {/* Header */}
                <View style={styles.cardHeader}>
                  <Ionicons name="flag" size={22} color={COLORS.danger} style={{ marginRight: 8 }} />
                  <Text style={styles.cardTitle}>Segnala un'Anomalia</Text>
                  <Pressable onPress={handleClose} style={styles.closeIcon}>
                    <Ionicons name="close" size={20} color={COLORS.secondary} />
                  </Pressable>
                </View>

                <Text style={styles.cardSubtitle}>
                  Aiutaci a migliorare Wolly. Descrivi brevemente cosa non funziona.
                </Text>

                {/* Messaggio Input */}
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

                {/* Bottoni d'azione */}
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

              </Pressable>
            </KeyboardAvoidingView>
          </Pressable>
        </Modal>
      </>
    );
  }

  if (inline) {
    return (
      <>
        {/* Pulsante in linea per Header */}
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

        {/* Banner / Modal di segnalazione */}
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
                
                {/* Header */}
                <View style={styles.cardHeader}>
                  <Ionicons name="flag" size={22} color={COLORS.danger} style={{ marginRight: 8 }} />
                  <Text style={styles.cardTitle}>Segnala un'Anomalia</Text>
                  <Pressable onPress={handleClose} style={styles.closeIcon}>
                    <Ionicons name="close" size={20} color={COLORS.secondary} />
                  </Pressable>
                </View>

                <Text style={styles.cardSubtitle}>
                  Aiutaci a migliorare Wolly. Descrivi brevemente cosa non funziona.
                </Text>

                {/* Messaggio Input */}
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

                {/* Bottoni d'azione */}
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

              </Pressable>
            </KeyboardAvoidingView>
          </Pressable>
        </Modal>
      </>
    );
  }

  return (
    <>
      {/* Pulsante Bug Fluttuante Centralizzato ed Elegante */}
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

      {/* Banner / Modal di segnalazione */}
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
              
              {/* Header */}
              <View style={styles.cardHeader}>
                <Ionicons name="flag" size={22} color={COLORS.danger} style={{ marginRight: 8 }} />
                <Text style={styles.cardTitle}>Segnala un'Anomalia</Text>
                <Pressable onPress={handleClose} style={styles.closeIcon}>
                  <Ionicons name="close" size={20} color={COLORS.secondary} />
                </Pressable>
              </View>

              <Text style={styles.cardSubtitle}>
                Aiutaci a migliorare Wolly. Descrivi brevemente cosa non funziona.
              </Text>

              {/* Messaggio Input */}
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

              {/* Bottoni d'azione */}
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
  closeIcon: {
    padding: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.secondary,
    lineHeight: 18,
    marginBottom: 14,
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
    justifyContent: 'flex-end',
    gap: 10,
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancel: {
    backgroundColor: '#F3F4F6',
  },
  btnCancelText: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.secondary,
  },
  btnSend: {
    backgroundColor: COLORS.primary,
    minWidth: 70,
    ...SHADOWS.soft,
  },
  btnSendText: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#FFF',
  },
});
