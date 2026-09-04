import { createObservability } from '../observability';

function adapter() {
  return {
    setUser: jest.fn(),
    track: jest.fn(),
    captureError: jest.fn(),
  };
}

describe('privacy-safe observability', () => {
  it('identifies a member using only the opaque user id', () => {
    const target = adapter();
    const client = createObservability(target);

    client.setUser('user-1');
    client.setUser(null);

    expect(target.setUser).toHaveBeenNthCalledWith(1, { id: 'user-1' });
    expect(target.setUser).toHaveBeenNthCalledWith(2, null);
  });

  it('removes identifiers, image details, URLs, secrets, and non-primitive values from events', () => {
    const target = adapter();
    const client = createObservability(target);

    client.track('tryon_requested', {
      category: 'top',
      count: 2,
      cached: false,
      garmentId: 'garment-1',
      bodyPhotoPath: 'user-1/body.jpg',
      result_url: 'https://private.example/result',
      email: 'member@example.com',
      apiToken: 'secret',
      nested: { provider: 'gemini' },
    });

    expect(target.track).toHaveBeenCalledWith('tryon_requested', {
      category: 'top',
      count: 2,
      cached: false,
    });
  });

  it('captures only a safe error descriptor, never the original message or object', () => {
    const target = adapter();
    const client = createObservability(target);
    const error = new Error('Failed for member@example.com at user-1/body.jpg using secret-token');

    client.captureError(error, {
      operation: 'tryon_enqueue',
      code: 'request_failed',
      fatal: false,
    });

    expect(target.captureError).toHaveBeenCalledWith({
      name: 'Error',
      operation: 'tryon_enqueue',
      code: 'request_failed',
      fatal: false,
    });
    expect(JSON.stringify(target.captureError.mock.calls)).not.toContain('member@example.com');
    expect(JSON.stringify(target.captureError.mock.calls)).not.toContain('body.jpg');
    expect(target.captureError).not.toHaveBeenCalledWith(error);
  });

  it('never lets an unavailable telemetry vendor crash the app', () => {
    const target = adapter();
    target.setUser.mockImplementation(() => {
      throw new Error('vendor unavailable');
    });
    target.track.mockImplementation(() => {
      throw new Error('vendor unavailable');
    });
    target.captureError.mockImplementation(() => {
      throw new Error('vendor unavailable');
    });
    const client = createObservability(target);

    expect(() => client.setUser('user-1')).not.toThrow();
    expect(() => client.track('app_opened', { source: 'launch' })).not.toThrow();
    expect(() => client.captureError(new Error('failure'), {
      operation: 'render',
      code: 'unexpected',
      fatal: true,
    })).not.toThrow();
  });
});
