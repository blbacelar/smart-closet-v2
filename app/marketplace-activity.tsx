import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowLeft, Check, Clock3, Coins, Gift, Repeat2, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MarketplaceMode } from '../src/features/marketplace/marketplaceValidation';
import {
  useCancelMarketplaceTransaction,
  useConfirmMarketplaceHandoff,
  useMarketplaceOffers,
  useMarketplaceTransactions,
  useRespondToMarketplaceOffer,
  useWithdrawMarketplaceOffer,
} from '../src/features/marketplace/useMarketplace';
import { useAuth } from '../src/providers/AuthProvider';
import { colors, fonts } from '../src/theme';

const modeLabels: Record<MarketplaceMode, string> = {
  credits: 'Fitly Credits',
  swap: 'Clothing swap',
  giveaway: 'Give away',
};

export default function MarketplaceActivityRoute() {
  const { identity } = useAuth();
  const offers = useMarketplaceOffers(identity?.id);
  const transactions = useMarketplaceTransactions(identity?.id);
  const respond = useRespondToMarketplaceOffer();
  const withdrawOffer = useWithdrawMarketplaceOffer();
  const confirm = useConfirmMarketplaceHandoff();
  const cancel = useCancelMarketplaceTransaction();
  const [message, setMessage] = useState('');
  const incoming = (offers.data ?? []).filter((item) => item.sellerId === identity?.id);
  const outgoing = (offers.data ?? []).filter((item) => item.buyerId === identity?.id);
  const busy = respond.isPending || withdrawOffer.isPending || confirm.isPending || cancel.isPending;

  const run = async (action: () => Promise<unknown>, success: string) => {
    setMessage('');
    try {
      await action();
      setMessage(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'That action could not be completed.');
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back to marketplace" accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <ArrowLeft color={colors.ink} size={20} />
        </Pressable>
        <Text style={styles.headerTitle}>ACTIVITY</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Offers & exchanges</Text>
        <Text style={styles.subtitle}>Credits move only after both members confirm the handoff.</Text>
        {!!message && <Text accessibilityRole="alert" style={styles.message}>{message}</Text>}

        <SectionTitle title="HANDOFFS" count={transactions.data?.length ?? 0} />
        {transactions.isLoading ? <ActivityIndicator color={colors.ink} /> : (transactions.data ?? []).length === 0 ? (
          <Empty text="Accepted offers will appear here." />
        ) : (transactions.data ?? []).map((item) => {
          const isBuyer = item.buyerId === identity?.id;
          const confirmed = isBuyer ? item.buyerConfirmedAt : item.sellerConfirmedAt;
          const otherConfirmed = isBuyer ? item.sellerConfirmedAt : item.buyerConfirmedAt;
          return (
            <View key={item.id} style={styles.card}>
              <CardHeader imageUrl={item.imageUrl} mode={item.mode} name={item.listingName} status={item.status} />
              <Text style={styles.detail}>
                {item.mode === 'credits' ? `${item.creditAmount} credits` : item.mode === 'swap' ? `Swap for ${item.swapListingName ?? 'another piece'}` : 'No credits required'}
              </Text>
              {item.status === 'awaiting_handoff' && (
                <>
                  <View style={styles.confirmationRow}>
                    <Text style={styles.confirmation}>{confirmed ? 'You confirmed' : 'Waiting for your confirmation'}</Text>
                    <Text style={styles.confirmation}>{otherConfirmed ? 'Other member confirmed' : 'Other member pending'}</Text>
                  </View>
                  {!confirmed && (
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => void run(() => confirm.mutateAsync(item.id), 'Handoff confirmed.')}
                      style={styles.primaryAction}
                    >
                      <Check color={colors.white} size={15} />
                      <Text style={styles.primaryActionText}>Confirm handoff</Text>
                    </Pressable>
                  )}
                  {!confirmed && !otherConfirmed && (
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => void run(() => cancel.mutateAsync(item.id), 'Exchange cancelled and reservations released.')}
                      style={styles.textAction}
                    >
                      <Text style={styles.textActionDanger}>Cancel exchange</Text>
                    </Pressable>
                  )}
                </>
              )}
            </View>
          );
        })}

        <SectionTitle title="INCOMING OFFERS" count={incoming.length} />
        {offers.isLoading ? <ActivityIndicator color={colors.ink} /> : incoming.length === 0 ? (
          <Empty text="Offers on your listed clothes will appear here." />
        ) : incoming.map((item) => (
          <View key={item.id} style={styles.card}>
            <CardHeader imageUrl={item.imageUrl} mode={item.mode} name={item.listingName} status={item.status} />
            <Text style={styles.detail}>{offerDetail(item.mode, item.creditAmount, item.swapListingName)}</Text>
            {!!item.message && <Text style={styles.note}>“{item.message}”</Text>}
            {item.status === 'pending' && (
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => void run(() => respond.mutateAsync({ offerId: item.id, accept: false }), 'Offer declined.')}
                  style={styles.rejectAction}
                >
                  <X color={colors.ink} size={15} /><Text style={styles.rejectText}>Decline</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => void run(() => respond.mutateAsync({ offerId: item.id, accept: true }), 'Offer accepted. Arrange a safe handoff.')}
                  style={[styles.primaryAction, styles.acceptAction]}
                >
                  <Check color={colors.white} size={15} /><Text style={styles.primaryActionText}>Accept</Text>
                </Pressable>
              </View>
            )}
          </View>
        ))}

        <SectionTitle title="YOUR OFFERS" count={outgoing.length} />
        {outgoing.length === 0 ? <Empty text="Offers you send will appear here." /> : outgoing.map((item) => (
          <View key={item.id} style={styles.card}>
            <CardHeader imageUrl={item.imageUrl} mode={item.mode} name={item.listingName} status={item.status} />
            <Text style={styles.detail}>{offerDetail(item.mode, item.creditAmount, item.swapListingName)}</Text>
            {item.status === 'pending' && (
              <>
                <View style={styles.pendingRow}><Clock3 color={colors.muted} size={12} /><Text style={styles.pending}>Waiting for the owner</Text></View>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => void run(() => withdrawOffer.mutateAsync(item.id), 'Offer withdrawn and any reserved credits released.')}
                  style={styles.textAction}
                >
                  <Text style={styles.textActionDanger}>Withdraw offer</Text>
                </Pressable>
              </>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function offerDetail(mode: MarketplaceMode, credits: number | null, swapName: string | null) {
  if (mode === 'credits') return `${credits} Fitly Credits reserved`;
  if (mode === 'swap') return `Offering ${swapName ?? 'another listed piece'}`;
  return 'Requesting this free give-away';
}

function SectionTitle({ title, count }: { title: string; count: number }) {
  return <Text style={styles.sectionTitle}>{title} · {count}</Text>;
}

function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

function CardHeader({ imageUrl, mode, name, status }: { imageUrl: string; mode: MarketplaceMode; name: string; status: string }) {
  const Icon = mode === 'credits' ? Coins : mode === 'swap' ? Repeat2 : Gift;
  return (
    <View style={styles.cardHeader}>
      <Image source={{ uri: imageUrl }} style={styles.image} contentFit="cover" />
      <View style={styles.cardCopy}>
        <Text numberOfLines={1} style={styles.cardName}>{name}</Text>
        <View style={styles.cardModeRow}><Icon color={colors.forestDark} size={12} /><Text style={styles.cardMode}>{modeLabels[mode]}</Text></View>
      </View>
      <Text style={styles.status}>{status.replaceAll('_', ' ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: { height: 52, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 42, height: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  headerTitle: { fontFamily: fonts.body, color: colors.muted, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.3 },
  headerSpacer: { width: 42 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 38 },
  title: { fontFamily: fonts.display, color: colors.ink, fontSize: 31, fontWeight: '600', letterSpacing: -0.7 },
  subtitle: { marginTop: 7, fontFamily: fonts.body, color: colors.muted, fontSize: 12, lineHeight: 18 },
  message: { marginTop: 14, padding: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.sage, fontFamily: fonts.body, color: colors.forestDark, fontSize: 11 },
  sectionTitle: { marginTop: 28, marginBottom: 10, fontFamily: fonts.body, color: colors.muted, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.15 },
  empty: { padding: 18, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, fontFamily: fonts.body, color: colors.muted, fontSize: 11, textAlign: 'center' },
  card: { marginBottom: 10, padding: 14, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  image: { width: 54, height: 64, borderRadius: 11, backgroundColor: colors.sage },
  cardCopy: { flex: 1, marginLeft: 11 },
  cardName: { fontFamily: fonts.body, color: colors.ink, fontSize: 13, fontWeight: '800' },
  cardModeRow: { marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMode: { fontFamily: fonts.body, color: colors.forestDark, fontSize: 9.5 },
  status: { maxWidth: 82, paddingHorizontal: 7, paddingVertical: 4, overflow: 'hidden', borderRadius: 7, backgroundColor: colors.sage, fontFamily: fonts.body, color: colors.forestDark, fontSize: 7.5, fontWeight: '900', textTransform: 'uppercase', textAlign: 'center' },
  detail: { marginTop: 11, fontFamily: fonts.body, color: colors.ink, fontSize: 11.5 },
  note: { marginTop: 9, padding: 10, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.canvas, fontFamily: fonts.body, color: colors.muted, fontSize: 10.5, lineHeight: 15 },
  actions: { marginTop: 12, flexDirection: 'row', gap: 8 },
  rejectAction: { flex: 1, minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  rejectText: { fontFamily: fonts.body, color: colors.ink, fontSize: 10.5, fontWeight: '800' },
  primaryAction: { minHeight: 44, marginTop: 12, borderRadius: 14, paddingHorizontal: 16, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  acceptAction: { flex: 1, marginTop: 0 },
  primaryActionText: { fontFamily: fonts.body, color: colors.white, fontSize: 10.5, fontWeight: '800' },
  confirmationRow: { marginTop: 10, gap: 4 },
  confirmation: { fontFamily: fonts.body, color: colors.muted, fontSize: 9.5 },
  textAction: { minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  textActionDanger: { fontFamily: fonts.body, color: '#8C3C34', fontSize: 10.5, fontWeight: '800' },
  pendingRow: { marginTop: 9, flexDirection: 'row', alignItems: 'center', gap: 5 },
  pending: { fontFamily: fonts.body, color: colors.muted, fontSize: 9.5 },
});
