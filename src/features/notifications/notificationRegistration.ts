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
  subscribeToTokenChanges: (listener: () => void) => () => void;
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

function unavailableReason(dependencies: NotificationRegistrationDependencies) {
  if (!dependencies.isPhysicalDevice) return 'physical-device-required' as const;
  if (dependencies.isExpoGo) return 'development-build-required' as const;
  if (!dependencies.projectId) return 'project-id-missing' as const;
  return null;
}

async function registerCurrentToken(dependencies: NotificationRegistrationDependencies) {
  const installationId = await dependencies.installationId();
  if (!installationId) throw new Error('Notification installation could not be identified.');
  const expoToken = await dependencies.getExpoPushToken(dependencies.projectId!);
  await dependencies.register({
    expoToken,
    installationId,
    platform: dependencies.platform,
  });
}

export async function enablePushNotifications(
  dependencies: NotificationRegistrationDependencies,
): Promise<NotificationEnableResult> {
  const reason = unavailableReason(dependencies);
  if (reason) return { state: 'unavailable', reason };

  if (dependencies.platform === 'android') {
    // Android 13 permission state is not available until a channel exists.
    await dependencies.createAndroidChannel();
  }

  let permission = await dependencies.getPermissions();
  if (!permissionAllowsPush(permission)) {
    permission = await dependencies.requestPermissions();
  }
  if (!permissionAllowsPush(permission)) return { state: 'denied' };

  await registerCurrentToken(dependencies);
  return { state: 'enabled' };
}

export async function syncPushNotifications(
  dependencies: NotificationRegistrationDependencies,
): Promise<NotificationEnableResult> {
  const reason = unavailableReason(dependencies);
  if (reason) return { state: 'unavailable', reason };
  if (dependencies.platform === 'android') await dependencies.createAndroidChannel();
  const permission = await dependencies.getPermissions();
  if (!permissionAllowsPush(permission)) return { state: 'denied' };
  await registerCurrentToken(dependencies);
  return { state: 'enabled' };
}

export function maintainPushNotifications(
  dependencies: NotificationRegistrationDependencies,
  onError: (error: unknown) => void,
) {
  if (unavailableReason(dependencies)) return () => undefined;
  let active = true;
  let refresh = Promise.resolve();
  const synchronize = () => {
    refresh = refresh
      .then(async () => {
        if (active) await syncPushNotifications(dependencies);
      })
      .catch(onError);
  };
  const unsubscribe = dependencies.subscribeToTokenChanges(synchronize);
  synchronize();
  return () => {
    active = false;
    unsubscribe();
  };
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
