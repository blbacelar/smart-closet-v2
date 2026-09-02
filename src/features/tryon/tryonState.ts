import { TryOnRequestError } from './tryonRepository';

export type TryOnAction = 'body-photo' | 'garment' | 'closet' | 'upgrade' | 'try-on';

export function getTryOnAction(input: {
  hasBodyPhoto: boolean;
  garmentCount: number;
  readyGarmentCount: number;
  remaining: number;
}): TryOnAction {
  if (!input.hasBodyPhoto) return 'body-photo';
  if (input.garmentCount === 0) return 'garment';
  if (input.readyGarmentCount === 0) return 'closet';
  if (input.remaining === 0) return 'upgrade';
  return 'try-on';
}

export function tryOnErrorMessage(error: unknown) {
  if (error instanceof TryOnRequestError) {
    if (error.code === 'quota_exceeded') {
      return 'You’ve used today’s try-ons. Upgrade to Pro or come back tomorrow.';
    }
    return error.message;
  }
  return 'Could not start the try-on. Try again.';
}
