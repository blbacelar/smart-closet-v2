import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React, { PropsWithChildren } from 'react';
import { TryOnJob, TryOnRepository } from '../tryonRepository';
import { tryOnKeys, useEnqueueTryOn, useSetTryOnFeedback, useTryOnJobs, useTryOnQuota } from '../useTryOns';

const completedJob: TryOnJob = {
  id: 'job-1',
  bodyPhotoId: 'body-1',
  garmentId: 'garment-1',
  status: 'done',
  resultPath: 'user-1/job-1.jpg',
  resultUrl: 'https://signed.example/result',
  provider: 'gemini',
  failureCode: null,
  feedback: null,
  createdAt: '2026-09-02T20:00:00Z',
  completedAt: '2026-09-02T20:00:08Z',
};

function setup() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  const repository: jest.Mocked<TryOnRepository> = {
    list: jest.fn().mockResolvedValue([]),
    quota: jest.fn().mockResolvedValue({ tier: 'free', limit: 3, used: 0, remaining: 3 }),
    enqueue: jest.fn().mockResolvedValue({
      state: 'queued',
      jobId: 'job-1',
      status: 'queued',
      limit: 3,
      remaining: 2,
    }),
    setFeedback: jest.fn().mockResolvedValue(undefined),
  };
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, repository, wrapper };
}

describe('try-on hooks', () => {
  it('does not load private jobs while signed out', async () => {
    const { client, repository, wrapper } = setup();
    const { unmount } = await renderHook(() => useTryOnJobs(undefined, repository), { wrapper });

    expect(repository.list).not.toHaveBeenCalled();
    await unmount();
    client.clear();
  });

  it('loads persisted jobs and server quota for the signed-in member', async () => {
    const { client, repository, wrapper } = setup();
    const jobs = await renderHook(() => useTryOnJobs('user-1', repository), { wrapper });
    const quota = await renderHook(() => useTryOnQuota('user-1', repository), { wrapper });

    await waitFor(() => expect(repository.list).toHaveBeenCalledWith('user-1'));
    await waitFor(() => expect(repository.quota).toHaveBeenCalled());
    await jobs.unmount();
    await quota.unmount();
    client.clear();
  });

  it('refreshes jobs and quota after enqueue', async () => {
    const { client, repository, wrapper } = setup();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result, unmount } = await renderHook(() => useEnqueueTryOn('user-1', repository), { wrapper });

    await act(() => result.current.mutateAsync({ bodyPhotoId: 'body-1', garmentId: 'garment-1' }));

    expect(repository.enqueue).toHaveBeenCalledWith({ bodyPhotoId: 'body-1', garmentId: 'garment-1' });
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: tryOnKeys.jobs('user-1') }));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: tryOnKeys.quota('user-1') }));
    await unmount();
    client.clear();
  });

  it('shows feedback immediately and refreshes persisted jobs after saving', async () => {
    const { client, repository, wrapper } = setup();
    client.setQueryData(tryOnKeys.jobs('user-1'), [completedJob]);
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result, unmount } = await renderHook(
      () => useSetTryOnFeedback('user-1', repository),
      { wrapper },
    );

    await act(() => result.current.mutateAsync({ jobId: 'job-1', feedback: 1 }));

    expect(repository.setFeedback).toHaveBeenCalledWith({ jobId: 'job-1', feedback: 1 });
    expect(client.getQueryData<TryOnJob[]>(tryOnKeys.jobs('user-1'))?.[0].feedback).toBe(1);
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: tryOnKeys.jobs('user-1') }));
    await unmount();
    client.clear();
  });

  it('restores previous feedback when saving fails', async () => {
    const { client, repository, wrapper } = setup();
    repository.setFeedback.mockRejectedValue(new Error('offline'));
    client.setQueryData(tryOnKeys.jobs('user-1'), [{ ...completedJob, feedback: 1 }]);
    const { result, unmount } = await renderHook(
      () => useSetTryOnFeedback('user-1', repository),
      { wrapper },
    );

    await expect(
      act(() => result.current.mutateAsync({ jobId: 'job-1', feedback: -1 })),
    ).rejects.toThrow('offline');

    expect(client.getQueryData<TryOnJob[]>(tryOnKeys.jobs('user-1'))?.[0].feedback).toBe(1);
    await unmount();
    client.clear();
  });
});
