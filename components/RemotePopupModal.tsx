import React, { useEffect, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  Animated,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { popupStore, RemotePopup } from '../services/popupStore';
import { COLORS } from '../constants/Theme';

const { width } = Dimensions.get('window');

// Definisce stili e colori predefiniti in base al tipo di popup
const POPUP_TYPES = {
  info: {
    gradient: ['#007AFF', '#00C6FF'] as [string, string],
    icon: 'notifications-outline' as const,
    buttonBg: '#007AFF',
  },
  warning: {
    gradient: ['#FF9500', '#FFB300'] as [string, string],
    icon: 'warning-outline' as const,
    buttonBg: '#FF9500',
  },
  error: {
    gradient: ['#FF3B30', '#FF7B7B'] as [string, string],
    icon: 'alert-circle-outline' as const,
    buttonBg: '#FF3B30',
  },
};

export default function RemotePopupModal() {
  const [popup, setPopup] = useState<RemotePopup | null>(null);
  const [visible, setVisible] = useState(false);
  const [scaleAnim] = useState(new Animated.Value(0.9));

  useEffect(() => {
    // Sottoscrizione alle modifiche del popupStore
    const unsubscribe = popupStore.subscribe(() => {
      const { currentVisiblePopup } = popupStore.getState();
      setPopup(currentVisiblePopup);
      
      if (currentVisiblePopup) {
        setVisible(true);
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }).start();
      } else {
        setVisible(false);
        scaleAnim.setValue(0.9);
      }
    });

    // Inizializza al montaggio
    const { currentVisiblePopup } = popupStore.getState();
    setPopup(currentVisiblePopup);
    if (currentVisiblePopup) setVisible(true);

    return () => {
      unsubscribe();
    };
  }, []);

  if (!popup) return null;

  const currentType = POPUP_TYPES[popup.type] || POPUP_TYPES.info;
  const gradientColors = (popup.hero_gradient_start && popup.hero_gradient_end)
    ? [popup.hero_gradient_start, popup.hero_gradient_end] as [string, string]
    : currentType.gradient;

  const handleClose = () => {
    // Animazione di chiusura leggera
    Animated.timing(scaleAnim, {
      toValue: 0.9,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      popupStore.dismissPopup();
    });
  };

  const handleAction = async () => {
    if (popup.button_url) {
      try {
        const supported = await Linking.canOpenURL(popup.button_url);
        if (supported) {
          await Linking.openURL(popup.button_url);
        }
      } catch (err) {
        console.error('Failed to open action URL:', err);
      }
    }
    handleClose();
  };

  // Verifica se icon_name è un Emoji (controllando i codici carattere o semplicemente la presenza di caratteri non-ASCII comuni)
  const isEmoji = (str: string) => {
    if (!str) return false;
    const charCode = str.codePointAt(0) || 0;
    // Range Emoji e Simboli speciali comuni
    return charCode > 127;
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.modalCard, { transform: [{ scale: scaleAnim }] }]}>
          
          {/* Sezione Hero con Gradiente */}
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroSection}
          >
            {/* Pulsante "X" in alto a destra */}
            <TouchableOpacity style={styles.closeButton} onPress={handleClose} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Icona o Emoji centrale */}
            <View style={styles.iconContainer}>
              {popup.icon_name && isEmoji(popup.icon_name) ? (
                <Text style={styles.emojiText}>{popup.icon_name}</Text>
              ) : (
                <Ionicons
                  name={(popup.icon_name || currentType.icon) as any}
                  size={54}
                  color="#FFFFFF"
                />
              )}
            </View>
          </LinearGradient>

          {/* Sezione dei Contenuti */}
          <View style={styles.contentSection}>
            <Text style={styles.titleText}>{popup.title}</Text>
            <Text style={styles.messageText}>{popup.message}</Text>

            {/* Pulsante d'azione opzionale */}
            {popup.button_text ? (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: currentType.buttonBg }]}
                onPress={handleAction}
                activeOpacity={0.8}
              >
                <Text style={styles.actionButtonText}>{popup.button_text}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.dismissTextButton}
                onPress={handleClose}
                activeOpacity={0.7}
              >
                <Text style={styles.dismissText}>Chiudi</Text>
              </TouchableOpacity>
            )}
          </View>

        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(28, 28, 30, 0.4)', // Soft glassmorphic overlay using brand core tone
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: Math.min(width - 48, 340),
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
    elevation: 8,
  },
  heroSection: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  emojiText: {
    fontSize: 56,
  },
  contentSection: {
    padding: 24,
    alignItems: 'center',
  },
  titleText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 20,
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 12,
  },
  messageText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 14,
    color: '#636366',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  actionButton: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  actionButtonText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  dismissTextButton: {
    paddingVertical: 10,
    width: '100%',
    alignItems: 'center',
  },
  dismissText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 15,
    color: '#8E8E93',
  },
});
