export type HandoffState = 'awaiting_handoff' | 'settlement_pending' | 'completed';

export type AcquisitionManifestItem = {
  acquiredGarmentId: string;
  sourceMarketplacePath: string;
  destinationPath: string;
};

export type SettlementDependencies = {
  recordConfirmation: (transactionId: string, userId: string) => Promise<HandoffState>;
  getManifest: (transactionId: string) => Promise<AcquisitionManifestItem[]>;
  objectExists: (path: string) => Promise<boolean>;
  copyObject: (sourcePath: string, destinationPath: string) => Promise<void>;
  finalize: (transactionId: string) => Promise<'completed'>;
};

function assertSafePath(item: AcquisitionManifestItem) {
  const destinationSuffix = `/acquired/${item.acquiredGarmentId}/asset`;
  const invalid =
    !item.sourceMarketplacePath
    || item.sourceMarketplacePath === item.destinationPath
    || !item.destinationPath.endsWith(destinationSuffix)
    || item.destinationPath.startsWith('/')
    || item.destinationPath.includes('..');

  if (invalid) throw new Error('Unsafe acquired garment path');
}

async function ensureCopy(
  sourcePath: string,
  destinationPath: string,
  dependencies: SettlementDependencies,
) {
  if (await dependencies.objectExists(destinationPath)) return;
  await dependencies.copyObject(sourcePath, destinationPath);
}

export async function settleHandoff(
  transactionId: string,
  userId: string,
  dependencies: SettlementDependencies,
): Promise<HandoffState> {
  const state = await dependencies.recordConfirmation(transactionId, userId);
  if (state !== 'settlement_pending') return state;

  const manifest = await dependencies.getManifest(transactionId);
  if (manifest.length < 1 || manifest.length > 2) {
    throw new Error('Invalid acquired garment manifest');
  }

  for (const item of manifest) {
    assertSafePath(item);
    await ensureCopy(
      item.sourceMarketplacePath,
      item.destinationPath,
      dependencies,
    );
  }

  return dependencies.finalize(transactionId);
}
