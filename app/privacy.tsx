import { router } from 'expo-router';
import { PrivacyAnalyticsScreen } from '../src/features/profile/PrivacyAnalyticsScreen';

export default function PrivacyScreen() {
  return <PrivacyAnalyticsScreen onBack={() => router.back()} />;
}
