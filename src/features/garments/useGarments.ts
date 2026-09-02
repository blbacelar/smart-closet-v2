import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GarmentRepository, supabaseGarmentRepository } from './garmentRepository';
import { GarmentDetails, ValidatedGarmentAsset } from './garmentValidation';

export const garmentKeys = {
  all: ['garments'] as const,
  list: (userId: string) => [...garmentKeys.all, userId] as const,
};

export function useGarments(
  userId: string | undefined,
  repository: GarmentRepository = supabaseGarmentRepository,
) {
  return useQuery({
    queryKey: garmentKeys.list(userId ?? 'signed-out'),
    queryFn: () => repository.list(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUploadGarment(
  userId: string,
  repository: GarmentRepository = supabaseGarmentRepository,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { asset: ValidatedGarmentAsset; details: GarmentDetails }) =>
      repository.upload({ userId, ...input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: garmentKeys.list(userId) }),
  });
}
