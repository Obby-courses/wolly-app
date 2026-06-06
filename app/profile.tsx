import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from '../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { getProfile, clearProfile, getRoleLabel, getRoleColor, type UserProfile } from '../services/profileStore';
import { deleteUserAccount } from '../services/dbFunctions';
import { analytics, ANALYTICS_SCREENS } from '../services/analytics';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    analytics.trackScreen(ANALYTICS_SCREENS.SETTINGS + '/profile');
    
    // Carica profilo utente
    getProfile().then(profile => setUserProfile(profile));
  }, []);

  const handleLogout = () => {
    Alert.alert(
      'Esci da Wolly',
      'Sei sicuro di voler uscire? Potrai rientrare in qualsiasi momento con il tuo account Google.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Esci',
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await clearProfile();
              await supabase.auth.signOut();
              router.replace('/login');
            } catch (e) {
              console.error('[Profile] Errore logout:', e);
              Alert.alert('Errore', 'Impossibile effettuare il logout. Riprova.');
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    // Step 1 — primo avviso
    Alert.alert(
      "Elimina account",
      "Stai per eliminare tutti i tuoi dati da Wolly. Questa azione è irreversibile.\n\nVerranno cancellati:\n\u2022 Tutte le transazioni\n\u2022 Gli abbonamenti\n\u2022 Il tuo patrimonio\n\u2022 I log di utilizzo AI",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Continua",
          style: "destructive",
          onPress: () => {
            // Step 2 — conferma definitiva
            Alert.alert(
              "Sei sicuro?",
              "Questa è l'ultima conferma. Tutti i tuoi dati verranno cancellati definitivamente e non potranno essere recuperati.",
              [
                { text: "No, torna indietro", style: "cancel" },
                {
                  text: "Sì, elimina tutto",
                  style: "destructive",
                  onPress: async () => {
                    setIsDeletingAccount(true);
                    try {
                      const result = await deleteUserAccount();
                      if (!result.success) {
                        console.warn('[Profile] deleteUserAccount completato con errori:', result.errors);
                      }
                      router.replace('/login');
                    } catch (e: any) {
                      console.error('[Profile] Errore critico deleteUserAccount:', e);
                      Alert.alert(
                        "Errore",
                        "Si è verificato un errore durante l'eliminazione. Riprova o contatta il supporto."
                      );
                    } finally {
                      setIsDeletingAccount(false);
                    }
                  }
                }
              ]
            );
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
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.title}>Il mio Profilo</Text>
        </View>
        <Text style={styles.subtitle}>Gestisci la sicurezza e l'accesso al tuo account</Text>
      </LinearGradient>

      {/* Overlapping Bottom Sheet */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 20 }]}>
        
        {/* Info profilo utente */}
        {userProfile && (
          <View style={styles.profileCard}>
            <View style={[styles.iconContainer, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="person" size={24} color="#0A74FF" />
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={styles.emailText} numberOfLines={1}>{userProfile.email}</Text>
              <View style={[styles.roleBadge, { backgroundColor: getRoleColor(userProfile.role) + '20' }]}>
                <View style={[styles.roleDot, { backgroundColor: getRoleColor(userProfile.role) }]} />
                <Text style={[styles.roleText, { color: getRoleColor(userProfile.role) }]}>
                  {getRoleLabel(userProfile.role)}
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Azioni Account</Text>

          {/* Pulsante Esci */}
          <Pressable
            style={[styles.item, styles.logoutItem]}
            onPress={handleLogout}
            disabled={isLoggingOut}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#FFF7ED' }]}>
              {isLoggingOut
                ? <ActivityIndicator size="small" color="#F97316" />
                : <Ionicons name="log-out-outline" size={20} color="#F97316" />
              }
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.itemTitleText, { color: '#F97316' }]}>
                {isLoggingOut ? 'Uscita in corso...' : 'Disconnetti'}
              </Text>
              <Text style={styles.itemSubtitleText}>
                Esci in sicurezza dall'app
              </Text>
            </View>
            {!isLoggingOut && (
              <Ionicons name="chevron-forward" size={18} color="#F97316" />
            )}
          </Pressable>

          {/* Elimina account */}
          <Pressable
            style={[styles.item, styles.dangerItem]}
            onPress={handleDeleteAccount}
            disabled={isDeletingAccount}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#FCE8E6' }]}>
              {isDeletingAccount
                ? <ActivityIndicator size="small" color="#EF4444" />
                : <Ionicons name="trash-outline" size={20} color="#EF4444" />
              }
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.itemTitleText, styles.dangerText]}>
                {isDeletingAccount ? 'Eliminazione in corso...' : 'Elimina account'}
              </Text>
              <Text style={styles.itemSubtitleText}>
                Cancella i tuoi dati e il tuo account per sempre
              </Text>
            </View>
            {!isDeletingAccount && (
              <Ionicons name="chevron-forward" size={18} color="#EF4444" />
            )}
          </Pressable>
        </View>

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
  backButton: {
    marginRight: 12,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
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
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
    ...SHADOWS.soft,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailText: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
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
  actionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
});
