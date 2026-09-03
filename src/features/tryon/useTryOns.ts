import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TryOnFeedbackInput, TryOnJob, TryOnRepository, supabaseTryOnRepository } from './tryonRepository';

export const tryOnKeys = {
  all: ['try-ons'] as const,
  jobs: (userId: string) => [...tryOnKeys.all, 'jobs', userId] as const,
  quota: (userId: string) => [...tryOnKeys.all, 'quota', userId] as const,
};

export function useTryOnJobs(
  userId: string | undefined,
  repository: TryOnRepository = supabaseTryOnRepository,
) {
  return useQuery({
    queryKey: tryOnKeys.jobs(userId ?? 'signed-out'),
    queryFn: () => repository.list(userId!),
    enabled: Boolean(userId),
    refetchInterval: (query) =>
      query.state.data?.some((job) => job.status === 'queued' || job.status === 'running') ? 2_000 : false,
  });
}

export function useTryOnQuota(
  userId: string | undefined,
  repository: TryOnRepository = supabaseTryOnRepository,
) {
  return useQuery({
    queryKey: tryOnKeys.quota(userId ?? 'signed-out'),
    queryFn: () => repository.quota(),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });
}

export function useEnqueueTryOn(
  userId: string,
  repository: TryOnRepository = supabaseTryOnRepository,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { bodyPhotoId: string; garmentId: string }) => repository.enqueue(input),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: tryOnKeys.jobs(userId) }),
        queryClient.invalidateQueries({ queryKey: tryOnKeys.quota(userId) }),
      ]);
    },
  });
}

export function useSetTryOnFeedback(
  userId: string,
  repository: TryOnRepository = supabaseTryOnRepository,
) {
  const queryClient = useQueryClient();
  const jobsKey = tryOnKeys.jobs(userId);

  return useMutation({
    mutationFn: (input: TryOnFeedbackInput) => repository.setFeedback(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: jobsKey });
      const previousJobs = queryClient.getQueryData<TryOnJob[]>(jobsKey);
      queryClient.setQueryData<TryOnJob[]>(jobsKey, (jobs = []) =>
        jobs.map((job) => job.id === input.jobId ? { ...job, feedback: input.feedback } : job),
      );
      return { previousJobs };
    },
    onError: (_error, _input, context) => {
      if (context?.previousJobs) queryClient.setQueryData(jobsKey, context.previousJobs);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: jobsKey });
    },
  });
}
