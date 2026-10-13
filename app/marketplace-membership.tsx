import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { MarketplaceMembershipScreen } from '../src/features/marketplace/MarketplaceMembershipScreen';
import {
  useActivateMarketplaceMembership,
  useMarketplaceSummary,
} from '../src/features/marketplace/useMarketplace';
import { useAuth } from '../src/providers/AuthProvider';
import { colors, fonts } from '../src/theme';

export default function MarketplaceMembershipRoute() {
  const { identity } = useAuth();
  const summary = useMarketplaceSummary(identity?.id);
  const activate = useActivateMarketplaceMembership();
  const [message, setMessage] = useState('');

  if (summary.isLoading) {
    return <View style={styles.center}><ActivityIndicator color={colors.ink} /></View>;
  }
  if (summary.isError || !summary.data) {
    return <View style={styles.center}><Text style={styles.message}>Could not load membership details.</Text></View>;
  }

  const onActivate = async () => {
    setMessage('');
    try {
      const result = await activate.mutateAsync();
      setMessage(result.creditsGranted > 0
        ? `${result.creditsGranted} Fitly Credits were added to your account.`
        : 'Your membership is already active.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not activate membership.');
    }
  };

  return (
    <MarketplaceMembershipScreen
      summary={summary.data}
      isActivating={activate.isPending}
      message={message}
      onActivate={() => void onActivate()}
      onClose={() => router.back()}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.canvas },
  message: { fontFamily: fonts.body, color: colors.muted, fontSize: 13, textAlign: 'center' },
});
