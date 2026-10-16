export const accountStorageBuckets = ['body', 'garments', 'results'] as const;
export type AccountStorageBucket = (typeof accountStorageBuckets)[number];

type DeleteAccountDependencies = {
  startDeletion: (userId: string) => Promise<{
    requestId: string;
    completedSteps: string[];
  }>;
  listPaths: (input: {
    bucket: AccountStorageBucket;
    userId: string;
    limit: number;
  }) => Promise<string[]>;
  removePaths: (input: {
    bucket: AccountStorageBucket;
    paths: string[];
  }) => Promise<void>;
  markStorageStep: (requestId: string, step: AccountStorageBucket) => Promise<void>;
  purgeDatabase: (requestId: string) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
};

const batchSize = 100;

export async function deleteAccountData(userId: string, dependencies: DeleteAccountDependencies) {
  const requiredPrefix = `${userId}/`;
  const { requestId, completedSteps } = await dependencies.startDeletion(userId);
  const completed = new Set(completedSteps);

  for (const bucket of accountStorageBuckets) {
    if (completed.has(bucket)) continue;
    while (true) {
      const paths = await dependencies.listPaths({ bucket, userId, limit: batchSize });
      if (paths.length === 0) break;
      if (paths.some((path) => !path.startsWith(requiredPrefix))) {
        throw new Error('Unsafe account deletion path');
      }
      await dependencies.removePaths({ bucket, paths });
    }
    await dependencies.markStorageStep(requestId, bucket);
  }

  if (!completed.has('database_purge')) {
    await dependencies.purgeDatabase(requestId);
  }
  await dependencies.deleteUser(userId);
}
