import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React, { PropsWithChildren } from 'react';
import { BodyPhotoRepository } from '../bodyPhotoRepository';
import { useBodyPhotos, useUploadBodyPhoto } from '../useBodyPhotos';

const photo = {
  id: 'photo-1',
  storagePath: 'user-1/photo-1.jpg',
  status: 'pending' as const,
  rejectReason: null,
  createdAt: '2026-09-02T20:00:00Z',
  signedUrl: 'https://signed.example/photo-1',
};

const asset = {
  uri: 'file:///body.jpg',
  base64: 'YWJjZA==',
  width: 1200,
  height: 1800,
  contentType: 'image/jpeg' as const,
  byteLength: 4,
};

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  const repository: jest.Mocked<BodyPhotoRepository> = {
    list: jest.fn().mockResolvedValue([photo]),
    upload: jest.fn().mockResolvedValue(photo),
  };
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { queryClient, repository, wrapper };
}

describe('body photo query hooks', () => {
  it('loads the authenticated user body photos', async () => {
    const { queryClient, repository, wrapper } = setup();
    const { result, unmount } = await renderHook(() => useBodyPhotos('user-1', repository), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual([photo]));
    expect(repository.list).toHaveBeenCalledWith('user-1');
    await unmount();
    queryClient.clear();
  });

  it('does not make a request without an authenticated user', async () => {
    const { queryClient, repository, wrapper } = setup();
    const { result, unmount } = await renderHook(() => useBodyPhotos(undefined, repository), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(repository.list).not.toHaveBeenCalled();
    await unmount();
    queryClient.clear();
  });

  it('uploads and invalidates the owner-scoped list', async () => {
    const { queryClient, repository, wrapper } = setup();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const { result, unmount } = await renderHook(() => useUploadBodyPhoto('user-1', repository), {
      wrapper,
    });

    await act(() => result.current.mutateAsync(asset));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(repository.upload).toHaveBeenCalledWith({ userId: 'user-1', asset });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['body-photos', 'user-1'] });
    await unmount();
    queryClient.clear();
  });
});
