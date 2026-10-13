import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Coins, Gift, MapPin, Repeat2, Send } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MarketplaceMode } from '../../src/features/marketplace/marketplaceValidation';
import {
  useCreateMarketplaceOffer,
  useMarketplaceListings,
  useMarketplaceSummary,
} from '../../src/features/marketplace/useMarketplace';
import { useAuth } from '../../src/providers/AuthProvider';
import { colors, fonts, shadow } from '../../src/theme';

export default function MarketplaceListingRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { identity } = useAuth();
  const listings = useMarketplaceListings(identity?.id);
  const summary = useMarketplaceSummary(identity?.id);
  const createOffer = useCreateMarketplaceOffer();
  const [mode, setMode] = useState<MarketplaceMode | null>(null);
  const [swapListingId, setSwapListingId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const listing = listings.data?.find((item) => item.id === id);
  const ownSwapListings = useMemo(() => (listings.data ?? []).filter((item) => (
    item.sellerId === identity?.id && item.acceptsSwap && item.id !== id
  )), [id, identity?.id, listings.data]);

  if (listings.isLoading || summary.isLoading) {
    return <View style={styles.center}><ActivityIndicator color={colors.ink} /></View>;
  }
  if (!listing) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>This listing is no longer available.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Back to marketplace</Text>
        </Pressable>
      </View>
    );
  }

  const isOwner = listing.sellerId === identity?.id;
  const insufficientCredits = mode === 'credits'
    && (summary.data?.availableCredits ?? 0) < (listing.creditPrice ?? 0);

  const sendOffer = async () => {
    if (!mode) {
      setMessage('Choose credits, swap, or give-away request.');
      return;
    }
    if (mode === 'swap' && !swapListingId) {
      setMessage('Choose one of your active swap listings.');
      return;
    }
    if (insufficientCredits) {
      setMessage('You do not have enough available Fitly Credits for this piece.');
      return;
    }
    setMessage('');
    try {
      await createOffer.mutateAsync({ listingId: listing.id, mode, swapListingId, message: note });
      setMessage('Offer sent. You can follow it from Marketplace activity.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not send that offer.');
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back to marketplace" accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <ArrowLeft color={colors.ink} size={20} />
        </Pressable>
        <Text style={styles.headerTitle}>FITLY MARKET</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Image accessibilityLabel={`${listing.garmentName} listing photo`} contentFit="cover" source={{ uri: listing.imageUrl }} style={styles.image} />
        <View style={styles.location}><MapPin color={colors.forestDark} size={13} /><Text style={styles.locationText}>{listing.pickupArea}</Text></View>
        <Text style={styles.title}>{listing.garmentName}</Text>
        <Text style={styles.meta}>{[listing.category, listing.color, listing.size ? `Size ${listing.size}` : null].filter(Boolean).join(' · ')}</Text>
        <Text style={styles.seller}>Listed by {listing.sellerName}</Text>

        {isOwner ? (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>This is your listing</Text>
            <Text style={styles.noticeText}>Open this garment from your closet to update or remove it. Incoming offers appear in Marketplace activity.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push(`/garment/${listing.garmentId}`)} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Manage in closet</Text>
            </Pressable>
          </View>
        ) : summary.data?.membershipStatus !== 'active' ? (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>Membership required</Text>
            <Text style={styles.noticeText}>Join Fitly Circle to make credit, swap, and give-away offers.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/marketplace-membership')} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>View membership</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.sectionLabel}>CHOOSE AN OFFER</Text>
            <View style={styles.options}>
              {listing.acceptsCredits && (
                <OfferOption
                  Icon={Coins}
                  active={mode === 'credits'}
                  label={`${listing.creditPrice} credits`}
                  onPress={() => { setMode('credits'); setSwapListingId(null); setMessage(''); }}
                />
              )}
              {listing.acceptsSwap && (
                <OfferOption
                  Icon={Repeat2}
                  active={mode === 'swap'}
                  label="Swap clothes"
                  onPress={() => { setMode('swap'); setMessage(''); }}
                />
              )}
              {listing.isGiveaway && (
                <OfferOption
                  Icon={Gift}
                  active={mode === 'giveaway'}
                  label="Request free"
                  onPress={() => { setMode('giveaway'); setSwapListingId(null); setMessage(''); }}
                />
              )}
            </View>

            {mode === 'credits' && (
              <Text style={styles.balance}>{summary.data.availableCredits} credits available · credits are reserved when you send</Text>
            )}
            {mode === 'swap' && (
              <View>
                <Text style={styles.sectionLabel}>OFFER ONE OF YOUR LISTINGS</Text>
                {ownSwapListings.length === 0 ? (
                  <Text style={styles.help}>List one of your closet pieces with Swap enabled first.</Text>
                ) : (
                  <View style={styles.swapOptions}>
                    {ownSwapListings.map((item) => (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: swapListingId === item.id }}
                        key={item.id}
                        onPress={() => setSwapListingId(item.id)}
                        style={[styles.swapOption, swapListingId === item.id && styles.swapOptionActive]}
                      >
                        <Image source={{ uri: item.imageUrl }} style={styles.swapImage} contentFit="cover" />
                        <Text numberOfLines={2} style={styles.swapName}>{item.garmentName}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            )}

            <Text style={styles.sectionLabel}>MESSAGE (OPTIONAL)</Text>
            <TextInput
              accessibilityLabel="Offer message"
              maxLength={500}
              multiline
              onChangeText={setNote}
              placeholder="Introduce yourself and suggest a safe public pickup plan."
              placeholderTextColor="#9B9F9B"
              style={styles.note}
              value={note}
            />
            {!!message && <Text accessibilityRole="alert" style={[styles.message, message.startsWith('Offer sent') && styles.success]}>{message}</Text>}
            <Pressable
              accessibilityLabel="Send marketplace offer"
              accessibilityRole="button"
              disabled={createOffer.isPending}
              onPress={() => void sendOffer()}
              style={[styles.primaryButton, createOffer.isPending && styles.disabled]}
            >
              {createOffer.isPending ? <ActivityIndicator color={colors.white} /> : <Send color={colors.white} size={17} />}
              <Text style={styles.primaryButtonText}>{createOffer.isPending ? 'Sending…' : 'Send offer'}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function OfferOption({ Icon, active, label, onPress }: { Icon: typeof Coins; active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.option, active && styles.optionActive]}>
      <Icon color={active ? colors.white : colors.ink} size={18} />
      <Text style={[styles.optionText, active && styles.optionTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  center: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  header: { height: 52, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 42, height: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  headerTitle: { fontFamily: fonts.body, color: colors.muted, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.3 },
  headerSpacer: { width: 42 },
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 36 },
  image: { width: '100%', aspectRatio: 0.82, borderRadius: 22, backgroundColor: colors.sage, borderWidth: 1, borderColor: colors.line },
  location: { alignSelf: 'flex-start', marginTop: 15, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99, backgroundColor: colors.sage, flexDirection: 'row', alignItems: 'center', gap: 5 },
  locationText: { fontFamily: fonts.body, color: colors.forestDark, fontSize: 9.5, fontWeight: '800' },
  title: { marginTop: 12, fontFamily: fonts.display, color: colors.ink, fontSize: 31, fontWeight: '600', letterSpacing: -0.7 },
  meta: { marginTop: 5, fontFamily: fonts.body, color: colors.muted, fontSize: 12 },
  seller: { marginTop: 5, fontFamily: fonts.body, color: colors.muted, fontSize: 10.5 },
  sectionLabel: { marginTop: 24, marginBottom: 9, fontFamily: fonts.body, color: colors.muted, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.1 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { minHeight: 46, paddingHorizontal: 14, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  optionActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  optionText: { fontFamily: fonts.body, color: colors.ink, fontSize: 11, fontWeight: '800' },
  optionTextActive: { color: colors.white },
  balance: { marginTop: 10, fontFamily: fonts.body, color: colors.muted, fontSize: 10 },
  swapOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  swapOption: { width: '31%', padding: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  swapOptionActive: { borderColor: colors.forest, borderWidth: 2, backgroundColor: colors.sage },
  swapImage: { width: '100%', aspectRatio: 1, borderRadius: 9, backgroundColor: colors.sage },
  swapName: { marginTop: 6, fontFamily: fonts.body, color: colors.ink, fontSize: 9.5, fontWeight: '700' },
  help: { fontFamily: fonts.body, color: colors.muted, fontSize: 11, lineHeight: 16 },
  note: { minHeight: 92, padding: 14, borderRadius: 16, textAlignVertical: 'top', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, fontFamily: fonts.body, color: colors.ink, fontSize: 12 },
  message: { marginTop: 12, padding: 12, overflow: 'hidden', borderRadius: 12, backgroundColor: '#F4E5E2', fontFamily: fonts.body, color: '#8C3C34', fontSize: 11 },
  success: { backgroundColor: colors.sage, color: colors.forestDark },
  primaryButton: { minHeight: 54, marginTop: 16, paddingHorizontal: 20, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.ink, ...shadow },
  primaryButtonText: { fontFamily: fonts.body, color: colors.white, fontSize: 12.5, fontWeight: '800' },
  secondaryButton: { minHeight: 48, marginTop: 14, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  secondaryButtonText: { fontFamily: fonts.body, color: colors.ink, fontSize: 11.5, fontWeight: '800' },
  disabled: { opacity: 0.65 },
  noticeCard: { marginTop: 24, padding: 18, borderRadius: 18, backgroundColor: colors.sage, borderWidth: 1, borderColor: colors.sageDeep },
  noticeTitle: { fontFamily: fonts.body, color: colors.ink, fontSize: 15, fontWeight: '800' },
  noticeText: { marginTop: 7, fontFamily: fonts.body, color: colors.muted, fontSize: 11.5, lineHeight: 17 },
  errorText: { fontFamily: fonts.body, color: colors.muted, fontSize: 13, textAlign: 'center' },
});
