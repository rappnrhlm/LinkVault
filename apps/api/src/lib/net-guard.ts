import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export class UnsafeUrlError extends Error {}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = (value << 8) + octet;
  }
  return value >>> 0;
}

function inV4Range(value: number, base: string, bits: number): boolean {
  const baseInt = ipv4ToInt(base);
  if (baseInt === null) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (value & mask) === (baseInt & mask);
}

function expandV6(ip: string): number[] | null {
  const [head, tail] = ip.split('::');
  if (ip.split('::').length > 2) return null;
  const parse = (part: string) => (part ? part.split(':').filter(Boolean) : []);
  const headParts = parse(head ?? '');
  const tailParts = parse(tail ?? '');
  const missing = 8 - headParts.length - tailParts.length;
  if (missing < 0) return null;
  const groups = [...headParts, ...Array(ip.includes('::') ? missing : 0).fill('0'), ...tailParts];
  if (groups.length !== 8) return null;
  const values: number[] = [];
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(group)) return null;
    values.push(parseInt(group, 16));
  }
  return values;
}

export function isPublicIp(ip: string): boolean {
  const clean = ip.trim().replace(/^\[|\]$/g, '').toLowerCase();
  const family = isIP(clean);
  if (family === 4) {
    const value = ipv4ToInt(clean);
    if (value === null) return false;
    const blocked = [
      ['0.0.0.0', 8],
      ['10.0.0.0', 8],
      ['100.64.0.0', 10],
      ['127.0.0.0', 8],
      ['169.254.0.0', 16],
      ['172.16.0.0', 12],
      ['192.0.0.0', 24],
      ['192.0.2.0', 24],
      ['192.168.0.0', 16],
      ['198.18.0.0', 15],
      ['198.51.100.0', 24],
      ['203.0.113.0', 24],
      ['224.0.0.0', 4],
      ['240.0.0.0', 4],
    ] as const;
    return !blocked.some(([base, bits]) => inV4Range(value, base, bits));
  }
  if (family === 6) {
    const mapped = clean.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPublicIp(mapped[1]!);
    const groups = expandV6(clean);
    if (!groups) return false;
    if (groups.every((group) => group === 0)) return false;
    if (groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1) return false;
    if ((groups[0]! & 0xffc0) === 0xfe80) return false;
    if ((groups[0]! & 0xfe00) === 0xfc00) return false;
    if ((groups[0]! & 0xff00) === 0xff00) return false;
    if (groups[0] === 0x2001 && groups[1] === 0x0db8) return false;
    if (groups[0] === 0x0064 && groups[1] === 0xff9b) return false;
    return true;
  }
  return false;
}

export function assertSafeUrl(input: string | URL): URL {
  let url: URL;
  try {
    url = input instanceof URL ? input : new URL(input);
  } catch {
    throw new UnsafeUrlError('That is not a valid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError('Only http and https URLs are supported');
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError('URLs with embedded credentials are not allowed');
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new UnsafeUrlError('Local and internal hostnames are not allowed');
  }
  if (isIP(host) && !isPublicIp(host)) {
    throw new UnsafeUrlError('Private and reserved addresses are not allowed');
  }
  return url;
}

export async function assertResolvesPublic(hostname: string): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) {
    if (!isPublicIp(host)) throw new UnsafeUrlError('Private and reserved addresses are not allowed');
    return;
  }
  let addresses: { address: string; family: number }[];
  try {
    addresses = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new UnsafeUrlError('Could not resolve that hostname');
  }
  if (addresses.length === 0) throw new UnsafeUrlError('Could not resolve that hostname');
  if (addresses.some((entry) => !isPublicIp(entry.address))) {
    throw new UnsafeUrlError('That hostname resolves to a private or reserved address');
  }
}

export async function guardedLookup(
  hostname: string,
  options: { family?: number; all?: boolean },
  callback: (error: Error | null, address?: unknown, family?: number) => void,
): Promise<void> {
  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    const safe = addresses.filter((entry) => isPublicIp(entry.address));
    if (safe.length === 0) {
      callback(new UnsafeUrlError('Private and reserved addresses are not allowed'));
      return;
    }
    if (options.all) {
      callback(null, safe);
      return;
    }
    const chosen = options.family
      ? safe.find((entry) => entry.family === options.family) ?? safe[0]!
      : safe[0]!;
    callback(null, chosen.address, chosen.family);
  } catch (error) {
    callback(error instanceof Error ? error : new Error('DNS lookup failed'));
  }
}
