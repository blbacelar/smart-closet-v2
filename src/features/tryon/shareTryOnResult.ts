import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

type CaptureOptions = {
  format: 'jpg';
  quality: number;
  result: 'tmpfile';
};

type SharingDependencies = {
  capture: (target: unknown, options: CaptureOptions) => Promise<string>;
  isAvailable: () => Promise<boolean>;
  share: (uri: string, options: {
    dialogTitle: string;
    mimeType: string;
    UTI: string;
  }) => Promise<unknown>;
};

const nativeDependencies: SharingDependencies = {
  capture: (target, options) => captureRef(target as View, options),
  isAvailable: Sharing.isAvailableAsync,
  share: Sharing.shareAsync,
};

export async function shareTryOnResult(
  resultView: RefObject<View | null>,
  dependencies: SharingDependencies = nativeDependencies,
) {
  if (!await dependencies.isAvailable()) {
    throw new Error('Sharing is not available on this device.');
  }
  if (!resultView.current) {
    throw new Error('Could not share that fitting. Try again.');
  }

  try {
    const uri = await dependencies.capture(resultView.current, {
      format: 'jpg',
      quality: 0.95,
      result: 'tmpfile',
    });
    await dependencies.share(uri, {
      dialogTitle: 'Share your Fitly fitting',
      mimeType: 'image/jpeg',
      UTI: 'public.jpeg',
    });
  } catch {
    throw new Error('Could not share that fitting. Try again.');
  }
}
