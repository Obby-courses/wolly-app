/**
 * Centralized Theme System for Wolly
 */

export const COLORS = {
  // Brand Colors
  primary: '#1C1C1E', // Soft, deep off-black
  secondary: '#8E8E93', // Sophisticated warm gray
  accent: '#000000', // Deep contrast for accents
  brandBlue: '#007AFF', // Saturated premium blue (main color after black/white)
  success: '#34C759',
  warning: '#FF9500',
  danger: '#FF3B30',
  background: '#F2F2F7', // Premium warm off-white
  surface: '#FFFFFF',
  border: '#E5E5EA',

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
    shadowOpacity: 0.02,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  medium: {
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4
  }
};
