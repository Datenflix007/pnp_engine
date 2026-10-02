import { describe, expect, it } from 'vitest';

import { getPlayerRoute } from '../src/routes.js';

describe('getPlayerRoute', () => {
  it('accepts only a single, syntactically valid invitation code', () => {
    expect(getPlayerRoute('/join/RAVEN01')).toEqual({ kind: 'JOIN', sessionCode: 'RAVEN01' });
    expect(getPlayerRoute('/join/RAVEN01/')).toEqual({ kind: 'JOIN', sessionCode: 'RAVEN01' });
    expect(getPlayerRoute('/join/raven01')).toEqual({ kind: 'INVALID_JOIN_CODE' });
    expect(getPlayerRoute('/join/RAVEN01/extra')).toEqual({ kind: 'INVALID_JOIN_CODE' });
  });

  it('keeps the root route separate and rejects malformed URL encoding', () => {
    expect(getPlayerRoute('/')).toEqual({ kind: 'HOME' });
    expect(getPlayerRoute('/join/%E0%A4%A')).toEqual({ kind: 'INVALID_JOIN_CODE' });
    expect(getPlayerRoute('/not-an-invitation')).toEqual({ kind: 'INVALID_JOIN_CODE' });
  });
});
