import { ageEligibilityMessage, checkAgeEligibility } from '../ageEligibility';

describe('account age eligibility', () => {
  const today = new Date('2026-10-01T12:00:00.000Z');

  it.each(['', '2000-2-01', '2000-02-31', 'not-a-date']) (
    'rejects the invalid date %p',
    (birthDate) => {
      const result = checkAgeEligibility(birthDate, today);
      expect(result).toEqual({ eligible: false, reason: 'invalid' });
      expect(ageEligibilityMessage(result)).toContain('YYYY-MM-DD');
    },
  );

  it('accepts someone on their eighteenth birthday', () => {
    expect(checkAgeEligibility('2008-10-01', today)).toEqual({ eligible: true });
  });

  it('rejects someone whose eighteenth birthday is tomorrow', () => {
    const result = checkAgeEligibility('2008-10-02', today);
    expect(result).toEqual({ eligible: false, reason: 'underage' });
    expect(ageEligibilityMessage(result)).toContain('18 or older');
  });
});
