import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Check } from 'lucide-react-native';
import { Garment } from '../data';
import { colors, fonts, shadow } from '../theme';

export function GarmentCard({ garment, selected = false, onPress }: { garment: Garment; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Select ${garment.name}`} onPress={onPress} style={[styles.card, selected && styles.selected]}>
      <View style={styles.imageWrap}>
        <Image source={{ uri: garment.image }} style={styles.image} contentFit="cover" transition={250} />
        {selected && <View style={styles.check}><Check size={14} color={colors.white} strokeWidth={3} /></View>}
      </View>
      <Text numberOfLines={1} style={styles.name}>{garment.name}</Text>
      <Text style={styles.meta}>{garment.color} · {garment.size}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: '48%', backgroundColor: colors.surface, borderRadius: 20, padding: 7, paddingBottom: 13, borderWidth: 1.5, borderColor: 'transparent', ...shadow },
  selected: { borderColor: colors.forest },
  imageWrap: { height: 168, borderRadius: 15, overflow: 'hidden', backgroundColor: colors.sand },
  image: { width: '100%', height: '100%' },
  check: { position: 'absolute', right: 9, top: 9, width: 27, height: 27, borderRadius: 14, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.body, fontWeight: '700', color: colors.ink, fontSize: 14, marginTop: 10, paddingHorizontal: 4 },
  meta: { fontFamily: fonts.body, color: colors.muted, fontSize: 12, marginTop: 3, paddingHorizontal: 4 },
});

