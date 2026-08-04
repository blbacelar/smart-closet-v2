import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Plus } from 'lucide-react-native';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Category } from '../../src/data';
import { useFitlyStore } from '../../src/store';
import { colors, fonts } from '../../src/theme';

const filters: Category[] = ['All', 'Tops', 'Dresses', 'Bottoms', 'Outerwear'];

export default function ClosetScreen() {
  const insets = useSafeAreaInsets();
  const garments = useFitlyStore((state) => state.garments);
  const [active, setActive] = useState<Category>('All');
  const visible = useMemo(() => garments.filter((item) => active === 'All' || item.category === active), [active, garments]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 18 }]}>
      <View style={styles.headingRow}>
        <View>
          <Text style={styles.eyebrow}>{garments.length} pieces</Text>
          <Text style={styles.title}>Your Closet</Text>
        </View>
        <Pressable accessibilityLabel="Add garment" onPress={() => router.push('/add-garment')} style={styles.addButton}>
          <Plus size={20} color={colors.white} />
        </Pressable>
      </View>

      <FlatList
        horizontal
        data={filters}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        style={styles.filterList}
        contentContainerStyle={styles.filters}
        renderItem={({ item }) => (
          <Pressable onPress={() => setActive(item)} style={[styles.filter, active === item && styles.filterActive]}>
            <Text style={[styles.filterText, active === item && styles.filterTextActive]}>{item}</Text>
          </Pressable>
        )}
      />

      <FlatList
        data={visible}
        numColumns={2}
        keyExtractor={(item) => item.id}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable style={styles.item}>
            <Image source={{ uri: item.image }} style={styles.itemImage} contentFit="cover" transition={180} />
            <Text numberOfLines={1} style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemMeta}>{item.category}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No pieces in this category yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas, paddingHorizontal: 22 },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eyebrow: { fontFamily: fonts.body, fontSize: 10, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 6 },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, fontWeight: '600', letterSpacing: -0.7, color: colors.ink },
  addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  filterList: { flexGrow: 0, height: 32, marginHorizontal: -22, marginTop: 20, marginBottom: 20 },
  filters: { height: 32, paddingHorizontal: 22, gap: 8 },
  filter: { height: 32, borderRadius: 14, paddingHorizontal: 15, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  filterActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  filterText: { fontFamily: fonts.body, color: colors.muted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.2 },
  filterTextActive: { color: colors.white },
  grid: { paddingBottom: 28 },
  row: { justifyContent: 'space-between' },
  item: { width: '48.2%', marginBottom: 16 },
  itemImage: { width: '100%', aspectRatio: 0.75, borderRadius: 14, backgroundColor: colors.sage, borderWidth: 1, borderColor: colors.line },
  itemName: { fontFamily: fonts.body, fontSize: 12, color: colors.ink, marginTop: 8, marginHorizontal: 2 },
  itemMeta: { fontFamily: fonts.body, fontSize: 11, color: colors.muted, marginTop: 2, marginHorizontal: 2 },
  empty: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 64 },
});
