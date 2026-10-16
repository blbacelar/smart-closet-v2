export type NotificationPlatform = 'ios' | 'android';
export type NormalizedPermission = {
  granted: boolean;
  iosStatus: 'undetermined' | 'denied' | 'authorized' | 'provisional' | 'ephemeral' | null;
};

export type NotificationRegistrationDependencies = {
  isPhysicalDevice: boolean;
  isExpoGo: boolean;
  platform: NotificationPlatform;
  projectId: string | null;
  installationId: () => Promise<string | null>;
  getPermissions: () => Promise<NormalizedPermission>;
  requestPermissions: () => Promise<NormalizedPermission>;
  createAndroidChannel: () => Promise<void>;
  getExpoPushToken: (projectId: string) => Promise<string>;
  register: (input: {
    expoToken: string;
    installationId: string;
    platform: NotificationPlatform;
  }) => Promise<void>;
  disable: (installationId: string) => Promise<void>;
};

export type NotificationEnableResult =
  | { state: 'enabled' }
  | { state: 'denied' }
  | {
      state: 'unavailable';
      reason: 'physical-device-required' | 'development-build-required' | 'project-id-missing';
    };

function permissionAllowsPush(permission: NormalizedPermission) {
  return permission.granted
    || permission.iosStatus === 'authorized'
    || permission.iosStatus === 'provisional'
    || permission.iosStatus === 'ephemeral';
}

export async function enablePushNotifications(
  dependencies: NotificationRegistrationDependencies,
): Promise<NotificationEnableResult> {
  if (!dependencies.isPhysicalDevice) {
    return { state: 'unavailable', reason: 'physical-device-required' };
  }
  if (dependencies.isExpoGo) {
    return { state: 'unavailable', reason: 'development-build-required' };
  }
  if (!dependencies.projectId) {
    return { state: 'unavailable', reason: 'project-id-missing' };
  }

  if (dependencies.platform === 'android') {
    // Android 13 permission state is not available until a channel exists.
    await dependencies.createAndroidChannel();
  }

  let permission = await dependencies.getPermissions();
  if (!permissionAllowsPush(permission)) {
    permission = await dependencies.requestPermissions();
  }
  if (!permissionAllowsPush(permission)) return { state: 'denied' };

  const installationId = await dependencies.installationId();
  if (!installationId) throw new Error('Notification installation could not be identified.');
  const expoToken = await dependencies.getExpoPushToken(dependencies.projectId);
  await dependencies.register({
    expoToken,
    installationId,
    platform: dependencies.platform,
  });
  return { state: 'enabled' };
}

export async function disablePushNotifications(
  dependencies: NotificationRegistrationDependencies,
) {
  const installationId = await dependencies.installationId();
  if (!installationId) return;
  await dependencies.disable(installationId);
}

export async function signOutAfterPushDisable(
  dependencies: NotificationRegistrationDependencies,
  signOut: () => Promise<void>,
) {
  await disablePushNotifications(dependencies);
  await signOut();
}
