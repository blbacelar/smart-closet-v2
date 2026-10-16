import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleConfirmMarketplaceHandoff } from './handler.ts';
import {
  settleHandoff,
  type AcquisitionManifestItem,
  type HandoffState,
} from './settleHandoff.ts';

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
const bucket = admin.storage.from('garments');

function throwIfError(error: unknown): asserts error is null | undefined {
  if (error) throw error;
}

function mapManifest(input: unknown): AcquisitionManifestItem[] {
  if (!Array.isArray(input)) throw new Error('Invalid acquisition manifest');
  return input.map((value) => {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Invalid acquisition manifest');
    }
    const row = value as Record<string, unknown>;
    return {
      acquiredGarmentId: String(row.acquired_garment_id ?? ''),
      sourceOriginalPath: String(row.source_original_path ?? ''),
      sourceCleanPath: row.source_clean_path === null ? null : String(row.source_clean_path ?? ''),
      destinationOriginalPath: String(row.destination_original_path ?? ''),
      destinationCleanPath: row.destination_clean_path === null
        ? null
        : String(row.destination_clean_path ?? ''),
    };
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authorization = request.headers.get('Authorization') ?? '';
  const result = await handleConfirmMarketplaceHandoff(
    { method: request.method, authorization, json: () => request.json() },
    {
      async authenticate(header) {
        const token = header.replace(/^Bearer\s+/i, '');
        if (!token || token === header) return null;
        const { data, error } = await admin.auth.getUser(token);
        if (error) return null;
        return data.user?.id ?? null;
      },
      settle: (transactionId, userId) => settleHandoff(transactionId, userId, {
        async recordConfirmation(id, participantId) {
          const { data, error } = await admin.rpc('marketplace_record_handoff_confirmation', {
            p_transaction_id: id,
            p_user_id: participantId,
          });
          throwIfError(error);
          return data as HandoffState;
        },
        async getManifest(id) {
          const { data, error } = await admin.rpc('marketplace_acquisition_manifest', {
            p_transaction_id: id,
          });
          throwIfError(error);
          return mapManifest(data);
        },
        async objectExists(path) {
          const { data } = await bucket.exists(path);
          return data;
        },
        async copyObject(sourcePath, destinationPath) {
          const { error } = await bucket.copy(sourcePath, destinationPath);
          throwIfError(error);
        },
        async finalize(id) {
          const { data, error } = await admin.rpc('marketplace_finalize_handoff', {
            p_transaction_id: id,
          });
          throwIfError(error);
          if (data !== 'completed') throw new Error('Settlement did not complete');
          return 'completed';
        },
      }),
    },
  );

  return Response.json(result.body, { status: result.status, headers: corsHeaders });
});
