import { Platform } from 'react-native';

export const colors = {
  canvas: '#F4F4F2',
  surface: '#FFFFFF',
  ink: '#141414',
  muted: '#8A8A8F',
  forest: '#141414',
  forestDark: '#0D0D0F',
  sage: '#F1F0ED',
  sageDeep: '#DEDCD6',
  coral: '#141414',
  coralSoft: '#F1F0ED',
  sand: '#E9E8E4',
  line: 'rgba(0,0,0,0.10)',
  white: '#FFFFFF',
  warning: '#636366',
};

export const fonts = {
  display: Platform.select({ ios: 'Helvetica Neue', android: 'sans-serif', web: 'Helvetica Neue' }),
  body: Platform.select({ ios: 'Helvetica Neue', android: 'sans-serif', web: 'Helvetica Neue' }),
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const motion = {
  instant: 0,
  fast: 150,
  standard: 250,
  slow: 400,
} as const;

export function createShadow(platform = Platform.OS) {
  if (platform === 'web') {
    return { boxShadow: '0 8px 12px rgba(27,33,29,0.06)' as const };
  }

  return {
    shadowColor: '#1B211D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  };
}

export const shadow = createShadow();
