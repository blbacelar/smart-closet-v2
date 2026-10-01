import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { OnboardingIntro } from '../src/features/profile/OnboardingIntro';
import { useCompleteOnboarding } from '../src/features/profile/useProfile';
import { useAuth } from '../src/providers/AuthProvider';
import { observability } from '../src/lib/observability';
import { loadAnalyticsConsent, saveAnalyticsConsent } from '../src/lib/analyticsConsent';

export default function OnboardingScreen() {
  const { identity } = useAuth();
  const completion = useCompleteOnboarding(identity?.id ?? 'signed-out');
  const [error, setError] = useState('');
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [analyticsSaving, setAnalyticsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void loadAnalyticsConsent().then((consent) => {
      if (active) setAnalyticsEnabled(consent === 'granted');
    });
    return () => {
      active = false;
    };
  }, []);

  const updateAnalytics = async (enabled: boolean) => {
    const previous = analyticsEnabled;
    const consent = enabled ? 'granted' : 'denied';
    setAnalyticsEnabled(enabled);
    setAnalyticsSaving(true);
    observability.setAnalyticsConsent(consent);
    try {
      await saveAnalyticsConsent(consent);
    } catch {
      setAnalyticsEnabled(previous);
      observability.setAnalyticsConsent(previous ? 'granted' : 'denied');
      setError('Could not save your analytics choice. Try again.');
    } finally {
      setAnalyticsSaving(false);
    }
  };

  const complete = async () => {
    if (!identity) return;
    setError('');
    try {
      await completion.mutateAsync();
      observability.track('onboarding_completed');
      router.replace('/(tabs)/tryon');
    } catch {
      setError('Could not save your setup. Try again.');
    }
  };

  return (
    <OnboardingIntro
      analyticsEnabled={analyticsEnabled}
      analyticsSaving={analyticsSaving}
      error={error}
      isCompleting={completion.isPending}
      onAnalyticsChange={updateAnalytics}
      onComplete={complete}
    />
  );
}
