import React, { PropsWithChildren, useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { motion } from '../../theme';

export function getRevealTransition(reduceMotion: boolean) {
  return reduceMotion
    ? { duration: motion.instant, initialOpacity: 1, initialScale: 1 }
    : { duration: motion.slow, initialOpacity: 0, initialScale: 1.035 };
}

type TryOnRevealProps = PropsWithChildren<{ reduceMotion: boolean }>;

export function TryOnReveal({ children, reduceMotion }: TryOnRevealProps) {
  const transition = getRevealTransition(reduceMotion);
  const opacity = useRef(new Animated.Value(transition.initialOpacity)).current;
  const scale = useRef(new Animated.Value(transition.initialScale)).current;

  useEffect(() => {
    if (transition.duration === 0) {
      opacity.setValue(1);
      scale.setValue(1);
      return;
    }

    const animation = Animated.parallel([
      Animated.timing(opacity, {
        duration: transition.duration,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        duration: transition.duration,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [opacity, scale, transition.duration]);

  return (
    <Animated.View
      accessibilityLabel="Your Fitly fitting is ready"
      accessibilityRole="image"
      style={[styles.fill, { opacity, transform: [{ scale }] }]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
