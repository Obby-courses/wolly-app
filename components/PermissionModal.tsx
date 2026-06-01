import React from 'react';
import { StyleSheet, View, Text, Pressable, Modal, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SHADOWS } from '../constants/Theme';

export type PermissionType = 'microphone' | 'camera' | null;

interface PermissionModalProps {
  visible: boolean;
  type: PermissionType;
  onClose: () => void;
}

export default function PermissionModal({ visible, type, onClose }: PermissionModalProps) {
  if (!visible || !type) return null;

  const content = {
    microphone: {
      icon: 'mic-off-outline' as const,
      title: 'Microfono disattivato',
      desc: "Per usare i comandi vocali e registrare le tue transazioni parlando, Wolly ha bisogno dell'accesso al microfono."
    },
    camera: {
      icon: 'camera-outline' as const,
      title: 'Fotocamera disattivata',
      desc: "Per scansionare gli scontrini tramite foto, Wolly ha bisogno dell'accesso alla fotocamera."
    }
  };

  const current = content[type];

  const handleOpenSettings = () => {
    onClose();
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Ionicons name={current.icon} size={40} color="#EF4444" />
          </View>
          
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.desc}>{current.desc}</Text>
          
          <View style={styles.buttonRow}>
            <Pressable style={[styles.btn, styles.btnCancel]} onPress={onClose}>
              <Text style={styles.btnCancelText}>Annulla</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnSettings]} onPress={handleOpenSettings}>
              <Text style={styles.btnSettingsText}>Apri Impostazioni</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#0F172A',
    marginBottom: 12,
    textAlign: 'center',
  },
  desc: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  btn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancel: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  btnCancelText: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#0F172A',
  },
  btnSettings: {
    backgroundColor: '#0A74FF',
  },
  btnSettingsText: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#FFFFFF',
  },
});
