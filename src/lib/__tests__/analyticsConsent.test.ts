import {
  analyticsConsentStorageKey,
  loadAnalyticsConsent,
  saveAnalyticsConsent,
} from '../analyticsConsent';

function storage(value: string | null = null) {
  return {
    getItem: jest.fn().mockResolvedValue(value),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  };
}

describe('analytics consent persistence', () => {
  it.each(['granted', 'denied'] as const)('loads a saved %s choice', async (choice) => {
    expect(await loadAnalyticsConsent(storage(choice))).toBe(choice);
  });

  it('defaults to unknown for absent, malformed, or unavailable storage', async () => {
    expect(await loadAnalyticsConsent(storage(null))).toBe('unknown');
    expect(await loadAnalyticsConsent(storage('yes'))).toBe('unknown');
    const unavailable = storage();
    unavailable.getItem.mockRejectedValue(new Error('unavailable'));
    expect(await loadAnalyticsConsent(unavailable)).toBe('unknown');
  });

  it('persists explicit choices and removes an unknown choice', async () => {
    const target = storage();
    await saveAnalyticsConsent('granted', target);
    await saveAnalyticsConsent('unknown', target);

    expect(target.setItem).toHaveBeenCalledWith(analyticsConsentStorageKey, 'granted');
    expect(target.removeItem).toHaveBeenCalledWith(analyticsConsentStorageKey);
  });
});
