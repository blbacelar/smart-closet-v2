import { useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Bookmark, ChevronLeft, Lock, Plus, Repeat2, Share2, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors, fonts } from '../../src/theme';
import { useAuth } from '../../src/providers/AuthProvider';
import { useBodyPhotos } from '../../src/features/body-photos/useBodyPhotos';
import { useGarments } from '../../src/features/garments/useGarments';
import { useEnqueueTryOn, useTryOnJobs, useTryOnQuota } from '../../src/features/tryon/useTryOns';
import { getTryOnAction, tryOnErrorMessage } from '../../src/features/tryon/tryonState';

const captions = ['Fitting the shoulders…', 'Matching the light…', 'Draping the fabric…', 'Almost there…'];

export default function TryOnScreen() {
  const insets = useSafeAreaInsets();
  const { identity } = useAuth();
  const bodyPhotoQuery = useBodyPhotos(identity?.id);
  const garmentQuery = useGarments(identity?.id);
  const jobsQuery = useTryOnJobs(identity?.id);
  const quotaQuery = useTryOnQuota(identity?.id);
  const enqueue = useEnqueueTryOn(identity?.id ?? 'signed-out');
  const garments = garmentQuery.data ?? [];
  const readyGarments = useMemo(() => garments.filter((item) => item.status === 'ready'), [garments]);
  const [bodyIndex, setBodyIndex] = useState(0);
  const [selectedGarmentId, setSelectedGarmentId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [captionIndex, setCaptionIndex] = useState(0);
  const notifiedJobId = useRef<string | null>(null);
  const selected = useMemo(
    () => readyGarments.find((item) => item.id === selectedGarmentId) ?? readyGarments[0],
    [readyGarments, selectedGarmentId],
  );
  const bodyPhotos = useMemo(
    () => (bodyPhotoQuery.data ?? []).filter((photo) => photo.status !== 'rejected'),
    [bodyPhotoQuery.data],
  );
  const selectedBodyPhoto = bodyPhotos[bodyIndex] ?? bodyPhotos[0];
  const activeJob = (jobsQuery.data ?? []).find((job) => job.id === activeJobId);
  const quota = quotaQuery.data;
  const remaining = quota?.remaining ?? 1;
  const limit = quota?.limit ?? 3;
  const isPro = quota?.tier === 'pro';
  const action = getTryOnAction({
    hasBodyPhoto: Boolean(selectedBodyPhoto),
    garmentCount: garments.length,
    readyGarmentCount: readyGarments.length,
    remaining,
  });
  const waitingForJob = Boolean(
    activeJobId
      && !activeJob
      && (enqueue.isPending || enqueue.data?.jobId === activeJobId),
  );
  const isGenerating = enqueue.isPending
    || waitingForJob
    || activeJob?.status === 'queued'
    || activeJob?.status === 'running';
  const resultJob = activeJob?.status === 'done' ? activeJob : null;

  useEffect(() => {
    if (!isGenerating) return;
    setCaptionIndex(0);
    const captionTimer = setInterval(() => setCaptionIndex((value) => Math.min(value + 1, captions.length - 1)), 650);
    return () => clearInterval(captionTimer);
  }, [isGenerating]);

  useEffect(() => {
    if (resultJob && notifiedJobId.current !== resultJob.id) {
      notifiedJobId.current = resultJob.id;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }
    if (activeJob?.status === 'failed') {
      setMessage('That fitting could not be generated. Your try-on was returned—please try again.');
    }
  }, [activeJob?.status, resultJob]);

  const startTryOn = async () => {
    if (!selectedBodyPhoto || !selected) return;
    setMessage('');
    try {
      const result = await enqueue.mutateAsync({
        bodyPhotoId: selectedBodyPhoto.id,
        garmentId: selected.id,
      });
      setActiveJobId(result.jobId);
    } catch (error) {
      setMessage(tryOnErrorMessage(error));
    }
  };

  if (isGenerating) {
    return (
      <View style={[styles.busyScreen, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <View style={styles.mergeStage}>
          <View style={[styles.mergeCard, styles.mergeLeft]}><Image source={{ uri: selectedBodyPhoto?.signedUrl }} style={styles.mergeImage} contentFit="cover" contentPosition="top" /></View>
          <View style={[styles.mergeCard, styles.mergeRight]}><Image source={{ uri: selected?.imageUrl }} style={styles.mergeImage} contentFit="cover" /></View>
          <View style={styles.scanLine} />
        </View>
        <Text key={captionIndex} style={styles.caption}>{captions[captionIndex]}</Text>
      </View>
    );
  }

  if (resultJob?.resultUrl) {
    return (
      <View style={styles.resultScreen}>
        <StatusBar style="light" />
        <View style={styles.resultImageWrap}>
          <Image source={{ uri: resultJob.resultUrl }} style={styles.resultImage} contentFit="cover" contentPosition="top" />
          <Pressable accessibilityLabel="Back to studio" onPress={() => setActiveJobId(null)} style={[styles.backButton, { top: insets.top + 12 }]}><ChevronLeft size={22} color={colors.white} /></Pressable>
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
            <Pressable onPress={() => setActiveJobId(null)} style={styles.resultAction}><Repeat2 size={15} color={colors.ink} /><Text style={styles.resultActionText}>Again</Text></Pressable>
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
          {bodyPhotos.map((photo, index) => (
            <Pressable key={photo.id} onPress={() => setBodyIndex(index)} style={[styles.bodyTile, selectedBodyPhoto?.id === photo.id && styles.selectedTile]}>
              <Image source={{ uri: photo.signedUrl }} style={styles.bodyImage} contentFit="cover" contentPosition="top" />
              <View style={styles.lockBadge}><Lock size={10} color={colors.white} /></View>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" onPress={() => router.push('/add-body-photo')} style={styles.addBody}>
            <Plus size={17} color={colors.muted} />
            <Text style={styles.addBodyText}>Add</Text>
          </Pressable>
        </View>
        {bodyPhotoQuery.isError && <Text style={styles.photoMessage}>Could not load your private photos.</Text>}
        {!bodyPhotoQuery.isLoading && bodyPhotos.length === 0 && (
          <Text style={styles.photoMessage}>Add a full-body photo before starting a fitting.</Text>
        )}

        <Text style={styles.label}>The garment</Text>
        <View style={styles.garmentGrid}>
          {readyGarments.slice(0, 6).map((item) => (
            <Pressable key={item.id} onPress={() => setSelectedGarmentId(item.id)} style={[styles.garmentTile, selected?.id === item.id && styles.selectedTile]}>
              <Image source={{ uri: item.imageUrl }} style={styles.garmentImage} contentFit="cover" />
              <Text style={styles.garmentLabel}>{item.category ?? 'piece'}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" onPress={() => router.push('/add-garment')} style={styles.addGarment}>
            <Plus size={18} color={colors.muted} />
            <Text style={styles.addGarmentText}>Add piece</Text>
          </Pressable>
        </View>
        {garmentQuery.isError && <Text style={styles.garmentMessage}>Could not load your garments.</Text>}
        {!garmentQuery.isLoading && garments.length === 0 && (
          <Text style={styles.garmentMessage}>Add a garment before starting a fitting.</Text>
        )}
        {!garmentQuery.isLoading && garments.length > 0 && readyGarments.length === 0 && (
          <Text style={styles.garmentMessage}>Your garment is still being prepared. Check Closet to retry processing.</Text>
        )}

        {!!message && <Text accessibilityRole="alert" style={styles.errorMessage}>{message}</Text>}
        {quotaQuery.isError && (
          <Text accessibilityRole="alert" style={styles.errorMessage}>Could not load today’s try-on allowance.</Text>
        )}
        {jobsQuery.isError && (
          <Text accessibilityRole="alert" style={styles.errorMessage}>Could not refresh this fitting’s status.</Text>
        )}

        <Pressable
          onPress={() => {
            if (action === 'body-photo') router.push('/add-body-photo');
            else if (action === 'garment') router.push('/add-garment');
            else if (action === 'closet') router.push('/(tabs)/closet');
            else if (action === 'upgrade') router.push('/pro');
            else startTryOn();
          }}
          style={styles.tryButton}
          accessibilityRole="button"
        >
          {action === 'try-on' ? <Sparkles size={16} color={colors.white} /> : <Plus size={16} color={colors.white} />}
          <Text style={styles.tryText}>{
            action === 'body-photo' ? 'Add body photo'
              : action === 'garment' ? 'Add garment'
                : action === 'closet' ? 'Check garment status'
                  : action === 'upgrade' ? 'Unlock more try-ons'
                    : 'Try it on'
          }</Text>
        </Pressable>
        <Text style={styles.quota}>{quotaQuery.isLoading ? 'Checking today’s allowance…' : `${remaining} of ${limit} ${isPro ? 'Pro' : 'free'} try-ons left today`}</Text>
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
  photoMessage: { fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: -19, marginBottom: 22 },
  garmentGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 29 },
  garmentTile: { position: 'relative', width: '31.5%', aspectRatio: 1, borderRadius: 14, backgroundColor: colors.sage, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  addGarment: { width: '31.5%', aspectRatio: 1, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, alignItems: 'center', justifyContent: 'center', gap: 5 },
  addGarmentText: { fontFamily: fonts.body, fontSize: 9, color: colors.muted },
  garmentImage: { width: '100%', height: '100%' },
  garmentLabel: { position: 'absolute', left: 8, bottom: 6, fontFamily: 'monospace', fontSize: 8, color: colors.white, backgroundColor: 'rgba(0,0,0,0.42)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  garmentMessage: { fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: -20, marginBottom: 22 },
  errorMessage: { marginBottom: 12, padding: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F4E5E2', fontFamily: fonts.body, color: '#8C3C34', fontSize: 11.5, lineHeight: 17 },
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
