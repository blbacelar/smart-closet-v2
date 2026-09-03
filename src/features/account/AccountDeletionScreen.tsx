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

type AccountDeletionScreenProps = {
  onCancel: () => void;
  onDelete: () => Promise<void>;
};

const confirmationPhrase = 'DELETE';
const safeFailureMessage = "We couldn't delete your account. Please try again.";

export function AccountDeletionScreen({ onCancel, onDelete }: AccountDeletionScreenProps) {
  const insets = useSafeAreaInsets();
  const [confirmation, setConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canDelete = confirmation === confirmationPhrase && !isDeleting;

  const handleDelete = async () => {
    if (!canDelete) return;

    setError(null);
    setIsDeleting(true);
    try {
      await onDelete();
    } catch {
      setError(safeFailureMessage);
      setIsDeleting(false);
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
          { paddingTop: insets.top + 22, paddingBottom: insets.bottom + 28 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>Privacy & account</Text>
        <Text style={styles.title}>Delete your account?</Text>
        <Text style={styles.intro}>
          This action is permanent and cannot be undone. Your current Fitly data will be removed.
        </Text>

        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>This permanently removes:</Text>
          <Text style={styles.summaryItem}>Your profile and sign-in access</Text>
          <Text style={styles.summaryItem}>Your private body photos</Text>
          <Text style={styles.summaryItem}>Your garments and fitting results</Text>
          <Text style={styles.summaryItem}>Your usage and feedback history</Text>
        </View>

        <Text style={styles.label}>Type DELETE to confirm</Text>
        <TextInput
          accessibilityLabel="Type DELETE to confirm"
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!isDeleting}
          onChangeText={setConfirmation}
          placeholder="DELETE"
          placeholderTextColor={colors.muted}
          returnKeyType="done"
          style={styles.input}
          value={confirmation}
        />
        {error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}

        <Pressable
          accessibilityLabel={isDeleting ? 'Deleting account' : 'Permanently delete account'}
          accessibilityRole="button"
          accessibilityState={{ busy: isDeleting, disabled: !canDelete }}
          disabled={!canDelete}
          onPress={handleDelete}
          style={[styles.deleteButton, !canDelete && styles.deleteButtonDisabled]}
        >
          {isDeleting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.deleteButtonText}>Permanently delete account</Text>
          )}
        </Pressable>

        <Pressable
          accessibilityLabel="Cancel account deletion"
          accessibilityRole="button"
          disabled={isDeleting}
          onPress={onCancel}
          style={styles.cancelButton}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { flexGrow: 1, paddingHorizontal: 22 },
  eyebrow: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10,
    letterSpacing: 1.4,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 32,
    fontWeight: '600',
    letterSpacing: -0.8,
    lineHeight: 36,
  },
  intro: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
  },
  summary: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    gap: 9,
    marginTop: 24,
    padding: 18,
  },
  summaryTitle: { color: colors.ink, fontFamily: fonts.body, fontSize: 14, fontWeight: '700' },
  summaryItem: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  label: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 25,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 16,
    height: 52,
    letterSpacing: 1.2,
    paddingHorizontal: 16,
  },
  error: { color: '#8C3C34', fontFamily: fonts.body, fontSize: 12, lineHeight: 18, marginTop: 10 },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: '#8C3C34',
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    marginTop: 20,
  },
  deleteButtonDisabled: { opacity: 0.38 },
  deleteButtonText: {
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  cancelButton: { alignItems: 'center', height: 48, justifyContent: 'center', marginTop: 8 },
  cancelButtonText: { color: colors.ink, fontFamily: fonts.body, fontSize: 13, fontWeight: '700' },
});
