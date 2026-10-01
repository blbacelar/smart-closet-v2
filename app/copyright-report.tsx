import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { ArrowLeft, ExternalLink } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../src/components/Screen';
import {
  buildCopyrightReportUrl,
  getCopyrightContact,
} from '../src/features/legal/copyrightReport';
import { colors, fonts } from '../src/theme';

const noticeDetails = [
  'Your physical or electronic signature',
  'The copyrighted work you believe was infringed',
  'The listing or material to remove, including its URL or ID',
  'Your contact information',
  'Your good-faith belief that the use is not authorized',
  'A statement of accuracy and authority, under penalty of perjury',
];

export default function CopyrightReportScreen() {
  const contact = getCopyrightContact();

  const startReport = async () => {
    if (!contact) return;
    await Linking.openURL(buildCopyrightReportUrl(contact));
  };

  return (
    <Screen contentStyle={styles.content}>
      <Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
        <ArrowLeft color={colors.ink} size={20} />
      </Pressable>
      <Text style={styles.eyebrow}>Safety & rights</Text>
      <Text style={styles.title}>Report copyrighted material</Text>
      <Text style={styles.intro}>
        If a community listing uses your copyrighted work without permission, send a removal request with the details below.
      </Text>

      <View style={styles.card}>
        {noticeDetails.map((detail, index) => (
          <View key={detail} style={styles.item}>
            <Text style={styles.number}>{index + 1}</Text>
            <Text style={styles.itemText}>{detail}</Text>
          </View>
        ))}
      </View>

      {!contact && (
        <Text accessibilityRole="alert" style={styles.betaNotice}>
          Copyright reporting is not yet configured. Public community uploads must remain disabled until a reporting contact and designated-agent process are active.
        </Text>
      )}

      <Pressable
        accessibilityLabel="Start copyright report"
        accessibilityRole="button"
        accessibilityState={{ disabled: !contact }}
        disabled={!contact}
        onPress={startReport}
        style={[styles.action, !contact && styles.actionDisabled]}
      >
        <Text style={styles.actionText}>Start copyright report</Text>
        <ExternalLink color={colors.white} size={17} />
      </Pressable>
      <Text style={styles.note}>
        Fitly reviews complete reports and may remove or disable access to reported material. This screen does not replace independent legal advice.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 18 },
  back: { alignItems: 'center', justifyContent: 'center', width: 42, height: 42, marginBottom: 20, borderRadius: 13, backgroundColor: colors.surface },
  eyebrow: { fontFamily: fonts.body, color: colors.muted, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { marginTop: 8, fontFamily: fonts.display, color: colors.ink, fontSize: 32, lineHeight: 36, fontWeight: '600', letterSpacing: -0.8 },
  intro: { marginTop: 12, fontFamily: fonts.body, color: colors.muted, fontSize: 14, lineHeight: 21 },
  card: { marginTop: 24, padding: 18, gap: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  number: { width: 22, height: 22, paddingTop: 3, borderRadius: 11, overflow: 'hidden', backgroundColor: colors.ink, fontFamily: fonts.body, color: colors.white, fontSize: 10, fontWeight: '800', textAlign: 'center' },
  itemText: { flex: 1, fontFamily: fonts.body, color: colors.ink, fontSize: 13, lineHeight: 19 },
  betaNotice: { marginTop: 18, padding: 14, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.sage, fontFamily: fonts.body, color: colors.ink, fontSize: 12, lineHeight: 18 },
  action: { marginTop: 20, height: 54, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 13, backgroundColor: colors.ink },
  actionDisabled: { opacity: 0.38 },
  actionText: { fontFamily: fonts.body, color: colors.white, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  note: { marginTop: 12, fontFamily: fonts.body, color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center' },
});
