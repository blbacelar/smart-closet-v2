import { Image } from 'expo-image';
import { Check, X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, shadow } from '../../theme';
import type { Garment } from './garmentRepository';
import {
  GarmentCategory,
  GarmentDetails,
  validateGarmentDetails,
} from './garmentValidation';

type GarmentDetailScreenProps = {
  garment: Garment;
  onBack: () => void;
  onSave: (details: GarmentDetails) => Promise<void>;
};

const categoryOptions: { value: GarmentCategory; label: string }[] = [
  { value: 'top', label: 'Tops' },
  { value: 'bottom', label: 'Bottoms' },
  { value: 'dress', label: 'Dresses' },
  { value: 'outerwear', label: 'Outerwear' },
  { value: 'shoes', label: 'Shoes' },
];

const categoryLabels: Record<GarmentCategory, string> = {
  top: 'Top',
  bottom: 'Bottom',
  dress: 'Dress',
  outerwear: 'Outerwear',
  shoes: 'Shoes',
};

function displayValue(value: string | null) {
  return value || 'Not set';
}

export function GarmentDetailScreen({ garment, onBack, onSave }: GarmentDetailScreenProps) {
  const [editorVisible, setEditorVisible] = useState(false);
  const [name, setName] = useState(garment.name ?? '');
  const [category, setCategory] = useState<GarmentCategory>(garment.category ?? 'top');
  const [color, setColor] = useState(garment.color ?? '');
  const [size, setSize] = useState(garment.size ?? '');
  const [season, setSeason] = useState(garment.season ?? '');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const openEditor = () => {
    setName(garment.name ?? '');
    setCategory(garment.category ?? 'top');
    setColor(garment.color ?? '');
    setSize(garment.size ?? '');
    setSeason(garment.season ?? '');
    setMessage('');
    setEditorVisible(true);
  };

  const closeEditor = () => {
    if (!isSaving) setEditorVisible(false);
  };

  const save = async () => {
    const result = validateGarmentDetails({ name, category, color, size, season });
    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    setMessage('');
    setIsSaving(true);
    try {
      await onSave(result.details);
      setEditorVisible(false);
    } catch {
      setMessage('Could not save those details. Try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Back to closet"
          accessibilityRole="button"
          onPress={onBack}
          style={styles.iconButton}
        >
          <X size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.eyebrow}>YOUR CLOSET</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Image
          accessibilityLabel={`${garment.name ?? 'Untitled piece'} garment photo`}
          contentFit="cover"
          source={{ uri: garment.imageUrl }}
          style={styles.image}
        />
        <View style={styles.statusPill}>
          <Check size={12} color={colors.ink} />
          <Text style={styles.statusText}>{garment.status === 'ready' ? 'Ready for try-on' : garment.status}</Text>
        </View>
        <Text style={styles.title}>{garment.name ?? 'Untitled piece'}</Text>
        <Text style={styles.category}>
          {garment.category ? categoryLabels[garment.category] : 'Uncategorized'}
        </Text>

        <View style={styles.detailsCard}>
          <DetailRow label="Color" value={displayValue(garment.color)} />
          <DetailRow label="Size" value={displayValue(garment.size)} />
          <DetailRow label="Season" value={displayValue(garment.season)} last />
        </View>

        <Pressable
          accessibilityLabel="Edit garment details"
          accessibilityRole="button"
          onPress={openEditor}
          style={styles.editButton}
        >
          <Text style={styles.editButtonText}>Edit details</Text>
        </Pressable>
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={closeEditor}
        transparent
        visible={editorVisible}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
          testID="garment-detail-keyboard-avoider"
        >
          <View accessibilityViewIsModal style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetEyebrow}>GARMENT TAGS</Text>
                <Text style={styles.sheetTitle}>Edit details</Text>
              </View>
              <Pressable
                accessibilityLabel="Close garment editor"
                accessibilityRole="button"
                disabled={isSaving}
                onPress={closeEditor}
                style={styles.iconButton}
              >
                <X size={19} color={colors.ink} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.form}
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              testID="garment-detail-form-scroll"
            >
              {!!message && <Text accessibilityRole="alert" style={styles.message}>{message}</Text>}

              <Text style={styles.label}>NAME</Text>
              <TextInput
                accessibilityLabel="Garment name"
                onChangeText={setName}
                placeholder="e.g. Vintage denim jacket"
                placeholderTextColor="#9B9F9B"
                returnKeyType="done"
                style={styles.input}
                value={name}
              />

              <Text style={styles.label}>CATEGORY</Text>
              <View style={styles.options}>
                {categoryOptions.map((option) => (
                  <Pressable
                    accessibilityLabel={`${option.label} category`}
                    accessibilityRole="button"
                    key={option.value}
                    onPress={() => setCategory(option.value)}
                    style={[styles.option, category === option.value && styles.optionActive]}
                  >
                    <Text style={[styles.optionText, category === option.value && styles.optionTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>COLOR</Text>
              <TextInput accessibilityLabel="Garment color" onChangeText={setColor} returnKeyType="done" style={styles.input} value={color} />
              <Text style={styles.label}>SIZE</Text>
              <TextInput accessibilityLabel="Garment size" onChangeText={setSize} returnKeyType="done" style={styles.input} value={size} />
              <Text style={styles.label}>SEASON</Text>
              <TextInput accessibilityLabel="Garment season" onChangeText={setSeason} returnKeyType="done" style={styles.input} value={season} />
            </ScrollView>

            <Pressable
              accessibilityLabel="Save garment details"
              accessibilityRole="button"
              disabled={isSaving}
              onPress={() => void save()}
              style={[styles.saveButton, isSaving && styles.disabledButton]}
            >
              {isSaving && <ActivityIndicator color={colors.white} size="small" />}
              <Text style={styles.saveButtonText}>{isSaving ? 'Saving…' : 'Save details'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function DetailRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.detailRow, last && styles.detailRowLast]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: { paddingHorizontal: 20, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerSpacer: { width: 42 },
  iconButton: { width: 42, height: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  eyebrow: { fontFamily: fonts.body, color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30 },
  image: { width: '100%', aspectRatio: 0.82, borderRadius: 22, backgroundColor: colors.sage, borderWidth: 1, borderColor: colors.line },
  statusPill: { alignSelf: 'flex-start', marginTop: 16, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.sage },
  statusText: { fontFamily: fonts.body, color: colors.ink, fontSize: 9.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7 },
  title: { marginTop: 14, fontFamily: fonts.display, color: colors.ink, fontSize: 31, lineHeight: 35, fontWeight: '600', letterSpacing: -0.7 },
  category: { marginTop: 5, fontFamily: fonts.body, color: colors.muted, fontSize: 13 },
  detailsCard: { marginTop: 22, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  detailRow: { minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  detailRowLast: { borderBottomWidth: 0 },
  detailLabel: { fontFamily: fonts.body, color: colors.muted, fontSize: 12 },
  detailValue: { fontFamily: fonts.body, color: colors.ink, fontSize: 13, fontWeight: '700' },
  editButton: { height: 52, marginTop: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink, ...shadow },
  editButtonText: { fontFamily: fonts.body, color: colors.white, fontSize: 13, fontWeight: '800' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,20,20,0.46)' },
  sheet: { maxHeight: '88%', paddingTop: 20, paddingHorizontal: 20, paddingBottom: 22, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.canvas, ...shadow },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sheetEyebrow: { fontFamily: fonts.body, color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  sheetTitle: { marginTop: 3, fontFamily: fonts.display, color: colors.ink, fontSize: 25, fontWeight: '600' },
  form: { paddingBottom: 18 },
  message: { marginTop: 10, padding: 13, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F4E5E2', fontFamily: fonts.body, color: '#8C3C34', fontSize: 12 },
  label: { marginTop: 18, marginBottom: 8, marginLeft: 2, fontFamily: fonts.body, color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  input: { height: 48, borderRadius: 15, paddingHorizontal: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, fontFamily: fonts.body, color: colors.ink, fontSize: 13 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderRadius: 99, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  optionActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  optionText: { fontFamily: fonts.body, color: colors.muted, fontSize: 11, fontWeight: '700' },
  optionTextActive: { color: colors.white },
  saveButton: { minHeight: 54, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.ink },
  disabledButton: { opacity: 0.68 },
  saveButtonText: { fontFamily: fonts.body, color: colors.white, fontSize: 13, fontWeight: '800' },
});
