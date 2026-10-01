import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { ArrowLeft, Lock, Shield } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import {
  AnalyticsConsentStorage,
  loadAnalyticsConsent,
  saveAnalyticsConsent,
} from '../../lib/analyticsConsent';
import { AnalyticsConsent, ObservabilityClient, observability } from '../../lib/observability';
import { colors, fonts } from '../../theme';

type PrivacyAnalyticsScreenProps = {
  onBack: () => void;
  observabilityClient?: ObservabilityClient;
  storage?: AnalyticsConsentStorage;
};

export function PrivacyAnalyticsScreen({
  onBack,
  observabilityClient = observability,
  storage,
}: PrivacyAnalyticsScreenProps) {
  const [consent, setConsent] = useState<AnalyticsConsent>('unknown');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void loadAnalyticsConsent(storage).then((storedConsent) => {
      if (!active) return;
      setConsent(storedConsent);
      observabilityClient.setAnalyticsConsent(storedConsent);
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [observabilityClient, storage]);

  const updateConsent = async (enabled: boolean) => {
    const nextConsent: AnalyticsConsent = enabled ? 'granted' : 'denied';
    const previousConsent = consent;
    setConsent(nextConsent);
    setSaveFailed(false);
    setIsSaving(true);
    observabilityClient.setAnalyticsConsent(nextConsent);

    try {
      await saveAnalyticsConsent(nextConsent, storage);
    } catch {
      setConsent(previousConsent);
      observabilityClient.setAnalyticsConsent(previousConsent);
      setSaveFailed(true);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={onBack} style={styles.back}>
        <ArrowLeft color={colors.ink} size={20} />
      </Pressable>
      <Text style={styles.eyebrow}>Privacy & visibility</Text>
      <Text style={styles.title}>Your data stays yours.</Text>
      <Text style={styles.intro}>
        Body photos, wardrobe items, and fitting results are private. Fitly never uses session replay.
      </Text>

      <View style={styles.card}>
        <View style={styles.icon}><Shield color={colors.ink} size={19} /></View>
        <View style={styles.settingCopy}>
          <Text style={styles.settingTitle}>Share optional product analytics</Text>
          <Text style={styles.settingDescription}>
            Help improve signup, garment upload, try-on, and subscription screens using simple event counts.
          </Text>
        </View>
        <Switch
          accessibilityLabel="Share optional product analytics"
          accessibilityState={{ disabled: isLoading || isSaving }}
          disabled={isLoading || isSaving}
          onValueChange={updateConsent}
          trackColor={{ false: colors.sageDeep, true: colors.ink }}
          thumbColor={colors.white}
          value={consent === 'granted'}
        />
      </View>

      {saveFailed && (
        <Text accessibilityRole="alert" style={styles.error}>
          We couldn't save that privacy choice. Please try again.
        </Text>
      )}

      <View style={styles.privateCard}>
        <Lock color={colors.ink} size={18} />
        <Text style={styles.privateText}>
          Analytics never includes your photos, generated images, email, name, messages, exact location, or private file links. You can turn it off at any time.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 18 },
  back: { alignItems: 'center', justifyContent: 'center', width: 42, height: 42, marginBottom: 20, borderRadius: 13, backgroundColor: colors.surface },
  eyebrow: { fontFamily: fonts.body, color: colors.muted, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { marginTop: 8, fontFamily: fonts.display, color: colors.ink, fontSize: 32, lineHeight: 36, fontWeight: '600', letterSpacing: -0.8 },
  intro: { marginTop: 12, fontFamily: fonts.body, color: colors.muted, fontSize: 14, lineHeight: 21 },
  card: { marginTop: 26, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  icon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.sage },
  settingCopy: { flex: 1 },
  settingTitle: { fontFamily: fonts.body, color: colors.ink, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  settingDescription: { marginTop: 5, fontFamily: fonts.body, color: colors.muted, fontSize: 11, lineHeight: 16 },
  error: { marginTop: 14, padding: 13, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.sage, fontFamily: fonts.body, color: '#8C3C34', fontSize: 12, lineHeight: 18 },
  privateCard: { marginTop: 18, padding: 17, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 14, backgroundColor: colors.sage },
  privateText: { flex: 1, fontFamily: fonts.body, color: colors.ink, fontSize: 12, lineHeight: 18 },
});
