import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TYPOGRAPHY, SPACING } from '../constants/Theme';

// ─── Types ───────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'warning' | 'error';

interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
}

interface ToastContextValue {
  showToast: (opts: ToastOptions) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export const useToast = () => useContext(ToastContext);

// ─── Config ──────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<ToastType, { bg: string; icon: string; iconColor: string }> = {
  success: { bg: '#1B4332', icon: 'checkmark-circle', iconColor: '#34D399' },
  warning: { bg: '#78350F', icon: 'warning', iconColor: '#FCD34D' },
  error:   { bg: '#7F1D1D', icon: 'close-circle', iconColor: '#FCA5A5' },
};

// ─── Provider ────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [opts, setOpts] = useState<Required<ToastOptions>>({
    message: '',
    type: 'success',
    duration: 3000,
  });
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((options: ToastOptions) => {
    // Cancel any existing timer
    if (timerRef.current) clearTimeout(timerRef.current);

    const merged: Required<ToastOptions> = {
      type: 'success',
      duration: 3000,
      ...options,
    };
    setOpts(merged);
    setVisible(true);

    // Fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    // Auto-dismiss
    timerRef.current = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    }, merged.duration);
  }, [fadeAnim]);

  const config = TYPE_CONFIG[opts.type];

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {visible && (
        <Animated.View
          style={[
            styles.toast,
            { backgroundColor: config.bg, bottom: insets.bottom + 90, opacity: fadeAnim },
          ]}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          <Ionicons name={config.icon as any} size={20} color={config.iconColor} style={styles.icon} />
          <Text style={styles.message} numberOfLines={2}>{opts.message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 16,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 9999,
    // Shadow
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  icon: {
    marginRight: 10,
    flexShrink: 0,
  },
  message: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
  },
});
