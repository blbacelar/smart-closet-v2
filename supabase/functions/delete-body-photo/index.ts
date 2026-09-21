import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { deleteBodyPhotoData } from './deleteBodyPhoto.ts';
import { handleDeleteBodyPhotoRequest } from './handler.ts';

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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authorization = request.headers.get('Authorization') ?? '';
  const result = await handleDeleteBodyPhotoRequest(
    { method: request.method, authorization, json: () => request.json() },
    {
      async authenticate(header) {
        const token = header.replace(/^Bearer\s+/i, '');
        if (!token || token === header) return null;
        const { data, error } = await admin.auth.getUser(token);
        if (error) return null;
        return data.user?.id ?? null;
      },
      deletePhoto(input) {
        return deleteBodyPhotoData(input, {
          async findOwnedPhoto({ userId, photoId }) {
            const { data: photo, error: photoError } = await admin
              .from('body_photos')
              .select('storage_path')
              .eq('id', photoId)
              .eq('user_id', userId)
              .maybeSingle();
            throwIfError(photoError);
            if (!photo) return null;

            const { data: jobs, error: jobsError } = await admin
              .from('tryon_jobs')
              .select('result_path')
              .eq('body_photo_id', photoId)
              .eq('user_id', userId)
              .not('result_path', 'is', null);
            throwIfError(jobsError);

            return {
              bodyPath: photo.storage_path,
              resultPaths: (jobs ?? [])
                .map((job) => job.result_path)
                .filter((path): path is string => typeof path === 'string' && path.length > 0),
            };
          },
          async removePaths({ bucket, paths }) {
            const { error } = await admin.storage.from(bucket).remove(paths);
            throwIfError(error);
          },
          async deleteRecord({ userId, photoId }) {
            const { error } = await admin
              .from('body_photos')
              .delete()
              .eq('id', photoId)
              .eq('user_id', userId);
            throwIfError(error);
          },
        });
      },
    },
  );

  return Response.json(result.body, { status: result.status, headers: corsHeaders });
});
