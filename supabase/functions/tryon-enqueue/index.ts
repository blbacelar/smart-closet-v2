import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return Response.json({ code: 'unauthorized' }, { status: 401, headers: corsHeaders });

    const client = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await client.auth.getUser();
    if (!user) return Response.json({ code: 'unauthorized' }, { status: 401, headers: corsHeaders });

    const { bodyPhotoId, garmentId, cacheKey } = await request.json();
    if (!bodyPhotoId || !garmentId || !cacheKey) {
      return Response.json({ code: 'invalid_request' }, { status: 400, headers: corsHeaders });
    }

    const { data: cached } = await client
      .from('tryon_jobs')
      .select('id,status,result_path')
      .eq('cache_key', cacheKey)
      .eq('status', 'done')
      .maybeSingle();
    if (cached) return Response.json({ cached: true, job: cached }, { headers: corsHeaders });

    const { data: profile } = await client.from('profiles').select('tier').single();
    const limit = profile?.tier === 'pro' ? 60 : 3;
    const { data: usage } = await client.from('usage_daily').select('tryon_count').eq('day', new Date().toISOString().slice(0, 10)).maybeSingle();
    if ((usage?.tryon_count ?? 0) >= limit) {
      return Response.json({ code: 'quota_exceeded', limit }, { status: 429, headers: corsHeaders });
    }

    const { data: job, error } = await client
      .from('tryon_jobs')
      .insert({ user_id: user.id, body_photo_id: bodyPhotoId, garment_id: garmentId, cache_key: cacheKey })
      .select('id,status')
      .single();
    if (error) throw error;

    return Response.json({ cached: false, job }, { status: 202, headers: corsHeaders });
  } catch (error) {
    return Response.json({ code: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500, headers: corsHeaders });
  }
});

