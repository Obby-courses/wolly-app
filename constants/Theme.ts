/**
 * Centralized Theme System for Wolly
 */

export const COLORS = {
  // Brand Colors
  primary: '#111827', // Black/Dark Gray
  secondary: '#6B7280', // Medium Gray
  accent: '#3B82F6', // Blue
  success: '#10B981', // Green
  warning: '#F59E0B', // Orange
  danger: '#EF4444', // Red
  background: '#F9FAFB',
  surface: '#FFFFFF',
  border: '#F3F4F6',

  // Category Specific Colors
  categories: {
    cibo_bevande: '#6366F1', // Indigo
    acquisti: '#06B6D4', // Cyan
    alloggio: '#8B5CF6', // Violet
    trasporti: '#3B82F6', // Blue
    veicolo: '#F59E0B', // Amber
    vita_intrattenimento: '#EC4899', // Pink
    comunicazione_pc: '#10B981', // Green
    spese_finanziarie: '#EF4444', // Red
    investimenti: '#D97706', // Bronze
    entrata: '#059669', // Emerald
    default: '#9CA3AF'
  }
};

export const TYPOGRAPHY = {
  fontFamily: 'Outfit_400Regular', // We'll need to load this
  fontBold: 'Outfit_700Bold',
  sizes: {
    xs: 10,
    sm: 12,
    base: 14,
    lg: 16,
    xl: 20,
    xxl: 24,
    huge: 32,
    giant: 48
  }
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  huge: 32
};

export const SHADOWS = {
  soft: {
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 2
  },
  medium: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 5
  }
};
