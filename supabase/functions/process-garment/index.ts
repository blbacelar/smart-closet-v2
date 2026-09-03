import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleProcessGarmentRequest } from './handler.ts';
import { processGarment, type ProcessingDependencies } from './processor.ts';
import { createGarmentImageProvider } from './removeBgProvider.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function requiredEnvironment(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function secretKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;

  const keys = JSON.parse(requiredEnvironment('SUPABASE_SECRET_KEYS')) as Record<string, string>;
  if (!keys.default) throw new Error('Default Supabase secret key is not configured.');
  return keys.default;
}

const admin = createClient(requiredEnvironment('SUPABASE_URL'), secretKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

function throwIfError(error: unknown): asserts error is null | undefined {
  if (error) throw error;
}

function processingDependencies(): ProcessingDependencies {
  return {
    async claim(input) {
      const { data, error } = await admin.rpc('claim_garment_processing', {
        p_garment_id: input.garmentId,
        p_user_id: input.userId,
      });
      throwIfError(error);
      return data as Awaited<ReturnType<ProcessingDependencies['claim']>>;
    },
    async downloadOriginal(storagePath) {
      const { data, error } = await admin.storage.from('garments').download(storagePath);
      throwIfError(error);
      return data.arrayBuffer();
    },
    async removeBackground(bytes) {
      const provider = createGarmentImageProvider({
        apiKey: Deno.env.get('REMOVE_BG_API_KEY'),
        costUsd: Deno.env.get('REMOVE_BG_COST_USD')
          ? Number(Deno.env.get('REMOVE_BG_COST_USD'))
          : undefined,
        fetch,
      });
      return provider.remove(bytes);
    },
    async hash(bytes) {
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    },
    async uploadClean(storagePath, bytes, contentType) {
      const { error } = await admin.storage.from('garments').upload(
        storagePath,
        new Blob([bytes], { type: contentType }),
        { contentType, upsert: true },
      );
      throwIfError(error);
    },
    async complete(input) {
      const { error } = await admin.rpc('complete_garment_processing', {
        p_garment_id: input.garmentId,
        p_user_id: input.userId,
        p_clean_path: input.cleanPath,
        p_image_hash: input.imageHash,
        p_provider: input.provider,
        p_cost_usd: input.costUsd,
      });
      throwIfError(error);
    },
    async fail(input) {
      const { error } = await admin.rpc('fail_garment_processing', {
        p_garment_id: input.garmentId,
        p_user_id: input.userId,
        p_message: input.message,
      });
      throwIfError(error);
    },
    async removeClean(storagePath) {
      const { error } = await admin.storage.from('garments').remove([storagePath]);
      throwIfError(error);
    },
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authorization = request.headers.get('Authorization') ?? '';
  const result = await handleProcessGarmentRequest(
    {
      method: request.method,
      authorization,
      json: () => request.json(),
    },
    {
      async authenticate(header) {
        const token = header.replace(/^Bearer\s+/i, '');
        if (!token || token === header) return null;
        const { data, error } = await admin.auth.getUser(token);
        if (error) return null;
        return data.user?.id ?? null;
      },
      process: (input) => processGarment(input, processingDependencies()),
    },
  );

  return Response.json(result.body, {
    status: result.status,
    headers: corsHeaders,
  });
});
