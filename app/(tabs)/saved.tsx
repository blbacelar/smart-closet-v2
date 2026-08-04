import { Image } from 'expo-image';
import { CalendarDays, Heart, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { bodyPhoto } from '../../src/data';
import { colors, fonts, shadow } from '../../src/theme';

export default function SavedScreen() {
  return (
    <Screen>
      <View style={styles.top}><View><Text style={styles.eyebrow}>YOUR LOOKBOOK</Text><Text style={styles.title}>Saved looks</Text></View><View style={styles.heart}><Heart size={20} color={colors.coral} fill={colors.coralSoft} /></View></View>
      <Text style={styles.subtitle}>Outfits you loved, all in one place.</Text>
      <View style={styles.featured}>
        <Image source={{ uri: bodyPhoto }} style={styles.image} contentFit="cover" contentPosition="top" />
        <View style={styles.overlay}>
          <View><Text style={styles.date}>JUL 28</Text><Text style={styles.name}>Summer market morning</Text><Text style={styles.items}>Linen button-up + wide-leg trousers</Text></View>
          <Heart size={19} color={colors.white} fill={colors.white} />
        </View>
      </View>
      <View style={styles.collectionHeader}><Text style={styles.section}>Collections</Text><Text style={styles.count}>1 look</Text></View>
      <Pressable onPress={() => router.push('/(tabs)/tryon')} style={styles.emptyCard}>
        <View style={styles.plus}><Plus size={22} color={colors.forest} /></View>
        <Text style={styles.emptyTitle}>Create your next favorite</Text>
        <Text style={styles.emptyCopy}>Mix something from your closet and save the result here.</Text>
      </Pressable>
      <View style={styles.tip}><CalendarDays size={18} color={colors.warning} /><Text style={styles.tipText}>Planning ahead? Saved looks make getting dressed on busy mornings much easier.</Text></View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { fontFamily: fonts.body, color: colors.coral, fontWeight: '800', letterSpacing: 1.3, fontSize: 11 },
  title: { fontFamily: fonts.display, color: colors.ink, fontSize: 35, letterSpacing: -1.1, marginTop: 4 },
  subtitle: { fontFamily: fonts.body, color: colors.muted, fontSize: 15, marginTop: 4, marginBottom: 24 },
  heart: { width: 43, height: 43, borderRadius: 16, backgroundColor: colors.coralSoft, alignItems: 'center', justifyContent: 'center' },
  featured: { height: 395, borderRadius: 28, overflow: 'hidden', backgroundColor: colors.sand, ...shadow },
  image: { width: '100%', height: '100%' },
  overlay: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 19, paddingTop: 54, backgroundColor: 'rgba(20,37,27,0.58)', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  date: { fontFamily: fonts.body, color: colors.sage, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  name: { fontFamily: fonts.display, color: colors.white, fontSize: 22, marginTop: 4 },
  items: { fontFamily: fonts.body, color: '#E9EEE9', fontSize: 11.5, marginTop: 4 },
  collectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, marginBottom: 13 },
  section: { fontFamily: fonts.display, color: colors.ink, fontSize: 23 },
  count: { fontFamily: fonts.body, color: colors.muted, fontSize: 12 },
  emptyCard: { backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.sageDeep, padding: 24, alignItems: 'center' },
  plus: { width: 44, height: 44, borderRadius: 17, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: fonts.body, color: colors.ink, fontWeight: '800', fontSize: 14, marginTop: 13 },
  emptyCopy: { fontFamily: fonts.body, color: colors.muted, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 4, maxWidth: 260 },
  tip: { marginTop: 18, backgroundColor: '#F5E9D8', borderRadius: 18, padding: 15, flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  tipText: { flex: 1, fontFamily: fonts.body, color: '#765B34', fontSize: 11.5, lineHeight: 17 },
});

