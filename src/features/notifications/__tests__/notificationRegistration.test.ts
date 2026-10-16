import {
  disablePushNotifications,
  enablePushNotifications,
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

  it('disables the current installation before logout and is idempotent without an installation', async () => {
    const deps = dependencies();

    await disablePushNotifications(deps);
    expect(deps.disable).toHaveBeenCalledWith('10000000-0000-4000-8000-000000000001');

    const missing = dependencies({ installationId: jest.fn().mockResolvedValue(null) });
    await expect(disablePushNotifications(missing)).resolves.toBeUndefined();
    expect(missing.disable).not.toHaveBeenCalled();
  });
});
