import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BodyPhoto, BodyPhotoRepository, supabaseBodyPhotoRepository } from './bodyPhotoRepository';
import { ValidatedBodyPhotoAsset } from './bodyPhotoValidation';

export const bodyPhotoKeys = {
  all: ['body-photos'] as const,
  list: (userId: string) => [...bodyPhotoKeys.all, userId] as const,
};

export function shouldPollBodyPhotos(photos: BodyPhoto[] | undefined) {
  return photos?.some((photo) => photo.status === 'pending' && !photo.validationError) ?? false;
}

export function useBodyPhotos(
  userId: string | undefined,
  repository: BodyPhotoRepository = supabaseBodyPhotoRepository,
) {
  return useQuery({
    queryKey: bodyPhotoKeys.list(userId ?? 'signed-out'),
    queryFn: () => repository.list(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
    refetchInterval: (query) => shouldPollBodyPhotos(query.state.data) ? 2_000 : false,
  });
}

export function useValidateBodyPhoto(
  userId: string,
  repository: BodyPhotoRepository = supabaseBodyPhotoRepository,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (photoId: string) => repository.validate(photoId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: bodyPhotoKeys.list(userId) }),
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

export function useDeleteBodyPhoto(
  userId: string,
  repository: BodyPhotoRepository = supabaseBodyPhotoRepository,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (photoId: string) => repository.remove(photoId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bodyPhotoKeys.list(userId) }),
  });
}
