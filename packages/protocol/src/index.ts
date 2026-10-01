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
