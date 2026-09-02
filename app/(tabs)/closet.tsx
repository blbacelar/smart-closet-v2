import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Plus, RefreshCw } from 'lucide-react-native';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GarmentCategory } from '../../src/features/garments/garmentValidation';
import { useGarments } from '../../src/features/garments/useGarments';
import { useAuth } from '../../src/providers/AuthProvider';
import { colors, fonts } from '../../src/theme';

type Filter = 'all' | GarmentCategory;

const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'top', label: 'Tops' },
  { value: 'dress', label: 'Dresses' },
  { value: 'bottom', label: 'Bottoms' },
  { value: 'outerwear', label: 'Outerwear' },
  { value: 'shoes', label: 'Shoes' },
];

const categoryLabels: Record<GarmentCategory, string> = {
  top: 'Top',
  bottom: 'Bottom',
  dress: 'Dress',
  outerwear: 'Outerwear',
  shoes: 'Shoes',
};

export default function ClosetScreen() {
  const insets = useSafeAreaInsets();
  const { identity } = useAuth();
  const garmentQuery = useGarments(identity?.id);
  const garments = garmentQuery.data ?? [];
  const [active, setActive] = useState<Filter>('all');
  const visible = useMemo(
    () => garments.filter((item) => active === 'all' || item.category === active),
    [active, garments],
  );

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
        keyExtractor={(item) => item.value}
        showsHorizontalScrollIndicator={false}
        style={styles.filterList}
        contentContainerStyle={styles.filters}
        renderItem={({ item }) => (
          <Pressable onPress={() => setActive(item.value)} style={[styles.filter, active === item.value && styles.filterActive]}>
            <Text style={[styles.filterText, active === item.value && styles.filterTextActive]}>{item.label}</Text>
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
            <Image source={{ uri: item.imageUrl }} style={styles.itemImage} contentFit="cover" transition={180} />
            {item.status === 'processing' && <Text style={styles.processing}>Cleanup pending</Text>}
            <Text numberOfLines={1} style={styles.itemName}>{item.name ?? 'Untitled piece'}</Text>
            <Text style={styles.itemMeta}>{item.category ? categoryLabels[item.category] : 'Uncategorized'}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          garmentQuery.isLoading ? (
            <ActivityIndicator style={styles.emptyState} color={colors.ink} />
          ) : garmentQuery.isError ? (
            <View style={styles.emptyState}>
              <Text style={styles.empty}>Could not load your closet.</Text>
              <Pressable accessibilityRole="button" onPress={() => garmentQuery.refetch()} style={styles.retry}>
                <RefreshCw size={14} color={colors.ink} />
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.empty}>{active === 'all' ? 'Your closet is ready for its first piece.' : 'No pieces in this category yet.'}</Text>
              {active === 'all' && (
                <Pressable accessibilityRole="button" onPress={() => router.push('/add-garment')} style={styles.retry}>
                  <Plus size={14} color={colors.ink} />
                  <Text style={styles.retryText}>Add a garment</Text>
                </Pressable>
              )}
            </View>
          )
        }
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
  processing: { position: 'absolute', left: 7, top: 7, borderRadius: 99, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 4, backgroundColor: 'rgba(20,20,20,0.72)', fontFamily: fonts.body, fontSize: 8, fontWeight: '700', color: colors.white },
  itemName: { fontFamily: fonts.body, fontSize: 12, color: colors.ink, marginTop: 8, marginHorizontal: 2 },
  itemMeta: { fontFamily: fonts.body, fontSize: 11, color: colors.muted, marginTop: 2, marginHorizontal: 2 },
  emptyState: { alignItems: 'center', marginTop: 64 },
  empty: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, textAlign: 'center' },
  retry: { marginTop: 14, minHeight: 40, paddingHorizontal: 15, borderRadius: 14, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  retryText: { fontFamily: fonts.body, fontSize: 11, fontWeight: '700', color: colors.ink },
});
