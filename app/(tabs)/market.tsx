import { Image } from 'expo-image';
import { Eye, Gift, MapPin, Palette, Ruler, Tag } from 'lucide-react-native';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFitlyStore } from '../../src/store';
import { colors, fonts } from '../../src/theme';

const filterData = [
  { label: '25 km', Icon: MapPin, active: true },
  { label: 'Sale', Icon: Tag, active: true },
  { label: 'Donation', Icon: Gift, active: false },
  { label: 'Size M', Icon: Ruler, active: false },
  { label: 'Color', Icon: Palette, active: false },
];

const listingMeta = [
  { price: '$24', size: 'Size M', area: 'Riverside', distance: '1.2 km' },
  { price: 'Donation', size: 'Size S', area: 'Northgate', distance: '2.8 km' },
  { price: '$40', size: 'Size L', area: 'Old Town', distance: '4.2 km' },
  { price: '$16', size: 'Size M', area: 'Harbor', distance: '3.1 km' },
  { price: 'Donation', size: 'Size XS', area: 'Elmwood', distance: '5.0 km' },
  { price: '$32', size: 'Size S', area: 'Midtown', distance: '2.1 km' },
];

export default function MarketScreen() {
  const insets = useSafeAreaInsets();
  const garments = useFitlyStore((state) => state.garments);
  const listings = garments.slice(0, 6).map((garment, index) => ({ ...garment, ...listingMeta[index] }));

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 18 }]}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>312 closets near you</Text>
        <Text style={styles.title}>Nearby</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filters}>
        {filterData.map(({ label, Icon, active }) => (
          <Pressable key={label} style={[styles.filter, active && styles.filterActive]}>
            <Icon size={13} color={active ? colors.white : colors.muted} />
            <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <FlatList
        data={listings}
        numColumns={2}
        keyExtractor={(item) => item.id}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={styles.listing}>
            <View style={styles.photoWrap}>
              <Image source={{ uri: item.image }} style={styles.photo} contentFit="cover" transition={180} />
              <View style={styles.distance}><Text style={styles.distanceText}>{item.distance}</Text></View>
            </View>
            <View style={styles.metaRow}><Text style={styles.price}>{item.price}</Text><Text style={styles.size}>{item.size}</Text></View>
            <Text style={styles.area}>{item.area}</Text>
            <Pressable style={styles.tryButton}>
              <Eye size={13} color={colors.white} />
              <Text style={styles.tryText}>See it on you</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  heading: { paddingHorizontal: 22 },
  eyebrow: { fontFamily: fonts.body, fontSize: 10, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 6 },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, fontWeight: '600', letterSpacing: -0.7, color: colors.ink },
  filterScroll: { flexGrow: 0, height: 34, marginTop: 18, marginBottom: 18 },
  filters: { height: 34, paddingHorizontal: 22, gap: 8 },
  filter: { height: 34, borderRadius: 14, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  filterText: { fontFamily: fonts.body, color: colors.muted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.1 },
  filterTextActive: { color: colors.white },
  grid: { paddingHorizontal: 22, paddingBottom: 28 },
  row: { justifyContent: 'space-between' },
  listing: { width: '48.2%', marginBottom: 18 },
  photoWrap: { width: '100%', aspectRatio: 0.75, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.sage, borderWidth: 1, borderColor: colors.line },
  photo: { width: '100%', height: '100%' },
  distance: { position: 'absolute', left: 8, top: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  distanceText: { fontFamily: fonts.body, color: colors.ink, fontSize: 9.5 },
  metaRow: { marginTop: 9, marginHorizontal: 2, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  price: { fontFamily: fonts.body, fontSize: 13, color: colors.ink },
  size: { fontFamily: fonts.body, fontSize: 10.5, color: colors.muted },
  area: { fontFamily: fonts.body, fontSize: 10.5, color: colors.muted, marginHorizontal: 2, marginTop: 2, marginBottom: 9 },
  tryButton: { height: 36, borderRadius: 14, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  tryText: { fontFamily: fonts.body, color: colors.white, fontSize: 9.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.1 },
});
