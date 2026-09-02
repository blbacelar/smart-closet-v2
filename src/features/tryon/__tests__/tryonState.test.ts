import { TryOnRequestError } from '../tryonRepository';
import { getTryOnAction, tryOnErrorMessage } from '../tryonState';

describe('try-on screen state', () => {
  it.each([
    [{ hasBodyPhoto: false, garmentCount: 0, readyGarmentCount: 0, remaining: 3 }, 'body-photo'],
    [{ hasBodyPhoto: true, garmentCount: 0, readyGarmentCount: 0, remaining: 3 }, 'garment'],
    [{ hasBodyPhoto: true, garmentCount: 1, readyGarmentCount: 0, remaining: 3 }, 'closet'],
    [{ hasBodyPhoto: true, garmentCount: 1, readyGarmentCount: 1, remaining: 0 }, 'upgrade'],
    [{ hasBodyPhoto: true, garmentCount: 1, readyGarmentCount: 1, remaining: 2 }, 'try-on'],
  ] as const)('chooses the next truthful action for %o', (input, expected) => {
    expect(getTryOnAction(input)).toBe(expected);
  });

  it('shows actionable typed failures without leaking provider details', () => {
    expect(tryOnErrorMessage(new TryOnRequestError('provider_unavailable', 'Configured message'))).toBe(
      'Configured message',
    );
    expect(tryOnErrorMessage(new TryOnRequestError('quota_exceeded', 'ignored'))).toBe(
      'You’ve used today’s try-ons. Upgrade to Pro or come back tomorrow.',
    );
    expect(tryOnErrorMessage(new Error('private provider detail'))).toBe(
      'Could not start the try-on. Try again.',
    );
  });
});
