import { Lock } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

type PrivacyVisibilityLineProps = {
  text?: string;
};

export function PrivacyVisibilityLine({
  text = 'Only you can see these',
}: PrivacyVisibilityLineProps) {
  return (
    <View accessibilityLabel={text} style={styles.line}>
      <Lock size={12} color={colors.ink} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  text: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.ink,
  },
});
