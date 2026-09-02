import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BodyPhotoRepository, supabaseBodyPhotoRepository } from './bodyPhotoRepository';
import { ValidatedBodyPhotoAsset } from './bodyPhotoValidation';

export const bodyPhotoKeys = {
  all: ['body-photos'] as const,
  list: (userId: string) => [...bodyPhotoKeys.all, userId] as const,
};

export function useBodyPhotos(
  userId: string | undefined,
  repository: BodyPhotoRepository = supabaseBodyPhotoRepository,
) {
  return useQuery({
    queryKey: bodyPhotoKeys.list(userId ?? 'signed-out'),
    queryFn: () => repository.list(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUploadBodyPhoto(
  userId: string,
  repository: BodyPhotoRepository = supabaseBodyPhotoRepository,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (asset: ValidatedBodyPhotoAsset) => repository.upload({ userId, asset }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bodyPhotoKeys.list(userId) }),
  });
}
