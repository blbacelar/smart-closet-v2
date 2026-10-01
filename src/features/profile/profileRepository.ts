import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';

const onboardingRowSchema = z.object({
  onboarding_completed_at: z.string().min(1).nullable(),
});

export type OnboardingStatus = { completed: boolean };

export type ProfileRepository = {
  getOnboardingStatus: (userId: string) => Promise<OnboardingStatus>;
  completeOnboarding: (userId: string) => Promise<void>;
};

function throwIfError(error: unknown): asserts error is null | undefined {
  if (error) throw error;
}

export function createProfileRepository(client: SupabaseClient): ProfileRepository {
  return {
    async getOnboardingStatus(userId) {
      const { data, error } = await client
        .from('profiles')
        .select('onboarding_completed_at')
        .eq('id', userId)
        .single();
      throwIfError(error);
      const row = onboardingRowSchema.parse(data);
      return { completed: Boolean(row.onboarding_completed_at) };
    },

    async completeOnboarding(userId) {
      const { error } = await client
        .from('profiles')
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq('id', userId);
      throwIfError(error);
    },
  };
}

function requireRepository() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Add the public URL and key to .env.local.');
  }
  return createProfileRepository(supabase);
}

export const supabaseProfileRepository: ProfileRepository = {
  getOnboardingStatus(userId) {
    return requireRepository().getOnboardingStatus(userId);
  },
  completeOnboarding(userId) {
    return requireRepository().completeOnboarding(userId);
  },
};
