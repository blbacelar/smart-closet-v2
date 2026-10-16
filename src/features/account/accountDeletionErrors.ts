export const unresolvedMarketplaceDeletionMessage =
  'Finish or cancel your active marketplace exchanges before deleting your account.';

export class AccountDeletionBlockedError extends Error {
  constructor() {
    super(unresolvedMarketplaceDeletionMessage);
    this.name = 'AccountDeletionBlockedError';
  }
}

export function isAccountDeletionBlockedError(error: unknown) {
  return error instanceof AccountDeletionBlockedError;
}
