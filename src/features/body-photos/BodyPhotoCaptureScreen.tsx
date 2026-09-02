import { Image } from 'expo-image';
import { Camera, Check, ImagePlus, Lock, X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, shadow } from '../../theme';
import { BodyPhotoPicker, expoBodyPhotoPicker } from './bodyPhotoPicker';
import { ValidatedBodyPhotoAsset, validateBodyPhotoAsset } from './bodyPhotoValidation';

type BodyPhotoCaptureScreenProps = {
  picker?: BodyPhotoPicker;
  onUpload: (asset: ValidatedBodyPhotoAsset) => Promise<void>;
  onClose: () => void;
};

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : 'Could not save that photo. Try again.';
}

export function BodyPhotoCaptureScreen({
  picker = expoBodyPhotoPicker,
  onUpload,
  onClose,
}: BodyPhotoCaptureScreenProps) {
  const [asset, setAsset] = useState<ValidatedBodyPhotoAsset | null>(null);
  const [message, setMessage] = useState('');
  const [isPicking, setIsPicking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const pick = async (source: 'camera' | 'library') => {
    setMessage('');
    setIsPicking(true);
    try {
      const result = await picker.pick(source);
      if (result.status === 'permission-denied') {
        setMessage('Camera permission is needed to take a body photo.');
        return;
      }
      if (result.status === 'cancelled') {
        return;
      }

      const validation = validateBodyPhotoAsset(result.asset);
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
      return;
    }

    setMessage('');
    setIsUploading(true);
    try {
      await onUpload(asset);
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
          <Text style={styles.eyebrow}>PRIVATE BY DEFAULT</Text>
          <Text style={styles.headerTitle}>Your photo</Text>
        </View>
        <View style={styles.spacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {asset ? (
          <View style={styles.previewWrap}>
            <Image
              accessibilityLabel="Selected body photo"
              source={{ uri: asset.uri }}
              style={styles.preview}
              contentFit="cover"
              contentPosition="top"
            />
            <View style={styles.privatePill}>
              <Lock size={12} color={colors.white} />
              <Text style={styles.privatePillText}>Only you can see this</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setAsset(null)}
              style={styles.changeButton}
            >
              <Text style={styles.changeText}>Change</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.guide}>
            <View style={styles.guideFigure}>
              <View style={styles.head} />
              <View style={styles.body} />
              <View style={styles.legs} />
            </View>
            <Text style={styles.title}>Show your full look.</Text>
            <Text style={styles.copy}>
              Stand straight, face the camera, and include yourself from head to toe in even light.
            </Text>
            <View style={styles.actions}>
              <Pressable
                accessibilityLabel="Take photo"
                accessibilityRole="button"
                disabled={isBusy}
                onPress={() => pick('camera')}
                style={styles.primaryAction}
              >
                <Camera size={17} color={colors.white} />
                <Text style={styles.primaryActionText}>Take photo</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Choose from library"
                accessibilityRole="button"
                disabled={isBusy}
                onPress={() => pick('library')}
                style={styles.secondaryAction}
              >
                <ImagePlus size={17} color={colors.ink} />
                <Text style={styles.secondaryActionText}>Choose</Text>
              </Pressable>
            </View>
          </View>
        )}

        {!!message && (
          <Text accessibilityRole="alert" style={styles.message}>
            {message}
          </Text>
        )}

        <View style={styles.checklist}>
          {['Portrait orientation', 'Head-to-toe framing', 'Good, even light'].map((item) => (
            <View key={item} style={styles.checkRow}>
              <View style={styles.checkIcon}>
                <Check size={12} color={colors.ink} />
              </View>
              <Text style={styles.checkText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={styles.privacyNote}>
          <Lock size={14} color={colors.ink} />
          <Text style={styles.privacyText}>
            Stored in your private Fitly space. This photo is never shown in the marketplace.
          </Text>
        </View>
      </ScrollView>

      {asset && (
        <View style={styles.footer}>
          <Pressable
            accessibilityLabel="Save private photo"
            accessibilityRole="button"
            disabled={isBusy}
            onPress={save}
            style={[styles.saveButton, isBusy && styles.disabled]}
          >
            {isUploading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Lock size={15} color={colors.white} />
                <Text style={styles.saveText}>Save private photo</Text>
              </>
            )}
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: { paddingHorizontal: 20, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 42, height: 42, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  spacer: { width: 42 },
  eyebrow: { fontFamily: fonts.body, color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.2, textAlign: 'center' },
  headerTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 25, textAlign: 'center', marginTop: 2 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 },
  guide: { minHeight: 350, borderRadius: 22, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sage, borderWidth: 1, borderColor: colors.line },
  guideFigure: { width: 76, height: 138, alignItems: 'center', marginBottom: 18 },
  head: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.sageDeep },
  body: { width: 54, height: 63, marginTop: 5, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, backgroundColor: colors.sageDeep },
  legs: { width: 38, height: 34, marginTop: 4, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, backgroundColor: colors.sageDeep },
  title: { fontFamily: fonts.display, color: colors.ink, fontSize: 23, fontWeight: '600' },
  copy: { maxWidth: 300, marginTop: 8, fontFamily: fonts.body, color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 9, marginTop: 20 },
  primaryAction: { height: 45, paddingHorizontal: 16, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.ink },
  primaryActionText: { fontFamily: fonts.body, color: colors.white, fontSize: 12, fontWeight: '800' },
  secondaryAction: { height: 45, paddingHorizontal: 16, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  secondaryActionText: { fontFamily: fonts.body, color: colors.ink, fontSize: 12, fontWeight: '700' },
  previewWrap: { height: 410, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.sand },
  preview: { width: '100%', height: '100%' },
  privatePill: { position: 'absolute', left: 13, bottom: 13, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 99, backgroundColor: 'rgba(0,0,0,0.64)' },
  privatePillText: { fontFamily: fonts.body, color: colors.white, fontSize: 10, fontWeight: '700' },
  changeButton: { position: 'absolute', right: 13, bottom: 13, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.92)' },
  changeText: { fontFamily: fonts.body, color: colors.ink, fontSize: 10, fontWeight: '800' },
  message: { marginTop: 13, padding: 13, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F4E5E2', fontFamily: fonts.body, color: '#8C3C34', fontSize: 12, lineHeight: 17 },
  checklist: { marginTop: 18, gap: 9 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  checkIcon: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  checkText: { fontFamily: fonts.body, color: colors.ink, fontSize: 12 },
  privacyNote: { marginTop: 20, padding: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  privacyText: { flex: 1, fontFamily: fonts.body, color: colors.muted, fontSize: 10.5, lineHeight: 15 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20, backgroundColor: 'rgba(244,244,242,0.98)' },
  saveButton: { height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.ink, ...shadow },
  disabled: { opacity: 0.68 },
  saveText: { fontFamily: fonts.body, color: colors.white, fontSize: 12, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' },
});
