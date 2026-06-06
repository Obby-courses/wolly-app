/**
 * WollyFeatureTourSlide
 *
 * A single slide for the onboarding feature tour.
 * Shows a large illustrative icon, a big action title, a subtitle,
 * and a CTA button. If disabled (permission denied), the card is
 * dimmed and the CTA is replaced with a "Salta →" text link.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { TYPOGRAPHY } from '../../constants/Theme';

export interface WollyFeatureTourSlideProps {
  /** Ionicons icon name shown large at top of slide */
  icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
  /** Big action title */
  title: string;
  /** Descriptive subtitle / how-to */
  subtitle: string;
  /** CTA button label (shown only when not disabled) */
  ctaLabel?: string;
  /** Called when CTA is pressed */
  onCta?: () => void;
  /** Called when "Salta" is pressed (disabled state) */
  onSkip?: () => void;
  /** When true: dims the slide and shows skip link instead of CTA */
  disabled?: boolean;
  /** Label shown under icon when disabled instead of subtitle */
  disabledLabel?: string;
  /** Whether this slide has already been completed */
  completed?: boolean;
}

export default function WollyFeatureTourSlide({
  icon,
  title,
  subtitle,
  ctaLabel = 'Prova ora',
  onCta,
  onSkip,
  disabled = false,
  disabledLabel = 'Accesso non concesso',
  completed = false,
}: WollyFeatureTourSlideProps) {
  return (
    <View style={[styles.slide, disabled && styles.slideDisabled]}>
      {/* ── Large illustrative icon ── */}
      <View style={styles.iconWrapper}>
        {completed ? (
          <Ionicons name="checkmark-circle" size={52} color="rgba(255,255,255,0.95)" />
        ) : disabled ? (
          <View style={styles.disabledIconStack}>
            <Ionicons name={icon} size={48} color="rgba(255,255,255,0.6)" />
            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={11} color="rgba(255,255,255,0.9)" />
            </View>
          </View>
        ) : (
          <LinearGradient
            colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.08)']}
            style={styles.iconGradientBg}
          >
            <Ionicons name={icon} size={48} color="#FFFFFF" />
          </LinearGradient>
        )}
      </View>

      {/* ── Title (big) ── */}
      <Text style={[styles.title, disabled && styles.titleDisabled]} numberOfLines={2}>
        {title}
      </Text>

      {/* ── Subtitle / disabled label ── */}
      <Text style={[styles.subtitle, disabled && styles.subtitleDisabled]} numberOfLines={3}>
        {disabled ? disabledLabel : subtitle}
      </Text>

      {/* ── CTA ── */}
      {!completed && (
        disabled ? (
          <Pressable onPress={onSkip} style={styles.skipBtn} hitSlop={8}>
            <Text style={styles.skipText}>Salta →</Text>
          </Pressable>
        ) : (
          <Pressable onPress={onCta} style={styles.ctaWrapper}>
            <LinearGradient
              colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.12)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaGradient}
            >
              <Text style={styles.ctaText}>{ctaLabel}</Text>
              <Ionicons name="arrow-forward" size={14} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </LinearGradient>
          </Pressable>
        )
      )}

      {completed && (
        <View style={styles.completedBadge}>
          <Text style={styles.completedText}>Completato</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  slide: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 6,
    alignItems: 'flex-start',
  },
  slideDisabled: {
    opacity: 0.48,
  },

  // Icon
  iconWrapper: {
    marginBottom: 14,
  },
  iconGradientBg: {
    width: 76,
    height: 76,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  disabledIconStack: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 8,
    padding: 3,
  },

  // Title
  title: {
    fontSize: 24,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#FFFFFF',
    lineHeight: 30,
    marginBottom: 6,
  },
  titleDisabled: {
    color: 'rgba(255,255,255,0.7)',
  },

  // Subtitle
  subtitle: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 19,
    marginBottom: 16,
  },
  subtitleDisabled: {
    color: 'rgba(255,255,255,0.45)',
  },

  // CTA
  ctaWrapper: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 4,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  ctaText: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontBold,
    color: '#FFFFFF',
  },

  // Skip
  skipBtn: {
    marginBottom: 4,
  },
  skipText: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontBold,
    color: 'rgba(255,255,255,0.55)',
  },

  // Completed badge
  completedBadge: {
    backgroundColor: 'rgba(52,199,89,0.25)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 4,
  },
  completedText: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontBold,
    color: 'rgba(52,220,100,0.95)',
  },
});
