import * as ImagePicker from 'expo-image-picker';
import { GarmentAsset } from './garmentValidation';

export type GarmentPickResult =
  | { status: 'selected'; asset: GarmentAsset }
  | { status: 'cancelled' }
  | { status: 'permission-denied' };

export type GarmentPicker = {
  pick: (source: 'camera' | 'library') => Promise<GarmentPickResult>;
};

type ImagePickerApi = Pick<
  typeof ImagePicker,
  'requestCameraPermissionsAsync' | 'launchCameraAsync' | 'launchImageLibraryAsync'
>;

const options: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: false,
  base64: true,
  quality: 0.8,
};

export function createGarmentPicker(imagePicker: ImagePickerApi): GarmentPicker {
  return {
    async pick(source) {
      if (source === 'camera') {
        const permission = await imagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          return { status: 'permission-denied' };
        }
      }

      const result =
        source === 'camera'
          ? await imagePicker.launchCameraAsync(options)
          : await imagePicker.launchImageLibraryAsync(options);

      if (result.canceled || !result.assets?.[0]) {
        return { status: 'cancelled' };
      }

      const asset = result.assets[0];
      return {
        status: 'selected',
        asset: {
          uri: asset.uri,
          base64: asset.base64,
          width: asset.width,
          height: asset.height,
        },
      };
    },
  };
}

export const expoGarmentPicker = createGarmentPicker(ImagePicker);
