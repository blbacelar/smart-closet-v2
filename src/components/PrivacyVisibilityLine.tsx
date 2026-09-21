import { Lock } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

type PrivacyVisibilityLineProps = {
  text?: string;
  onPress?: () => void;
};

export function PrivacyVisibilityLine({
  text = 'Only you can see these',
  onPress,
}: PrivacyVisibilityLineProps) {
  const content = (
    <>
      <Lock size={12} color={colors.ink} />
      <Text style={styles.text}>{text}</Text>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityLabel={text}
        accessibilityRole="button"
        hitSlop={8}
        onPress={onPress}
        style={styles.line}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View accessibilityLabel={text} style={styles.line}>
      {content}
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
