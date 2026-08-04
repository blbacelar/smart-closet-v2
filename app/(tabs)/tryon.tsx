import { useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Bookmark, ChevronLeft, Lock, Plus, Repeat2, Share2, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { bodyPhoto } from '../../src/data';
import { useFitlyStore } from '../../src/store';
import { colors, fonts } from '../../src/theme';

type Stage = 'idle' | 'generating' | 'result';
const captions = ['Fitting the shoulders…', 'Matching the light…', 'Draping the fabric…', 'Almost there…'];

export default function TryOnScreen() {
  const insets = useSafeAreaInsets();
  const { garments, selectedGarmentId, selectGarment, tryOnsUsed, useTryOn, isPro } = useFitlyStore();
  const [stage, setStage] = useState<Stage>('idle');
  const [bodyIndex, setBodyIndex] = useState(0);
  const [captionIndex, setCaptionIndex] = useState(0);
  const selected = useMemo(() => garments.find((item) => item.id === selectedGarmentId) ?? garments[0], [garments, selectedGarmentId]);
  const remaining = isPro ? Math.max(0, 60 - tryOnsUsed) : Math.max(0, 3 - tryOnsUsed);

  useEffect(() => {
    if (stage !== 'generating') return;
    setCaptionIndex(0);
    const captionTimer = setInterval(() => setCaptionIndex((value) => Math.min(value + 1, captions.length - 1)), 650);
    const resultTimer = setTimeout(() => {
      clearInterval(captionTimer);
      useTryOn();
      setStage('result');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }, 2800);
    return () => { clearInterval(captionTimer); clearTimeout(resultTimer); };
  }, [stage, useTryOn]);

  if (stage === 'generating') {
    return (
      <View style={[styles.busyScreen, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <View style={styles.mergeStage}>
          <View style={[styles.mergeCard, styles.mergeLeft]}><Image source={{ uri: bodyPhoto }} style={styles.mergeImage} contentFit="cover" contentPosition="top" /></View>
          <View style={[styles.mergeCard, styles.mergeRight]}><Image source={{ uri: selected.image }} style={styles.mergeImage} contentFit="cover" /></View>
          <View style={styles.scanLine} />
        </View>
        <Text key={captionIndex} style={styles.caption}>{captions[captionIndex]}</Text>
      </View>
    );
  }

  if (stage === 'result') {
    return (
      <View style={styles.resultScreen}>
        <StatusBar style="light" />
        <View style={styles.resultImageWrap}>
          <Image source={{ uri: bodyPhoto }} style={styles.resultImage} contentFit="cover" contentPosition="top" />
          <Pressable accessibilityLabel="Back to studio" onPress={() => setStage('idle')} style={[styles.backButton, { top: insets.top + 12 }]}><ChevronLeft size={22} color={colors.white} /></Pressable>
          <View style={styles.privatePill}><Lock size={12} color={colors.white} /><Text style={styles.privatePillText}>Only you can see this</Text></View>
          {!isPro && <Text style={styles.watermark}>FITLY</Text>}
        </View>
        <View style={styles.resultSheet}>
          <View style={styles.fitRow}>
            <Text style={styles.fitTitle}>How’s the fit?</Text>
            <View style={styles.voteRow}>
              <Pressable style={styles.voteActive}><ThumbsUp size={19} color={colors.white} /></Pressable>
              <Pressable style={styles.vote}><ThumbsDown size={19} color={colors.muted} /></Pressable>
            </View>
          </View>
          <View style={styles.resultActions}>
            <Pressable style={[styles.resultAction, styles.resultActionActive]}><Bookmark size={15} color={colors.white} /><Text style={styles.resultActionActiveText}>Save</Text></Pressable>
            <Pressable style={styles.resultAction}><Share2 size={15} color={colors.ink} /><Text style={styles.resultActionText}>Share</Text></Pressable>
            <Pressable onPress={() => setStage('idle')} style={styles.resultAction}><Repeat2 size={15} color={colors.ink} /><Text style={styles.resultActionText}>Again</Text></Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 18 }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>Fitly</Text>
        <Text style={styles.title}>The Studio</Text>
        <Text style={styles.subtitle}>Pick a photo of you and a garment, then see it on.</Text>

        <Text style={styles.label}>Your photo</Text>
        <View style={styles.bodyRow}>
          {[0, 1, 2].map((index) => (
            <Pressable key={index} onPress={() => setBodyIndex(index)} style={[styles.bodyTile, bodyIndex === index && styles.selectedTile]}>
              <Image source={{ uri: bodyPhoto }} style={styles.bodyImage} contentFit="cover" contentPosition={index === 0 ? 'top' : 'center'} />
              <View style={styles.lockBadge}><Lock size={10} color={colors.white} /></View>
            </Pressable>
          ))}
          <Pressable style={styles.addBody}>
            <Plus size={17} color={colors.muted} />
            <Text style={styles.addBodyText}>Add</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>The garment</Text>
        <View style={styles.garmentGrid}>
          {garments.slice(0, 6).map((item) => (
            <Pressable key={item.id} onPress={() => selectGarment(item.id)} style={[styles.garmentTile, selected.id === item.id && styles.selectedTile]}>
              <Image source={{ uri: item.image }} style={styles.garmentImage} contentFit="cover" />
              <Text style={styles.garmentLabel}>{item.category.replace('Outerwear', 'coat').replace('Bottoms', 'pants').toLowerCase()}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable onPress={() => setStage('generating')} style={styles.tryButton} accessibilityRole="button">
          <Sparkles size={16} color={colors.white} />
          <Text style={styles.tryText}>Try it on</Text>
        </Pressable>
        <Text style={styles.quota}>{remaining} of {isPro ? 60 : 3} {isPro ? 'Pro' : 'free'} try-ons left today</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 22, paddingBottom: 28 },
  eyebrow: { fontFamily: fonts.body, fontSize: 10, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 6 },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 32, fontWeight: '600', letterSpacing: -0.7, color: colors.ink },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 4, marginBottom: 27 },
  label: { fontFamily: fonts.body, fontSize: 10, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 12 },
  bodyRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  bodyTile: { position: 'relative', width: 58, height: 78, borderRadius: 10, backgroundColor: colors.sage, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  selectedTile: { borderWidth: 2, borderColor: colors.ink },
  bodyImage: { width: '100%', height: '100%' },
  lockBadge: { position: 'absolute', left: 5, bottom: 5, width: 19, height: 19, borderRadius: 10, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  addBody: { width: 58, height: 78, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, alignItems: 'center', justifyContent: 'center', gap: 3 },
  addBodyText: { fontFamily: fonts.body, fontSize: 9, color: colors.muted },
  garmentGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 29 },
  garmentTile: { position: 'relative', width: '31.5%', aspectRatio: 1, borderRadius: 14, backgroundColor: colors.sage, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  garmentImage: { width: '100%', height: '100%' },
  garmentLabel: { position: 'absolute', left: 8, bottom: 6, fontFamily: 'monospace', fontSize: 8, color: colors.white, backgroundColor: 'rgba(0,0,0,0.42)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  tryButton: { width: '100%', height: 54, borderRadius: 14, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  tryText: { fontFamily: fonts.body, color: colors.white, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5 },
  quota: { fontFamily: fonts.body, color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 12 },
  busyScreen: { flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  mergeStage: { width: 250, height: 270, alignItems: 'center', justifyContent: 'center' },
  mergeCard: { position: 'absolute', width: 124, height: 166, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.sage, borderWidth: 1, borderColor: colors.line },
  mergeLeft: { transform: [{ translateX: -55 }, { rotate: '-4deg' }] },
  mergeRight: { transform: [{ translateX: 55 }, { rotate: '4deg' }] },
  mergeImage: { width: '100%', height: '100%' },
  scanLine: { position: 'absolute', width: 2, height: 210, backgroundColor: colors.ink, opacity: 0.14 },
  caption: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1.4, marginTop: 24 },
  resultScreen: { flex: 1, backgroundColor: colors.forestDark },
  resultImageWrap: { flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: colors.sand },
  resultImage: { width: '100%', height: '100%' },
  backButton: { position: 'absolute', left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  privatePill: { position: 'absolute', left: 16, bottom: 16, height: 28, paddingHorizontal: 12, borderRadius: 99, backgroundColor: 'rgba(0,0,0,0.50)', flexDirection: 'row', alignItems: 'center', gap: 6 },
  privatePillText: { fontFamily: fonts.body, color: colors.white, fontSize: 10.5 },
  watermark: { position: 'absolute', right: 16, bottom: 20, fontFamily: fonts.body, fontSize: 11, fontWeight: '700', letterSpacing: 2.2, color: 'rgba(255,255,255,0.75)' },
  resultSheet: { backgroundColor: colors.canvas, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 22, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  fitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  fitTitle: { fontFamily: fonts.body, fontSize: 16, fontWeight: '600', color: colors.ink },
  voteRow: { flexDirection: 'row', gap: 10 },
  voteActive: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  vote: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center' },
  resultActions: { flexDirection: 'row', gap: 10 },
  resultAction: { flex: 1, height: 46, borderRadius: 14, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  resultActionActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  resultActionText: { fontFamily: fonts.body, fontSize: 9.5, fontWeight: '700', color: colors.ink, textTransform: 'uppercase', letterSpacing: 1.1 },
  resultActionActiveText: { fontFamily: fonts.body, fontSize: 9.5, fontWeight: '700', color: colors.white, textTransform: 'uppercase', letterSpacing: 1.1 },
});
