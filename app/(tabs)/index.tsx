import { router } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Camera, ChevronRight, LockKeyhole, Plus, Sparkles } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Brand } from '../../src/components/Brand';
import { Screen } from '../../src/components/Screen';
import { bodyPhoto } from '../../src/data';
import { useFitlyStore } from '../../src/store';
import { colors, fonts, shadow } from '../../src/theme';

export default function HomeScreen() {
  const { garments, tryOnsUsed, isPro } = useFitlyStore();
  const recent = garments.slice(0, 3);
  const remaining = isPro ? 59 : Math.max(0, 3 - tryOnsUsed);

  return (
    <Screen>
      <View style={styles.header}>
        <Brand />
        <Pressable onPress={() => router.push('/(tabs)/profile')} style={styles.avatar} accessibilityLabel="Open your profile">
          <Image source={{ uri: bodyPhoto }} style={styles.avatarImage} contentFit="cover" />
          <View style={styles.onlineDot} />
        </Pressable>
      </View>

      <Text style={styles.eyebrow}>MONDAY, AUGUST 3</Text>
      <Text style={styles.greeting}>Good morning, Bruno.</Text>
      <Text style={styles.subhead}>What feels like you today?</Text>

      <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/tryon')} style={styles.heroWrap}>
        <LinearGradient colors={[colors.forestDark, '#3E7557']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroText}>
            <View style={styles.pill}><Sparkles size={13} color={colors.forestDark} /><Text style={styles.pillText}>{remaining} TRY-ONS LEFT</Text></View>
            <Text style={styles.heroTitle}>See it on you.</Text>
            <Text style={styles.heroCopy}>Choose anything from your closet and get a realistic preview in seconds.</Text>
            <View style={styles.heroButton}><Text style={styles.heroButtonText}>Start a try-on</Text><ArrowRight size={17} color={colors.forestDark} /></View>
          </View>
          <View style={styles.cutout}>
            <Image source={{ uri: bodyPhoto }} style={styles.heroImage} contentFit="cover" contentPosition="top" />
          </View>
          <View style={styles.sparkleOne} />
          <View style={styles.sparkleTwo} />
        </LinearGradient>
      </Pressable>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Your closet</Text>
          <Text style={styles.sectionMeta}>{garments.length} pieces, ready to style</Text>
        </View>
        <Pressable onPress={() => router.push('/(tabs)/closet')} style={styles.seeAll}><Text style={styles.seeAllText}>See all</Text><ChevronRight size={15} color={colors.forest} /></Pressable>
      </View>

      <View style={styles.recentRow}>
        {recent.map((item) => (
          <Pressable key={item.id} style={styles.miniCard} onPress={() => router.push('/(tabs)/closet')}>
            <Image source={{ uri: item.image }} style={styles.miniImage} contentFit="cover" transition={200} />
            <Text numberOfLines={1} style={styles.miniName}>{item.name}</Text>
            <Text style={styles.miniMeta}>{item.category}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.addCard} onPress={() => router.push('/add-garment')}>
        <View style={styles.addIcon}><Camera size={20} color={colors.forest} /></View>
        <View style={styles.addCopy}><Text style={styles.addTitle}>Add something new</Text><Text style={styles.addText}>Snap a photo. We’ll clean it up and tag it for you.</Text></View>
        <Plus size={20} color={colors.forest} />
      </Pressable>

      <View style={styles.privacyLine}><LockKeyhole size={13} color={colors.muted} /><Text style={styles.privacyText}>Your body photos are private and never shown to other people.</Text></View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: 8, marginBottom: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  avatar: { width: 42, height: 42 },
  avatarImage: { width: 42, height: 42, borderRadius: 16, backgroundColor: colors.sand },
  onlineDot: { position: 'absolute', right: -1, bottom: -1, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.coral, borderWidth: 2, borderColor: colors.canvas },
  eyebrow: { fontFamily: fonts.body, color: colors.coral, fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  greeting: { fontFamily: fonts.display, color: colors.ink, fontSize: 32, letterSpacing: -1.1, marginTop: 7 },
  subhead: { fontFamily: fonts.body, color: colors.muted, fontSize: 16, marginTop: 3, marginBottom: 22 },
  heroWrap: { borderRadius: 28, ...shadow },
  hero: { height: 276, borderRadius: 28, overflow: 'hidden', padding: 22, flexDirection: 'row' },
  heroText: { width: '60%', zIndex: 2 },
  pill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.sage, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 99 },
  pillText: { fontFamily: fonts.body, color: colors.forestDark, fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  heroTitle: { fontFamily: fonts.display, color: colors.white, fontSize: 35, lineHeight: 38, letterSpacing: -1.2, marginTop: 22 },
  heroCopy: { fontFamily: fonts.body, color: '#E5EEE8', fontSize: 13, lineHeight: 19, marginTop: 9 },
  heroButton: { marginTop: 18, backgroundColor: colors.surface, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 11, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7 },
  heroButtonText: { fontFamily: fonts.body, color: colors.forestDark, fontSize: 12, fontWeight: '800' },
  cutout: { position: 'absolute', right: -16, bottom: 0, width: '49%', height: '92%', borderTopLeftRadius: 90, overflow: 'hidden', backgroundColor: colors.sageDeep },
  heroImage: { width: '100%', height: '100%' },
  sparkleOne: { position: 'absolute', right: 153, top: 42, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.coral },
  sparkleTwo: { position: 'absolute', right: 144, top: 59, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.sage },
  sectionHeader: { marginTop: 30, marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  sectionTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 24, letterSpacing: -0.6 },
  sectionMeta: { fontFamily: fonts.body, color: colors.muted, fontSize: 12, marginTop: 3 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 1, paddingBottom: 3 },
  seeAllText: { fontFamily: fonts.body, color: colors.forest, fontSize: 13, fontWeight: '700' },
  recentRow: { flexDirection: 'row', gap: 10 },
  miniCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 17, padding: 6, paddingBottom: 11, ...shadow },
  miniImage: { width: '100%', aspectRatio: 0.83, borderRadius: 13, backgroundColor: colors.sand },
  miniName: { fontFamily: fonts.body, color: colors.ink, fontSize: 11, fontWeight: '700', marginTop: 8, paddingHorizontal: 3 },
  miniMeta: { fontFamily: fonts.body, color: colors.muted, fontSize: 10, marginTop: 2, paddingHorizontal: 3 },
  addCard: { marginTop: 22, backgroundColor: colors.sage, borderRadius: 21, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 13 },
  addIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  addCopy: { flex: 1 },
  addTitle: { fontFamily: fonts.body, color: colors.forestDark, fontSize: 14, fontWeight: '800' },
  addText: { fontFamily: fonts.body, color: '#52665A', fontSize: 11.5, lineHeight: 16, marginTop: 3 },
  privacyLine: { marginTop: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  privacyText: { fontFamily: fonts.body, color: colors.muted, fontSize: 10.5 },
});

