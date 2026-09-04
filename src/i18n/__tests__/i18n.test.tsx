import { renderHook } from '@testing-library/react-native';
import React, { PropsWithChildren } from 'react';
import { I18nProvider, resolveSupportedLocale, translate, useI18n } from '../i18n';

describe('localization scaffold', () => {
  it.each([
    [['pt-BR'], 'pt-BR'],
    [['pt-PT'], 'pt-BR'],
    [['fr-CA', 'en-CA'], 'en'],
    [[], 'en'],
  ] as const)('resolves device locales %p to %s', (localeTags, expected) => {
    expect(resolveSupportedLocale([...localeTags])).toBe(expected);
  });

  it('translates English and Brazilian Portuguese messages', () => {
    expect(translate('en', 'errorBoundary.title')).toBe('Something went wrong');
    expect(translate('pt-BR', 'errorBoundary.title')).toBe('Algo deu errado');
    expect(translate('pt-BR', 'quota.remaining', { count: 3 })).toBe('3 provas restantes');
  });

  it('exposes the selected locale and translator app-wide', async () => {
    const wrapper = ({ children }: PropsWithChildren) => (
      <I18nProvider localeTags={['pt-BR']}>{children}</I18nProvider>
    );
    const { result } = await renderHook(() => useI18n(), { wrapper });

    expect(result.current.locale).toBe('pt-BR');
    expect(result.current.t('common.tryAgain')).toBe('Tentar novamente');
  });

  it('requires consumers to be inside the localization provider', async () => {
    expect(() => renderHook(() => useI18n())).rejects.toThrow(
      'useI18n must be used inside I18nProvider.',
    );
  });
});
