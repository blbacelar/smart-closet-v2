import { ArrowRight, Check, Coins, Repeat2, Shirt, X } from 'lucide-react-native';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, shadow } from '../../theme';
import type { MarketplaceSummary } from './marketplaceRepository';

type Props = {
  summary: MarketplaceSummary;
  isActivating: boolean;
  message?: string;
  onActivate: () => void;
  onClose: () => void;
};

export function MarketplaceMembershipScreen({
  summary,
  isActivating,
  message,
  onActivate,
  onClose,
}: Props) {
  const price = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: summary.currencyCode,
    maximumFractionDigits: 0,
  }).format(summary.annualPriceCents / 100);
  const active = summary.membershipStatus === 'active';

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View />
        <Pressable accessibilityLabel="Close membership" accessibilityRole="button" onPress={onClose} style={styles.close}>
          <X color={colors.ink} size={20} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.coin}><Coins color={colors.white} size={30} /></View>
        <Text style={styles.eyebrow}>FITLY CIRCLE</Text>
        <Text style={styles.title}>Wear more.{`\n`}Waste less.</Text>
        <Text style={styles.copy}>
          One annual membership gives you access to exchanges and a starting balance of Fitly Credits.
        </Text>

        <View style={styles.plan}>
          <View>
            <Text style={styles.planLabel}>{active ? 'ACTIVE MEMBERSHIP' : 'ANNUAL MEMBERSHIP'}</Text>
            <Text style={styles.price}>{active ? `${summary.availableCredits} credits` : price}</Text>
          </View>
          <Text style={styles.period}>{active ? 'available now' : 'per year · pilot price'}</Text>
        </View>

        <View style={styles.benefits}>
          <Benefit Icon={Coins} text={`${summary.firstYearCreditGrant} credits when you first join`} />
          <Benefit Icon={Shirt} text="Earn credits when another member receives your clothes" />
          <Benefit Icon={Repeat2} text="Swap clothes directly without using credits" />
          <Benefit Icon={Check} text={`${summary.renewalCreditGrant} credits on each renewal`} />
        </View>

        {!!message && <Text accessibilityRole="alert" style={styles.message}>{message}</Text>}

        {!active && (
          <Pressable
            accessibilityLabel="Activate annual marketplace membership"
            accessibilityRole="button"
            disabled={isActivating}
            onPress={onActivate}
            style={[styles.button, isActivating && styles.buttonDisabled]}
          >
            {isActivating ? <ActivityIndicator color={colors.white} /> : <Coins color={colors.white} size={18} />}
            <Text style={styles.buttonText}>{isActivating ? 'Activating…' : 'Activate membership'}</Text>
            {!isActivating && <ArrowRight color={colors.white} size={18} />}
          </Pressable>
        )}
        {active && (
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.button}>
            <Text style={styles.buttonText}>Explore marketplace</Text>
            <ArrowRight color={colors.white} size={18} />
          </Pressable>
        )}

        <Text style={styles.disclosure}>
          {summary.billingMode === 'development'
            ? 'Development mode: activating this membership does not charge you. Store checkout will replace this step before public launch.'
            : 'Payment, renewal, cancellation, and refund terms are shown by the store before purchase.'}
          {' '}Fitly Credits have no cash value and cannot be withdrawn or transferred outside completed clothing exchanges.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Benefit({ Icon, text }: { Icon: typeof Coins; text: string }) {
  return (
    <View style={styles.benefit}>
      <View style={styles.benefitIcon}><Icon color={colors.ink} size={17} /></View>
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: { height: 48, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between' },
  close: { width: 42, height: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 34 },
  coin: { width: 66, height: 66, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.forest, ...shadow },
  eyebrow: { marginTop: 24, fontFamily: fonts.body, color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  title: { marginTop: 8, fontFamily: fonts.display, color: colors.ink, fontSize: 40, lineHeight: 43, fontWeight: '600', letterSpacing: -1 },
  copy: { marginTop: 14, maxWidth: 390, fontFamily: fonts.body, color: colors.muted, fontSize: 14, lineHeight: 21 },
  plan: { marginTop: 28, padding: 20, borderRadius: 20, backgroundColor: colors.sage, borderWidth: 1, borderColor: colors.sageDeep, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  planLabel: { fontFamily: fonts.body, color: colors.forestDark, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  price: { marginTop: 5, fontFamily: fonts.display, color: colors.ink, fontSize: 30, fontWeight: '600' },
  period: { fontFamily: fonts.body, color: colors.muted, fontSize: 9.5 },
  benefits: { marginTop: 26, gap: 13 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefitIcon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  benefitText: { flex: 1, fontFamily: fonts.body, color: colors.ink, fontSize: 12.5, lineHeight: 18 },
  message: { marginTop: 18, padding: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F4E5E2', color: '#8C3C34', fontFamily: fonts.body, fontSize: 12 },
  button: { minHeight: 56, marginTop: 28, paddingHorizontal: 20, borderRadius: 18, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, ...shadow },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { fontFamily: fonts.body, color: colors.white, fontSize: 13, fontWeight: '800' },
  disclosure: { marginTop: 15, paddingHorizontal: 7, fontFamily: fonts.body, color: colors.muted, fontSize: 9.5, lineHeight: 14, textAlign: 'center' },
});
