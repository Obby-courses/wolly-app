/**
 * SlideCarousel – generic reusable slide container
 *
 * Provides:
 *  - X button (top-right) → calls onDismiss + persists dismiss to AsyncStorage
 *  - Dot indicators (shown when slides.length > 1)
 *  - Horizontal swipe between slides via PanResponder
 *  - Optional top label/badge
 *  - onComplete() callback fired after last slide is "advanced" past
 *
 * Content of each slide is fully determined by the caller.
 * This component is content-agnostic and can be reused for any feature.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { TYPOGRAPHY } from '../constants/Theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 60;

export interface SlideCarouselSlide {
  key: string;
  content: React.ReactNode;
}

export interface SlideCarouselProps {
  /** Array of slides to display */
  slides: SlideCarouselSlide[];
  /** AsyncStorage key used to persist the dismissed state */
  storageKey: string;
  /** Optional small badge text shown above the slides */
  label?: string;
  /** Called after the user presses X (after state is persisted) */
  onDismiss?: () => void;
  /** Called when the user advances past the last slide */
  onComplete?: () => void;
  /** Controlled current slide index (optional – uses internal state if omitted) */
  currentIndex?: number;
  /** Called when the internal index changes (useful for syncing external state) */
  onIndexChange?: (index: number) => void;
}

export default function SlideCarousel({
  slides,
  storageKey,
  label,
  onDismiss,
  onComplete,
  currentIndex: controlledIndex,
  onIndexChange,
}: SlideCarouselProps) {
  const [internalIndex, setInternalIndex] = useState(0);
  const activeIndex = controlledIndex !== undefined ? controlledIndex : internalIndex;

  const translateX = useRef(new Animated.Value(0)).current;
  const isDragging = useRef(false);

  // Advance to next slide or fire onComplete if already on last
  const goNext = useCallback(() => {
    if (activeIndex < slides.length - 1) {
      const next = activeIndex + 1;
      Animated.timing(translateX, {
        toValue: -next * SCREEN_WIDTH,
        duration: 260,
        useNativeDriver: true,
      }).start();
      setInternalIndex(next);
      onIndexChange?.(next);
    } else {
      onComplete?.();
    }
  }, [activeIndex, slides.length, translateX, onIndexChange, onComplete]);

  const goPrev = useCallback(() => {
    if (activeIndex > 0) {
      const prev = activeIndex - 1;
      Animated.timing(translateX, {
        toValue: -prev * SCREEN_WIDTH,
        duration: 260,
        useNativeDriver: true,
      }).start();
      setInternalIndex(prev);
      onIndexChange?.(prev);
    }
  }, [activeIndex, translateX, onIndexChange]);

  // Sync translateX if controlled index changes externally
  useEffect(() => {
    if (controlledIndex !== undefined) {
      Animated.timing(translateX, {
        toValue: -controlledIndex * SCREEN_WIDTH,
        duration: 260,
        useNativeDriver: true,
      }).start();
    }
  }, [controlledIndex]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy),
      onPanResponderGrant: () => {
        isDragging.current = true;
      },
      onPanResponderMove: (_, { dx }) => {
        translateX.setValue(-activeIndex * SCREEN_WIDTH + dx);
      },
      onPanResponderRelease: (_, { dx }) => {
        isDragging.current = false;
        if (dx < -SWIPE_THRESHOLD) {
          goNext();
        } else if (dx > SWIPE_THRESHOLD) {
          goPrev();
        } else {
          // snap back
          Animated.spring(translateX, {
            toValue: -activeIndex * SCREEN_WIDTH,
            useNativeDriver: true,
            tension: 80,
            friction: 10,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        isDragging.current = false;
        Animated.spring(translateX, {
          toValue: -activeIndex * SCREEN_WIDTH,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }).start();
      },
    })
  ).current;

  // Keep panResponder handlers updated with latest activeIndex
  // (workaround for stale closure in PanResponder)
  const activeIndexRef = useRef(activeIndex);
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const handleDismiss = async () => {
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify({ dismissed: true }));
    } catch (_) {}
    onDismiss?.();
  };

  if (slides.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* ── Top row: label + X ── */}
      <View style={styles.topRow}>
        {label ? (
          <View style={styles.labelBadge}>
            <Ionicons name="sparkles" size={10} color="rgba(255,255,255,0.9)" style={{ marginRight: 4 }} />
            <Text style={styles.labelText}>{label}</Text>
          </View>
        ) : (
          <View />
        )}
        <Pressable
          onPress={handleDismiss}
          hitSlop={12}
          style={styles.closeBtn}
          accessibilityLabel="Chiudi"
          accessibilityRole="button"
        >
          <Ionicons name="close" size={16} color="rgba(255,255,255,0.8)" />
        </Pressable>
      </View>

      {/* ── Slides ── */}
      <View style={styles.slidesViewport} {...panResponder.panHandlers}>
        <Animated.View
          style={[
            styles.slidesTrack,
            { width: SCREEN_WIDTH * slides.length, transform: [{ translateX }] },
          ]}
        >
          {slides.map((slide) => (
            <View key={slide.key} style={[styles.slideCell, { width: SCREEN_WIDTH }]}>
              {slide.content}
            </View>
          ))}
        </Animated.View>
      </View>

      {/* ── Dot indicators ── */}
      {slides.length > 1 && (
        <View style={styles.dotsRow}>
          {slides.map((slide, i) => (
            <View
              key={slide.key}
              style={[
                styles.dot,
                i === activeIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
    marginTop: 14,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 2,
  },
  labelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  labelText: {
    fontSize: 9,
    fontFamily: TYPOGRAPHY.fontBold,
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slidesViewport: {
    overflow: 'hidden',
  },
  slidesTrack: {
    flexDirection: 'row',
  },
  slideCell: {
    // Each slide fills the carousel width; inner padding handled by slide content
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 12,
    paddingTop: 8,
    gap: 6,
  },
  dot: {
    borderRadius: 4,
    height: 6,
  },
  dotActive: {
    width: 18,
    backgroundColor: '#FFFFFF',
    opacity: 1,
  },
  dotInactive: {
    width: 6,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
});
