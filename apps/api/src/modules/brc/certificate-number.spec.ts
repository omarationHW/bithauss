import {
  CERTIFICATE_NUMBER_PATTERN,
  certificateNumberPrefix,
  formatCertificateNumber,
  nextCertificateNumber,
} from './certificate-number';

describe('nextCertificateNumber', () => {
  it('starts the year at 000001', () => {
    expect(nextCertificateNumber([], 2026)).toBe('BRC-2026-000001');
  });

  it('continues after the highest issued folio, not after the last one seen', () => {
    expect(
      nextCertificateNumber(
        ['BRC-2026-000001', 'BRC-2026-000007', 'BRC-2026-000003'],
        2026,
      ),
    ).toBe('BRC-2026-000008');
  });

  it('never reuses a number, which is what Math.random() in the browser could', () => {
    const issued = ['BRC-2026-000001', 'BRC-2026-000002'];
    const next = nextCertificateNumber(issued, 2026);
    expect(issued).not.toContain(next);
  });

  it('restarts on a new year and ignores other years', () => {
    expect(nextCertificateNumber(['BRC-2025-000999'], 2026)).toBe('BRC-2026-000001');
  });

  it('ignores malformed, empty and nullish rows', () => {
    expect(
      nextCertificateNumber(
        ['BRC-2026-12', 'brc-2026-000009', '', null, undefined, 'BRC-2026-000002'],
        2026,
      ),
    ).toBe('BRC-2026-000003');
  });

  it('produces a folio that matches the platform-wide pattern', () => {
    expect(CERTIFICATE_NUMBER_PATTERN.test(nextCertificateNumber([], 2026))).toBe(true);
  });

  it('pads to six digits and prefixes by year', () => {
    expect(formatCertificateNumber(2026, 42)).toBe('BRC-2026-000042');
    expect(certificateNumberPrefix(2026)).toBe('BRC-2026-');
  });
});
