import packageJson from '../../../package.json';
import { fonts } from '../../theme';

describe('privacy-sensitive dependencies', () => {
  const directDependencies = Object.keys(packageJson.dependencies ?? {});

  it('does not ship a session-replay SDK', () => {
    const replayPackages = [
      'posthog',
      'fullstory',
      'logrocket',
      'smartlook',
      'uxcam',
      'clarity',
    ];

    expect(
      directDependencies.filter((dependency) =>
        replayPackages.some((vendor) => dependency.toLowerCase().includes(vendor)),
      ),
    ).toEqual([]);
  });

  it('uses platform fonts without remote Google Fonts requests', () => {
    expect(directDependencies.some((dependency) => dependency.startsWith('@expo-google-fonts/')))
      .toBe(false);
    expect(Object.values(fonts).join(' ')).not.toMatch(/https?:|fonts\.(?:googleapis|gstatic)\.com/i);
  });
});
