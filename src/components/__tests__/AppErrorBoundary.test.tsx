import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { AppErrorBoundary } from '../AppErrorBoundary';
import { ObservabilityClient } from '../../lib/observability';

function observability(): jest.Mocked<ObservabilityClient> {
  return {
    setUser: jest.fn(),
    track: jest.fn(),
    captureError: jest.fn(),
  };
}

describe('AppErrorBoundary', () => {
  it('reports render failures safely and provides an accessible retry', async () => {
    const client = observability();
    let shouldThrow = true;
    const Problem = () => {
      if (shouldThrow) throw new Error('private render detail');
      return <Text>Recovered</Text>;
    };
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const screen = await render(
      <AppErrorBoundary observability={client}>
        <Problem />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(client.captureError).toHaveBeenCalledWith(expect.any(Error), {
      operation: 'react_render',
      code: 'unexpected_render_error',
      fatal: true,
    });

    shouldThrow = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Recovered')).toBeTruthy();
    consoleError.mockRestore();
  });
});
