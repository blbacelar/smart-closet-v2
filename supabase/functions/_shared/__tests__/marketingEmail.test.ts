import { buildMarketingEmail } from '../marketingEmail';

const validInput = {
  subject: 'A wardrobe update',
  textBody: 'New looks are available.',
  htmlBody: '<p>New looks are available.</p>',
  senderName: 'Fitly',
  mailingAddress: '123 Example Street, Vancouver, BC',
  unsubscribeUrl: 'https://example.com/unsubscribe/token',
  hasMarketingConsent: true,
};

describe('marketing email compliance boundary', () => {
  it('adds sender identity, mailing address, and unsubscribe instructions', () => {
    const result = buildMarketingEmail(validInput);

    expect(result.text).toContain('Sent by Fitly');
    expect(result.text).toContain(validInput.mailingAddress);
    expect(result.text).toContain(`Unsubscribe: ${validInput.unsubscribeUrl}`);
    expect(result.html).toContain('>Unsubscribe</a>');
  });

  it.each([
    ['recipient consent', { hasMarketingConsent: false }],
    ['sender identity', { senderName: ' ' }],
    ['mailing address', { mailingAddress: '' }],
    ['HTTPS unsubscribe URL', { unsubscribeUrl: 'http://example.com/unsubscribe' }],
  ])('refuses delivery without %s', (_requirement, override) => {
    expect(() => buildMarketingEmail({ ...validInput, ...override })).toThrow();
  });

  it('escapes organization fields in the HTML footer', () => {
    const result = buildMarketingEmail({
      ...validInput,
      senderName: '<Fitly & Co>',
      mailingAddress: 'Suite "A"',
    });

    expect(result.html).toContain('&lt;Fitly &amp; Co&gt;');
    expect(result.html).toContain('Suite &quot;A&quot;');
  });
});
