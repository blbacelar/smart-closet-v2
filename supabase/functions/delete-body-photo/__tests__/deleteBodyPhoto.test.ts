import { deleteBodyPhotoData } from '../deleteBodyPhoto';

const userId = '00000000-0000-4000-8000-000000000001';
const photoId = '10000000-0000-4000-8000-000000000001';

function dependencies() {
  return {
    findOwnedPhoto: jest.fn().mockResolvedValue({
      bodyPath: `${userId}/body.jpg`,
      resultPaths: [`${userId}/result-one.png`, `${userId}/result-two.png`],
    }),
    removePaths: jest.fn().mockResolvedValue(undefined),
    deleteRecord: jest.fn().mockResolvedValue(undefined),
  };
}

describe('deleteBodyPhotoData', () => {
  it('removes derived results and the source before deleting metadata', async () => {
    const deps = dependencies();

    await deleteBodyPhotoData({ userId, photoId }, deps);

    expect(deps.removePaths).toHaveBeenNthCalledWith(1, {
      bucket: 'results',
      paths: [`${userId}/result-one.png`, `${userId}/result-two.png`],
    });
    expect(deps.removePaths).toHaveBeenNthCalledWith(2, {
      bucket: 'body',
      paths: [`${userId}/body.jpg`],
    });
    expect(deps.deleteRecord).toHaveBeenCalledWith({ userId, photoId });
    expect(deps.deleteRecord.mock.invocationCallOrder[0]).toBeGreaterThan(
      deps.removePaths.mock.invocationCallOrder.at(-1)!,
    );
  });

  it('is idempotent when the photo is already gone', async () => {
    const deps = dependencies();
    deps.findOwnedPhoto.mockResolvedValue(null);

    await expect(deleteBodyPhotoData({ userId, photoId }, deps)).resolves.toBeUndefined();
    expect(deps.removePaths).not.toHaveBeenCalled();
    expect(deps.deleteRecord).not.toHaveBeenCalled();
  });

  it('refuses paths outside the authenticated member folder', async () => {
    const deps = dependencies();
    deps.findOwnedPhoto.mockResolvedValue({
      bodyPath: 'someone-else/body.jpg',
      resultPaths: [],
    });

    await expect(deleteBodyPhotoData({ userId, photoId }, deps)).rejects.toThrow(
      'Unsafe body photo deletion path',
    );
    expect(deps.removePaths).not.toHaveBeenCalled();
    expect(deps.deleteRecord).not.toHaveBeenCalled();
  });

  it('keeps metadata when Storage cleanup fails so deletion can be retried', async () => {
    const deps = dependencies();
    deps.removePaths.mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(deleteBodyPhotoData({ userId, photoId }, deps)).rejects.toThrow('storage unavailable');
    expect(deps.deleteRecord).not.toHaveBeenCalled();
  });
});
