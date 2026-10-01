import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { ObservabilityClient } from '../../../lib/observability';
import { PrivacyAnalyticsScreen } from '../PrivacyAnalyticsScreen';

function telemetry(): jest.Mocked<ObservabilityClient> {
  return {
    setUser: jest.fn(),
    setAnalyticsConsent: jest.fn(),
    getAnalyticsConsent: jest.fn().mockReturnValue('unknown'),
    track: jest.fn(),
    captureError: jest.fn(),
  };
}

function storage(value: string | null = null) {
  return {
    getItem: jest.fn().mockResolvedValue(value),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  };
}

describe('PrivacyAnalyticsScreen', () => {
  it('explains excluded data and preserves an existing opt-in', async () => {
    const client = telemetry();
    const screen = await render(
      <PrivacyAnalyticsScreen onBack={jest.fn()} observabilityClient={client} storage={storage('granted')} />,
    );

    expect(screen.getByText(/never includes your photos/i)).toBeTruthy();
    await waitFor(() => expect(client.setAnalyticsConsent).toHaveBeenCalledWith('granted'));
    expect(screen.getByLabelText('Share optional product analytics').props.value).toBe(true);
  });

  it('persists opt-in and updates telemetry immediately', async () => {
    const client = telemetry();
    const target = storage('denied');
    const screen = await render(
      <PrivacyAnalyticsScreen onBack={jest.fn()} observabilityClient={client} storage={target} />,
    );
    const toggle = await screen.findByLabelText('Share optional product analytics');
    await waitFor(() => expect(toggle.props.disabled).toBe(false));

    await fireEvent(toggle, 'valueChange', true);

    await waitFor(() => expect(target.setItem).toHaveBeenCalledWith('fitly.analytics-consent.v1', 'granted'));
    expect(client.setAnalyticsConsent).toHaveBeenLastCalledWith('granted');
  });

  it('restores the previous choice when persistence fails', async () => {
    const client = telemetry();
    const target = storage('denied');
    target.setItem.mockRejectedValue(new Error('storage failed'));
    const screen = await render(
      <PrivacyAnalyticsScreen onBack={jest.fn()} observabilityClient={client} storage={target} />,
    );
    const toggle = await screen.findByLabelText('Share optional product analytics');
    await waitFor(() => expect(toggle.props.disabled).toBe(false));

    await fireEvent(toggle, 'valueChange', true);

    expect(await screen.findByText("We couldn't save that privacy choice. Please try again.")).toBeTruthy();
    expect(client.setAnalyticsConsent).toHaveBeenLastCalledWith('denied');
  });
});
