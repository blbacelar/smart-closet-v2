import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

export type TryOnRealtime = {
  subscribe: (userId: string, onUpdate: () => void) => () => void;
};

export function createTryOnRealtime(client: SupabaseClient): TryOnRealtime {
  return {
    subscribe(userId, onUpdate) {
      const channel = client
        .channel(`tryon-jobs:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'tryon_jobs',
            filter: `user_id=eq.${userId}`,
          },
          onUpdate,
        )
        .subscribe();

      return () => {
        void client.removeChannel(channel);
      };
    },
  };
}

export const supabaseTryOnRealtime: TryOnRealtime = {
  subscribe(userId, onUpdate) {
    if (!supabase) return () => undefined;
    return createTryOnRealtime(supabase).subscribe(userId, onUpdate);
  },
};
