import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppErrorBoundary } from '../src/components/AppErrorBoundary';
import { I18nProvider } from '../src/i18n/i18n';
import { observability } from '../src/lib/observability';
import { MotionPreferenceProvider } from '../src/providers/MotionPreferenceProvider';
import { AuthProvider, useAuth } from '../src/providers/AuthProvider';
import { colors } from '../src/theme';

const queryClient = new QueryClient();

function RootNavigator() {
  const { identity, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  const isSignedIn = Boolean(identity);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="add-body-photo" options={{ presentation: 'modal' }} />
        <Stack.Screen name="add-garment" options={{ presentation: 'modal' }} />
        <Stack.Screen name="pro" options={{ presentation: 'modal' }} />
        <Stack.Screen name="delete-account" options={{ presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  observability.track('app_opened', { source: 'launch' });

  return (
    <AppErrorBoundary>
      <I18nProvider>
        <MotionPreferenceProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <StatusBar style="dark" />
              <RootNavigator />
            </AuthProvider>
          </QueryClientProvider>
        </MotionPreferenceProvider>
      </I18nProvider>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
});
