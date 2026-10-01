import { router } from 'expo-router';
import { useState } from 'react';
import { OnboardingIntro } from '../src/features/profile/OnboardingIntro';
import { useCompleteOnboarding } from '../src/features/profile/useProfile';
import { useAuth } from '../src/providers/AuthProvider';

export default function OnboardingScreen() {
  const { identity } = useAuth();
  const completion = useCompleteOnboarding(identity?.id ?? 'signed-out');
  const [error, setError] = useState('');

  const complete = async () => {
    if (!identity) return;
    setError('');
    try {
      await completion.mutateAsync();
      router.replace('/(tabs)/tryon');
    } catch {
      setError('Could not save your setup. Try again.');
    }
  };

  return <OnboardingIntro error={error} isCompleting={completion.isPending} onComplete={complete} />;
}
