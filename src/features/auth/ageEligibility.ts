const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export const minimumAccountAge = 18;

export type AgeEligibility =
  | { eligible: true }
  | { eligible: false; reason: 'invalid' | 'underage' };

function parseBirthDate(value: string) {
  const match = isoDatePattern.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function checkAgeEligibility(
  birthDate: string,
  today = new Date(),
): AgeEligibility {
  const parsed = parseBirthDate(birthDate);
  if (!parsed) return { eligible: false, reason: 'invalid' };

  const currentYear = today.getUTCFullYear();
  const currentMonth = today.getUTCMonth() + 1;
  const currentDay = today.getUTCDate();
  let age = currentYear - parsed.year;
  const birthdayHasPassed =
    currentMonth > parsed.month
    || (currentMonth === parsed.month && currentDay >= parsed.day);

  if (!birthdayHasPassed) age -= 1;
  return age >= minimumAccountAge
    ? { eligible: true }
    : { eligible: false, reason: 'underage' };
}

export function ageEligibilityMessage(result: AgeEligibility) {
  if (result.eligible) return '';
  return result.reason === 'invalid'
    ? 'Enter your date of birth as YYYY-MM-DD.'
    : 'Fitly is available only to people aged 18 or older.';
}
