export const accountStorageBuckets = ['body', 'garments', 'results'] as const;
export type AccountStorageBucket = (typeof accountStorageBuckets)[number];

type DeleteAccountDependencies = {
  listPaths: (input: {
    bucket: AccountStorageBucket;
    userId: string;
    limit: number;
  }) => Promise<string[]>;
  removePaths: (input: {
    bucket: AccountStorageBucket;
    paths: string[];
  }) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
};

const batchSize = 100;

export async function deleteAccountData(userId: string, dependencies: DeleteAccountDependencies) {
  const requiredPrefix = `${userId}/`;

  for (const bucket of accountStorageBuckets) {
    while (true) {
      const paths = await dependencies.listPaths({ bucket, userId, limit: batchSize });
      if (paths.length === 0) break;
      if (paths.some((path) => !path.startsWith(requiredPrefix))) {
        throw new Error('Unsafe account deletion path');
      }
      await dependencies.removePaths({ bucket, paths });
    }
  }

  await dependencies.deleteUser(userId);
}
