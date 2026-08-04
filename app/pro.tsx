import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Crown, Sparkles, X, Zap } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFitlyStore } from '../src/store';
import { colors, fonts, shadow } from '../src/theme';

const benefits = ['Up to 60 try-ons every day', 'Unlimited pieces in your closet', '3 private body photos', 'Outfit builder & priority generation'];

export default function ProScreen() {
  const upgrade = useFitlyStore((s) => s.upgrade);
  const choose = () => { upgrade(); router.back(); };
  return (
    <LinearGradient colors={[colors.forestDark, colors.ink, colors.canvas]} locations={[0, 0.63, 1]} style={styles.background}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}><View /><Pressable onPress={() => router.back()} style={styles.close}><X size={20} color={colors.white} /></Pressable></View>
        <View style={styles.hero}>
          <View style={styles.crown}><Crown size={29} color={colors.coral} /></View>
          <Text style={styles.eyebrow}>MEET FITLY PRO</Text>
          <Text style={styles.title}>More ways to feel{`\n`}like yourself.</Text>
          <Text style={styles.copy}>Try more looks, save every favorite, and build a closet without limits.</Text>
        </View>
        <View style={styles.sheet}>
          <View style={styles.benefits}>{benefits.map((benefit) => <View style={styles.benefit} key={benefit}><View style={styles.check}><Check size={13} color={colors.white} strokeWidth={3} /></View><Text style={styles.benefitText}>{benefit}</Text></View>)}</View>
          <View style={styles.plans}>
            <Pressable style={styles.plan}><View><Text style={styles.planTitle}>Monthly</Text><Text style={styles.planSub}>Cancel anytime</Text></View><View><Text style={styles.price}>$7.99</Text><Text style={styles.period}>CAD / month</Text></View></Pressable>
            <Pressable style={[styles.plan, styles.planActive]}><View style={styles.best}><Sparkles size={11} color={colors.forestDark} /><Text style={styles.bestText}>BEST VALUE</Text></View><View><Text style={styles.planTitle}>Yearly</Text><Text style={styles.planSub}>Save 38%</Text></View><View><Text style={styles.price}>$59</Text><Text style={styles.period}>CAD / year</Text></View></Pressable>
          </View>
          <Pressable onPress={choose} style={styles.continue}><Zap size={18} color={colors.white} fill={colors.white} /><Text style={styles.continueText}>Start Fitly Pro</Text></Pressable>
          <Text style={styles.legal}>7-day free trial, then $59/year. Cancel anytime in your App Store settings. Your wardrobe stays yours.</Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  safe: { flex: 1 },
  header: { height: 46, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between' },
  close: { width: 40, height: 40, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.13)', alignItems: 'center', justifyContent: 'center' },
  hero: { flex: 1, minHeight: 305, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 22 },
  crown: { width: 64, height: 64, borderRadius: 24, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-7deg' }], ...shadow },
  eyebrow: { fontFamily: fonts.body, color: colors.sageDeep, fontSize: 10.5, letterSpacing: 1.7, fontWeight: '800', marginTop: 20 },
  title: { fontFamily: fonts.display, color: colors.white, fontSize: 36, lineHeight: 40, letterSpacing: -1.2, textAlign: 'center', marginTop: 7 },
  copy: { fontFamily: fonts.body, color: '#D8D8D6', fontSize: 13.5, lineHeight: 20, textAlign: 'center', marginTop: 10, maxWidth: 330 },
  sheet: { backgroundColor: colors.canvas, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 23, paddingBottom: 13 },
  benefits: { gap: 13, marginBottom: 20 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: { width: 24, height: 24, borderRadius: 9, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
  benefitText: { fontFamily: fonts.body, color: colors.ink, fontSize: 12.5, fontWeight: '600' },
  plans: { flexDirection: 'row', gap: 10 },
  plan: { flex: 1, minHeight: 95, borderRadius: 19, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line, padding: 13, justifyContent: 'space-between' },
  planActive: { borderColor: colors.forest, backgroundColor: colors.sage },
  best: { position: 'absolute', right: 8, top: -11, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 99, backgroundColor: colors.sand },
  bestText: { fontFamily: fonts.body, color: colors.forestDark, fontSize: 7.5, fontWeight: '900', letterSpacing: 0.6 },
  planTitle: { fontFamily: fonts.body, color: colors.ink, fontSize: 13, fontWeight: '800' },
  planSub: { fontFamily: fonts.body, color: colors.muted, fontSize: 9.5, marginTop: 2 },
  price: { fontFamily: fonts.display, color: colors.ink, fontSize: 22 },
  period: { fontFamily: fonts.body, color: colors.muted, fontSize: 8.5 },
  continue: { height: 56, borderRadius: 18, backgroundColor: colors.coral, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 17, ...shadow },
  continueText: { fontFamily: fonts.body, color: colors.white, fontSize: 14, fontWeight: '800' },
  legal: { fontFamily: fonts.body, color: colors.muted, fontSize: 9, lineHeight: 13, textAlign: 'center', marginTop: 10, paddingHorizontal: 10 },
});
