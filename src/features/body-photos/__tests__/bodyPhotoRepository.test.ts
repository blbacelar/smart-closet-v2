let mockSupabase: any;

jest.mock('../../../lib/supabase', () => ({
  get supabase() {
    return mockSupabase;
  },
}));

import { createBodyPhotoRepository, supabaseBodyPhotoRepository } from '../bodyPhotoRepository';

const row = {
  id: 'photo-1',
  storage_path: 'user-1/photo-1.jpg',
  status: 'pending',
  reject_reason: null,
  validation_attempts: 1,
  validation_error: null,
  created_at: '2026-09-02T20:00:00Z',
};

function createClient() {
  const order = jest.fn().mockResolvedValue({ data: [row], error: null });
  const eq = jest.fn(() => ({ order }));
  const selectList = jest.fn(() => ({ eq }));
  const single = jest.fn().mockResolvedValue({ data: row, error: null });
  const selectInsert = jest.fn(() => ({ single }));
  const insert = jest.fn(() => ({ select: selectInsert }));
  const fromTable = jest.fn(() => ({ select: selectList, insert }));
  const upload = jest.fn().mockResolvedValue({ error: null });
  const createSignedUrl = jest
    .fn()
    .mockResolvedValue({ data: { signedUrl: 'https://signed.example/photo-1' }, error: null });
  const remove = jest.fn().mockResolvedValue({ error: null });
  const invoke = jest.fn().mockImplementation((name: string) => Promise.resolve(
    name === 'validate-body-photo'
      ? { data: { state: 'approved' }, error: null }
      : { data: { deleted: true }, error: null },
  ));
  const bucket = { upload, createSignedUrl, remove };
  const fromBucket = jest.fn(() => bucket);

  return {
    client: { from: fromTable, storage: { from: fromBucket }, functions: { invoke } },
    fromTable,
    selectList,
    eq,
    order,
    insert,
    selectInsert,
    single,
    fromBucket,
    upload,
    createSignedUrl,
    remove,
    invoke,
  };
}

describe('bodyPhotoRepository', () => {
  it('lists owner-scoped records with short-lived signed URLs', async () => {
    const mocks = createClient();
    const repository = createBodyPhotoRepository(mocks.client as never, () => 'generated-id');

    await expect(repository.list('user-1')).resolves.toEqual([
      {
        id: 'photo-1',
        storagePath: 'user-1/photo-1.jpg',
        status: 'pending',
        rejectReason: null,
        validationAttempts: 1,
        validationError: null,
        createdAt: '2026-09-02T20:00:00Z',
        signedUrl: 'https://signed.example/photo-1',
      },
    ]);
    expect(mocks.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(mocks.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(mocks.createSignedUrl).toHaveBeenCalledWith(row.storage_path, 3600);
  });

  it('uploads to a new private path before inserting metadata', async () => {
    const mocks = createClient();
    const repository = createBodyPhotoRepository(mocks.client as never, () => 'generated-id');
    const asset = {
      uri: 'file:///body.jpg',
      base64: 'YWJjZA==',
      width: 1200,
      height: 1800,
      contentType: 'image/jpeg' as const,
      byteLength: 4,
    };

    await expect(repository.upload({ userId: 'user-1', asset })).resolves.toMatchObject({
      id: 'photo-1',
      storagePath: 'user-1/generated-id.jpg',
    });
    expect(mocks.upload).toHaveBeenCalledWith(
      'user-1/generated-id.jpg',
      expect.any(ArrayBuffer),
      { contentType: 'image/jpeg', upsert: false },
    );
    expect(mocks.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      storage_path: 'user-1/generated-id.jpg',
      status: 'pending',
    });
    expect(mocks.invoke).toHaveBeenCalledWith('validate-body-photo', {
      body: { photoId: 'photo-1' },
    });
  });

  it('keeps a successfully saved photo pending when validation is temporarily unavailable', async () => {
    const mocks = createClient();
    mocks.invoke.mockResolvedValue({ data: null, error: new Error('private provider detail') });
    const repository = createBodyPhotoRepository(mocks.client as never, () => 'generated-id');

    await expect(repository.upload({
      userId: 'user-1',
      asset: {
        uri: 'file:///body.jpg',
        base64: 'YWJjZA==',
        width: 1200,
        height: 1800,
        contentType: 'image/jpeg',
        byteLength: 4,
      },
    })).resolves.toMatchObject({ status: 'pending' });
  });

  it('keeps a successfully saved photo when validation invocation rejects', async () => {
    const mocks = createClient();
    mocks.invoke.mockRejectedValue(new Error('network unavailable'));
    const repository = createBodyPhotoRepository(mocks.client as never, () => 'generated-id');

    await expect(repository.upload({
      userId: 'user-1',
      asset: {
        uri: 'file:///body.jpg',
        base64: 'YWJjZA==',
        width: 1200,
        height: 1800,
        contentType: 'image/jpeg',
        byteLength: 4,
      },
    })).resolves.toMatchObject({ status: 'pending' });
  });

  it('removes the uploaded object when metadata insertion fails', async () => {
    const mocks = createClient();
    const error = new Error('Photo limit reached');
    mocks.single.mockResolvedValue({ data: null, error });
    const repository = createBodyPhotoRepository(mocks.client as never, () => 'generated-id');

    await expect(
      repository.upload({
        userId: 'user-1',
        asset: {
          uri: 'file:///body.jpg',
          base64: 'YWJjZA==',
          width: 1200,
          height: 1800,
          contentType: 'image/jpeg',
          byteLength: 4,
        },
      }),
    ).rejects.toBe(error);
    expect(mocks.remove).toHaveBeenCalledWith(['user-1/generated-id.jpg']);
  });

  it('does not insert metadata when storage upload fails', async () => {
    const mocks = createClient();
    const error = new Error('Upload failed');
    mocks.upload.mockResolvedValue({ error });
    const repository = createBodyPhotoRepository(mocks.client as never, () => 'generated-id');

    await expect(
      repository.upload({
        userId: 'user-1',
        asset: {
          uri: 'file:///body.jpg',
          base64: 'YWJjZA==',
          width: 1200,
          height: 1800,
          contentType: 'image/jpeg',
          byteLength: 4,
        },
      }),
    ).rejects.toBe(error);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('deletes through the authenticated server cleanup boundary', async () => {
    const mocks = createClient();
    const repository = createBodyPhotoRepository(mocks.client as never, () => 'generated-id');

    await expect(repository.remove('photo-1')).resolves.toBeUndefined();
    expect(mocks.invoke).toHaveBeenCalledWith('delete-body-photo', {
      body: { photoId: 'photo-1' },
    });
  });

  it('retries validation through the authenticated validation boundary', async () => {
    const mocks = createClient();
    const repository = createBodyPhotoRepository(mocks.client as never, () => 'generated-id');

    await expect(repository.validate('photo-1')).resolves.toEqual({ state: 'approved' });
    expect(mocks.invoke).toHaveBeenCalledWith('validate-body-photo', {
      body: { photoId: 'photo-1' },
    });
  });

  it('returns safe retry feedback when validation cannot start', async () => {
    const mocks = createClient();
    mocks.invoke.mockResolvedValue({ data: null, error: new Error('provider internals') });
    const repository = createBodyPhotoRepository(mocks.client as never, () => 'generated-id');

    await expect(repository.validate('photo-1')).rejects.toThrow(
      'Could not check that photo. Try again.',
    );
  });

  it('returns a safe retry error when server cleanup fails', async () => {
    const mocks = createClient();
    mocks.invoke.mockResolvedValue({ data: null, error: new Error('service role details') });
    const repository = createBodyPhotoRepository(mocks.client as never, () => 'generated-id');

    await expect(repository.remove('photo-1')).rejects.toThrow('Could not delete that photo. Try again.');
  });

  it('requires Supabase configuration', async () => {
    mockSupabase = null;

    await expect(supabaseBodyPhotoRepository.list('user-1')).rejects.toThrow(
      'Supabase is not configured',
    );
  });
});
