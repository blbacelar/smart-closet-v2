import { useLocales } from 'expo-localization';
import React, { createContext, PropsWithChildren, useContext, useMemo } from 'react';

const english = {
  'common.tryAgain': 'Try again',
  'errorBoundary.title': 'Something went wrong',
  'errorBoundary.message': 'Fitly hit an unexpected problem. Your private photos were not included in the report.',
  'quota.remaining': '{count} try-ons remaining',
} as const;

type MessageKey = keyof typeof english;
export type SupportedLocale = 'en' | 'pt-BR';
type InterpolationValues = Record<string, string | number>;

const portuguese: Record<MessageKey, string> = {
  'common.tryAgain': 'Tentar novamente',
  'errorBoundary.title': 'Algo deu errado',
  'errorBoundary.message': 'O Fitly encontrou um problema inesperado. Suas fotos privadas não foram incluídas no relatório.',
  'quota.remaining': '{count} provas restantes',
};

const messages: Record<SupportedLocale, Record<MessageKey, string>> = {
  en: english,
  'pt-BR': portuguese,
};

export function resolveSupportedLocale(localeTags: string[]): SupportedLocale {
  for (const localeTag of localeTags) {
    const normalized = localeTag.toLowerCase();
    if (normalized.startsWith('pt')) return 'pt-BR';
    if (normalized.startsWith('en')) return 'en';
  }
  return 'en';
}

export function translate(
  locale: SupportedLocale,
  key: MessageKey,
  values: InterpolationValues = {},
) {
  return Object.entries(values).reduce(
    (message, [name, value]) => message.replaceAll(`{${name}}`, String(value)),
    messages[locale][key],
  );
}

type I18nContextValue = {
  locale: SupportedLocale;
  t: (key: MessageKey, values?: InterpolationValues) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

type I18nProviderProps = PropsWithChildren<{
  localeTags?: string[];
}>;

export function I18nProvider({ children, localeTags }: I18nProviderProps) {
  const deviceLocales = useLocales();
  const locale = resolveSupportedLocale(
    localeTags ?? deviceLocales.map((deviceLocale) => deviceLocale.languageTag),
  );
  const value = useMemo<I18nContextValue>(
    () => ({ locale, t: (key, values) => translate(locale, key, values) }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider.');
  return value;
}
