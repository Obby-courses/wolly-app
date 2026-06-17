import React, { useState, useRef } from 'react';
import {
  StyleSheet, Text, View, Pressable, TextInput,
  Animated, Dimensions, KeyboardAvoidingView, Platform, Keyboard, ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, TYPOGRAPHY, SHADOWS, SPACING } from '../constants/Theme';
import { NetWorthRepository } from '../services/database/repositories/NetWorthRepository';
import { analytics, ANALYTICS_SCREENS } from '../services/analytics';

const { width, height } = Dimensions.get('window');

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [balance, setBalance] = useState('1.000');
  const [isNegative, setIsNegative] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Consensi Legali
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Animation values
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const inputRef = useRef<TextInput>(null);

  const totalSteps = 4;

  React.useEffect(() => {
    analytics.trackScreen(ANALYTICS_SCREENS.ONBOARDING);
    analytics.trackEvent('onboarding_started');
  }, []);

  const handleBalanceChange = (newVal: string) => {
    let hasComma = newVal.includes(',');
    let endsWithDot = newVal.endsWith('.');
    
    // Check if there is a dot followed by 1 or 2 digits at the end (e.g. .5 or .58)
    const dotDecimalMatch = newVal.match(/\.(\d{1,2})$/);
    let hasDotDecimal = !hasComma && dotDecimalMatch !== null;
    
    let integerPart = '';
    let decimalPart = '';
    
    if (hasComma) {
      const parts = newVal.split(',');
      integerPart = parts[0];
      decimalPart = parts[1] || '';
    } else if (hasDotDecimal && dotDecimalMatch) {
      const lastDotIndex = newVal.lastIndexOf('.');
      integerPart = newVal.slice(0, lastDotIndex);
      decimalPart = dotDecimalMatch[1];
      hasComma = true; // treat as comma decimal
    } else if (endsWithDot) {
      integerPart = newVal.slice(0, -1);
      decimalPart = '';
      hasComma = true;
    } else {
      integerPart = newVal;
    }
    
    const cleanInteger = integerPart.replace(/\D/g, '');
    const cleanDecimal = decimalPart.replace(/\D/g, '').slice(0, 2);
    
    // Enforce maximum limit: 1 billion minus 1 cent (999.999.999,99)
    const checkValStr = cleanInteger + '.' + (cleanDecimal || '0');
    const checkVal = parseFloat(checkValStr) || 0;
    if (checkVal > 999999999.99) {
      return; // block keystrokes that exceed the limit
    }
    
    const formattedInteger = cleanInteger.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    let formattedVal = formattedInteger;
    if (hasComma || endsWithDot) {
      formattedVal += ',' + cleanDecimal;
    }
    
    setBalance(formattedVal);
  };

  const changeStep = (nextStep: number) => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: nextStep > step ? -30 : 30,
        duration: 150,
        useNativeDriver: true,
      })
    ]).start(() => {
      setStep(nextStep);
      analytics.trackEvent('onboarding_step_completed', { from_step: step, to_step: nextStep });
      slideAnim.setValue(nextStep > step ? 30 : -30);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        })
      ]).start(() => {
        if (nextStep === 2) {
          setTimeout(() => {
            inputRef.current?.focus();
          }, 100);
        }
      });
    });
  };

  const handleNext = async () => {
    if (step === 1 && (!privacyAccepted || !termsAccepted)) {
      import('react-native').then(({ Alert }) => {
        Alert.alert(
          "Consenso richiesto",
          "Devi prendere visione della Privacy Policy e accettare i Termini di Utilizzo per poter continuare e usare Wolly."
        );
      });
      return;
    }

    if (step < totalSteps - 1) {
      changeStep(step + 1);
    } else {
      setIsSaving(true);
      try {
        // Clean and parse balance: strip thousands separator dots, then replace decimal comma with dot
        const cleanBalance = balance.replace(/\./g, '').replace(',', '.').trim();
        const numVal = parseFloat(cleanBalance) || 0;
        const finalBalance = isNegative ? -numVal : numVal;

        // Save starting net worth in the SQLite DB
        await NetWorthRepository.updateTotal(finalBalance);

        // Mark onboarding completed in storage
        await AsyncStorage.setItem('wolly_onboarding_completed', 'true');
        await AsyncStorage.setItem('wolly_last_nw_sync_date', new Date().toISOString().split('T')[0]);

        // Save Legal Consents
        await AsyncStorage.setItem('wolly_privacy_version', '1.0');
        await AsyncStorage.setItem('wolly_accepted_privacy_at', new Date().toISOString());
        await AsyncStorage.setItem('wolly_terms_version', '1.0');
        await AsyncStorage.setItem('wolly_accepted_terms_at', new Date().toISOString());

        analytics.trackEvent('onboarding_completed', { success: true });

        // Navigate home
        router.replace('/');
      } catch (err) {
        console.error('Errore nel completamento onboarding:', err);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleBack = () => {
    if (step > 0) {
      changeStep(step - 1);
    }
  };

  const renderWelcomeSlide = () => (
    <View style={styles.slideContent}>
      {/* 50% Height top gradient */}
      <View style={styles.topGradientContainer}>
        <LinearGradient
          colors={['#E0F2FE', '#FFFFFF']}
          style={styles.topGradient}
        />
        <View style={styles.iconContainer}>
          <Ionicons name="sparkles" size={56} color="#0A74FF" />
        </View>
      </View>

      {/* Slide Text Content */}
      <View style={styles.textContainerWelcome}>
        <Text style={styles.slideTitle}>Benvenuto in Wolly</Text>
        <View style={styles.versionBadgeContainer}>
          <View style={styles.versionBadge}>
            <Text style={styles.versionText}>Beta v.0.0.1</Text>
          </View>
        </View>
        
        <Text style={[styles.slideSubtitle, { paddingHorizontal: 16 }]}>
          Questa è la versione beta di Wolly, monitora le tue spese in modo facile e veloce.
        </Text>
      </View>
    </View>
  );

  const renderSecuritySlide = () => (
    <View style={[styles.slideContent, { paddingHorizontal: 24, paddingTop: insets.top + 40 }]}>
      <View style={styles.securityHeader}>
        <View style={styles.securityIconBackground}>
          <Ionicons name="shield-checkmark" size={32} color="#0A74FF" />
        </View>
        <Text style={styles.slideTitleSecurity}>Sicurezza e Privacy</Text>
        <Text style={styles.slideSubtitleSecurity}>
          Wolly è progettato per garantire il controllo assoluto e la riservatezza delle tue finanze.
        </Text>
      </View>

      <View style={styles.securityItemsContainer}>
        <View style={styles.securityItem}>
          <View style={styles.securityItemIcon}>
            <Ionicons name="phone-portrait-outline" size={24} color="#0A74FF" style={{ marginRight: 6 }} />
          </View>
          <View style={styles.securityItemContent}>
            <Text style={styles.securityItemTitle}>Dati locali e protetti</Text>
            <Text style={styles.securityItemDesc}>
              Tutte le tue transazioni e il tuo patrimonio iniziale sono salvati esclusivamente sul tuo telefono. Nessun database esterno o cloud.
            </Text>
          </View>
        </View>

        <View style={styles.securityItem}>
          <View style={styles.securityItemIcon}>
            <Ionicons name="key-outline" size={24} color="#0A74FF" style={{ marginRight: 6 }} />
          </View>
          <View style={styles.securityItemContent}>
            <Text style={styles.securityItemTitle}>Nessun account richiesto</Text>
            <Text style={styles.securityItemDesc}>
              Non chiediamo email, password o collegamenti a conti bancari. Utilizzi l'app in totale anonimato fin dal primo avvio.
            </Text>
          </View>
        </View>

        <View style={styles.securityItem}>
          <View style={styles.securityItemIcon}>
            <Ionicons name="bar-chart-outline" size={24} color="#0A74FF" style={{ marginRight: 6 }} />
          </View>
          <View style={styles.securityItemContent}>
            <Text style={styles.securityItemTitle}>Statistiche anonime</Text>
            <Text style={styles.securityItemDesc}>
              Raccogliamo dati statistici in modo totalmente anonimo solo per monitorare le performance dell'applicazione e migliorarne l'esperienza.
            </Text>
          </View>
        </View>
      </View>

      {/* Sezione Consensi (obbligatori) */}
      <View style={styles.consentsContainer}>
        <Pressable 
          style={styles.consentRow} 
          onPress={() => setPrivacyAccepted(!privacyAccepted)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: privacyAccepted }}
          accessibilityLabel="Ho preso visione della Privacy Policy"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={[styles.checkbox, privacyAccepted && styles.checkboxActive]}>
            {privacyAccepted && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
          </View>
          <Text style={styles.consentText}>
            Ho preso visione della{' '}
            <Text style={styles.linkText} onPress={(e) => { e.stopPropagation(); router.push('/privacy'); }}>
              Privacy Policy
            </Text>
          </Text>
        </Pressable>

        <Pressable 
          style={styles.consentRow} 
          onPress={() => setTermsAccepted(!termsAccepted)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: termsAccepted }}
          accessibilityLabel="Accetto i Termini di Utilizzo Beta"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={[styles.checkbox, termsAccepted && styles.checkboxActive]}>
            {termsAccepted && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
          </View>
          <Text style={styles.consentText}>
            Accetto i{' '}
            <Text style={styles.linkText} onPress={(e) => { e.stopPropagation(); router.push('/terms'); }}>
              Termini di Utilizzo Beta
            </Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const renderBalanceSlide = () => (
    <View style={[styles.slideContent, { paddingHorizontal: 24, paddingTop: insets.top + 40 }]}>
      <View style={styles.balanceHeader}>
        <View style={styles.balanceIconBackground}>
          <Ionicons name="wallet" size={32} color="#0A74FF" />
        </View>
        <Text style={styles.slideTitleBalance}>Imposta il patrimonio</Text>
        <Text style={styles.slideSubtitleBalance}>
          Configura il tuo capitale di partenza corrente. Il valore può essere positivo o negativo.
        </Text>
      </View>

      {/* Input container with plus/minus selector toggle */}
      <View style={styles.inputCard}>
        <Pressable
          onPress={() => setIsNegative(!isNegative)}
          style={[
            styles.signToggle,
            isNegative ? styles.signToggleNegative : styles.signTogglePositive
          ]}
          accessibilityRole="button"
          accessibilityLabel={isNegative ? 'Importo negativo, tocca per rendere positivo' : 'Importo positivo, tocca per rendere negativo'}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[
            styles.signToggleText,
            isNegative ? styles.signTextNegative : styles.signTextPositive
          ]}>
            {isNegative ? '-' : '+'}
          </Text>
        </Pressable>

        <TextInput
          ref={inputRef}
          style={styles.balanceTextInput}
          value={balance}
          onChangeText={handleBalanceChange}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor="#94A3B8"
          accessibilityLabel="Patrimonio iniziale in euro"
          accessibilityHint="Inserisci il tuo capitale di partenza usando la virgola come separatore decimale"
        />
        <Text style={styles.currencySuffix}>EUR</Text>
      </View>

      <Text style={styles.helpText}>
        Questo importo iniziale imposterà il tuo patrimonio e potrà essere modificato o sincronizzato in qualsiasi momento.
      </Text>
    </View>
  );

  const renderParsingSlide = () => (
    <View style={[styles.slideContent, { paddingHorizontal: 24, paddingTop: insets.top + 40 }]}>
      <View style={styles.securityHeader}>
        <View style={styles.securityIconBackground}>
          <Ionicons name="flash-outline" size={32} color="#0A74FF" />
        </View>
        <Text style={styles.slideTitleSecurity}>Come registrare le spese</Text>
        <Text style={styles.slideSubtitleSecurity}>
          Wolly usa l'Intelligenza Artificiale per farti risparmiare tempo. Usa il pulsante + centrale nel menu.
        </Text>
      </View>

      <View style={styles.securityItemsContainer}>
        <View style={styles.securityItem}>
          <View style={styles.securityItemIcon}>
            <Ionicons name="chatbubble-ellipses-outline" size={24} color="#0A74FF" style={{ marginRight: 6 }} />
          </View>
          <View style={styles.securityItemContent}>
            <Text style={styles.securityItemTitle}>1 tocco: Testo</Text>
            <Text style={styles.securityItemDesc}>
              Scrivi la tua spesa (es. "Pizza 12 euro") o fai domande sulle tue finanze alla chat AI.
            </Text>
          </View>
        </View>

        <View style={styles.securityItem}>
          <View style={styles.securityItemIcon}>
            <Ionicons name="camera-outline" size={24} color="#0A74FF" style={{ marginRight: 6 }} />
          </View>
          <View style={styles.securityItemContent}>
            <Text style={styles.securityItemTitle}>2 tocchi veloci: Fotocamera</Text>
            <Text style={styles.securityItemDesc}>
              Scatta una foto a uno o più scontrini. L'AI estrarrà le voci e compilerà tutto in automatico.
            </Text>
          </View>
        </View>

        <View style={styles.securityItem}>
          <View style={styles.securityItemIcon}>
            <Ionicons name="mic-outline" size={24} color="#0A74FF" style={{ marginRight: 6 }} />
          </View>
          <View style={styles.securityItemContent}>
            <Text style={styles.securityItemTitle}>Tieni premuto: Voce</Text>
            <Text style={styles.securityItemDesc}>
              Parla in modo naturale. Wolly capirà importo, categoria e dettagli e preparerà la transazione.
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
      >
        {/* Step Indicator */}
        <View style={[styles.indicatorContainer, { paddingTop: step === 0 ? insets.top + 20 : insets.top + 10 }]}>
          <View style={styles.dotsRow}>
            {Array.from({ length: totalSteps }).map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.dot,
                idx === step ? styles.dotActive : null
              ]}
              accessibilityLabel={`Step ${idx + 1} di ${totalSteps}${idx === step ? ', attivo' : ''}`}
              accessible
            />
          ))}
          </View>
        </View>

        {/* Dynamic Card Container */}
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          scrollEnabled={true}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.animatedWrapper,
              {
                opacity: fadeAnim,
                transform: [{ translateX: slideAnim }]
              }
            ]}
          >
            {step === 0 ? renderWelcomeSlide() : step === 1 ? renderSecuritySlide() : step === 2 ? renderBalanceSlide() : renderParsingSlide()}
          </Animated.View>
        </ScrollView>

        {/* Footer Navigation */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.footerButtons}>
            {step > 0 ? (
              <Pressable onPress={handleBack} style={[styles.btn, styles.btnBack]}>
                <Ionicons name="arrow-back" size={16} color="#0F172A" style={{ marginRight: 6 }} />
                <Text style={styles.btnBackText}>Indietro</Text>
              </Pressable>
            ) : (
              <View style={{ flex: 1 }} />
            )}

            <Pressable
              onPress={handleNext}
              disabled={isSaving || (step === 1 && (!privacyAccepted || !termsAccepted))}
              style={[
                styles.btn, 
                styles.btnNext,
                (step === 1 && (!privacyAccepted || !termsAccepted)) && { opacity: 0.4 }
              ]}
            >
              <Text style={styles.btnNextText}>
                {step === totalSteps - 1 ? 'Capito' : 'Continua'}
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#FFF" style={{ marginLeft: 6 }} />
            </Pressable>
          </View>
        </View>

      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // 100% white background
  },
  keyboardAvoid: {
    flex: 1,
    justifyContent: 'space-between',
  },
  indicatorContainer: {
    width: '100%',
    alignItems: 'center',
    zIndex: 10,
    position: 'absolute',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
  },
  dotActive: {
    backgroundColor: '#0A74FF', // azure
    width: 20,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  animatedWrapper: {
    width: '100%',
    flex: 1,
  },
  slideContent: {
    width: '100%',
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topGradientContainer: {
    width: '100%',
    height: height * 0.46,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.soft,
  },
  textContainerWelcome: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    width: '100%',
  },
  slideTitle: {
    fontSize: 24,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#0F172A', // black
    textAlign: 'center',
    marginBottom: 12,
  },
  versionBadgeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  versionBadge: {
    backgroundColor: '#0A74FF', // Premium Blue
    borderRadius: 8, // Rounded rectangle
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#38BDF8', // Light azure border
  },
  versionText: {
    color: '#E0F2FE', // Azure/Sky blue text
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontBold,
    letterSpacing: 0.5,
  },
  slideSubtitle: {
    fontSize: 14,
    color: '#334155',
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: TYPOGRAPHY.fontFamily,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  balanceHeader: {
    alignItems: 'center',
    width: '100%',
    marginBottom: 32,
  },
  balanceIconBackground: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  slideTitleBalance: {
    fontSize: 22,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#0F172A',
    marginBottom: 8,
  },
  slideSubtitleBalance: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: TYPOGRAPHY.fontFamily,
    paddingHorizontal: 12,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    height: 64,
    width: '100%',
    marginBottom: 16,
    ...SHADOWS.soft,
  },
  signToggle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  signTogglePositive: {
    backgroundColor: '#E0F2FE',
  },
  signToggleNegative: {
    backgroundColor: '#FEE2E2',
  },
  signToggleText: {
    fontSize: 20,
    fontFamily: TYPOGRAPHY.fontBold,
  },
  signTextPositive: {
    color: '#0A74FF', // azure
  },
  signTextNegative: {
    color: '#EF4444', // red
  },
  balanceTextInput: {
    flex: 1,
    height: '100%',
    fontSize: 20,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#0F172A',
  },
  currencySuffix: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#64748B',
    marginLeft: 10,
  },
  helpText: {
    fontSize: 11,
    color: '#94A3B8',
    fontFamily: TYPOGRAPHY.fontFamily,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 20,
  },
  footer: {
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  btnBack: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  btnBackText: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#0F172A',
  },
  btnNext: {
    backgroundColor: '#0A74FF', // azure
    ...SHADOWS.soft,
  },
  btnNextText: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#FFFFFF',
  },
  securityHeader: {
    alignItems: 'center',
    width: '100%',
    marginBottom: 24,
  },
  securityIconBackground: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  slideTitleSecurity: {
    fontSize: 22,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  slideSubtitleSecurity: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: TYPOGRAPHY.fontFamily,
    paddingHorizontal: 12,
  },
  securityItemsContainer: {
    width: '100%',
    gap: 12,
    marginTop: 8,
  },
  securityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 16,
    padding: 14,
  },
  securityItemIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  securityItemContent: {
    flex: 1,
  },
  securityItemTitle: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#0F172A',
    marginBottom: 4,
  },
  securityItemDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  consentsContainer: {
    marginTop: 24,
    width: '100%',
    paddingHorizontal: 8,
    gap: 16,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxActive: {
    backgroundColor: '#0A74FF',
    borderColor: '#0A74FF',
  },
  consentText: {
    fontSize: 14,
    color: '#334155',
    fontFamily: TYPOGRAPHY.fontFamily,
    flex: 1,
  },
  linkText: {
    color: '#0A74FF',
    textDecorationLine: 'underline',
    fontFamily: TYPOGRAPHY.fontBold,
  },
});
