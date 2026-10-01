type ProfileSettingNotice = {
  title: string;
  message: string;
};

const notices: Record<string, ProfileSettingNotice> = {
  Notifications: {
    title: 'Notifications during beta',
    message: 'Fitly does not send push notifications during beta. Notification controls will arrive with marketplace messaging.',
  },
  Language: {
    title: 'Language during beta',
    message: 'Fitly currently uses English. Complete language selection and translations are planned before public launch.',
  },
};

export function getProfileSettingNotice(label: string): ProfileSettingNotice | null {
  return notices[label] ?? null;
}
