import { SupabaseClient } from '@supabase/supabase-js';
import type {
  AnalyticsEvent,
  ObservabilityAdapter,
  SafeErrorReport,
  SafeTelemetryProperties,
} from './observability';

type AnalyticsClient = Pick<SupabaseClient, 'from'>;

export function createSupabaseObservabilityAdapter(
  client: AnalyticsClient | null,
): ObservabilityAdapter {
  let userId: string | null = null;

  const insert = (
    eventName: AnalyticsEvent | 'app_error',
    properties: SafeTelemetryProperties | SafeErrorReport,
  ) => {
    if (!client || !userId) return;

    void Promise.resolve(client.from('analytics_events').insert({
      user_id: userId,
      event_name: eventName,
      properties,
    })).catch(() => undefined);
  };

  return {
    setUser(user) {
      userId = user?.id ?? null;
    },
    track(event, properties) {
      insert(event, properties);
    },
    captureError(report) {
      insert('app_error', report);
    },
  };
}
