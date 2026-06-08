import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TYPOGRAPHY, SHADOWS } from '../constants/Theme';

export default function AiLimitScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  
  const type = params.type === 'global' ? 'global' : 'user';

  const title = type === 'user' ? 'Limite Beta Raggiunto' : 'Servizio al Completo';
  const subtitle = type === 'user'
    ? 'Hai raggiunto il limite di spesa mensile previsto per il tuo account in questa fase di Beta testing.'
    : 'Wolly ha esaurito il budget AI globale allocato per questo mese.';
  
  const description = type === 'user'
    ? 'Il tuo contatore si azzererà automaticamente all\'inizio del prossimo mese. Grazie mille per aver testato l\'app e per il tuo prezioso contributo!'
    : 'Il servizio riprenderà regolarmente all\'inizio del prossimo mese. Ci scusiamo per l\'inconveniente e ti ringraziamo per la pazienza.';

  const handleDismiss = () => {
    router.back();
  };

  return (
    <View style={styles.overlay}>
      {/* Background Dimmed Overlay */}
      <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />

      <View style={[styles.modalCard, { marginBottom: insets.bottom + 20 }]}>
        {/* Cerchio con Icona e Gradiente Premium */}
        <View style={styles.iconContainer}>
          <LinearGradient
            colors={type === 'user' ? ['#F59E0B', '#D97706'] : ['#EF4444', '#B91C1C']}
            style={styles.iconBg}
          >
            <Ionicons
              name={type === 'user' ? "speedometer-outline" : "server-outline"}
              size={40}
              color="#FFFFFF"
            />
          </LinearGradient>
        </View>

        {/* Titolo e Testi */}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        
        <View style={styles.divider} />
        
        <Text style={styles.description}>{description}</Text>

        {/* Pulsante Grande "Capito" */}
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }
          ]}
          onPress={handleDismiss}
        >
          <Text style={styles.buttonText}>Capito</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)', // Sfondo scuro e semitrasparente
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    ...SHADOWS.large,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  iconContainer: {
    marginBottom: 16,
    ...SHADOWS.medium,
  },
  iconBg: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 6,
  },
  divider: {
    width: '60%',
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 16,
  },
  description: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  primaryButton: {
    width: '100%',
    height: 54,
    backgroundColor: '#0F172A', // Sfondo scuro premium
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#FFFFFF',
  },
});
