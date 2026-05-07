export const COLORS = {
  primary: '#0066FF',
  primaryDark: '#0052CC',
  primaryLight: '#3385FF',

  secondary: '#00C853',
  secondaryDark: '#00A843',
  secondaryLight: '#33D470',

  accent: '#FF6B00',
  accentDark: '#CC5500',
  accentLight: '#FF8833',

  background: '#FFFFFF',
  backgroundSecondary: '#F5F7FA',
  backgroundTertiary: '#E8ECF1',

  surface: '#FFFFFF',
  surfaceHover: '#F8F9FB',

  text: '#1A1D1F',
  textSecondary: '#6F767E',
  textTertiary: '#9A9FA5',
  textInverse: '#FFFFFF',

  border: '#E8ECF1',
  borderLight: '#F3F5F7',

  success: '#00C853',
  error: '#FF3B30',
  warning: '#FFAB00',
  info: '#0066FF',

  income: '#00C853',
  expense: '#FF3B30',

  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.2)',
};

export const TYPOGRAPHY = {
  fontFamily: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
  },
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 40,
  '3xl': 48,
};

export const RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
};
