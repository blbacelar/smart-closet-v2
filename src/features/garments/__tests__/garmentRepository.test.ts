let mockSupabase: any;

jest.mock('../../../lib/supabase', () => ({
  get supabase() {
    return mockSupabase;
  },
}));

import { createGarmentRepository, supabaseGarmentRepository } from '../garmentRepository';

const row = {
  id: 'garment-1',
  original_path: 'user-1/original.jpg',
  clean_path: null,
  name: 'Vintage jacket',
  category: 'outerwear',
  color: 'Blue',
  size: 'M',
  season: 'All year',
  status: 'processing',
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
  const createSignedUrl = jest.fn().mockResolvedValue({
    data: { signedUrl: 'https://signed.example/garment-1' },
    error: null,
  });
  const remove = jest.fn().mockResolvedValue({ error: null });
  const bucket = { upload, createSignedUrl, remove };
  const fromBucket = jest.fn(() => bucket);

  return {
    client: { from: fromTable, storage: { from: fromBucket } },
    eq,
    order,
    insert,
    single,
    upload,
    createSignedUrl,
    remove,
  };
}

const asset = {
  uri: 'file:///shirt.jpg',
  base64: 'YWJjZA==',
  width: 1200,
  height: 1600,
  contentType: 'image/jpeg' as const,
  byteLength: 4,
};

const details = {
  name: 'Vintage jacket',
  category: 'outerwear' as const,
  color: 'Blue',
  size: 'M',
  season: 'All year',
};

describe('garmentRepository', () => {
  it('lists owner-scoped garments and signs the best available image', async () => {
    const mocks = createClient();
    const repository = createGarmentRepository(mocks.client as never, () => 'generated-id');

    await expect(repository.list('user-1')).resolves.toEqual([
      {
        id: 'garment-1',
        originalPath: 'user-1/original.jpg',
        cleanPath: null,
        name: 'Vintage jacket',
        category: 'outerwear',
        color: 'Blue',
        size: 'M',
        season: 'All year',
        status: 'processing',
        createdAt: '2026-09-02T20:00:00Z',
        imageUrl: 'https://signed.example/garment-1',
      },
    ]);
    expect(mocks.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(mocks.createSignedUrl).toHaveBeenCalledWith('user-1/original.jpg', 3600);
  });

  it('prefers a processed image when one exists', async () => {
    const mocks = createClient();
    mocks.order.mockResolvedValue({ data: [{ ...row, clean_path: 'user-1/clean.png', status: 'ready' }], error: null });
    const repository = createGarmentRepository(mocks.client as never);

    await repository.list('user-1');

    expect(mocks.createSignedUrl).toHaveBeenCalledWith('user-1/clean.png', 3600);
  });

  it('uploads the original before inserting processing metadata', async () => {
    const mocks = createClient();
    const repository = createGarmentRepository(mocks.client as never, () => 'generated-id');

    await expect(repository.upload({ userId: 'user-1', asset, details })).resolves.toMatchObject({
      id: 'garment-1',
      originalPath: 'user-1/generated-id-original.jpg',
      status: 'processing',
    });
    expect(mocks.upload).toHaveBeenCalledWith(
      'user-1/generated-id-original.jpg',
      expect.any(ArrayBuffer),
      { contentType: 'image/jpeg', upsert: false },
    );
    expect(mocks.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      original_path: 'user-1/generated-id-original.jpg',
      clean_path: null,
      image_hash: null,
      status: 'processing',
      ...details,
    });
  });

  it('removes the original when metadata insertion fails', async () => {
    const mocks = createClient();
    const error = new Error('Garment limit reached');
    mocks.single.mockResolvedValue({ data: null, error });
    const repository = createGarmentRepository(mocks.client as never, () => 'generated-id');

    await expect(repository.upload({ userId: 'user-1', asset, details })).rejects.toBe(error);
    expect(mocks.remove).toHaveBeenCalledWith(['user-1/generated-id-original.jpg']);
  });

  it('does not insert metadata after a storage failure', async () => {
    const mocks = createClient();
    mocks.upload.mockResolvedValue({ error: new Error('Upload failed') });
    const repository = createGarmentRepository(mocks.client as never, () => 'generated-id');

    await expect(repository.upload({ userId: 'user-1', asset, details })).rejects.toThrow('Upload failed');
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('requires Supabase configuration', async () => {
    mockSupabase = null;
    await expect(supabaseGarmentRepository.list('user-1')).rejects.toThrow('Supabase is not configured');
  });
});
