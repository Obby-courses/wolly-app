import React from 'react';
import { StyleSheet, View, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SPACING } from '../constants/Theme';

export default function TopNavigation() {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

const navItems = [
    { path: '/', icon: 'home-outline', activeIcon: 'home', label: 'Home' },
    { path: '/stats', icon: 'pie-chart-outline', activeIcon: 'pie-chart', label: 'Statistiche' },
    { path: '/subscriptions', icon: 'card-outline', activeIcon: 'card', label: 'Abbonamenti' },
  ];

  return (
    <View style={styles.outerContainer}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.leftGroup}>
            {navItems.map((item) => {
              const active = isActive(item.path);
              return (
                <Pressable
                  key={item.path}
                  onPress={() => router.push(item.path as any)}
                  style={[
                    styles.navBtn,
                    active && styles.navBtnActive
                  ]}
                >
                  <Ionicons
                    name={active ? (item.activeIcon as any) : (item.icon as any)}
                    size={22}
                    color={active ? COLORS.primary : COLORS.secondary}
                  />
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => router.push('/settings')}
            style={[
              styles.navBtn,
              styles.settingsBtn,
              isActive('/settings') && styles.navBtnActive
            ]}
          >
            <Ionicons
              name={isActive('/settings') ? "settings" : "settings-outline"}
              size={22}
              color={isActive('/settings') ? COLORS.primary : COLORS.secondary}
            />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    backgroundColor: COLORS.background,
    zIndex: 100,
  },
  safeArea: {
    backgroundColor: COLORS.background,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
    height: 56,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 4,
    borderRadius: 24,
    gap: 4,
  },
  navBtn: {
    width: 48,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  settingsBtn: {
    backgroundColor: '#F3F4F6',
    width: 40,
    height: 40,
  },
  navBtnActive: {
    backgroundColor: COLORS.surface,
    ...SHADOWS.soft,
  },
});
