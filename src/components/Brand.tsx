import { StyleSheet, Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { colors, fonts } from '../theme';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.row}>
      <View style={[styles.mark, compact && styles.markCompact]}>
        <Sparkles size={compact ? 14 : 17} color={colors.surface} strokeWidth={2.2} />
      </View>
      <Text style={[styles.word, compact && styles.wordCompact]}>fitly</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  mark: { width: 32, height: 32, borderRadius: 12, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-7deg' }] },
  markCompact: { width: 27, height: 27, borderRadius: 10 },
  word: { fontFamily: fonts.display, fontSize: 30, color: colors.ink, letterSpacing: -1.2 },
  wordCompact: { fontSize: 25 },
});

