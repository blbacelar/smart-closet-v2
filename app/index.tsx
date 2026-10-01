import { Redirect } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useOnboardingStatus } from '../src/features/profile/useProfile';
import { useAuth } from '../src/providers/AuthProvider';
import { colors, fonts } from '../src/theme';

export default function Index() {
  const { identity } = useAuth();
  const onboarding = useOnboardingStatus(identity?.id);

  if (onboarding.isLoading) {
    return <View style={styles.center}><ActivityIndicator color={colors.ink} /></View>;
  }
  if (onboarding.isError) {
    return (
      <View style={styles.center}>
        <Text accessibilityRole="alert" style={styles.message}>Could not load your setup.</Text>
        <Pressable accessibilityRole="button" onPress={() => onboarding.refetch()} style={styles.retry}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return <Redirect href={onboarding.data?.completed ? '/(tabs)/tryon' : '/onboarding'} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.canvas },
  message: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginBottom: 14 },
  retry: { minWidth: 120, height: 44, paddingHorizontal: 20, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  retryText: { fontFamily: fonts.body, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, color: colors.white },
});
