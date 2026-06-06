import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Alert, Switch, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from '../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { TransactionRepository } from '../services/database/repositories/TransactionRepository';
import { networkStore } from '../services/networkStore';
import { analytics, ANALYTICS_SCREENS } from '../services/analytics';
import AnomalyReporter from '../components/AnomalyReporter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteUserAccount } from '../services/dbFunctions';
import { supabase } from '../services/supabase';
import { getProfile, clearProfile, getRoleLabel, getRoleColor, type UserProfile } from '../services/profileStore';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [networkState, setNetworkState] = useState(networkStore.getState());
  const [devSettingsEnabled, setDevSettingsEnabled] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    analytics.trackScreen(ANALYTICS_SCREENS.SETTINGS);
    
    // Load dev settings state from async storage
    AsyncStorage.getItem('wolly_dev_settings_enabled').then(val => {
      if (val !== null) setDevSettingsEnabled(val === 'true');
    });

    // Carica profilo utente
    getProfile().then(profile => setUserProfile(profile));

    const unsub = networkStore.subscribe(() => setNetworkState(networkStore.getState()));
    return () => { unsub(); };
  }, []);

  const handleToggleDevSettings = async (val: boolean) => {
    setDevSettingsEnabled(val);
    await AsyncStorage.setItem('wolly_dev_settings_enabled', String(val));
  };

  const handleDeleteAll = () => {
    Alert.alert(
      "Elimina tutti i dati",
      "Sei sicuro di voler eliminare DEFINITIVAMENTE tutti i dati (transazioni, periodiche, abbonamenti e spese programmate) dal database? Questa azione non è reversibile e resetterà anche il tuo patrimonio.",
      [
        { text: "Annulla", style: "cancel" },
        { 
          text: "Sì, elimina tutto", 
          style: "destructive",
          onPress: async () => {
            try {
              await TransactionRepository.deleteAll();
              Alert.alert("Completato", "Tutti i dati (transazioni, periodiche e programmate) sono stati eliminati e il patrimonio è stato resettato.");
            } catch (error) {
              console.error(error);
              Alert.alert("Errore", "Impossibile eliminare i dati.");
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Sfumato Blu Premium */}
      <LinearGradient
        colors={['#5CB5FF', '#0078FF']}
        style={[styles.headerGradient, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Impostazioni</Text>
        </View>
        <Text style={styles.subtitle}>Gestisci l'applicazione e le tue preferenze</Text>
      </LinearGradient>

      {/* Overlapping Bottom Sheet */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 48 }]}>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Sezione Profilo in alto */}
          {userProfile && (
            <Pressable 
              style={styles.profileCard} 
              onPress={() => router.push('/profile')}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="person-circle-outline" size={22} color="#0A74FF" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.itemTitleText} numberOfLines={1}>{userProfile.email}</Text>
                <View style={[styles.roleBadge, { backgroundColor: getRoleColor(userProfile.role) + '20' }]}>
                  <View style={[styles.roleDot, { backgroundColor: getRoleColor(userProfile.role) }]} />
                  <Text style={[styles.roleText, { color: getRoleColor(userProfile.role) }]}>
                    {getRoleLabel(userProfile.role)}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            </Pressable>
          )}

          {/* Opzioni Tecniche */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Opzioni Tecniche</Text>
            
            <AnomalyReporter
              renderTrigger={(open) => (
                <Pressable style={styles.item} onPress={open}>
                  <View style={[styles.iconContainer, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="flag" size={20} color="#EF4444" />
                  </View>
                  <Text style={styles.itemText}>Segnala un'Anomalia</Text>
                  <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
                </Pressable>
              )}
            />
          </View>

          {/* Opzioni Informative */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informazioni e Note Legali</Text>

            <Pressable style={styles.item} onPress={() => router.push('/privacy')}>
              <View style={[styles.iconContainer, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="shield-checkmark" size={20} color="#0284C7" />
              </View>
              <Text style={styles.itemText}>Informativa sulla Privacy</Text>
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            </Pressable>

            <Pressable style={[styles.item, { marginTop: 8 }]} onPress={() => router.push('/terms')}>
              <View style={[styles.iconContainer, { backgroundColor: '#F3EFFF' }]}>
                <Ionicons name="document-text" size={20} color="#8B5CF6" />
              </View>
              <Text style={styles.itemText}>Termini di Utilizzo Beta</Text>
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            </Pressable>
          </View>

          {/* Impostazioni di Sviluppo */}
          {userProfile?.role === 'admin' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Impostazioni di Sviluppo</Text>
              
              <View style={styles.item}>
                <View style={[styles.iconContainer, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="code-working" size={20} color="#0284C7" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.itemTitleText}>Dev Settings</Text>
                  <Text style={styles.itemSubtitleText}>Abilita strumenti sviluppatore e gestione dati</Text>
                </View>
                <Switch
                  value={devSettingsEnabled}
                  onValueChange={handleToggleDevSettings}
                  trackColor={{ false: '#D1D5DB', true: '#0A74FF' }}
                  thumbColor={'#FFF'}
                />
              </View>

              {devSettingsEnabled && (
                <>
                  {/* Inizializza Onboarding */}
                  <Pressable style={[styles.item, { marginTop: 8 }]} onPress={async () => {
                    await AsyncStorage.setItem('wolly_onboarding_completed', 'false');
                    router.push('/onboarding');
                  }}>
                    <View style={[styles.iconContainer, { backgroundColor: '#E0F2FE' }]}>
                      <Ionicons name="rocket" size={20} color="#0284C7" />
                    </View>
                    <Text style={styles.itemText}>Inizializza Onboarding</Text>
                    <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
                  </Pressable>

                  {/* Gestione Dati & Seed */}
                  <Pressable style={styles.item} onPress={() => router.push('/seed-data')}>
                    <View style={[styles.iconContainer, { backgroundColor: '#E6F0FF' }]}>
                      <Ionicons name="server" size={20} color="#0A74FF" />
                    </View>
                    <Text style={styles.itemText}>Gestione Dati & Seed</Text>
                    <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
                  </Pressable>

                  {/* Modalità Demo Offline */}
                  <View style={styles.item}>
                    <View style={[styles.iconContainer, { backgroundColor: '#E6F4EA' }]}>
                      <Ionicons name="cloud-offline" size={20} color="#34C759" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.itemTitleText}>Modalità Demo Offline</Text>
                      <Text style={styles.itemSubtitleText}>Forza l'app in modalità senza rete (disabilita AI)</Text>
                    </View>
                    <Switch
                      value={networkState.isDemoOffline}
                      onValueChange={(val) => networkStore.setDemoOffline(val)}
                      trackColor={{ false: '#D1D5DB', true: '#0A74FF' }}
                      thumbColor={'#FFF'}
                    />
                  </View>

                  {/* Unauthorized Mode (Test Permessi) */}
                  <View style={styles.item}>
                    <View style={[styles.iconContainer, { backgroundColor: '#FEF08A' }]}>
                      <Ionicons name="lock-closed" size={20} color="#CA8A04" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.itemTitleText}>Unauthorized Mode</Text>
                      <Text style={styles.itemSubtitleText}>Forza il rifiuto dei permessi (Microfono e Fotocamera)</Text>
                    </View>
                    <Switch
                      value={networkState.isUnauthorizedMode}
                      onValueChange={(val) => networkStore.setUnauthorizedMode(val)}
                      trackColor={{ false: '#D1D5DB', true: '#0A74FF' }}
                      thumbColor={'#FFF'}
                    />
                  </View>

                  {/* Elimina tutte le transazioni */}
                  <Pressable style={[styles.item, styles.dangerItem]} onPress={handleDeleteAll}>
                    <View style={[styles.iconContainer, { backgroundColor: '#FCE8E6' }]}>
                      <Ionicons name="trash" size={20} color="#EF4444" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.itemTitleText, styles.dangerText]}>Elimina tutte le transazioni</Text>
                      <Text style={styles.itemSubtitleText}>Svuota database transazioni e resetta patrimonio</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#EF4444" />
                  </Pressable>
                </>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  title: {
    fontSize: 24,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#FFFFFF',
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily,
    marginTop: 6,
  },
  bottomSection: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    marginTop: -20,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: SPACING.md,
    marginLeft: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 20,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
    ...SHADOWS.soft,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.primary,
  },
  itemTitleText: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.primary,
  },
  itemSubtitleText: {
    fontSize: 11,
    color: COLORS.secondary,
    fontFamily: TYPOGRAPHY.fontFamily,
    marginTop: 2,
  },
  dangerItem: {
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  dangerText: {
    color: '#EF4444',
  },
  logoutItem: {
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 20,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
    ...SHADOWS.soft,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
    gap: 4,
  },
  roleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  roleText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontBold,
    letterSpacing: 0.3,
  },
});
