import { createProfileRepository } from '../profileRepository';

function createClient() {
  const single = jest.fn().mockResolvedValue({
    data: { onboarding_completed_at: null },
    error: null,
  });
  const eqSelect = jest.fn(() => ({ single }));
  const select = jest.fn(() => ({ eq: eqSelect }));
  const eqUpdate = jest.fn().mockResolvedValue({ error: null });
  const update = jest.fn(() => ({ eq: eqUpdate }));
  const from = jest.fn(() => ({ select, update }));

  return { client: { from }, from, select, eqSelect, single, update, eqUpdate };
}

describe('profileRepository', () => {
  it('loads the current member onboarding state', async () => {
    const mocks = createClient();
    const repository = createProfileRepository(mocks.client as never);

    await expect(repository.getOnboardingStatus('user-1')).resolves.toEqual({
      completed: false,
    });
    expect(mocks.from).toHaveBeenCalledWith('profiles');
    expect(mocks.select).toHaveBeenCalledWith('onboarding_completed_at');
    expect(mocks.eqSelect).toHaveBeenCalledWith('id', 'user-1');
  });

  it('persists onboarding completion only for the current profile', async () => {
    const mocks = createClient();
    const repository = createProfileRepository(mocks.client as never);

    await repository.completeOnboarding('user-1');

    expect(mocks.update).toHaveBeenCalledWith({
      onboarding_completed_at: expect.any(String),
    });
    expect(mocks.eqUpdate).toHaveBeenCalledWith('id', 'user-1');
  });
});
