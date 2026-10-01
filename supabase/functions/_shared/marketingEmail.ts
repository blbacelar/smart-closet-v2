export type MarketingEmailInput = {
  subject: string;
  textBody: string;
  htmlBody: string;
  senderName: string;
  mailingAddress: string;
  unsubscribeUrl: string;
  hasMarketingConsent: boolean;
};

export type MarketingEmail = {
  subject: string;
  text: string;
  html: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function required(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Marketing email requires ${field}.`);
  return normalized;
}

function requireUnsubscribeUrl(value: string) {
  const normalized = required(value, 'an unsubscribe URL');
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error('Marketing email requires a valid HTTPS unsubscribe URL.');
  }
  if (url.protocol !== 'https:') {
    throw new Error('Marketing email requires a valid HTTPS unsubscribe URL.');
  }
  return url.toString();
}

export function buildMarketingEmail(input: MarketingEmailInput): MarketingEmail {
  if (!input.hasMarketingConsent) {
    throw new Error('Marketing email requires recorded recipient consent.');
  }

  const subject = required(input.subject, 'a subject');
  const senderName = required(input.senderName, 'sender identification');
  const mailingAddress = required(input.mailingAddress, 'a valid mailing address');
  const unsubscribeUrl = requireUnsubscribeUrl(input.unsubscribeUrl);
  const textBody = required(input.textBody, 'a text body');
  const htmlBody = required(input.htmlBody, 'an HTML body');

  return {
    subject,
    text: `${textBody}\n\nSent by ${senderName}\n${mailingAddress}\nUnsubscribe: ${unsubscribeUrl}`,
    html: `${htmlBody}<hr><p>Sent by ${escapeHtml(senderName)}<br>${escapeHtml(mailingAddress)}</p><p><a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe</a></p>`,
  };
}
