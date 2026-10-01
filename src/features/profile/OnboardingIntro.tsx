import { ArrowRight, Camera, Lock, Shirt, Sparkles } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';

type OnboardingIntroProps = {
  error?: string;
  isCompleting?: boolean;
  analyticsEnabled?: boolean;
  analyticsSaving?: boolean;
  onAnalyticsChange?: (enabled: boolean) => void;
  onComplete: () => void;
};

const steps = [
  { Icon: Camera, title: '1. Add a private body photo', copy: 'Your photo stays private and is used only for your fittings.' },
  { Icon: Shirt, title: '2. Build your digital closet', copy: 'Capture one piece or add up to five garments from your library.' },
  { Icon: Sparkles, title: '3. Try pieces on with AI', copy: 'Choose your photo and a ready garment to create a private fitting.' },
];

export function OnboardingIntro({
  error,
  isCompleting = false,
  analyticsEnabled = false,
  analyticsSaving = false,
  onAnalyticsChange,
  onComplete,
}: OnboardingIntroProps) {
  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.mark}><Sparkles size={20} color={colors.white} /></View>
        <Text style={styles.eyebrow}>Welcome to Fitly</Text>
        <Text style={styles.title}>Your closet, on you.</Text>
        <Text style={styles.subtitle}>Three quick steps turn your wardrobe into a private fitting room.</Text>
      </View>

      <View style={styles.steps}>
        {steps.map(({ Icon, title, copy }) => (
          <View key={title} style={styles.step}>
            <View style={styles.stepIcon}><Icon size={18} color={colors.ink} /></View>
            <View style={styles.stepCopy}>
              <Text style={styles.stepTitle}>{title}</Text>
              <Text style={styles.stepText}>{copy}</Text>
            </View>
          </View>
        ))}
      </View>

      <View>
        <View style={styles.analyticsRow}>
          <View style={styles.analyticsCopy}>
            <Text style={styles.analyticsTitle}>Share optional product analytics</Text>
            <Text style={styles.analyticsText}>Simple event counts only—never photos, names, email, messages, or exact location.</Text>
          </View>
          <Switch
            accessibilityLabel="Share optional product analytics"
            disabled={analyticsSaving}
            onValueChange={onAnalyticsChange}
            trackColor={{ false: colors.sageDeep, true: colors.ink }}
            thumbColor={colors.white}
            value={analyticsEnabled}
          />
        </View>
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <Pressable
          accessibilityLabel={isCompleting ? 'Saving setup' : 'Start my closet'}
          accessibilityRole="button"
          disabled={isCompleting}
          onPress={onComplete}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          {isCompleting ? <ActivityIndicator color={colors.white} /> : (
            <>
              <Text style={styles.buttonText}>Start my closet</Text>
              <ArrowRight size={17} color={colors.white} />
            </>
          )}
        </Pressable>
        <View style={styles.privacy}><Lock size={11} color={colors.muted} /><Text style={styles.privacyText}>Private by default. You control your photos.</Text></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 72, paddingBottom: 32, backgroundColor: colors.canvas },
  hero: { alignItems: 'flex-start' },
  mark: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink, marginBottom: 28 },
  eyebrow: { fontFamily: fonts.body, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, marginBottom: 8 },
  title: { fontFamily: fonts.display, fontSize: 39, lineHeight: 43, fontWeight: '600', letterSpacing: -1.1, color: colors.ink },
  subtitle: { marginTop: 12, maxWidth: 330, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.muted },
  steps: { gap: 12, marginVertical: 30 },
  step: { minHeight: 82, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 13 },
  stepIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sage },
  stepCopy: { flex: 1 },
  stepTitle: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.ink },
  stepText: { marginTop: 4, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.muted },
  error: { marginBottom: 12, padding: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F4E5E2', fontFamily: fonts.body, fontSize: 12, color: '#8C3C34' },
  analyticsRow: { marginBottom: 14, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, backgroundColor: colors.sage },
  analyticsCopy: { flex: 1 },
  analyticsTitle: { fontFamily: fonts.body, fontSize: 11, lineHeight: 15, fontWeight: '700', color: colors.ink },
  analyticsText: { marginTop: 3, fontFamily: fonts.body, fontSize: 9.5, lineHeight: 14, color: colors.muted },
  button: { height: 56, borderRadius: 14, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  buttonText: { fontFamily: fonts.body, fontSize: 11, fontWeight: '800', letterSpacing: 1.3, textTransform: 'uppercase', color: colors.white },
  pressed: { opacity: 0.82 },
  privacy: { marginTop: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  privacyText: { fontFamily: fonts.body, fontSize: 9.5, color: colors.muted },
});
