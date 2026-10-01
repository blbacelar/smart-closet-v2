import AsyncStorage from '@react-native-async-storage/async-storage';
import { AnalyticsConsent } from './observability';

export const analyticsConsentStorageKey = 'fitly.analytics-consent.v1';

export type AnalyticsConsentStorage = Pick<
  typeof AsyncStorage,
  'getItem' | 'setItem' | 'removeItem'
>;

export async function loadAnalyticsConsent(
  storage: AnalyticsConsentStorage = AsyncStorage,
): Promise<AnalyticsConsent> {
  try {
    const value = await storage.getItem(analyticsConsentStorageKey);
    return value === 'granted' || value === 'denied' ? value : 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function saveAnalyticsConsent(
  consent: AnalyticsConsent,
  storage: AnalyticsConsentStorage = AsyncStorage,
): Promise<void> {
  if (consent === 'unknown') {
    await storage.removeItem(analyticsConsentStorageKey);
    return;
  }

  await storage.setItem(analyticsConsentStorageKey, consent);
}
