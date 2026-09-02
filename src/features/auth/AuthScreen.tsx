import { ArrowRight, Lock, Sparkles } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../../theme';
import { AuthGateway, supabaseAuthGateway } from './authGateway';
import { AuthFieldErrors, AuthFields, AuthMode, validateAuthForm } from './credentials';

type AuthScreenProps = {
  gateway?: AuthGateway;
};

const initialFields: AuthFields = { displayName: '', email: '', password: '' };

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Try again.';
}

export function AuthScreen({ gateway = supabaseAuthGateway }: AuthScreenProps) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [fields, setFields] = useState(initialFields);
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [statusMessage, setStatusMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSignIn = mode === 'sign-in';

  const updateField = (field: keyof AuthFields, value: string) => {
    setFields((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setStatusMessage('');
  };

  const switchMode = () => {
    setMode(isSignIn ? 'sign-up' : 'sign-in');
    setErrors({});
    setStatusMessage('');
  };

  const submit = async () => {
    const result = validateAuthForm(fields, mode);
    setFields(result.values);
    setErrors(result.errors);
    setStatusMessage('');

    if (Object.keys(result.errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSignIn) {
        await gateway.signIn({ email: result.values.email, password: result.values.password });
      } else {
        const outcome = await gateway.signUp(result.values);
        if (outcome.requiresEmailConfirmation) {
          setStatusMessage('Check your email to confirm your account.');
        }
      }
    } catch (error) {
      setStatusMessage(messageFrom(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View>
          <View style={styles.wordmarkRow}>
            <View style={styles.mark}>
              <Sparkles size={15} color={colors.white} />
            </View>
            <Text style={styles.wordmark}>FITLY</Text>
          </View>

          <Text style={styles.eyebrow}>Your private fitting room</Text>
          <Text style={styles.title}>{isSignIn ? 'Welcome back.' : 'Start your closet.'}</Text>
          <Text style={styles.subtitle}>
            {isSignIn
              ? 'Sign in to keep your wardrobe and fittings in sync.'
              : 'See clothes on you before you buy them.'}
          </Text>
        </View>

        <View style={styles.form}>
          {!isSignIn && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                accessibilityLabel="Name"
                autoCapitalize="words"
                autoComplete="name"
                onChangeText={(value) => updateField('displayName', value)}
                placeholder="Your name"
                placeholderTextColor={colors.muted}
                style={[styles.input, errors.displayName && styles.inputError]}
                value={fields.displayName}
              />
              {errors.displayName && <Text style={styles.error}>{errors.displayName}</Text>}
            </View>
          )}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              accessibilityLabel="Email"
              autoCapitalize="none"
              autoComplete="email"
              inputMode="email"
              onChangeText={(value) => updateField('email', value)}
              placeholder="you@example.com"
              placeholderTextColor={colors.muted}
              style={[styles.input, errors.email && styles.inputError]}
              value={fields.email}
            />
            {errors.email && <Text style={styles.error}>{errors.email}</Text>}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              accessibilityLabel="Password"
              autoCapitalize="none"
              autoComplete={isSignIn ? 'current-password' : 'new-password'}
              onChangeText={(value) => updateField('password', value)}
              placeholder="At least 8 characters"
              placeholderTextColor={colors.muted}
              secureTextEntry
              style={[styles.input, errors.password && styles.inputError]}
              value={fields.password}
            />
            {errors.password && <Text style={styles.error}>{errors.password}</Text>}
          </View>

          {!!statusMessage && <Text style={styles.status}>{statusMessage}</Text>}

          <Pressable
            accessibilityLabel={isSignIn ? 'Sign in' : 'Create account'}
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={submit}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>
                  {isSignIn ? 'Sign in' : 'Create account'}
                </Text>
                <ArrowRight size={17} color={colors.white} />
              </>
            )}
          </Pressable>

          <Pressable
            accessibilityLabel={isSignIn ? 'Create an account' : 'Sign in instead'}
            accessibilityRole="button"
            onPress={switchMode}
            style={styles.switchButton}
          >
            <Text style={styles.switchText}>
              {isSignIn ? 'New to Fitly? ' : 'Already have an account? '}
              <Text style={styles.switchTextStrong}>
                {isSignIn ? 'Create an account' : 'Sign in'}
              </Text>
            </Text>
          </Pressable>
        </View>

        <View style={styles.privacyRow}>
          <Lock size={12} color={colors.muted} />
          <Text style={styles.privacyText}>Your photos stay private and are never public by default.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: 24 },
  wordmarkRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 72 },
  mark: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  wordmark: { fontFamily: fonts.body, fontSize: 13, fontWeight: '800', letterSpacing: 2.4, color: colors.ink },
  eyebrow: { fontFamily: fonts.body, fontSize: 10, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 9 },
  title: { fontFamily: fonts.display, fontSize: 38, lineHeight: 42, fontWeight: '600', letterSpacing: -1.1, color: colors.ink },
  subtitle: { maxWidth: 330, marginTop: 12, fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.muted },
  form: { marginTop: 44 },
  fieldGroup: { marginBottom: 17 },
  label: { marginBottom: 7, fontFamily: fonts.body, fontSize: 10, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase', color: colors.ink },
  input: { height: 54, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.line, borderRadius: 13, backgroundColor: colors.surface, fontFamily: fonts.body, fontSize: 16, color: colors.ink },
  inputError: { borderColor: '#B54A4A' },
  error: { marginTop: 6, fontFamily: fonts.body, fontSize: 11, color: '#A13F3F' },
  status: { marginBottom: 14, padding: 12, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.sage, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.ink },
  primaryButton: { height: 54, paddingHorizontal: 18, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.ink },
  primaryButtonText: { fontFamily: fonts.body, fontSize: 11, fontWeight: '800', letterSpacing: 1.3, textTransform: 'uppercase', color: colors.white },
  pressed: { opacity: 0.82 },
  switchButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  switchText: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  switchTextStrong: { fontWeight: '700', color: colors.ink },
  privacyRow: { marginTop: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  privacyText: { flexShrink: 1, fontFamily: fonts.body, fontSize: 10, lineHeight: 14, color: colors.muted },
});
