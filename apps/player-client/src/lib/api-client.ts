export interface LobbyMetadata {
  readonly id: string;
  readonly name: string;
  readonly lobbyState: 'CLOSED' | 'OPEN';
  readonly playerCount: number;
}

export class PlayerApiError extends Error {
  public constructor(
    readonly code: 'INVALID_RESPONSE' | 'NETWORK_ERROR' | 'NOT_FOUND' | 'REQUEST_FAILED',
  ) {
    super('The player API request could not be completed.');
  }
}

export interface PlayerApiClientOptions {
  readonly serverUrl: string;
  readonly fetch?: typeof fetch;
}

/** Reads only the public lobby metadata that is safe to show before a join. */
export class PlayerApiClient {
  private readonly fetch: typeof fetch;

  public constructor(private readonly options: PlayerApiClientOptions) {
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  public async getLobby(sessionCode: string): Promise<LobbyMetadata> {
    let response: Response;
    try {
      response = await this.fetch(
        new URL(`/api/lobbies/${encodeURIComponent(sessionCode)}`, this.options.serverUrl),
      );
    } catch {
      throw new PlayerApiError('NETWORK_ERROR');
    }

    if (response.status === 404) {
      throw new PlayerApiError('NOT_FOUND');
    }
    if (!response.ok) {
      throw new PlayerApiError('REQUEST_FAILED');
    }

    const body: unknown = await response.json();
    const lobby = getLobbyMetadata(body);
    if (lobby === undefined) {
      throw new PlayerApiError('INVALID_RESPONSE');
    }
    return lobby;
  }
}

function getLobbyMetadata(body: unknown): LobbyMetadata | undefined {
  if (!isRecord(body) || !isRecord(body.session)) {
    return undefined;
  }

  const session = body.session;
  if (
    typeof session.id !== 'string' ||
    typeof session.name !== 'string' ||
    (session.lobbyState !== 'CLOSED' && session.lobbyState !== 'OPEN') ||
    typeof session.playerCount !== 'number' ||
    !Number.isInteger(session.playerCount) ||
    session.playerCount < 0
  ) {
    return undefined;
  }

  return {
    id: session.id,
    name: session.name,
    lobbyState: session.lobbyState,
    playerCount: session.playerCount,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
