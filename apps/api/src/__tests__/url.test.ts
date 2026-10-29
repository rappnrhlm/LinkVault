import { describe, expect, it } from 'vitest';
import { normalizeUrl, isValidHttpUrl } from '@linkvault/shared';
import { assertSafeUrl, isPublicIp, UnsafeUrlError } from '../lib/net-guard.js';

describe('URL normalization', () => {
  it('keeps query parameters and normalizes the host and default port', () => {
    expect(normalizeUrl('HTTPS://Example.COM:443/Path?b=2&a=1#frag')).toBe(
      'https://example.com/Path?b=2&a=1',
    );
    expect(normalizeUrl('http://example.com:80')).toBe('http://example.com/');
  });

  it('removes only the fragment and keeps meaningful paths', () => {
    expect(normalizeUrl('https://example.com/a/?utm_source=x#top')).toBe(
      'https://example.com/a/?utm_source=x',
    );
    expect(normalizeUrl('https://example.com')).toBe('https://example.com/');
  });

  it('rejects non-http protocols and embedded credentials', () => {
    expect(() => normalizeUrl('file:///etc/passwd')).toThrow();
    expect(() => normalizeUrl('javascript:alert(1)')).toThrow();
    expect(() => normalizeUrl('https://user:pass@example.com')).toThrow();
    expect(isValidHttpUrl('ftp://example.com')).toBe(false);
    expect(isValidHttpUrl('https://example.com')).toBe(true);
  });
});

describe('SSRF guard', () => {
  it('blocks loopback, private, link-local and reserved IPv4', () => {
    for (const ip of [
      '127.0.0.1',
      '127.10.0.2',
      '10.0.0.5',
      '172.16.4.2',
      '192.168.1.1',
      '169.254.169.254',
      '0.0.0.0',
      '100.64.0.1',
      '224.0.0.1',
    ]) {
      expect(isPublicIp(ip), ip).toBe(false);
    }
    expect(isPublicIp('1.1.1.1')).toBe(true);
    expect(isPublicIp('93.184.215.14')).toBe(true);
  });

  it('blocks IPv6 loopback, ULA and link-local, and mapped IPv4', () => {
    for (const ip of ['::1', '::', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', '::ffff:192.168.0.1']) {
      expect(isPublicIp(ip), ip).toBe(false);
    }
    expect(isPublicIp('2606:4700:10::6814:179a')).toBe(true);
  });

  it('rejects local hostnames and reserved URLs', () => {
    expect(() => assertSafeUrl('http://localhost:4317/api/health')).toThrow(UnsafeUrlError);
    expect(() => assertSafeUrl('http://app.localhost/')).toThrow(UnsafeUrlError);
    expect(() => assertSafeUrl('http://printer.local/')).toThrow(UnsafeUrlError);
    expect(() => assertSafeUrl('http://192.168.0.1/')).toThrow(UnsafeUrlError);
    expect(() => assertSafeUrl('file:///etc/passwd')).toThrow(UnsafeUrlError);
    expect(() => assertSafeUrl('https://example.com/page')).not.toThrow();
  });
});
