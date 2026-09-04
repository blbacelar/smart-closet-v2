import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export type MotionPreferenceSource = {
  get: () => Promise<boolean>;
  subscribe: (listener: (enabled: boolean) => void) => () => void;
};

const nativeMotionPreferenceSource: MotionPreferenceSource = {
  get: () => AccessibilityInfo.isReduceMotionEnabled(),
  subscribe(listener) {
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', listener);
    return () => subscription.remove();
  },
};

type MotionPreference = {
  reduceMotion: boolean;
  duration: (milliseconds: number) => number;
};

const MotionPreferenceContext = createContext<MotionPreference | null>(null);

type MotionPreferenceProviderProps = PropsWithChildren<{
  source?: MotionPreferenceSource;
}>;

export function MotionPreferenceProvider({
  children,
  source = nativeMotionPreferenceSource,
}: MotionPreferenceProviderProps) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    source.get().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    }).catch(() => undefined);
    const unsubscribe = source.subscribe(setReduceMotion);
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [source]);

  const value = useMemo<MotionPreference>(
    () => ({
      reduceMotion,
      duration: (milliseconds) => reduceMotion ? 0 : milliseconds,
    }),
    [reduceMotion],
  );

  return (
    <MotionPreferenceContext.Provider value={value}>
      {children}
    </MotionPreferenceContext.Provider>
  );
}

export function useMotionPreference() {
  const value = useContext(MotionPreferenceContext);
  if (!value) throw new Error('useMotionPreference must be used inside MotionPreferenceProvider.');
  return value;
}
