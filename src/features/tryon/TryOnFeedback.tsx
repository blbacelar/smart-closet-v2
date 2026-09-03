import { ThumbsDown, ThumbsUp } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../../theme';

type Props = {
  value: -1 | 1 | null;
  pending: boolean;
  onChange: (feedback: -1 | 1) => void;
};

export function TryOnFeedback({ value, pending, onChange }: Props) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityLabel="Good fit"
        accessibilityRole="button"
        accessibilityState={{ disabled: pending, selected: value === 1 }}
        disabled={pending}
        onPress={() => onChange(1)}
        style={[styles.vote, value === 1 && styles.voteActive]}
      >
        <ThumbsUp size={19} color={value === 1 ? colors.white : colors.muted} />
      </Pressable>
      <Pressable
        accessibilityLabel="Poor fit"
        accessibilityRole="button"
        accessibilityState={{ disabled: pending, selected: value === -1 }}
        disabled={pending}
        onPress={() => onChange(-1)}
        style={[styles.vote, value === -1 && styles.voteActive]}
      >
        <ThumbsDown size={19} color={value === -1 ? colors.white : colors.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  vote: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteActive: { backgroundColor: colors.ink },
});
