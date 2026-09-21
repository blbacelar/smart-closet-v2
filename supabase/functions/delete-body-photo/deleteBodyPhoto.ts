type PrivateBucket = 'body' | 'results';

type OwnedPhotoCleanup = {
  bodyPath: string;
  resultPaths: string[];
};

type DeleteBodyPhotoDependencies = {
  findOwnedPhoto: (input: { userId: string; photoId: string }) => Promise<OwnedPhotoCleanup | null>;
  removePaths: (input: { bucket: PrivateBucket; paths: string[] }) => Promise<void>;
  deleteRecord: (input: { userId: string; photoId: string }) => Promise<void>;
};

export async function deleteBodyPhotoData(
  input: { userId: string; photoId: string },
  dependencies: DeleteBodyPhotoDependencies,
) {
  const cleanup = await dependencies.findOwnedPhoto(input);
  if (!cleanup) return;

  const requiredPrefix = `${input.userId}/`;
  const resultPaths = [...new Set(cleanup.resultPaths)];
  if (
    !cleanup.bodyPath.startsWith(requiredPrefix)
    || resultPaths.some((path) => !path.startsWith(requiredPrefix))
  ) {
    throw new Error('Unsafe body photo deletion path');
  }

  if (resultPaths.length > 0) {
    await dependencies.removePaths({ bucket: 'results', paths: resultPaths });
  }
  await dependencies.removePaths({ bucket: 'body', paths: [cleanup.bodyPath] });
  await dependencies.deleteRecord(input);
}
