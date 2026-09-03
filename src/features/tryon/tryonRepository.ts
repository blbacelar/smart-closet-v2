import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';

const jobRowSchema = z.object({
  id: z.string().min(1),
  body_photo_id: z.string().min(1),
  garment_id: z.string().min(1),
  status: z.enum(['queued', 'running', 'done', 'failed']),
  result_path: z.string().nullable(),
  provider: z.string().nullable(),
  failure_code: z.string().nullable(),
  feedback: z.union([z.literal(-1), z.literal(1)]).nullable(),
  created_at: z.string().min(1),
  completed_at: z.string().nullable(),
});

const quotaSchema = z.object({
  tier: z.enum(['free', 'pro']),
  limit: z.number().int().positive(),
  used: z.number().int().min(0),
  remaining: z.number().int().min(0),
});

const enqueueSchema = z.object({
  state: z.enum(['queued', 'cached', 'in-progress']),
  jobId: z.string().min(1),
  status: z.enum(['queued', 'running', 'done']),
  limit: z.number().int().positive(),
  remaining: z.number().int().min(0),
});

const feedbackInputSchema = z.object({
  jobId: z.string().min(1),
  feedback: z.union([z.literal(-1), z.literal(1)]),
});

export type TryOnJob = {
  id: string;
  bodyPhotoId: string;
  garmentId: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  resultPath: string | null;
  resultUrl: string | null;
  provider: string | null;
  failureCode: string | null;
  feedback: -1 | 1 | null;
  createdAt: string;
  completedAt: string | null;
};

export type TryOnQuota = z.infer<typeof quotaSchema>;
export type EnqueueTryOnResult = z.infer<typeof enqueueSchema>;
export type TryOnFeedbackInput = z.infer<typeof feedbackInputSchema>;

export type TryOnRepository = {
  list: (userId: string) => Promise<TryOnJob[]>;
  quota: () => Promise<TryOnQuota>;
  enqueue: (input: { bodyPhotoId: string; garmentId: string }) => Promise<EnqueueTryOnResult>;
  setFeedback: (input: TryOnFeedbackInput) => Promise<void>;
};

export class TryOnRequestError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'TryOnRequestError';
  }
}

function throwIfError(error: unknown): asserts error is null | undefined {
  if (error) throw error;
}

async function parseFunctionError(error: unknown): Promise<never> {
  try {
    const context = typeof error === 'object' && error !== null && 'context' in error
      ? (error as { context?: { json?: () => Promise<unknown> } }).context
      : undefined;
    const payload = context?.json ? await context.json() : null;
    if (typeof payload === 'object' && payload !== null) {
      const value = payload as Record<string, unknown>;
      if (typeof value.code === 'string') {
        throw new TryOnRequestError(
          value.code,
          typeof value.message === 'string' ? value.message : 'Could not start the try-on. Try again.',
        );
      }
    }
  } catch (parsedError) {
    if (parsedError instanceof TryOnRequestError) throw parsedError;
  }
  throw new TryOnRequestError('request_failed', 'Could not start the try-on. Try again.');
}

export function createTryOnRepository(client: SupabaseClient): TryOnRepository {
  const results = client.storage.from('results');
  return {
    async list(userId) {
      const { data, error } = await client
        .from('tryon_jobs')
        .select('id, body_photo_id, garment_id, status, result_path, provider, failure_code, feedback, created_at, completed_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      throwIfError(error);

      return Promise.all((data ?? []).map(async (value) => {
        const row = jobRowSchema.parse(value);
        let resultUrl: string | null = null;
        if (row.status === 'done' && row.result_path) {
          const signed = await results.createSignedUrl(row.result_path, 600);
          throwIfError(signed.error);
          resultUrl = signed.data.signedUrl;
        }
        return {
          id: row.id,
          bodyPhotoId: row.body_photo_id,
          garmentId: row.garment_id,
          status: row.status,
          resultPath: row.result_path,
          resultUrl,
          provider: row.provider,
          failureCode: row.failure_code,
          feedback: row.feedback,
          createdAt: row.created_at,
          completedAt: row.completed_at,
        };
      }));
    },

    async quota() {
      const { data, error } = await client.rpc('get_my_tryon_quota');
      throwIfError(error);
      return quotaSchema.parse(data);
    },

    async enqueue(input) {
      const { data, error } = await client.functions.invoke('tryon-enqueue', { body: input });
      if (error) return parseFunctionError(error);
      return enqueueSchema.parse(data);
    },

    async setFeedback(input) {
      const value = feedbackInputSchema.parse(input);
      const { error } = await client
        .from('tryon_jobs')
        .update({ feedback: value.feedback })
        .eq('id', value.jobId)
        .eq('status', 'done')
        .select('id')
        .single();
      throwIfError(error);
    },
  };
}

function requireRepository() {
  if (!supabase) throw new Error('Supabase is not configured. Add the public URL and key to .env.local.');
  return createTryOnRepository(supabase);
}

export const supabaseTryOnRepository: TryOnRepository = {
  async list(userId) {
    return requireRepository().list(userId);
  },
  async quota() {
    return requireRepository().quota();
  },
  async enqueue(input) {
    return requireRepository().enqueue(input);
  },
  async setFeedback(input) {
    return requireRepository().setFeedback(input);
  },
};
