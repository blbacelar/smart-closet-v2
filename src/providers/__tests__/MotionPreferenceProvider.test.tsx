import { act, renderHook, waitFor } from '@testing-library/react-native';
import React, { PropsWithChildren } from 'react';
import {
  MotionPreferenceProvider,
  MotionPreferenceSource,
  useMotionPreference,
} from '../MotionPreferenceProvider';

function source(initial = false) {
  let listener: (enabled: boolean) => void = () => undefined;
  const remove = jest.fn();
  const value: MotionPreferenceSource = {
    get: jest.fn().mockResolvedValue(initial),
    subscribe: jest.fn((nextListener) => {
      listener = nextListener;
      return remove;
    }),
  };
  return { value, emit: (enabled: boolean) => listener(enabled), remove };
}

describe('MotionPreferenceProvider', () => {
  it('reads the device preference and removes animation duration when enabled', async () => {
    const motion = source(true);
    const wrapper = ({ children }: PropsWithChildren) => (
      <MotionPreferenceProvider source={motion.value}>{children}</MotionPreferenceProvider>
    );
    const { result } = await renderHook(() => useMotionPreference(), { wrapper });

    await waitFor(() => expect(result.current.reduceMotion).toBe(true));
    expect(result.current.duration(240)).toBe(0);
  });

  it('updates live when the operating-system preference changes and unsubscribes', async () => {
    const motion = source(false);
    const wrapper = ({ children }: PropsWithChildren) => (
      <MotionPreferenceProvider source={motion.value}>{children}</MotionPreferenceProvider>
    );
    const { result, unmount } = await renderHook(() => useMotionPreference(), { wrapper });

    await waitFor(() => expect(result.current.duration(240)).toBe(240));
    await act(async () => motion.emit(true));
    expect(result.current.reduceMotion).toBe(true);

    await unmount();
    expect(motion.remove).toHaveBeenCalledTimes(1);
  });

  it('falls back safely when the device preference cannot be read', async () => {
    const motion = source();
    motion.value.get = jest.fn().mockRejectedValue(new Error('platform unavailable'));
    const wrapper = ({ children }: PropsWithChildren) => (
      <MotionPreferenceProvider source={motion.value}>{children}</MotionPreferenceProvider>
    );
    const { result } = await renderHook(() => useMotionPreference(), { wrapper });

    await waitFor(() => expect(motion.value.get).toHaveBeenCalledTimes(1));
    expect(result.current.reduceMotion).toBe(false);
  });
});
