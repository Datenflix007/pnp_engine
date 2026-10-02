import { describe, expect, it } from 'vitest';

import { createPlayerDeviceTokenStore } from '../src/lib/device-token-store.js';

describe('player device token store', () => {
  it('restores a valid token only for its original session', () => {
    const storage = new FakeStorage();
    const store = createPlayerDeviceTokenStore(storage);
    const token = 'a'.repeat(43);

    store.save('ravenhill', token);

    expect(store.get('ravenhill')).toBe(token);
    expect(store.get('another-session')).toBeUndefined();
    expect(storage.values()).not.toContain('ravenhill:' + token);
  });

  it('ignores malformed storage data and unusable tokens', () => {
    const storage = new FakeStorage();
    storage.setItem('pnp-engine.player-device-tokens.v1', '{invalid-json');
    const store = createPlayerDeviceTokenStore(storage);

    expect(store.get('ravenhill')).toBeUndefined();
    store.save('ravenhill', 'not-a-device-token');
    expect(store.get('ravenhill')).toBeUndefined();
  });
});

class FakeStorage implements Storage {
  private readonly records = new Map<string, string>();

  public get length(): number {
    return this.records.size;
  }

  public clear(): void {
    this.records.clear();
  }

  public getItem(key: string): string | null {
    return this.records.get(key) ?? null;
  }

  public key(index: number): string | null {
    return [...this.records.keys()][index] ?? null;
  }

  public removeItem(key: string): void {
    this.records.delete(key);
  }

  public setItem(key: string, value: string): void {
    this.records.set(key, value);
  }

  public values(): string {
    return JSON.stringify(Object.fromEntries(this.records));
  }
}
