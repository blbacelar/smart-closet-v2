import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React, { PropsWithChildren } from 'react';
import { GarmentRepository } from '../garmentRepository';
import { garmentKeys, useGarments, useUploadGarment } from '../useGarments';

function setup() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  const repository: jest.Mocked<GarmentRepository> = {
    list: jest.fn().mockResolvedValue([]),
    upload: jest.fn().mockResolvedValue({ id: 'garment-1' }),
  } as never;
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, repository, wrapper };
}

describe('useGarments', () => {
  it('does not fetch while signed out', async () => {
    const { client, repository, wrapper } = setup();
    const { unmount } = await renderHook(() => useGarments(undefined, repository), { wrapper });
    expect(repository.list).not.toHaveBeenCalled();
    await unmount();
    client.clear();
  });

  it('loads the current owner wardrobe', async () => {
    const { client, repository, wrapper } = setup();
    const { unmount } = await renderHook(() => useGarments('user-1', repository), { wrapper });
    await waitFor(() => expect(repository.list).toHaveBeenCalledWith('user-1'));
    await unmount();
    client.clear();
  });

  it('invalidates the wardrobe after upload', async () => {
    const { client, repository, wrapper } = setup();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result, unmount } = await renderHook(() => useUploadGarment('user-1', repository), { wrapper });

    await act(() => result.current.mutateAsync({ asset: {} as never, details: {} as never }));

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: garmentKeys.list('user-1') }));
    await unmount();
    client.clear();
  });
});
