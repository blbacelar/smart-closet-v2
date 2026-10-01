import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ProfileRepository, supabaseProfileRepository } from './profileRepository';

export const profileKeys = {
  all: ['profile'] as const,
  detail: (userId: string) => [...profileKeys.all, userId] as const,
};

export function useOnboardingStatus(
  userId: string | undefined,
  repository: ProfileRepository = supabaseProfileRepository,
) {
  return useQuery({
    queryKey: profileKeys.detail(userId ?? 'signed-out'),
    queryFn: () => repository.getOnboardingStatus(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCompleteOnboarding(
  userId: string,
  repository: ProfileRepository = supabaseProfileRepository,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => repository.completeOnboarding(userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: profileKeys.detail(userId) });
    },
  });
}
