import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../../lib/supabase';
import {
  disablePushNotifications,
  enablePushNotifications,
  maintainPushNotifications,
  signOutAfterPushDisable,
  type NormalizedPermission,
  type NotificationPlatform,
  type NotificationRegistrationDependencies,
} from './notificationRegistration';

const installationStorageKey = 'fitly:notification-installation-id:v1';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function newInstallationId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

async function installationId() {
  const current = await AsyncStorage.getItem(installationStorageKey);
  if (current && uuidPattern.test(current)) return current;
  const created = newInstallationId();
  await AsyncStorage.setItem(installationStorageKey, created);
  return created;
}

function normalizePermission(
  permission: Notifications.NotificationPermissionsStatus,
): NormalizedPermission {
  const iosStatus = permission.ios?.status;
  const mapped = iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED
    ? 'authorized'
    : iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL
      ? 'provisional'
      : iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
        ? 'ephemeral'
        : iosStatus === Notifications.IosAuthorizationStatus.DENIED
          ? 'denied'
          : iosStatus === Notifications.IosAuthorizationStatus.NOT_DETERMINED
            ? 'undetermined'
            : null;
  return { granted: permission.granted, iosStatus: mapped };
}

function requireSupabase() {
  if (!supabase) throw new Error('Notifications are not configured.');
  return supabase;
}

function projectId() {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined;
  const value = Constants.easConfig?.projectId ?? extra?.eas?.projectId;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function createNativeNotificationDependencies(): NotificationRegistrationDependencies {
  const platform = Platform.OS === 'android' ? 'android' : 'ios';
  return {
    isPhysicalDevice: Device.isDevice,
    isExpoGo: Constants.appOwnership === 'expo',
    platform: platform as NotificationPlatform,
    projectId: projectId(),
    installationId,
    getPermissions: async () => normalizePermission(await Notifications.getPermissionsAsync()),
    requestPermissions: async () => normalizePermission(
      await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      }),
    ),
    createAndroidChannel: async () => {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Fitly updates',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    },
    getExpoPushToken: async (easProjectId, devicePushToken) => (
      await Notifications.getExpoPushTokenAsync({
        projectId: easProjectId,
        ...(devicePushToken ? { devicePushToken } : {}),
      })
    ).data,
    register: async ({ expoToken, installationId: id, platform: os }) => {
      const { error } = await requireSupabase().rpc('register_push_token', {
        p_expo_token: expoToken,
        p_installation_id: id,
        p_platform: os,
      });
      if (error) throw new Error('Could not enable notifications. Try again.');
    },
    disable: async (id) => {
      const { error } = await requireSupabase().rpc('disable_push_installation', {
        p_installation_id: id,
        p_reason: 'logout',
      });
      if (error) throw new Error('Could not safely disable notifications. Try again.');
    },
    subscribeToTokenChanges: (listener) => {
      const subscription = Notifications.addPushTokenListener(listener);
      return () => subscription.remove();
    },
  };
}

export function enableNotificationsForCurrentInstallation() {
  return enablePushNotifications(createNativeNotificationDependencies());
}

export function disableNotificationsForCurrentInstallation() {
  return disablePushNotifications(createNativeNotificationDependencies());
}

export function signOutWithNotificationCleanup(signOut: () => Promise<void>) {
  return signOutAfterPushDisable(createNativeNotificationDependencies(), signOut);
}

export function maintainNotificationsForCurrentSession(onError: (error: unknown) => void) {
  return maintainPushNotifications(createNativeNotificationDependencies(), onError);
}
