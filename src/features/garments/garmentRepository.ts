import type { SupabaseClient } from '@supabase/supabase-js';
import { decode } from 'base64-arraybuffer';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { GarmentCategory, GarmentDetails, ValidatedGarmentAsset } from './garmentValidation';

const garmentRowSchema = z.object({
  id: z.string().uuid().or(z.string().min(1)),
  original_path: z.string().min(1),
  clean_path: z.string().nullable(),
  name: z.string().nullable(),
  category: z.enum(['top', 'bottom', 'dress', 'outerwear', 'shoes']).nullable(),
  color: z.string().nullable(),
  size: z.string().nullable(),
  season: z.string().nullable(),
  status: z.enum(['processing', 'ready', 'failed']),
  created_at: z.string().min(1),
});

type GarmentRow = z.infer<typeof garmentRowSchema>;

export type Garment = {
  id: string;
  originalPath: string;
  cleanPath: string | null;
  name: string | null;
  category: GarmentCategory | null;
  color: string | null;
  size: string | null;
  season: string | null;
  status: 'processing' | 'ready' | 'failed';
  createdAt: string;
  imageUrl: string;
};

export type GarmentRepository = {
  list: (userId: string) => Promise<Garment[]>;
  upload: (input: {
    userId: string;
    asset: ValidatedGarmentAsset;
    details: GarmentDetails;
  }) => Promise<Garment>;
  process: (garmentId: string) => Promise<{ state: string }>;
};

function randomPathSegment() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function throwIfError(error: unknown): asserts error is null | undefined {
  if (error) {
    throw error;
  }
}

export function createGarmentRepository(
  client: SupabaseClient,
  createId: () => string = randomPathSegment,
): GarmentRepository {
  const bucket = client.storage.from('garments');
  const selection =
    'id, original_path, clean_path, name, category, color, size, season, status, created_at';

  const withSignedUrl = async (
    rowInput: unknown,
    originalPathOverride?: string,
  ): Promise<Garment> => {
    const row: GarmentRow = garmentRowSchema.parse(rowInput);
    const originalPath = originalPathOverride ?? row.original_path;
    const imagePath = row.clean_path ?? originalPath;
    const { data, error } = await bucket.createSignedUrl(imagePath, 3600);
    throwIfError(error);

    return {
      id: row.id,
      originalPath,
      cleanPath: row.clean_path,
      name: row.name,
      category: row.category,
      color: row.color,
      size: row.size,
      season: row.season,
      status: row.status,
      createdAt: row.created_at,
      imageUrl: data.signedUrl,
    };
  };

  return {
    async list(userId) {
      const { data, error } = await client
        .from('garments')
        .select(selection)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      throwIfError(error);

      return Promise.all((data ?? []).map((item) => withSignedUrl(item)));
    },

    async upload({ userId, asset, details }) {
      const storagePath = `${userId}/${createId()}-original.jpg`;
      const { error: uploadError } = await bucket.upload(storagePath, decode(asset.base64), {
        contentType: asset.contentType,
        upsert: false,
      });
      throwIfError(uploadError);

      const { data, error: insertError } = await client
        .from('garments')
        .insert({
          user_id: userId,
          original_path: storagePath,
          clean_path: null,
          image_hash: null,
          status: 'processing',
          ...details,
        })
        .select(selection)
        .single();

      if (insertError) {
        await bucket.remove([storagePath]);
        throw insertError;
      }

      return withSignedUrl(data, storagePath);
    },

    async process(garmentId) {
      const { data, error } = await client.functions.invoke('process-garment', {
        body: { garmentId },
      });
      throwIfError(error);
      return z.object({ state: z.string().min(1) }).parse(data);
    },
  };
}

function requireRepository() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Add the public URL and key to .env.local.');
  }
  return createGarmentRepository(supabase);
}

export const supabaseGarmentRepository: GarmentRepository = {
  async list(userId) {
    return requireRepository().list(userId);
  },
  async upload(input) {
    return requireRepository().upload(input);
  },
  async process(garmentId) {
    return requireRepository().process(garmentId);
  },
};
