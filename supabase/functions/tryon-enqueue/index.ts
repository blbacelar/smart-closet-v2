import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createGeminiProvider } from './geminiProvider.ts';
import { handleTryOnEnqueueRequest, type EnqueueTryOnResult } from './handler.ts';
import { processTryOn, type TryOnProcessingDependencies } from './processor.ts';

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
  const model = Deno.env.get('GOOGLE_GEMINI_IMAGE_MODEL') ?? 'gemini-3.1-flash-image';
  const fallbackCostValue = Deno.env.get('GOOGLE_GEMINI_TRYON_COST_USD_FALLBACK') ?? '0.07';
  const fallbackCostUsd = Number(fallbackCostValue);
  const cacheNamespace = `gemini:${model}:interactions:stateless:v1`;
  return {
    apiKey,
    model,
    cacheNamespace,
    fallbackCostUsd,
    ready: Boolean(apiKey)
      && Boolean(model)
      && cacheNamespace.length <= 200
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

function base64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 32_768;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function processingDependencies(): TryOnProcessingDependencies {
  const config = providerConfiguration();
  const provider = createGeminiProvider({
    apiKey: config.apiKey,
    model: config.model,
    fallbackCostUsd: config.fallbackCostUsd,
    fetch: (url, init) => fetch(url, init as RequestInit),
  });

  return {
    async claim(input) {
      const { data, error } = await admin.rpc('claim_tryon_job', {
        p_job_id: input.jobId,
        p_user_id: input.userId,
      });
      throwIfError(error);
      return data as Awaited<ReturnType<TryOnProcessingDependencies['claim']>>;
    },
    async downloadInput(bucket, path, contentType) {
      const { data, error } = await admin.storage.from(bucket).download(path);
      throwIfError(error);
      return `data:${contentType};base64,${base64(await data.arrayBuffer())}`;
    },
    generateTryOn: provider.generateTryOn,
    async setProviderJob(input) {
      const { error } = await admin.rpc('set_tryon_provider_job', {
        p_job_id: input.jobId,
        p_user_id: input.userId,
        p_provider: input.provider,
        p_provider_job_id: input.providerJobId,
      });
      throwIfError(error);
    },
    async uploadResult(path, bytes, contentType) {
      const { error } = await admin.storage.from('results').upload(
        path,
        new Blob([bytes], { type: contentType }),
        { contentType, upsert: false },
      );
      throwIfError(error);
    },
    async complete(input) {
      const { error } = await admin.rpc('complete_tryon_job', {
        p_job_id: input.jobId,
        p_user_id: input.userId,
        p_result_path: input.resultPath,
        p_provider: input.provider,
        p_cost_usd: input.costUsd,
        p_latency_ms: input.latencyMs,
      });
      throwIfError(error);
    },
    async fail(input) {
      const { error } = await admin.rpc('fail_tryon_job', {
        p_job_id: input.jobId,
        p_user_id: input.userId,
        p_failure_code: input.failureCode,
        p_provider: input.provider,
        p_cost_usd: input.costUsd,
      });
      throwIfError(error);
    },
    async removeResult(path) {
      const { error } = await admin.storage.from('results').remove([path]);
      throwIfError(error);
    },
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authorization = request.headers.get('Authorization') ?? '';
  const result = await handleTryOnEnqueueRequest(
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
      async reserve(input) {
        const config = providerConfiguration();
        const { data, error } = await admin.rpc('reserve_tryon_job', {
          p_user_id: input.userId,
          p_body_photo_id: input.bodyPhotoId,
          p_garment_id: input.garmentId,
          p_cache_namespace: config.cacheNamespace,
        });
        throwIfError(error);
        return data as EnqueueTryOnResult;
      },
      schedule(input) {
        const task = processTryOn(input, processingDependencies()).catch(() => undefined);
        EdgeRuntime.waitUntil(task);
      },
    },
  );

  return Response.json(result.body, { status: result.status, headers: corsHeaders });
});
