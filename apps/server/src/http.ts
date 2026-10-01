export interface HealthResponse {
  readonly status: 'ok';
}

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'INVALID_JOIN_CODE'
  | 'INVALID_SESSION_ID'
  | 'NOT_FOUND'
  | 'SESSION_NOT_FOUND'
  | 'INTERNAL_SERVER_ERROR';

export interface ApiErrorResponse {
  readonly error: {
    readonly code: ApiErrorCode;
    readonly message: string;
  };
}

export const HEALTH_RESPONSE = { status: 'ok' } as const satisfies HealthResponse;

export interface SessionMetadataResponse {
  readonly session: {
    readonly id: string;
    readonly name: string;
    readonly lobbyState: 'CLOSED' | 'OPEN';
    readonly playerCount: number;
  };
}

export const INVALID_JOIN_CODE_RESPONSE = {
  error: {
    code: 'INVALID_JOIN_CODE',
    message: 'Invalid join code.',
  },
} as const satisfies ApiErrorResponse;

export const INVALID_SESSION_ID_RESPONSE = {
  error: {
    code: 'INVALID_SESSION_ID',
    message: 'Invalid session ID.',
  },
} as const satisfies ApiErrorResponse;

export const SESSION_NOT_FOUND_RESPONSE = {
  error: {
    code: 'SESSION_NOT_FOUND',
    message: 'Session not found.',
  },
} as const satisfies ApiErrorResponse;

export function createErrorResponse(statusCode: number): ApiErrorResponse {
  if (statusCode === 404) {
    return {
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found.',
      },
    };
  }

  if (statusCode >= 400 && statusCode < 500) {
    return {
      error: {
        code: 'BAD_REQUEST',
        message: 'Invalid request.',
      },
    };
  }

  return {
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error.',
    },
  };
}
