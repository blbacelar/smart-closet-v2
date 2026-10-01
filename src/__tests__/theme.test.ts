import { colors, fonts, motion, radii, spacing } from '../theme';

describe('Fitly design tokens', () => {
  it('provides semantic color and typography tokens', () => {
    expect(colors.canvas).toMatch(/^#/);
    expect(colors.surface).toMatch(/^#/);
    expect(colors.ink).toMatch(/^#/);
    expect(fonts.display).toBeTruthy();
    expect(fonts.body).toBeTruthy();
  });

  it('uses a consistent four-point spacing scale', () => {
    expect(spacing).toEqual({
      xxs: 4,
      xs: 8,
      sm: 12,
      md: 16,
      lg: 24,
      xl: 32,
      xxl: 48,
    });
  });

  it('provides shared radii and motion durations', () => {
    expect(radii).toEqual({
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
      pill: 999,
    });
    expect(motion).toEqual({
      instant: 0,
      fast: 150,
      standard: 250,
      slow: 400,
    });
  });
});
