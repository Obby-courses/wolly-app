import React from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { clearProfile } from '../services/profileStore';
import { TYPOGRAPHY, SHADOWS } from '../constants/Theme';

export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = React.useState(false);

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
              console.error('[Paywall] Errore logout:', e);
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <LinearGradient
        colors={['#EFF6FF', '#FFFFFF']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.6 }}
      />

      <View style={styles.content}>
        {/* Icona */}
        <View style={styles.iconContainer}>
          <LinearGradient colors={['#60A5FA', '#0A74FF']} style={styles.iconBg}>
            <Ionicons name="rocket" size={40} color="#FFFFFF" />
          </LinearGradient>
        </View>

        <Text style={styles.title}>La Beta è terminata</Text>
        <Text style={styles.subtitle}>
          Grazie per aver partecipato alla beta di Wolly!{'\n'}
          Il periodo di accesso gratuito è scaduto.
        </Text>

        {/* Features premium */}
        <View style={styles.featuresCard}>
          <Text style={styles.featuresTitle}>Con Wolly Premium ottieni:</Text>
          {[
            'Registrazione spese con la voce',
            'Analisi AI avanzata delle finanze',
            'Abbonamenti e spese ricorrenti',
            'Statistiche e grafici dettagliati',
          ].map((feat, i) => (
            <View key={i} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={16} color="#0A74FF" />
              <Text style={styles.featureText}>{feat}</Text>
            </View>
          ))}
        </View>

        {/* Coming soon badge */}
        <View style={styles.comingSoonBadge}>
          <Ionicons name="time-outline" size={14} color="#7C3AED" />
          <Text style={styles.comingSoonText}>Piano Premium — prossimamente</Text>
        </View>
      </View>

      {/* Pulsante Esci */}
      <Pressable
        style={({ pressed }) => [styles.logoutButton, pressed && { opacity: 0.75 }]}
        onPress={handleLogout}
        disabled={isLoading}
      >
        <Ionicons name="log-out-outline" size={18} color="#64748B" />
        <Text style={styles.logoutText}>
          {isLoading ? 'Uscita in corso...' : 'Esci dall\'account'}
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
  featuresCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
    marginTop: 4,
  },
  featuresTitle: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#0F172A',
    marginBottom: 4,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: '#334155',
    flex: 1,
  },
  comingSoonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5F3FF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  comingSoonText: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#7C3AED',
  },
  logoutButton: {
    width: '100%',
    height: 52,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  logoutText: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#64748B',
  },
});
