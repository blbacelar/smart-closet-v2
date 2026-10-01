import { Image } from 'expo-image';
import { Camera, Check, ImagePlus, Sparkles, X } from 'lucide-react-native';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, shadow } from '../../theme';
import { expoGarmentPicker, GarmentPicker, garmentBatchLimit } from './garmentPicker';
import {
  GarmentCategory,
  GarmentDetails,
  ValidatedGarmentAsset,
  validateGarmentAsset,
  validateGarmentDetails,
} from './garmentValidation';

type GarmentCaptureScreenProps = {
  picker?: GarmentPicker;
  onUpload: (input: { asset: ValidatedGarmentAsset; details: GarmentDetails }) => Promise<void>;
  onClose: () => void;
};

type GarmentDraft = {
  asset: ValidatedGarmentAsset;
  name: string;
  category: GarmentCategory | null;
  color: string;
  size: string;
};

const categoryOptions: { value: GarmentCategory | null; label: string; accessibilityLabel: string }[] = [
  { value: null, label: 'Auto', accessibilityLabel: 'Auto-detect category' },
  { value: 'top', label: 'Tops', accessibilityLabel: 'Tops category' },
  { value: 'bottom', label: 'Bottoms', accessibilityLabel: 'Bottoms category' },
  { value: 'dress', label: 'Dresses', accessibilityLabel: 'Dresses category' },
  { value: 'outerwear', label: 'Outerwear', accessibilityLabel: 'Outerwear category' },
  { value: 'shoes', label: 'Shoes', accessibilityLabel: 'Shoes category' },
];
const colorOptions = ['Cream', 'Black', 'Blue', 'Green', 'Red'];

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : 'Could not save that garment. Try again.';
}

function createDraft(asset: ValidatedGarmentAsset): GarmentDraft {
  return { asset, name: '', category: null, color: 'Cream', size: 'M' };
}

export function GarmentCaptureScreen({
  picker = expoGarmentPicker,
  onUpload,
  onClose,
}: GarmentCaptureScreenProps) {
  const [drafts, setDrafts] = useState<GarmentDraft[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [message, setMessage] = useState('');
  const [isPicking, setIsPicking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(1);
  const activeDraft = drafts[activeIndex];

  const updateActiveDraft = (patch: Partial<Omit<GarmentDraft, 'asset'>>) => {
    setDrafts((current) => current.map((draft, index) => (
      index === activeIndex ? { ...draft, ...patch } : draft
    )));
  };

  const removeActiveDraft = () => {
    setDrafts((current) => current.filter((_, index) => index !== activeIndex));
    setActiveIndex((current) => Math.max(0, Math.min(current, drafts.length - 2)));
    setMessage('');
  };

  const pick = async (source: 'camera' | 'library') => {
    setMessage('');
    setIsPicking(true);
    try {
      const result = await picker.pick(source);
      if (result.status === 'permission-denied') {
        setMessage('Camera permission is needed to photograph a garment.');
        return;
      }
      if (result.status === 'cancelled') {
        return;
      }

      const validDrafts: GarmentDraft[] = [];
      let firstRejection = '';
      result.assets.forEach((asset, index) => {
        const validation = validateGarmentAsset(asset);
        if (validation.ok) {
          validDrafts.push(createDraft(validation.asset));
        } else if (!firstRejection) {
          firstRejection = result.assets.length === 1
            ? validation.message
            : `Photo ${index + 1} was skipped: ${validation.message}`;
        }
      });
      setDrafts(validDrafts);
      setActiveIndex(0);
      if (firstRejection) {
        setMessage(firstRejection);
      }
    } catch (error) {
      setMessage(messageFrom(error));
    } finally {
      setIsPicking(false);
    }
  };

  const save = async () => {
    if (!drafts.length) {
      setMessage('Add a clear garment photo first.');
      return;
    }

    const uploads: { asset: ValidatedGarmentAsset; details: GarmentDetails }[] = [];
    for (let index = 0; index < drafts.length; index += 1) {
      const draft = drafts[index];
      const validation = validateGarmentDetails({
        name: draft.name,
        category: draft.category,
        color: draft.color,
        size: draft.size,
        season: 'All year',
      });
      if (!validation.ok) {
        setActiveIndex(index);
        setMessage(drafts.length === 1 ? validation.message : `Piece ${index + 1}: ${validation.message}`);
        return;
      }
      uploads.push({ asset: draft.asset, details: validation.details });
    }

    setMessage('');
    setIsUploading(true);
    setUploadProgress(1);
    try {
      for (let index = 0; index < uploads.length; index += 1) {
        setUploadProgress(index + 1);
        try {
          await onUpload(uploads[index]);
        } catch (error) {
          setDrafts(drafts.slice(index));
          setActiveIndex(0);
          const failure = messageFrom(error);
          setMessage(index > 0 ? `Saved ${index} of ${uploads.length}. ${failure}` : failure);
          return;
        }
      }
      onClose();
    } finally {
      setIsUploading(false);
    }
  };

  const isBusy = isPicking || isUploading;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={onClose} style={styles.close}>
          <X size={20} color={colors.ink} />
        </Pressable>
        <View>
          <Text style={styles.eyebrow}>BUILD YOUR CLOSET</Text>
          <Text style={styles.title}>Add a piece</Text>
        </View>
        <View style={styles.spacer} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardArea}
        testID="garment-keyboard-avoider"
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
          testID="garment-form-scroll"
        >
        {activeDraft ? (
          <View style={styles.photoReady}>
            <Image
              accessibilityLabel="Selected garment photo"
              source={{ uri: activeDraft.asset.uri }}
              style={styles.preview}
              contentFit="cover"
            />
            <View style={styles.cleanBadge}>
              <Sparkles size={13} color={colors.forest} />
              <Text style={styles.cleanText}>Original saved first · cleanup pending</Text>
            </View>
            <Pressable
              accessibilityLabel={drafts.length > 1 ? 'Remove current garment photo' : 'Change garment photo'}
              accessibilityRole="button"
              style={styles.change}
              onPress={removeActiveDraft}
            >
              <Text style={styles.changeText}>{drafts.length > 1 ? 'Remove piece' : 'Change photo'}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.photoZone}>
            <View style={styles.cameraIcon}><ImagePlus size={27} color={colors.forest} /></View>
            <Text style={styles.photoTitle}>Show us the whole garment</Text>
            <Text style={styles.photoCopy}>
              Lay it flat or hang it up in good light. A plain background works best.
            </Text>
            <View style={styles.photoActions}>
              <Pressable
                accessibilityLabel="Take garment photo"
                accessibilityRole="button"
                disabled={isBusy}
                style={styles.primaryPhoto}
                onPress={() => pick('camera')}
              >
                <Camera size={17} color={colors.white} />
                <Text style={styles.primaryPhotoText}>Take photo</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Choose garment photos"
                accessibilityRole="button"
                disabled={isBusy}
                style={styles.secondaryPhoto}
                onPress={() => pick('library')}
              >
                <ImagePlus size={17} color={colors.forest} />
                <Text style={styles.secondaryPhotoText}>Choose up to {garmentBatchLimit}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {!!drafts.length && (
          <View style={styles.batchSection}>
            <View style={styles.batchSummary}>
              <Text style={styles.batchCount}>{drafts.length} {drafts.length === 1 ? 'piece' : 'pieces'} selected</Text>
              <Text style={styles.batchPosition}>Piece {activeIndex + 1} of {drafts.length}</Text>
            </View>
            {drafts.length > 1 && (
              <ScrollView
                contentContainerStyle={styles.batchRail}
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {drafts.map((draft, index) => (
                  <Pressable
                    accessibilityLabel={`Edit piece ${index + 1}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: index === activeIndex }}
                    key={`${draft.asset.uri}-${index}`}
                    onPress={() => setActiveIndex(index)}
                    style={[styles.batchThumbButton, index === activeIndex && styles.batchThumbButtonActive]}
                  >
                    <Image source={{ uri: draft.asset.uri }} style={styles.batchThumb} contentFit="cover" />
                    <View style={styles.batchNumber}><Text style={styles.batchNumberText}>{index + 1}</Text></View>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        <View style={styles.tip}>
          <View style={styles.tipIcon}><Check size={13} color={colors.forest} /></View>
          <Text style={styles.tipText}>
            Your original is private. Automatic background cleanup will appear here when processing is enabled.
          </Text>
        </View>

        {!!message && <Text accessibilityRole="alert" style={styles.message}>{message}</Text>}

        <Text style={styles.label}>NAME</Text>
        <TextInput
          accessibilityLabel="Garment name"
          value={activeDraft?.name ?? ''}
          onChangeText={(name) => updateActiveDraft({ name })}
          placeholder="e.g. Vintage denim jacket"
          placeholderTextColor="#9B9F9B"
          returnKeyType="done"
          style={styles.input}
        />

        <Text style={styles.label}>CATEGORY</Text>
        <View style={styles.options}>
          {categoryOptions.map((item) => (
            <Pressable
              accessibilityLabel={item.accessibilityLabel}
              accessibilityRole="button"
              accessibilityState={{ selected: activeDraft?.category === item.value }}
              key={item.value ?? 'auto'}
              onPress={() => updateActiveDraft({ category: item.value })}
              style={[styles.option, activeDraft?.category === item.value && styles.optionActive]}
            >
              <Text style={[styles.optionText, activeDraft?.category === item.value && styles.optionTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.categoryHint}>
          Fitly will suggest a category after processing. You can edit it anytime.
        </Text>

        <Text style={styles.label}>COLOR</Text>
        <View style={styles.options}>
          {colorOptions.map((item) => (
            <Pressable
              accessibilityLabel={`${item} color`}
              accessibilityRole="button"
              key={item}
              onPress={() => updateActiveDraft({ color: item })}
              style={[styles.option, activeDraft?.color === item && styles.optionActive]}
            >
              <Text style={[styles.optionText, activeDraft?.color === item && styles.optionTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>SIZE</Text>
        <TextInput
          accessibilityLabel="Garment size"
          value={activeDraft?.size ?? ''}
          onChangeText={(size) => updateActiveDraft({ size })}
          placeholder="M"
          placeholderTextColor="#9B9F9B"
          returnKeyType="done"
          style={styles.input}
        />
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityLabel={drafts.length > 1 ? `Add ${drafts.length} pieces to my closet` : 'Add to my closet'}
            accessibilityRole="button"
            onPress={save}
            disabled={isBusy}
            style={[styles.save, isBusy && styles.saveDisabled]}
          >
            {isUploading ? <ActivityIndicator color={colors.white} /> : <Sparkles size={18} color={colors.white} />}
            <Text style={styles.saveText}>
              {isUploading
                ? `Saving ${uploadProgress} of ${drafts.length}…`
                : drafts.length > 1
                  ? `Add ${drafts.length} pieces to my closet`
                  : 'Add to my closet'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  keyboardArea: { flex: 1 },
  scroll: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  close: { width: 42, height: 42, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  spacer: { width: 42 },
  eyebrow: { fontFamily: fonts.body, color: colors.coral, fontSize: 9.5, fontWeight: '800', letterSpacing: 1.1, textAlign: 'center' },
  title: { fontFamily: fonts.display, color: colors.ink, fontSize: 25, textAlign: 'center', marginTop: 2 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  photoZone: { height: 276, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.sageDeep, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  cameraIcon: { width: 58, height: 58, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow },
  photoTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 20, marginTop: 18 },
  photoCopy: { fontFamily: fonts.body, color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 7 },
  photoActions: { flexDirection: 'row', gap: 9, marginTop: 18 },
  primaryPhoto: { height: 43, borderRadius: 15, backgroundColor: colors.forest, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 7 },
  primaryPhotoText: { fontFamily: fonts.body, color: colors.white, fontSize: 12, fontWeight: '800' },
  secondaryPhoto: { height: 43, borderRadius: 15, backgroundColor: colors.surface, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: colors.line },
  secondaryPhotoText: { fontFamily: fonts.body, color: colors.forest, fontSize: 12, fontWeight: '700' },
  photoReady: { height: 310, borderRadius: 27, overflow: 'hidden', backgroundColor: colors.sand },
  preview: { width: '100%', height: '100%' },
  cleanBadge: { position: 'absolute', left: 13, top: 13, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,253,249,0.95)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 7 },
  cleanText: { fontFamily: fonts.body, color: colors.forest, fontSize: 10, fontWeight: '800' },
  change: { position: 'absolute', right: 13, bottom: 13, backgroundColor: 'rgba(27,33,29,0.76)', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 8 },
  changeText: { fontFamily: fonts.body, color: colors.white, fontSize: 10.5, fontWeight: '700' },
  batchSection: { marginTop: 13, gap: 10 },
  batchSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 },
  batchCount: { fontFamily: fonts.body, color: colors.ink, fontSize: 12, fontWeight: '800' },
  batchPosition: { fontFamily: fonts.body, color: colors.muted, fontSize: 11, fontWeight: '600' },
  batchRail: { gap: 9, paddingVertical: 2 },
  batchThumbButton: { width: 66, height: 66, borderRadius: 17, padding: 3, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.surface },
  batchThumbButtonActive: { borderColor: colors.forest },
  batchThumb: { width: '100%', height: '100%', borderRadius: 12 },
  batchNumber: { position: 'absolute', right: 5, bottom: 5, width: 19, height: 19, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.forest },
  batchNumberText: { fontFamily: fonts.body, color: colors.white, fontSize: 9, fontWeight: '800' },
  tip: { marginTop: 13, backgroundColor: colors.sage, borderRadius: 17, padding: 13, flexDirection: 'row', gap: 9, alignItems: 'center' },
  tipIcon: { width: 25, height: 25, borderRadius: 9, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  tipText: { flex: 1, fontFamily: fonts.body, color: '#5F5F64', fontSize: 10.5, lineHeight: 15 },
  message: { marginTop: 13, padding: 13, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F4E5E2', fontFamily: fonts.body, color: '#8C3C34', fontSize: 12, lineHeight: 17 },
  label: { fontFamily: fonts.body, color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginTop: 21, marginBottom: 8, marginLeft: 2 },
  input: { height: 49, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 15, fontFamily: fonts.body, color: colors.ink, fontSize: 13 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderRadius: 99, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 9 },
  optionActive: { backgroundColor: colors.forest, borderColor: colors.forest },
  optionText: { fontFamily: fonts.body, color: colors.muted, fontSize: 11.5, fontWeight: '600' },
  optionTextActive: { color: colors.white },
  categoryHint: { marginTop: 8, marginHorizontal: 2, fontFamily: fonts.body, color: colors.muted, fontSize: 10.5, lineHeight: 15 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, backgroundColor: 'rgba(247,244,238,0.98)' },
  save: { height: 56, borderRadius: 18, backgroundColor: colors.forest, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...shadow },
  saveDisabled: { opacity: 0.7 },
  saveText: { fontFamily: fonts.body, color: colors.white, fontSize: 14, fontWeight: '800' },
});
