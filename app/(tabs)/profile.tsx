import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Bell, Camera, ChevronRight, Globe2, Lock, LogOut, Shield, Trash2 } from 'lucide-react-native';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFitlyStore } from '../../src/store';
import { useAuth } from '../../src/providers/AuthProvider';
import { useBodyPhotos } from '../../src/features/body-photos/useBodyPhotos';
import { colors, fonts } from '../../src/theme';

const settings = [
  { Icon: Shield, label: 'Privacy & visibility' },
  { Icon: Bell, label: 'Notifications' },
  { Icon: Globe2, label: 'Language' },
  { Icon: LogOut, label: 'Sign out' },
  { Icon: Trash2, label: 'Delete account' },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const isPro = useFitlyStore((state) => state.isPro);
  const { identity, signOut } = useAuth();
  const bodyPhotos = useBodyPhotos(identity?.id);

  const handleSettingPress = async (label: string) => {
    if (label === 'Delete account') {
      router.push('/delete-account');
      return;
    }
    if (label !== 'Sign out') {
      return;
    }

    try {
      await signOut();
    } catch (error) {
      Alert.alert('Could not sign out', error instanceof Error ? error.message : 'Try again.');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + 18 }]} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>{isPro ? 'Pro plan' : 'Free plan'}</Text>
      <Text style={styles.title}>{identity?.displayName ?? 'Fitly member'}</Text>

      <View style={styles.photoHeader}>
        <Text style={styles.sectionLabel}>Your body photos</Text>
        <View style={styles.privateLabel}><Lock size={12} color={colors.ink} /><Text style={styles.privateText}>Only you can see these</Text></View>
      </View>
      <View style={styles.photoRow}>
        {bodyPhotos.isLoading && (
          <View style={styles.photoLoading}>
            <ActivityIndicator color={colors.ink} />
          </View>
        )}
        {(bodyPhotos.data ?? []).map((photo) => (
          <View key={photo.id} style={styles.bodyPhoto}>
            <Image source={{ uri: photo.signedUrl }} style={styles.bodyImage} contentFit="cover" contentPosition="top" />
            <View style={styles.lockBadge}><Lock size={11} color={colors.white} /></View>
            {photo.status !== 'approved' && (
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{photo.status}</Text>
              </View>
            )}
          </View>
        ))}
        {!bodyPhotos.isLoading && (bodyPhotos.data?.length ?? 0) < 3 && (
        <Pressable accessibilityRole="button" onPress={() => router.push('/add-body-photo')} style={styles.addPhoto}>
          <Camera size={19} color={colors.muted} />
          <Text style={styles.addPhotoText}>Add photo</Text>
        </Pressable>
        )}
      </View>
      {bodyPhotos.isError && (
        <Pressable accessibilityRole="button" onPress={() => bodyPhotos.refetch()} style={styles.retryRow}>
          <Text style={styles.retryText}>Could not load your photos. Tap to retry.</Text>
        </Pressable>
      )}

      <Pressable onPress={() => !isPro && router.push('/pro')} style={styles.proCard}>
        <View style={styles.proBadge}><Text style={styles.proBadgeText}>FITLY PRO</Text></View>
        <Text style={styles.proTitle}>{isPro ? 'Your fitting room, unlocked.' : 'Unlimited fittings.'}</Text>
        <Text style={styles.proCopy}>60 try-ons a day · 3 body photos · no watermark</Text>
        {!isPro && <View style={styles.proButton}><Text style={styles.proButtonText}>Go Pro — $7.99/mo</Text></View>}
      </Pressable>

      <View style={styles.settings}>
        {settings.map(({ Icon, label }, index) => (
          <Pressable
            accessibilityRole="button"
            key={label}
            onPress={() => handleSettingPress(label)}
            style={[styles.setting, index === settings.length - 1 && styles.settingLast]}
          >
            <Icon size={17} color={colors.ink} />
            <Text style={[styles.settingText, label === 'Delete account' && styles.dangerText]}>{label}</Text>
            <ChevronRight size={16} color={colors.muted} />
          </Pressable>
        ))}
      </View>
      <Text style={styles.version}>Fitly beta · v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 22, paddingBottom: 30 },
  eyebrow: { fontFamily: fonts.body, fontSize: 10, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 6 },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, fontWeight: '600', letterSpacing: -0.7, color: colors.ink, marginBottom: 27 },
  photoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionLabel: { fontFamily: fonts.body, fontSize: 10, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1.4 },
  privateLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  privateText: { fontFamily: fonts.body, fontSize: 10.5, color: colors.ink },
  photoRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  bodyPhoto: { position: 'relative', width: 70, height: 96, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.sage, borderWidth: 1, borderColor: colors.line },
  photoLoading: { width: 70, height: 96, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sage },
  bodyImage: { width: '100%', height: '100%' },
  lockBadge: { position: 'absolute', left: 6, bottom: 6, width: 21, height: 21, borderRadius: 11, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  statusBadge: { position: 'absolute', right: 5, top: 5, paddingHorizontal: 5, paddingVertical: 3, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.9)' },
  statusText: { fontFamily: fonts.body, fontSize: 7, fontWeight: '800', color: colors.ink, textTransform: 'uppercase', letterSpacing: 0.5 },
  addPhoto: { width: 70, height: 96, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, alignItems: 'center', justifyContent: 'center', gap: 5 },
  addPhotoText: { fontFamily: fonts.body, color: colors.muted, fontSize: 9 },
  retryRow: { marginTop: -18, marginBottom: 22 },
  retryText: { fontFamily: fonts.body, color: '#8C3C34', fontSize: 11 },
  proCard: { borderRadius: 14, backgroundColor: colors.ink, padding: 22, marginBottom: 22 },
  proBadge: { alignSelf: 'flex-start', backgroundColor: colors.white, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4, marginBottom: 14 },
  proBadgeText: { fontFamily: fonts.body, color: colors.ink, fontSize: 8.5, fontWeight: '800', letterSpacing: 1.2 },
  proTitle: { fontFamily: fonts.body, color: colors.white, fontSize: 22, lineHeight: 24, fontWeight: '600', letterSpacing: -0.3 },
  proCopy: { fontFamily: fonts.body, color: 'rgba(255,255,255,0.74)', fontSize: 12, marginTop: 8, marginBottom: 16 },
  proButton: { alignSelf: 'flex-start', height: 40, paddingHorizontal: 22, borderRadius: 11, backgroundColor: colors.white, justifyContent: 'center' },
  proButtonText: { fontFamily: fonts.body, color: colors.ink, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.1 },
  settings: { borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  setting: { minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  settingLast: { borderBottomWidth: 0 },
  settingText: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  dangerText: { color: '#8C3C34' },
  version: { fontFamily: fonts.body, fontSize: 9, color: colors.muted, textAlign: 'center', marginTop: 20 },
});
