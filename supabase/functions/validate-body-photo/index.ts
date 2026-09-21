import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createGeminiModerationProvider } from './geminiModerationProvider.ts';
import { handleValidateBodyPhotoRequest } from './handler.ts';
import { validateBodyPhoto, type BodyPhotoValidationDependencies } from './processor.ts';

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

function providerConfiguration() {
  const apiKey = Deno.env.get('GOOGLE_GEMINI_API_KEY') ?? '';
  const model = Deno.env.get('GOOGLE_GEMINI_MODERATION_MODEL') ?? 'gemini-3.8-flash';
  const fallbackCostUsd = Number(Deno.env.get('GOOGLE_GEMINI_MODERATION_COST_USD_FALLBACK') ?? '0.001');
  return {
    apiKey,
    model,
    fallbackCostUsd,
    ready: Boolean(apiKey)
      && Boolean(model)
      && Number.isFinite(fallbackCostUsd)
      && fallbackCostUsd >= 0,
  };
}

const admin = createClient(requiredEnvironment('SUPABASE_URL'), secretKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

function throwIfError(error: unknown): asserts error is null | undefined {
  if (error) throw error;
}

function validationDependencies(): BodyPhotoValidationDependencies {
  const config = providerConfiguration();
  const provider = createGeminiModerationProvider({
    apiKey: config.apiKey,
    model: config.model,
    fallbackCostUsd: config.fallbackCostUsd,
    fetch: (url, init) => fetch(url, init as RequestInit),
  });

  return {
    async claim(input) {
      const { data, error } = await admin.rpc('claim_body_photo_validation', {
        p_photo_id: input.photoId,
        p_user_id: input.userId,
      });
      throwIfError(error);
      return data as Awaited<ReturnType<BodyPhotoValidationDependencies['claim']>>;
    },
    async download(storagePath) {
      const { data, error } = await admin.storage.from('body').download(storagePath);
      throwIfError(error);
      return { bytes: await data.arrayBuffer(), contentType: 'image/jpeg' };
    },
    moderate: provider.moderate,
    async complete(input) {
      const { error } = await admin.rpc('complete_body_photo_validation', {
        p_photo_id: input.photoId,
        p_user_id: input.userId,
        p_attempt: input.attempt,
        p_decision: input.decision,
        p_reject_reason: input.rejectReason,
        p_provider: input.provider,
        p_cost_usd: input.costUsd,
      });
      throwIfError(error);
    },
    async fail(input) {
      const { error } = await admin.rpc('fail_body_photo_validation', {
        p_photo_id: input.photoId,
        p_user_id: input.userId,
        p_attempt: input.attempt,
        p_message: input.message,
      });
      throwIfError(error);
    },
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authorization = request.headers.get('Authorization') ?? '';
  const result = await handleValidateBodyPhotoRequest(
    { method: request.method, authorization, json: () => request.json() },
    {
      async authenticate(header) {
        const token = header.replace(/^Bearer\s+/i, '');
        if (!token || token === header) return null;
        const { data, error } = await admin.auth.getUser(token);
        if (error) return null;
        return data.user?.id ?? null;
      },
      isConfigured: () => providerConfiguration().ready,
      process: (input) => validateBodyPhoto(input, validationDependencies()),
    },
  );

  return Response.json(result.body, { status: result.status, headers: corsHeaders });
});
