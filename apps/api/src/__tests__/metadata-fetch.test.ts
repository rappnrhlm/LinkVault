import { describe, expect, it } from 'vitest';
import { fetchMetadata, UnsafeUrlError } from '../services/metadata.js';

describe('metadata fetching refuses local and reserved destinations', () => {
  for (const url of [
    'http://127.0.0.1:4317/api/health',
    'http://localhost/',
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]/',
    'http://0.0.0.0/',
    'http://10.0.0.1/',
    'http://192.168.1.1/',
    'file:///etc/passwd',
  ]) {
    it(`blocks ${url}`, async () => {
      await expect(fetchMetadata(url)).rejects.toBeInstanceOf(UnsafeUrlError);
    });
  }

  it('blocks a hostname that resolves to a loopback address', async () => {
    await expect(fetchMetadata('http://localtest.me/')).rejects.toBeInstanceOf(UnsafeUrlError);
  });
});
