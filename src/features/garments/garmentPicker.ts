import * as ImagePicker from 'expo-image-picker';
import { GarmentAsset } from './garmentValidation';

export type GarmentPickResult =
  | { status: 'selected'; assets: GarmentAsset[] }
  | { status: 'cancelled' }
  | { status: 'permission-denied' };

export type GarmentPicker = {
  pick: (source: 'camera' | 'library') => Promise<GarmentPickResult>;
};

type ImagePickerApi = Pick<
  typeof ImagePicker,
  'requestCameraPermissionsAsync' | 'launchCameraAsync' | 'launchImageLibraryAsync'
>;

export const garmentBatchLimit = 5;

const cameraOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: false,
  base64: true,
  quality: 0.8,
};

const libraryOptions: ImagePicker.ImagePickerOptions = {
  ...cameraOptions,
  allowsMultipleSelection: true,
  orderedSelection: true,
  selectionLimit: garmentBatchLimit,
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
          ? await imagePicker.launchCameraAsync(cameraOptions)
          : await imagePicker.launchImageLibraryAsync(libraryOptions);

      if (result.canceled || !result.assets?.[0]) {
        return { status: 'cancelled' };
      }

      return {
        status: 'selected',
        assets: result.assets.slice(0, garmentBatchLimit).map((asset) => ({
          uri: asset.uri,
          base64: asset.base64,
          width: asset.width,
          height: asset.height,
        })),
      };
    },
  };
}

export const expoGarmentPicker = createGarmentPicker(ImagePicker);
