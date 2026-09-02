let mockSupabase: any;

jest.mock('../../../lib/supabase', () => ({
  get supabase() {
    return mockSupabase;
  },
}));

import { createTryOnRepository, supabaseTryOnRepository } from '../tryonRepository';

const row = {
  id: 'job-1',
  body_photo_id: 'body-1',
  garment_id: 'garment-1',
  status: 'done',
  result_path: 'user-1/job-1.jpg',
  provider: 'fashn',
  failure_code: null,
  feedback: null,
  created_at: '2026-09-02T20:00:00Z',
  completed_at: '2026-09-02T20:00:08Z',
};

function createClient() {
  const order = jest.fn().mockResolvedValue({ data: [row], error: null });
  const eq = jest.fn(() => ({ order }));
  const select = jest.fn(() => ({ eq }));
  const from = jest.fn(() => ({ select }));
  const createSignedUrl = jest.fn().mockResolvedValue({
    data: { signedUrl: 'https://signed.example/result' },
    error: null,
  });
  const storageFrom = jest.fn(() => ({ createSignedUrl }));
  const invoke = jest.fn().mockResolvedValue({
    data: { state: 'queued', jobId: 'job-1', status: 'queued', limit: 3, remaining: 2 },
    error: null,
  });
  const rpc = jest.fn().mockResolvedValue({
    data: { tier: 'free', limit: 3, used: 1, remaining: 2 },
    error: null,
  });

  return {
    client: { from, storage: { from: storageFrom }, functions: { invoke }, rpc },
    from,
    eq,
    order,
    createSignedUrl,
    invoke,
    rpc,
  };
}

describe('tryonRepository', () => {
  it('lists only the owner jobs and signs completed private results', async () => {
    const mocks = createClient();
    const repository = createTryOnRepository(mocks.client as never);

    await expect(repository.list('user-1')).resolves.toEqual([
      {
        id: 'job-1',
        bodyPhotoId: 'body-1',
        garmentId: 'garment-1',
        status: 'done',
        resultPath: 'user-1/job-1.jpg',
        resultUrl: 'https://signed.example/result',
        provider: 'fashn',
        failureCode: null,
        feedback: null,
        createdAt: '2026-09-02T20:00:00Z',
        completedAt: '2026-09-02T20:00:08Z',
      },
    ]);
    expect(mocks.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(mocks.createSignedUrl).toHaveBeenCalledWith('user-1/job-1.jpg', 600);
  });

  it('does not create a result URL for an unfinished job', async () => {
    const mocks = createClient();
    mocks.order.mockResolvedValue({
      data: [{ ...row, status: 'running', result_path: null, completed_at: null }],
      error: null,
    });
    const repository = createTryOnRepository(mocks.client as never);

    await expect(repository.list('user-1')).resolves.toEqual([
      expect.objectContaining({ status: 'running', resultPath: null, resultUrl: null }),
    ]);
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
  });

  it('enqueues only trusted input identifiers and never accepts a client cache key', async () => {
    const mocks = createClient();
    const repository = createTryOnRepository(mocks.client as never);

    await expect(repository.enqueue({ bodyPhotoId: 'body-1', garmentId: 'garment-1' })).resolves.toEqual(
      expect.objectContaining({ state: 'queued', jobId: 'job-1', remaining: 2 }),
    );
    expect(mocks.invoke).toHaveBeenCalledWith('tryon-enqueue', {
      body: { bodyPhotoId: 'body-1', garmentId: 'garment-1' },
    });
  });

  it('loads the server-authoritative daily quota', async () => {
    const mocks = createClient();
    const repository = createTryOnRepository(mocks.client as never);

    await expect(repository.quota()).resolves.toEqual({ tier: 'free', limit: 3, used: 1, remaining: 2 });
    expect(mocks.rpc).toHaveBeenCalledWith('get_my_tryon_quota');
  });

  it('turns a typed function response into a safe client error', async () => {
    const mocks = createClient();
    mocks.invoke.mockResolvedValue({
      data: null,
      error: {
        context: {
          json: jest.fn().mockResolvedValue({
            code: 'provider_unavailable',
            message: 'Virtual try-on is not configured yet.',
          }),
        },
      },
    });
    const repository = createTryOnRepository(mocks.client as never);

    await expect(repository.enqueue({ bodyPhotoId: 'body-1', garmentId: 'garment-1' })).rejects.toEqual(
      expect.objectContaining({
        code: 'provider_unavailable',
        message: 'Virtual try-on is not configured yet.',
      }),
    );
  });

  it('requires Supabase configuration', async () => {
    mockSupabase = null;
    await expect(supabaseTryOnRepository.quota()).rejects.toThrow('Supabase is not configured');
  });
});
