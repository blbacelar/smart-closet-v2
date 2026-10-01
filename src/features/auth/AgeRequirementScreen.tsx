import { ArrowRight, Shield } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { colors, fonts } from '../../theme';
import { ageEligibilityMessage, checkAgeEligibility } from './ageEligibility';

type Props = {
  onConfirm: () => Promise<void>;
};

export function AgeRequirementScreen({ onConfirm }: Props) {
  const [birthDate, setBirthDate] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    const eligibility = checkAgeEligibility(birthDate);
    const eligibilityMessage = ageEligibilityMessage(eligibility);
    setMessage(eligibilityMessage);
    if (!eligibility.eligible) return;

    setIsSubmitting(true);
    try {
      await onConfirm();
    } catch {
      setMessage('Could not confirm account eligibility. Try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.icon}><Shield color={colors.white} size={25} /></View>
      <Text style={styles.eyebrow}>Account eligibility</Text>
      <Text style={styles.title}>Fitly is for adults.</Text>
      <Text style={styles.intro}>
        Enter your date of birth to confirm that you are 18 or older. We store only the confirmation time, never your birth date.
      </Text>

      <Text style={styles.label}>Date of birth</Text>
      <TextInput
        accessibilityHint="Use four-digit year, two-digit month, and two-digit day"
        accessibilityLabel="Date of birth"
        autoComplete="birthdate-full"
        editable={!isSubmitting}
        inputMode="numeric"
        onChangeText={(value) => {
          setBirthDate(value);
          setMessage('');
        }}
        onSubmitEditing={() => void submit()}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.muted}
        returnKeyType="done"
        style={styles.input}
        value={birthDate}
      />
      {!!message && <Text accessibilityRole="alert" style={styles.message}>{message}</Text>}

      <Pressable
        accessibilityLabel="Confirm age eligibility"
        accessibilityRole="button"
        accessibilityState={{ busy: isSubmitting, disabled: isSubmitting }}
        disabled={isSubmitting}
        onPress={submit}
        style={styles.action}
      >
        {isSubmitting ? <ActivityIndicator color={colors.white} /> : (
          <>
            <Text style={styles.actionText}>Continue</Text>
            <ArrowRight color={colors.white} size={17} />
          </>
        )}
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
  icon: { width: 52, height: 52, marginBottom: 24, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  eyebrow: { fontFamily: fonts.body, color: colors.muted, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { marginTop: 8, fontFamily: fonts.display, color: colors.ink, fontSize: 36, lineHeight: 40, fontWeight: '600', letterSpacing: -1 },
  intro: { marginTop: 12, fontFamily: fonts.body, color: colors.muted, fontSize: 14, lineHeight: 21 },
  label: { marginTop: 32, marginBottom: 8, fontFamily: fonts.body, color: colors.ink, fontSize: 10, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase' },
  input: { height: 54, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.line, borderRadius: 13, backgroundColor: colors.surface, fontFamily: fonts.body, color: colors.ink, fontSize: 16 },
  message: { marginTop: 9, fontFamily: fonts.body, color: '#8C3C34', fontSize: 12, lineHeight: 18 },
  action: { height: 54, marginTop: 20, paddingHorizontal: 18, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: colors.ink },
  actionText: { fontFamily: fonts.body, color: colors.white, fontSize: 11, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' },
});
