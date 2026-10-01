import { getProfileSettingNotice } from '../profileSettings';

describe('getProfileSettingNotice', () => {
  it.each([
    ['Privacy & visibility', 'Private by default'],
    ['Notifications', 'Notifications during beta'],
    ['Language', 'Language during beta'],
  ])('returns an honest notice for %s', (setting, expectedTitle) => {
    expect(getProfileSettingNotice(setting)).toEqual(expect.objectContaining({
      title: expectedTitle,
      message: expect.any(String),
    }));
  });

  it('does not intercept settings with dedicated actions', () => {
    expect(getProfileSettingNotice('Sign out')).toBeNull();
    expect(getProfileSettingNotice('Delete account')).toBeNull();
  });
});
