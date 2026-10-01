const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getCopyrightContact() {
  const value = process.env.EXPO_PUBLIC_COPYRIGHT_EMAIL?.trim() ?? '';
  return emailPattern.test(value) ? value : null;
}

export function buildCopyrightReportUrl(contactEmail: string) {
  if (!emailPattern.test(contactEmail)) {
    throw new Error('A valid copyright contact is required.');
  }

  const subject = encodeURIComponent('Copyright removal request');
  const body = encodeURIComponent([
    'Please include:',
    '1. Your physical or electronic signature.',
    '2. The copyrighted work you believe was infringed.',
    '3. The Fitly listing or material to remove, including its URL or ID.',
    '4. Your address, telephone number, and email address.',
    '5. A statement of your good-faith belief that the use is not authorized.',
    '6. A statement that the notice is accurate and that you are authorized to act for the rights holder, under penalty of perjury.',
  ].join('\n'));

  return `mailto:${contactEmail}?subject=${subject}&body=${body}`;
}
