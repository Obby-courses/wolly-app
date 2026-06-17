import React, { useEffect, useRef } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { COLORS, TYPOGRAPHY, SHADOWS } from '../constants/Theme';

const { width } = Dimensions.get('window');

interface PopupProps {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDangerous?: boolean;
}

export default function Popup({
  visible,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Annulla',
  onConfirm,
  onCancel,
  isDangerous = false,
}: PopupProps) {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 65,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.9);
      fadeAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onCancel}
      accessibilityViewIsModal={true}
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
        
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ scale: scaleAnim }],
              opacity: fadeAnim,
            },
          ]}
        >
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>

          <View style={styles.buttonRow}>
            {/* Pulsante Primario (a sinistra) */}
            <Pressable
              style={({ pressed }) => [
                styles.button,
                isDangerous ? styles.buttonDanger : styles.buttonPrimary,
                pressed && styles.buttonPressed,
              ]}
              onPress={onConfirm}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
            >
              <Text style={[styles.buttonText, styles.buttonTextWhite]}>
                {confirmLabel}
              </Text>
            </Pressable>

            {/* Pulsante Secondario (a destra) */}
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.buttonSecondary,
                pressed && styles.buttonPressed,
              ]}
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
            >
              <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
                {cancelLabel}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28, 28, 30, 0.4)',
  },
  card: {
    width: Math.min(width - 48, 320),
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 18,
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: 14,
    color: COLORS.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: COLORS.primary,
  },
  buttonDanger: {
    backgroundColor: COLORS.danger,
  },
  buttonSecondary: {
    backgroundColor: COLORS.border,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 15,
  },
  buttonTextWhite: {
    color: '#FFFFFF',
  },
  buttonTextSecondary: {
    color: COLORS.primary,
  },
});
