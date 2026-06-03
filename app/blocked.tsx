import React from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { getProfile, clearProfile } from '../services/profileStore';
import { TYPOGRAPHY, SHADOWS } from '../constants/Theme';

export default function BlockedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isNotWhitelisted, setIsNotWhitelisted] = React.useState(false);
  const [isChecking, setIsChecking] = React.useState(true);

  React.useEffect(() => {
    const checkStatus = async () => {
      try {
        const profile = await getProfile();
        if (!profile) {
          setIsNotWhitelisted(true);
        } else if (profile.role === 'blocked') {
          setIsNotWhitelisted(false);
        }
      } catch (e) {
        console.warn('[BlockedScreen] Errore verifica profilo:', e);
      } finally {
        setIsChecking(false);
      }
    };
    checkStatus();
  }, []);

  const handleLogout = async () => {
    Alert.alert(
      'Esci da Wolly',
      'Sei sicuro di voler uscire?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Esci',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await clearProfile();
              await supabase.auth.signOut();
              router.replace('/login');
            } catch (e) {
              console.error('[Blocked] Errore logout:', e);
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  if (isChecking) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#0A74FF" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <LinearGradient
        colors={isNotWhitelisted ? ['#FFF7ED', '#FFFFFF'] : ['#FEF2F2', '#FFFFFF']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.5 }}
      />

      <View style={styles.content}>
        {/* Icona */}
        <View style={styles.iconContainer}>
          <LinearGradient 
            colors={isNotWhitelisted ? ['#FDBA74', '#F97316'] : ['#FCA5A5', '#EF4444']} 
            style={styles.iconBg}
          >
            <Ionicons name={isNotWhitelisted ? "alert-circle" : "lock-closed"} size={44} color="#FFFFFF" />
          </LinearGradient>
        </View>

        <Text style={styles.title}>
          {isNotWhitelisted ? 'Account non abilitato' : 'Accesso sospeso'}
        </Text>
        <Text style={styles.subtitle}>
          {isNotWhitelisted 
            ? 'Ci dispiace, questa email non è inserita nella lista dei beta tester abilitati.\nPer richiedere l\'accesso o per assistenza contatta il supporto.'
            : 'Il tuo account è stato temporaneamente sospeso.\nPer assistenza contatta il supporto Wolly.'
          }
        </Text>

        {/* Card info */}
        <View style={[styles.infoCard, isNotWhitelisted && { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
          <Ionicons 
            name="mail-outline" 
            size={18} 
            color={isNotWhitelisted ? '#F97316' : '#EF4444'} 
            style={{ marginRight: 10 }} 
          />
          <Text style={[styles.infoText, isNotWhitelisted && { color: '#F97316' }]}>supporto@wolly.app</Text>
        </View>
      </View>

      {/* Pulsante Esci */}
      <Pressable
        style={({ pressed }) => [
          styles.logoutButton,
          isNotWhitelisted && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
          pressed && { opacity: 0.75 }
        ]}
        onPress={handleLogout}
        disabled={isLoading}
      >
        <Ionicons 
          name="log-out-outline" 
          size={18} 
          color={isNotWhitelisted ? '#475569' : '#EF4444'} 
        />
        <Text style={[styles.logoutText, isNotWhitelisted && { color: '#475569' }]}>
          {isLoading ? 'Uscita in corso...' : isNotWhitelisted ? 'Torna al Login' : 'Esci dall\'account'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  iconContainer: {
    marginBottom: 8,
    ...SHADOWS.medium,
  },
  iconBg: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#0F172A',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginTop: 8,
  },
  infoText: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#EF4444',
  },
  logoutButton: {
    width: '100%',
    height: 52,
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#EF4444',
  },
});
