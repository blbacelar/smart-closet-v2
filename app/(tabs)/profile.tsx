import { router } from 'expo-router';
import { Bell, ChevronRight, Globe2, LogOut, Shield, Trash2 } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFitlyStore } from '../../src/store';
import { useAuth } from '../../src/providers/AuthProvider';
import { BodyPhotoGallery } from '../../src/features/body-photos/BodyPhotoGallery';
import {
  useBodyPhotos,
  useDeleteBodyPhoto,
  useValidateBodyPhoto,
} from '../../src/features/body-photos/useBodyPhotos';
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
  const deleteBodyPhoto = useDeleteBodyPhoto(identity?.id ?? 'signed-out');
  const validateBodyPhoto = useValidateBodyPhoto(identity?.id ?? 'signed-out');

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

      <BodyPhotoGallery
        photos={bodyPhotos.data ?? []}
        isLoading={bodyPhotos.isLoading}
        hasError={bodyPhotos.isError}
        onAdd={() => router.push('/add-body-photo')}
        onDelete={(photo) => deleteBodyPhoto.mutateAsync(photo.id)}
        onRetryValidation={(photo) => validateBodyPhoto.mutateAsync(photo.id).then(() => undefined)}
        onRetry={() => bodyPhotos.refetch()}
      />

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
