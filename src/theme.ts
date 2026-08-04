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

export const shadow = {
  shadowColor: '#1B211D',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 2,
};
