const SESSION_CODE_PATTERN = /^[A-Z0-9]{4,16}$/;

export type PlayerRoute =
  | { readonly kind: 'HOME' }
  | { readonly kind: 'INVALID_JOIN_CODE' }
  | { readonly kind: 'JOIN'; readonly sessionCode: string };

/** Decodes only the public invitation route; all other paths stay on the start screen. */
export function getPlayerRoute(pathname: string): PlayerRoute {
  const match = /^\/join\/([^/]+)\/?$/.exec(pathname);
  if (match === null) {
    return pathname === '/' ? { kind: 'HOME' } : { kind: 'INVALID_JOIN_CODE' };
  }

  const encodedSessionCode = match[1];
  if (encodedSessionCode === undefined) {
    return { kind: 'INVALID_JOIN_CODE' };
  }

  let sessionCode: string;
  try {
    sessionCode = decodeURIComponent(encodedSessionCode);
  } catch {
    return { kind: 'INVALID_JOIN_CODE' };
  }

  return SESSION_CODE_PATTERN.test(sessionCode)
    ? { kind: 'JOIN', sessionCode }
    : { kind: 'INVALID_JOIN_CODE' };
}
