import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { accountStorageBuckets, deleteAccountData, type AccountStorageBucket } from './deleteAccount.ts';
import { handleDeleteAccountRequest } from './handler.ts';

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

async function listUserPaths(bucket: AccountStorageBucket, userId: string, limit: number) {
  const paths: string[] = [];
  const folders = [userId];

  while (folders.length > 0 && paths.length < limit) {
    const folder = folders.shift()!;
    let offset = 0;
    while (paths.length < limit) {
      const pageLimit = Math.min(100, limit - paths.length);
      const { data, error } = await admin.storage.from(bucket).list(folder, {
        limit: pageLimit,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      throwIfError(error);
      const entries = data ?? [];
      for (const entry of entries) {
        const path = `${folder}/${entry.name}`;
        if (entry.id) paths.push(path);
        else folders.push(path);
      }
      if (entries.length < pageLimit) break;
      offset += entries.length;
    }
  }

  return paths.slice(0, limit);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authorization = request.headers.get('Authorization') ?? '';
  const result = await handleDeleteAccountRequest(
    { method: request.method, authorization, json: () => request.json() },
    {
      async authenticate(header) {
        const token = header.replace(/^Bearer\s+/i, '');
        if (!token || token === header) return null;
        const { data, error } = await admin.auth.getUser(token);
        if (error) return null;
        return data.user?.id ?? null;
      },
      deleteAccount(userId) {
        return deleteAccountData(userId, {
          listPaths: ({ bucket, userId: accountId, limit }) => listUserPaths(bucket, accountId, limit),
          async removePaths({ bucket, paths }) {
            const { error } = await admin.storage.from(bucket).remove(paths);
            throwIfError(error);
          },
          async deleteUser(accountId) {
            const { error } = await admin.auth.admin.deleteUser(accountId, false);
            throwIfError(error);
          },
        });
      },
    },
  );

  return Response.json(result.body, { status: result.status, headers: corsHeaders });
});

export { accountStorageBuckets };
