import { decode } from 'base64-arraybuffer';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { ValidatedBodyPhotoAsset } from './bodyPhotoValidation';

const bodyPhotoRowSchema = z.object({
  id: z.string().uuid().or(z.string().min(1)),
  storage_path: z.string().min(1),
  status: z.enum(['pending', 'approved', 'rejected']),
  reject_reason: z.enum([
    'adult_content',
    'age_not_confirmed',
    'no_single_person',
    'not_full_body',
    'poor_quality',
  ]).nullable(),
  validation_attempts: z.number().int().min(0).max(3),
  validation_error: z.string().nullable(),
  created_at: z.string().min(1),
});

type BodyPhotoRow = z.infer<typeof bodyPhotoRowSchema>;

export type BodyPhoto = {
  id: string;
  storagePath: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectReason: BodyPhotoRejectReason | null;
  validationAttempts: number;
  validationError: string | null;
  createdAt: string;
  signedUrl: string;
};

export type BodyPhotoRejectReason = NonNullable<BodyPhotoRow['reject_reason']>;

export type BodyPhotoValidationState =
  | 'approved'
  | 'rejected'
  | 'busy'
  | 'exhausted'
  | 'not-found';

export type BodyPhotoRepository = {
  list: (userId: string) => Promise<BodyPhoto[]>;
  upload: (input: {
    userId: string;
    asset: ValidatedBodyPhotoAsset;
  }) => Promise<BodyPhoto>;
  validate: (photoId: string) => Promise<{ state: BodyPhotoValidationState }>;
  remove: (photoId: string) => Promise<void>;
};

const safeDeletionError = 'Could not delete that photo. Try again.';
const safeValidationError = 'Could not check that photo. Try again.';
const validationResponseSchema = z.object({
  state: z.enum(['approved', 'rejected', 'busy', 'exhausted', 'not-found']),
});
const selectedColumns = [
  'id',
  'storage_path',
  'status',
  'reject_reason',
  'validation_attempts',
  'validation_error',
  'created_at',
].join(', ');

function randomPathSegment() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function throwIfError(error: unknown): asserts error is null | undefined {
  if (error) {
    throw error;
  }
}

export function createBodyPhotoRepository(
  client: SupabaseClient,
  createId: () => string = randomPathSegment,
): BodyPhotoRepository {
  const bucket = client.storage.from('body');

  const withSignedUrl = async (rowInput: unknown, storagePathOverride?: string): Promise<BodyPhoto> => {
    const row: BodyPhotoRow = bodyPhotoRowSchema.parse(rowInput);
    const storagePath = storagePathOverride ?? row.storage_path;
    const { data, error } = await bucket.createSignedUrl(storagePath, 3600);
    throwIfError(error);

    return {
      id: row.id,
      storagePath,
      status: row.status,
      rejectReason: row.reject_reason,
      validationAttempts: row.validation_attempts,
      validationError: row.validation_error,
      createdAt: row.created_at,
      signedUrl: data.signedUrl,
    };
  };

  return {
    async list(userId) {
      const { data, error } = await client
        .from('body_photos')
        .select(selectedColumns)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      throwIfError(error);

      return Promise.all((data ?? []).map((row) => withSignedUrl(row)));
    },

    async upload({ userId, asset }) {
      const storagePath = `${userId}/${createId()}.jpg`;
      const { error: uploadError } = await bucket.upload(storagePath, decode(asset.base64), {
        contentType: asset.contentType,
        upsert: false,
      });
      throwIfError(uploadError);

      const { data, error: insertError } = await client
        .from('body_photos')
        .insert({ user_id: userId, storage_path: storagePath, status: 'pending' })
        .select(selectedColumns)
        .single();

      if (insertError) {
        await bucket.remove([storagePath]);
        throw insertError;
      }

      const row = bodyPhotoRowSchema.parse(data);
      await client.functions.invoke('validate-body-photo', {
        body: { photoId: row.id },
      }).catch(() => undefined);

      return withSignedUrl(row, storagePath);
    },

    async validate(photoId) {
      const { data, error } = await client.functions.invoke('validate-body-photo', {
        body: { photoId },
      });
      const parsed = validationResponseSchema.safeParse(data);
      if (error || !parsed.success) throw new Error(safeValidationError);
      return parsed.data;
    },

    async remove(photoId) {
      const { data, error } = await client.functions.invoke('delete-body-photo', {
        body: { photoId },
      });
      if (
        error
        || typeof data !== 'object'
        || data === null
        || !('deleted' in data)
        || data.deleted !== true
      ) {
        throw new Error(safeDeletionError);
      }
    },
  };
}

function requireRepository() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Add the public URL and key to .env.local.');
  }

  return createBodyPhotoRepository(supabase);
}

export const supabaseBodyPhotoRepository: BodyPhotoRepository = {
  async list(userId) {
    return requireRepository().list(userId);
  },
  async upload(input) {
    return requireRepository().upload(input);
  },
  async validate(photoId) {
    return requireRepository().validate(photoId);
  },
  async remove(photoId) {
    return requireRepository().remove(photoId);
  },
};
