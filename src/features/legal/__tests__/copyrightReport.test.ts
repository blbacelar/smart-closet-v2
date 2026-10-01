import { buildCopyrightReportUrl } from '../copyrightReport';

describe('copyright reporting', () => {
  it('prepares a report with the required notice details', () => {
    const url = buildCopyrightReportUrl('copyright@example.com');
    const decoded = decodeURIComponent(url);

    expect(decoded).toContain('mailto:copyright@example.com');
    expect(decoded).toContain('signature');
    expect(decoded).toContain('listing or material');
    expect(decoded).toContain('good-faith belief');
    expect(decoded).toContain('penalty of perjury');
  });

  it('refuses an invalid reporting address', () => {
    expect(() => buildCopyrightReportUrl('not-an-address')).toThrow(
      'A valid copyright contact is required.',
    );
  });
});
