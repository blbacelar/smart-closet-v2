import { createSupabaseObservabilityAdapter } from './supabaseObservabilityAdapter';
import { supabase } from './supabase';

export type AnalyticsEvent =
  | 'app_opened'
  | 'auth_signed_in'
  | 'auth_signed_up'
  | 'onboarding_completed'
  | 'body_photo_uploaded'
  | 'garment_uploaded'
  | 'tryon_requested'
  | 'tryon_completed'
  | 'paywall_viewed'
  | 'subscription_purchase_started'
  | 'account_deleted';

export type ObservabilityErrorContext = {
  operation: 'react_render' | 'auth_session_restore' | 'tryon_enqueue' | 'render';
  code: 'unexpected_render_error' | 'session_restore_failed' | 'request_failed' | 'unexpected';
  fatal: boolean;
};

export type SafeTelemetryProperties = Record<string, string | number | boolean>;

export type SafeErrorReport = ObservabilityErrorContext & {
  name: 'Error' | 'TypeError' | 'RangeError' | 'ReferenceError' | 'SyntaxError' | 'UnknownError';
};

export type ObservabilityAdapter = {
  setUser: (user: { id: string } | null) => void;
  track: (event: AnalyticsEvent, properties: SafeTelemetryProperties) => void;
  captureError: (report: SafeErrorReport) => void;
};

export type ObservabilityClient = {
  setUser: (userId: string | null) => void;
  setAnalyticsConsent: (consent: AnalyticsConsent) => void;
  getAnalyticsConsent: () => AnalyticsConsent;
  track: (event: AnalyticsEvent, properties?: Record<string, unknown>) => void;
  captureError: (error: unknown, context: ObservabilityErrorContext) => void;
};

export type AnalyticsConsent = 'granted' | 'denied' | 'unknown';

export type ObservabilityOptions = {
  analyticsConsent: AnalyticsConsent;
};

const noopAdapter: ObservabilityAdapter = {
  setUser: () => undefined,
  track: () => undefined,
  captureError: () => undefined,
};

const sensitiveKey = /(?:id$|_id$|photo|image|url|path|email|token|secret|name)/i;
const recognizedErrorNames = new Set<SafeErrorReport['name']>([
  'Error',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
]);

function callSafely(action: () => void) {
  try {
    action();
  } catch {
    // Monitoring must never become an app-availability dependency.
  }
}

function sanitizeProperties(properties: Record<string, unknown>) {
  const safe: SafeTelemetryProperties = {};
  for (const [key, value] of Object.entries(properties)) {
    if (sensitiveKey.test(key)) continue;
    if (typeof value === 'string') safe[key] = value.slice(0, 160);
    else if (typeof value === 'boolean') safe[key] = value;
    else if (typeof value === 'number' && Number.isFinite(value)) safe[key] = value;
  }
  return safe;
}

function safeErrorName(error: unknown): SafeErrorReport['name'] {
  if (!(error instanceof Error)) return 'UnknownError';
  return recognizedErrorNames.has(error.name as SafeErrorReport['name'])
    ? error.name as SafeErrorReport['name']
    : 'Error';
}

export function createObservability(
  adapter: ObservabilityAdapter = noopAdapter,
  options: ObservabilityOptions = { analyticsConsent: 'unknown' },
): ObservabilityClient {
  let analyticsConsent = options.analyticsConsent;
  let currentUserId: string | null = null;
  const isAllowed = () => analyticsConsent === 'granted';

  return {
    setUser(userId) {
      currentUserId = userId;
      if (!isAllowed()) return;
      callSafely(() => adapter.setUser(userId ? { id: userId } : null));
    },
    setAnalyticsConsent(consent) {
      if (consent === analyticsConsent) return;
      const wasAllowed = isAllowed();
      analyticsConsent = consent;

      if (isAllowed()) {
        callSafely(() => adapter.setUser(currentUserId ? { id: currentUserId } : null));
      } else if (wasAllowed) {
        callSafely(() => adapter.setUser(null));
      }
    },
    getAnalyticsConsent() {
      return analyticsConsent;
    },
    track(event, properties = {}) {
      if (!isAllowed()) return;
      callSafely(() => adapter.track(event, sanitizeProperties(properties)));
    },
    captureError(error, context) {
      if (!isAllowed()) return;
      callSafely(() => adapter.captureError({ name: safeErrorName(error), ...context }));
    },
  };
}

// First-party, consent-gated event storage only. No session-replay vendor is used.
export const observability = createObservability(
  createSupabaseObservabilityAdapter(supabase),
);
