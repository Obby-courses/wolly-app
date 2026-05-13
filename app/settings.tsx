import React from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING } from '../constants/Theme';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dati & Database</Text>
          <Pressable style={styles.item} onPress={() => router.push('/seed-data')}>
            <Ionicons name="server-outline" size={22} color={COLORS.primary} />
            <Text style={styles.itemText}>Gestione Dati & Seed</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.secondary} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Finanze</Text>
          <Pressable style={styles.item} onPress={() => router.push('/subscriptions')}>
            <Ionicons name="repeat-outline" size={22} color={COLORS.primary} />
            <Text style={styles.itemText}>Abbonamenti & Ricorrenti</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.secondary} />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: SPACING.xl,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: TYPOGRAPHY.sizes.xxl,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.primary,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: 100,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontFamily: TYPOGRAPHY.fontBold,
    color: COLORS.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.md,
    marginLeft: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: 16,
    marginBottom: SPACING.sm,
  },
  itemText: {
    flex: 1,
    marginLeft: SPACING.md,
    fontSize: TYPOGRAPHY.sizes.base,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.primary,
  }
});
