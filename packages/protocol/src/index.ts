/** The first stable revision of the Socket.IO message envelope. */
export const PROTOCOL_VERSION = 1 as const;

export type ProtocolVersion = typeof PROTOCOL_VERSION;

/**
 * A role-neutral, versioned message envelope.
 *
 * The concrete command or event name is carried by `type`. `payload` remains
 * generic so the package can describe both client commands and server events
 * without importing application-specific state. A `requestId` belongs to a
 * client request and lets clients correlate an acknowledgement or error.
 */
export interface ProtocolMessage<TType extends string = string, TPayload = unknown> {
  readonly protocolVersion: ProtocolVersion;
  readonly type: TType;
  readonly requestId?: string;
  readonly payload: TPayload;
}

export interface ProtocolMessageInput<TType extends string, TPayload> {
  readonly type: TType;
  readonly requestId?: string;
  readonly payload: TPayload;
}

/**
 * Creates a protocol-v1 envelope and omits an absent `requestId` instead of
 * serialising it as `undefined`.
 */
export function createProtocolMessage<TType extends string, TPayload>(
  input: ProtocolMessageInput<TType, TPayload>,
): ProtocolMessage<TType, TPayload> {
  if (input.requestId === undefined) {
    return {
      protocolVersion: PROTOCOL_VERSION,
      type: input.type,
      payload: input.payload,
    };
  }

  return {
    protocolVersion: PROTOCOL_VERSION,
    type: input.type,
    requestId: input.requestId,
    payload: input.payload,
  };
}

/** Socket.IO transport event names for protocol-v1 envelopes. */
export const SOCKET_COMMAND_EVENT = 'COMMAND' as const;
export const SOCKET_EVENT = 'EVENT' as const;

export interface PlayerJoinPayload {
  readonly displayName: string;
}

export interface PlayerJoinedPayload {
  readonly player: {
    readonly id: string;
    readonly displayName: string;
    readonly connectionState: 'OFFLINE' | 'CONNECTED' | 'REMOVED';
  };
}

export interface PlayerJoinAcceptedPayload extends PlayerJoinedPayload {
  /** Delivered only to the joining browser; never broadcast or persisted in plaintext. */
  readonly deviceToken: string;
}

export interface CommandAcceptedPayload {
  readonly commandType: string;
}

export type CommandRejectionCode =
  | 'COMMAND_NOT_SUPPORTED'
  | 'INTERNAL_ERROR'
  | 'INVALID_COMMAND'
  | 'INVALID_PLAYER_NAME'
  | 'PLAYER_ALREADY_JOINED'
  | 'PLAYER_NAME_TAKEN'
  | 'READ_ONLY_ROLE';

export interface CommandRejectedPayload {
  readonly commandType?: string;
  readonly code: CommandRejectionCode;
}

export type PlayerJoinCommand = ProtocolMessage<'PLAYER_JOIN', PlayerJoinPayload>;
export type PlayerJoinedEvent = ProtocolMessage<'PLAYER_JOINED', PlayerJoinedPayload>;
export type PlayerJoinAcceptedEvent = ProtocolMessage<
  'PLAYER_JOIN_ACCEPTED',
  PlayerJoinAcceptedPayload
>;
export type PlayerReconnectedEvent = ProtocolMessage<'PLAYER_RECONNECTED', PlayerJoinedPayload>;
export type CommandAcceptedEvent = ProtocolMessage<'COMMAND_ACCEPTED', CommandAcceptedPayload>;
export type CommandRejectedEvent = ProtocolMessage<'COMMAND_REJECTED', CommandRejectedPayload>;
