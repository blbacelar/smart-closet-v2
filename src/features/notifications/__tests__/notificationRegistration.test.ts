import { waitFor } from '@testing-library/react-native';
import {
  disablePushNotifications,
  enablePushNotifications,
  maintainPushNotifications,
  signOutAfterPushDisable,
  syncPushNotifications,
  type NotificationRegistrationDependencies,
} from '../notificationRegistration';

function dependencies(
  overrides: Partial<NotificationRegistrationDependencies> = {},
): NotificationRegistrationDependencies {
  return {
    isPhysicalDevice: true,
    isExpoGo: false,
    platform: 'ios',
    projectId: 'project-1',
    installationId: jest.fn().mockResolvedValue('10000000-0000-4000-8000-000000000001'),
    getPermissions: jest.fn().mockResolvedValue({ granted: false, iosStatus: 'undetermined' }),
    requestPermissions: jest.fn().mockResolvedValue({ granted: true, iosStatus: 'authorized' }),
    createAndroidChannel: jest.fn().mockResolvedValue(undefined),
    getExpoPushToken: jest.fn().mockResolvedValue('ExpoPushToken[token-1]'),
    register: jest.fn().mockResolvedValue(undefined),
    disable: jest.fn().mockResolvedValue(undefined),
    subscribeToTokenChanges: jest.fn().mockReturnValue(() => undefined),
    ...overrides,
  };
}

describe('notification registration', () => {
  it.each([
    [{ isPhysicalDevice: false }, 'physical-device-required'],
    [{ isExpoGo: true }, 'development-build-required'],
    [{ projectId: null }, 'project-id-missing'],
  ] as const)('does not prompt or register when capability is unavailable', async (override, reason) => {
    const deps = dependencies(override);

    await expect(enablePushNotifications(deps)).resolves.toEqual({ state: 'unavailable', reason });
    expect(deps.requestPermissions).not.toHaveBeenCalled();
    expect(deps.getExpoPushToken).not.toHaveBeenCalled();
    expect(deps.register).not.toHaveBeenCalled();
  });

  it('creates the Android channel before requesting permission and registers one installation', async () => {
    const order: string[] = [];
    const deps = dependencies({
      platform: 'android',
      createAndroidChannel: jest.fn(async () => { order.push('channel'); }),
      requestPermissions: jest.fn(async () => {
        order.push('permission');
        return { granted: true, iosStatus: null };
      }),
    });

    await expect(enablePushNotifications(deps)).resolves.toEqual({ state: 'enabled' });

    expect(order).toEqual(['channel', 'permission']);
    expect(deps.getExpoPushToken).toHaveBeenCalledWith('project-1');
    expect(deps.register).toHaveBeenCalledWith({
      expoToken: 'ExpoPushToken[token-1]',
      installationId: '10000000-0000-4000-8000-000000000001',
      platform: 'android',
    });
  });

  it('accepts an already-authorized or provisional iOS permission without prompting again', async () => {
    const deps = dependencies({
      getPermissions: jest.fn().mockResolvedValue({ granted: false, iosStatus: 'provisional' }),
    });

    await expect(enablePushNotifications(deps)).resolves.toEqual({ state: 'enabled' });
    expect(deps.requestPermissions).not.toHaveBeenCalled();
  });

  it('returns a denied result without requesting a token', async () => {
    const deps = dependencies({
      requestPermissions: jest.fn().mockResolvedValue({ granted: false, iosStatus: 'denied' }),
    });

    await expect(enablePushNotifications(deps)).resolves.toEqual({ state: 'denied' });
    expect(deps.getExpoPushToken).not.toHaveBeenCalled();
    expect(deps.register).not.toHaveBeenCalled();
  });

  it('silently refreshes an already-authorized registration at session startup', async () => {
    const deps = dependencies({
      getPermissions: jest.fn().mockResolvedValue({ granted: true, iosStatus: 'authorized' }),
    });

    await expect(syncPushNotifications(deps)).resolves.toEqual({ state: 'enabled' });
    expect(deps.requestPermissions).not.toHaveBeenCalled();
    expect(deps.register).toHaveBeenCalledTimes(1);
  });

  it('re-registers the Expo token when the native push token rotates', async () => {
    let tokenChanged: ((token: { type: string; data: string }) => void) | undefined;
    const remove = jest.fn();
    const deps = dependencies({
      getPermissions: jest.fn().mockResolvedValue({ granted: true, iosStatus: 'authorized' }),
      subscribeToTokenChanges: jest.fn((listener) => {
        tokenChanged = listener;
        return remove;
      }),
    });

    const stop = maintainPushNotifications(deps, jest.fn());
    await waitFor(() => expect(deps.register).toHaveBeenCalledTimes(1));
    const rotated = { type: 'ios', data: 'native-token-2' };
    tokenChanged?.(rotated);
    await waitFor(() => expect(deps.register).toHaveBeenCalledTimes(2));
    expect(deps.getExpoPushToken).toHaveBeenLastCalledWith('project-1', rotated);

    stop();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('does not install a native token listener when remote push is unavailable', () => {
    const deps = dependencies({ isExpoGo: true });

    const stop = maintainPushNotifications(deps, jest.fn());

    expect(deps.subscribeToTokenChanges).not.toHaveBeenCalled();
    expect(deps.register).not.toHaveBeenCalled();
    expect(stop()).toBeUndefined();
  });

  it('disables the current installation before logout and is idempotent without an installation', async () => {
    const deps = dependencies();

    await disablePushNotifications(deps);
    expect(deps.disable).toHaveBeenCalledWith('10000000-0000-4000-8000-000000000001');

    const missing = dependencies({ installationId: jest.fn().mockResolvedValue(null) });
    await expect(disablePushNotifications(missing)).resolves.toBeUndefined();
    expect(missing.disable).not.toHaveBeenCalled();
  });

  it('does not switch accounts until the current installation is safely disabled', async () => {
    const order: string[] = [];
    const deps = dependencies({
      disable: jest.fn(async () => { order.push('disable'); }),
    });
    const signOut = jest.fn(async () => { order.push('sign-out'); });

    await signOutAfterPushDisable(deps, signOut);

    expect(order).toEqual(['disable', 'sign-out']);

    deps.disable = jest.fn().mockRejectedValue(new Error('network unavailable'));
    await expect(signOutAfterPushDisable(deps, signOut)).rejects.toThrow('network unavailable');
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
