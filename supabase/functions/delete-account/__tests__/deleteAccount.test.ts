import { deleteAccountData } from '../deleteAccount';

function dependencies() {
  return {
    startDeletion: jest.fn().mockResolvedValue({ requestId: 'request-1', completedSteps: [] }),
    listPaths: jest.fn().mockResolvedValue([]),
    removePaths: jest.fn().mockResolvedValue(undefined),
    markStorageStep: jest.fn().mockResolvedValue(undefined),
    purgeDatabase: jest.fn().mockResolvedValue(undefined),
    deleteUser: jest.fn().mockResolvedValue(undefined),
  };
}

describe('deleteAccountData', () => {
  it('removes every Phase 1 private object before deleting the auth user', async () => {
    const deps = dependencies();
    deps.listPaths
      .mockResolvedValueOnce(['user-1/body.jpg'])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(['user-1/shirt-original.jpg', 'user-1/shirt-clean.png'])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(['user-1/tryon.png'])
      .mockResolvedValueOnce([]);

    await deleteAccountData('user-1', deps);

    expect(deps.startDeletion).toHaveBeenCalledWith('user-1');
    expect(deps.listPaths).toHaveBeenNthCalledWith(1, { bucket: 'body', userId: 'user-1', limit: 100 });
    expect(deps.listPaths).toHaveBeenNthCalledWith(3, { bucket: 'garments', userId: 'user-1', limit: 100 });
    expect(deps.listPaths).toHaveBeenNthCalledWith(5, { bucket: 'results', userId: 'user-1', limit: 100 });
    expect(deps.removePaths).toHaveBeenNthCalledWith(1, {
      bucket: 'body',
      paths: ['user-1/body.jpg'],
    });
    expect(deps.removePaths).toHaveBeenNthCalledWith(2, {
      bucket: 'garments',
      paths: ['user-1/shirt-original.jpg', 'user-1/shirt-clean.png'],
    });
    expect(deps.removePaths).toHaveBeenNthCalledWith(3, {
      bucket: 'results',
      paths: ['user-1/tryon.png'],
    });
    expect(deps.markStorageStep).toHaveBeenNthCalledWith(1, 'request-1', 'body');
    expect(deps.markStorageStep).toHaveBeenNthCalledWith(2, 'request-1', 'garments');
    expect(deps.markStorageStep).toHaveBeenNthCalledWith(3, 'request-1', 'results');
    expect(deps.purgeDatabase).toHaveBeenCalledWith('request-1');
    expect(deps.deleteUser).toHaveBeenCalledWith('user-1');
    expect(deps.deleteUser.mock.invocationCallOrder[0]).toBeGreaterThan(
      deps.removePaths.mock.invocationCallOrder.at(-1)!,
    );
  });

  it('resumes from durable checkpoints without repeating completed purge work', async () => {
    const deps = dependencies();
    deps.startDeletion.mockResolvedValue({
      requestId: 'request-1',
      completedSteps: ['tombstone', 'body', 'database_purge'],
    });

    await deleteAccountData('user-1', deps);

    expect(deps.listPaths).not.toHaveBeenCalledWith(expect.objectContaining({ bucket: 'body' }));
    expect(deps.listPaths).toHaveBeenCalledWith({ bucket: 'garments', userId: 'user-1', limit: 100 });
    expect(deps.listPaths).toHaveBeenCalledWith({ bucket: 'results', userId: 'user-1', limit: 100 });
    expect(deps.purgeDatabase).not.toHaveBeenCalled();
    expect(deps.deleteUser).toHaveBeenCalledWith('user-1');
  });

  it('does not delete the auth user when private object cleanup fails', async () => {
    const deps = dependencies();
    deps.listPaths.mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(deleteAccountData('user-1', deps)).rejects.toThrow('storage unavailable');
    expect(deps.deleteUser).not.toHaveBeenCalled();
  });

  it('refuses to remove a path outside the authenticated user prefix', async () => {
    const deps = dependencies();
    deps.listPaths.mockResolvedValueOnce(['user-2/private.jpg']);

    await expect(deleteAccountData('user-1', deps)).rejects.toThrow('Unsafe account deletion path');
    expect(deps.removePaths).not.toHaveBeenCalled();
    expect(deps.deleteUser).not.toHaveBeenCalled();
  });
});
