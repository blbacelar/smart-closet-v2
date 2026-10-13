import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Coins, Gift, Inbox, MapPin, RefreshCw, Repeat2, Ruler } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMarketplaceListings, useMarketplaceSummary } from '../../src/features/marketplace/useMarketplace';
import { useAuth } from '../../src/providers/AuthProvider';
import { colors, fonts, shadow } from '../../src/theme';

type MarketFilter = 'credits' | 'swap' | 'giveaway' | 'size-m';

const filterData: { key: MarketFilter; label: string; Icon: typeof Coins }[] = [
  { key: 'credits', label: 'Credits', Icon: Coins },
  { key: 'swap', label: 'Swap', Icon: Repeat2 },
  { key: 'giveaway', label: 'Give away', Icon: Gift },
  { key: 'size-m', label: 'Size M', Icon: Ruler },
];

export default function MarketScreen() {
  const insets = useSafeAreaInsets();
  const { identity } = useAuth();
  const summary = useMarketplaceSummary(identity?.id);
  const listings = useMarketplaceListings(identity?.id);
  const [activeFilters, setActiveFilters] = useState<MarketFilter[]>([]);
  const filteredListings = useMemo(() => (listings.data ?? []).filter((item) => {
    if (activeFilters.includes('credits') && !item.acceptsCredits) return false;
    if (activeFilters.includes('swap') && !item.acceptsSwap) return false;
    if (activeFilters.includes('giveaway') && !item.isGiveaway) return false;
    if (activeFilters.includes('size-m') && item.size?.toUpperCase() !== 'M') return false;
    return true;
  }), [activeFilters, listings.data]);

  const toggleFilter = (filter: MarketFilter) => {
    setActiveFilters((current) => current.includes(filter)
      ? current.filter((value) => value !== filter)
      : [...current, filter]);
  };

  const isRefreshing = listings.isRefetching || summary.isRefetching;
  const refresh = async () => {
    await Promise.all([listings.refetch(), summary.refetch()]);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 18 }]}>
      <View style={styles.headingRow}>
        <View>
          <Text style={styles.eyebrow}>{listings.data?.length ?? 0} pieces available</Text>
          <Text style={styles.title}>Marketplace</Text>
        </View>
        <Pressable
          accessibilityLabel="Marketplace activity"
          accessibilityRole="button"
          onPress={() => router.push('/marketplace-activity')}
          style={styles.activityButton}
        >
          <Inbox color={colors.ink} size={20} />
        </Pressable>
      </View>

      {summary.data?.membershipStatus === 'active' ? (
        <Pressable
          accessibilityLabel="View marketplace membership"
          accessibilityRole="button"
          onPress={() => router.push('/marketplace-membership')}
          style={styles.balanceCard}
        >
          <View style={styles.balanceIcon}><Coins color={colors.white} size={17} /></View>
          <View style={styles.balanceCopy}>
            <Text style={styles.balanceLabel}>FITLY CREDITS</Text>
            <Text style={styles.balanceValue}>{summary.data.availableCredits} available</Text>
          </View>
          {summary.data.reservedCredits > 0 && <Text style={styles.reserved}>{summary.data.reservedCredits} reserved</Text>}
        </Pressable>
      ) : (
        <Pressable
          accessibilityLabel="Join Fitly Circle"
          accessibilityRole="button"
          onPress={() => router.push('/marketplace-membership')}
          style={styles.joinCard}
        >
          <View style={styles.joinCopy}>
            <Text style={styles.joinTitle}>Join Fitly Circle</Text>
            <Text style={styles.joinText}>Exchange with credits, swap directly, or give clothes away.</Text>
          </View>
          <Text style={styles.joinAction}>JOIN</Text>
        </Pressable>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
        directionalLockEnabled
        bounces={false}
        overScrollMode="never"
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustsScrollIndicatorInsets={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filters}
      >
        <View style={[styles.filter, styles.filterActive]}>
          <MapPin size={13} color={colors.white} />
          <Text style={[styles.filterText, styles.filterTextActive]}>Local pickup</Text>
        </View>
        {filterData.map(({ key, label, Icon }) => {
          const active = activeFilters.includes(key);
          return (
            <Pressable
              accessibilityLabel={`${label} filter`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              key={key}
              onPress={() => toggleFilter(key)}
              style={[styles.filter, active && styles.filterActive]}
            >
              <Icon size={13} color={active ? colors.white : colors.muted} />
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <FlatList
        data={filteredListings}
        numColumns={2}
        keyExtractor={(item) => item.id}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.grid, filteredListings.length === 0 && styles.emptyGrid]}
        showsVerticalScrollIndicator={false}
        refreshing={isRefreshing}
        onRefresh={() => void refresh()}
        renderItem={({ item }) => (
          <Pressable
            accessibilityLabel={`Open ${item.garmentName} listing`}
            accessibilityRole="button"
            onPress={() => router.push(`/marketplace/${item.id}`)}
            style={styles.listing}
          >
            <View style={styles.photoWrap}>
              <Image source={{ uri: item.imageUrl }} style={styles.photo} contentFit="cover" transition={180} />
              <View style={styles.areaPill}><Text numberOfLines={1} style={styles.areaPillText}>{item.pickupArea}</Text></View>
            </View>
            <View style={styles.metaRow}>
              <Text numberOfLines={1} style={styles.name}>{item.garmentName}</Text>
              <Text style={styles.size}>{item.size ? `Size ${item.size}` : 'Size —'}</Text>
            </View>
            <View style={styles.modeRow}>
              {item.acceptsCredits && <Text style={styles.mode}>{item.creditPrice} credits</Text>}
              {item.acceptsSwap && <Text style={styles.mode}>Swap</Text>}
              {item.isGiveaway && <Text style={styles.mode}>Free</Text>}
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          listings.isLoading ? (
            <ActivityIndicator color={colors.ink} />
          ) : listings.isError ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Could not load the marketplace.</Text>
              <Pressable accessibilityRole="button" onPress={() => void listings.refetch()} style={styles.retryButton}>
                <RefreshCw color={colors.ink} size={14} />
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No pieces match these filters yet.</Text>
              <Text style={styles.emptyText}>List a ready garment from your closet to start the community.</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  headingRow: { paddingHorizontal: 22, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  eyebrow: { fontFamily: fonts.body, fontSize: 10, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 6 },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, fontWeight: '600', letterSpacing: -0.7, color: colors.ink },
  activityButton: { width: 42, height: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  balanceCard: { marginTop: 18, marginHorizontal: 22, minHeight: 66, borderRadius: 17, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.sage, borderWidth: 1, borderColor: colors.sageDeep },
  balanceIcon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.forest },
  balanceCopy: { flex: 1, marginLeft: 11 },
  balanceLabel: { fontFamily: fonts.body, color: colors.forestDark, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  balanceValue: { marginTop: 3, fontFamily: fonts.body, color: colors.ink, fontSize: 14, fontWeight: '800' },
  reserved: { fontFamily: fonts.body, color: colors.muted, fontSize: 9.5 },
  joinCard: { marginTop: 18, marginHorizontal: 22, minHeight: 76, padding: 16, borderRadius: 18, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', gap: 10, ...shadow },
  joinCopy: { flex: 1 },
  joinTitle: { fontFamily: fonts.body, color: colors.white, fontSize: 14, fontWeight: '800' },
  joinText: { marginTop: 4, fontFamily: fonts.body, color: 'rgba(255,255,255,0.7)', fontSize: 10, lineHeight: 14 },
  joinAction: { fontFamily: fonts.body, color: colors.white, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  filterScroll: { flexGrow: 0, flexShrink: 0, height: 56, marginTop: 10, marginBottom: 10 },
  filters: { height: 56, paddingHorizontal: 22, gap: 8, alignItems: 'center' },
  filter: { height: 34, borderRadius: 14, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  filterText: { fontFamily: fonts.body, color: colors.muted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.1 },
  filterTextActive: { color: colors.white },
  grid: { paddingHorizontal: 22, paddingBottom: 28 },
  emptyGrid: { flexGrow: 1, justifyContent: 'center' },
  row: { justifyContent: 'space-between' },
  listing: { width: '48.2%', marginBottom: 20 },
  photoWrap: { width: '100%', aspectRatio: 0.75, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.sage, borderWidth: 1, borderColor: colors.line },
  photo: { width: '100%', height: '100%' },
  areaPill: { position: 'absolute', left: 8, top: 8, alignSelf: 'flex-start', maxWidth: '84%', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  areaPillText: { fontFamily: fonts.body, color: colors.ink, fontSize: 8.5 },
  metaRow: { marginTop: 9, marginHorizontal: 2, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 5 },
  name: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: colors.ink, fontWeight: '700' },
  size: { fontFamily: fonts.body, fontSize: 9.5, color: colors.muted },
  modeRow: { minHeight: 18, marginTop: 5, marginHorizontal: 2, flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  mode: { overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, backgroundColor: colors.sage, fontFamily: fonts.body, color: colors.forestDark, fontSize: 8.5, fontWeight: '800' },
  empty: { alignItems: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontFamily: fonts.body, color: colors.ink, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  emptyText: { marginTop: 7, fontFamily: fonts.body, color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  retryButton: { marginTop: 14, minHeight: 42, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 7 },
  retryText: { fontFamily: fonts.body, color: colors.ink, fontSize: 11, fontWeight: '800' },
});
