import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  handleOperationsHealth,
  parseOperationalHealthAccessToken,
  parseOperationalHealthConfig,
} from './handler.ts';

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

const serviceKey = secretKey();
const accessToken = parseOperationalHealthAccessToken(
  Deno.env.get('OPERATIONS_HEALTH_ACCESS_TOKEN'),
);
const healthConfig = parseOperationalHealthConfig((name) => Deno.env.get(name));
const admin = createClient(requiredEnvironment('SUPABASE_URL'), serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (request) => {
  const result = await handleOperationsHealth({
    method: request.method,
    authorization: request.headers.get('Authorization') ?? '',
  }, {
    accessToken,
    now: () => new Date(),
    async readHealth() {
      const { error: configurationError } = await admin.rpc('configure_operational_health', {
        p_stale_after: `${healthConfig.staleMinutes} minutes`,
        p_warning_count: healthConfig.warningCount,
        p_critical_count: healthConfig.criticalCount,
      });
      if (configurationError) throw configurationError;
      const { data, error } = await admin.rpc('operational_health_check');
      if (error) throw error;
      return data;
    },
  });
  return Response.json(result.body, {
    status: result.status,
    headers: { 'Cache-Control': 'no-store' },
  });
});
