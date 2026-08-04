import { PropsWithChildren } from 'react';
import { ScrollView, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

type Props = PropsWithChildren<{ contentStyle?: StyleProp<ViewStyle>; scroll?: boolean }>;

export function Screen({ children, contentStyle, scroll = true }: Props) {
  if (!scroll) {
    return <SafeAreaView style={[styles.safe, contentStyle]} edges={['top']}>{children}</SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, contentStyle]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 112 },
});

