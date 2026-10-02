const STORAGE_KEY = 'pnp-engine.player-device-tokens.v1';
const DEVICE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface PlayerDeviceTokenStore {
  get(sessionId: string): string | undefined;
  save(sessionId: string, deviceToken: string): void;
}

/**
 * Keeps opaque reconnect tokens only in this browser's local storage. The
 * session ID prevents a token from one game being offered for another lobby.
 */
export function createPlayerDeviceTokenStore(storage: Storage | undefined): PlayerDeviceTokenStore {
  return {
    get(sessionId) {
      const records = readRecords(storage);
      const deviceToken = records[sessionId];
      return typeof deviceToken === 'string' && DEVICE_TOKEN_PATTERN.test(deviceToken)
        ? deviceToken
        : undefined;
    },
    save(sessionId, deviceToken) {
      if (!DEVICE_TOKEN_PATTERN.test(deviceToken)) {
        return;
      }
      const records = readRecords(storage);
      records[sessionId] = deviceToken;
      try {
        storage?.setItem(STORAGE_KEY, JSON.stringify(records));
      } catch {
        // Privacy settings may deny local storage; reconnect remains unavailable in that browser.
      }
    },
  };
}

function readRecords(storage: Storage | undefined): Record<string, string> {
  try {
    const rawRecords = storage?.getItem(STORAGE_KEY);
    if (rawRecords === null || rawRecords === undefined) {
      return {};
    }
    const records: unknown = JSON.parse(rawRecords);
    return isStringRecord(records) ? records : {};
  } catch {
    return {};
  }
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === 'string')
  );
}
