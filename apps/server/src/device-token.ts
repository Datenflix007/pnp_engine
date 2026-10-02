import { createHash, randomBytes } from 'node:crypto';

const DEVICE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Generates a 256-bit, URL-safe device credential for one player browser. */
export function createDeviceToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Only this deterministic hash is allowed to enter SQLite. */
export function hashDeviceToken(deviceToken: string): string {
  return createHash('sha256').update(deviceToken).digest('hex');
}

export function isValidDeviceToken(deviceToken: string): boolean {
  return DEVICE_TOKEN_PATTERN.test(deviceToken);
}
