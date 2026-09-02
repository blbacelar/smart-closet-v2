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
import { expoGarmentPicker, GarmentPicker } from './garmentPicker';
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

const categoryOptions: { value: GarmentCategory; label: string }[] = [
  { value: 'top', label: 'Tops' },
  { value: 'bottom', label: 'Bottoms' },
  { value: 'dress', label: 'Dresses' },
  { value: 'outerwear', label: 'Outerwear' },
  { value: 'shoes', label: 'Shoes' },
];
const colorOptions = ['Cream', 'Black', 'Blue', 'Green', 'Red'];

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : 'Could not save that garment. Try again.';
}

export function GarmentCaptureScreen({
  picker = expoGarmentPicker,
  onUpload,
  onClose,
}: GarmentCaptureScreenProps) {
  const [asset, setAsset] = useState<ValidatedGarmentAsset | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<GarmentCategory>('top');
  const [color, setColor] = useState('Cream');
  const [size, setSize] = useState('M');
  const [message, setMessage] = useState('');
  const [isPicking, setIsPicking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

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

      const validation = validateGarmentAsset(result.asset);
      if (!validation.ok) {
        setAsset(null);
        setMessage(validation.message);
        return;
      }
      setAsset(validation.asset);
    } catch (error) {
      setMessage(messageFrom(error));
    } finally {
      setIsPicking(false);
    }
  };

  const save = async () => {
    if (!asset) {
      setMessage('Add a clear garment photo first.');
      return;
    }

    const validation = validateGarmentDetails({
      name,
      category,
      color,
      size,
      season: 'All year',
    });
    if (!validation.ok) {
      setMessage(validation.message);
      return;
    }

    setMessage('');
    setIsUploading(true);
    try {
      await onUpload({ asset, details: validation.details });
      onClose();
    } catch (error) {
      setMessage(messageFrom(error));
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
        {asset ? (
          <View style={styles.photoReady}>
            <Image
              accessibilityLabel="Selected garment photo"
              source={{ uri: asset.uri }}
              style={styles.preview}
              contentFit="cover"
            />
            <View style={styles.cleanBadge}>
              <Sparkles size={13} color={colors.forest} />
              <Text style={styles.cleanText}>Original saved first · cleanup pending</Text>
            </View>
            <Pressable
              accessibilityLabel="Change garment photo"
              accessibilityRole="button"
              style={styles.change}
              onPress={() => setAsset(null)}
            >
              <Text style={styles.changeText}>Change photo</Text>
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
                accessibilityLabel="Choose garment photo"
                accessibilityRole="button"
                disabled={isBusy}
                style={styles.secondaryPhoto}
                onPress={() => pick('library')}
              >
                <ImagePlus size={17} color={colors.forest} />
                <Text style={styles.secondaryPhotoText}>Choose</Text>
              </Pressable>
            </View>
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
          value={name}
          onChangeText={setName}
          placeholder="e.g. Vintage denim jacket"
          placeholderTextColor="#9B9F9B"
          returnKeyType="done"
          style={styles.input}
        />

        <Text style={styles.label}>CATEGORY</Text>
        <View style={styles.options}>
          {categoryOptions.map((item) => (
            <Pressable
              accessibilityLabel={`${item.label} category`}
              accessibilityRole="button"
              key={item.value}
              onPress={() => setCategory(item.value)}
              style={[styles.option, category === item.value && styles.optionActive]}
            >
              <Text style={[styles.optionText, category === item.value && styles.optionTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>COLOR</Text>
        <View style={styles.options}>
          {colorOptions.map((item) => (
            <Pressable
              accessibilityLabel={`${item} color`}
              accessibilityRole="button"
              key={item}
              onPress={() => setColor(item)}
              style={[styles.option, color === item && styles.optionActive]}
            >
              <Text style={[styles.optionText, color === item && styles.optionTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>SIZE</Text>
        <TextInput
          accessibilityLabel="Garment size"
          value={size}
          onChangeText={setSize}
          placeholder="M"
          placeholderTextColor="#9B9F9B"
          returnKeyType="done"
          style={styles.input}
        />
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityLabel="Add to my closet"
            accessibilityRole="button"
            onPress={save}
            disabled={isBusy}
            style={[styles.save, isBusy && styles.saveDisabled]}
          >
            {isUploading ? <ActivityIndicator color={colors.white} /> : <Sparkles size={18} color={colors.white} />}
            <Text style={styles.saveText}>{isUploading ? 'Saving your piece…' : 'Add to my closet'}</Text>
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
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, backgroundColor: 'rgba(247,244,238,0.98)' },
  save: { height: 56, borderRadius: 18, backgroundColor: colors.forest, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...shadow },
  saveDisabled: { opacity: 0.7 },
  saveText: { fontFamily: fonts.body, color: colors.white, fontSize: 14, fontWeight: '800' },
});
