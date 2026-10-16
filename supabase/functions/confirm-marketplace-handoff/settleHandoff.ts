export type HandoffState = 'awaiting_handoff' | 'settlement_pending' | 'completed';

export type AcquisitionManifestItem = {
  acquiredGarmentId: string;
  sourceOriginalPath: string;
  sourceCleanPath: string | null;
  destinationOriginalPath: string;
  destinationCleanPath: string | null;
};

export type SettlementDependencies = {
  recordConfirmation: (transactionId: string, userId: string) => Promise<HandoffState>;
  getManifest: (transactionId: string) => Promise<AcquisitionManifestItem[]>;
  objectExists: (path: string) => Promise<boolean>;
  copyObject: (sourcePath: string, destinationPath: string) => Promise<void>;
  finalize: (transactionId: string) => Promise<'completed'>;
};

function assertSafePath(item: AcquisitionManifestItem) {
  const originalSuffix = `/acquired/${item.acquiredGarmentId}/original`;
  const cleanSuffix = `/acquired/${item.acquiredGarmentId}/clean`;
  const invalid =
    !item.sourceOriginalPath
    || item.sourceOriginalPath === item.destinationOriginalPath
    || !item.destinationOriginalPath.endsWith(originalSuffix)
    || item.destinationOriginalPath.startsWith('/')
    || item.destinationOriginalPath.includes('..')
    || (item.sourceCleanPath === null) !== (item.destinationCleanPath === null)
    || (item.sourceCleanPath !== null && (
      item.sourceCleanPath === item.destinationCleanPath
      || !item.destinationCleanPath?.endsWith(cleanSuffix)
      || item.destinationCleanPath.startsWith('/')
      || item.destinationCleanPath.includes('..')
    ));

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
      item.sourceOriginalPath,
      item.destinationOriginalPath,
      dependencies,
    );
    if (item.sourceCleanPath && item.destinationCleanPath) {
      await ensureCopy(
        item.sourceCleanPath,
        item.destinationCleanPath,
        dependencies,
      );
    }
  }

  return dependencies.finalize(transactionId);
}
