/** Identifiers are opaque at runtime so they remain straightforward to persist and serialise. */
export type SessionId = string;
export type PlayerId = string;
export type RoleId = string;
export type CharacterId = string;
export type MapId = string;
export type TokenId = string;
export type SceneId = string;
export type MessageId = string;

/** ISO-8601 timestamp strings are validated at API boundaries. */
export type IsoTimestamp = string;

/** A local, server-managed reference to an uploaded or bundled asset. */
export type AssetPath = string;

export type ClientRole = 'PLAYER' | 'GAME_MASTER' | 'PRESENTATION' | 'ADMIN';

export type LobbyState = 'CLOSED' | 'OPEN';

export type PlayerConnectionState = 'OFFLINE' | 'CONNECTED' | 'REMOVED';

export interface Player {
  readonly id: PlayerId;
  readonly displayName: string;
  readonly connectionState: PlayerConnectionState;
  readonly characterId?: CharacterId;
  readonly roleId?: RoleId;
}

/** A private briefing that can be assigned independently of a character. */
export interface Role {
  readonly id: RoleId;
  readonly name: string;
  readonly privateDescription: string;
  readonly objective: string;
  readonly secretHints: readonly string[];
}

export interface InventoryItem {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly quantity: number;
}

export interface Character {
  readonly id: CharacterId;
  readonly name: string;
  readonly className?: string;
  readonly profession?: string;
  readonly avatarAssetPath?: AssetPath;
  readonly age?: number;
  readonly attributes: Readonly<Record<string, number>>;
  readonly abilities: readonly string[];
  readonly inventory: readonly InventoryItem[];
  readonly hitPoints: number;
  readonly status: readonly string[];
  readonly notes: string;
}

export interface MapGrid {
  readonly enabled: boolean;
  readonly cellSize: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

export interface GameMap {
  readonly id: MapId;
  readonly name: string;
  readonly backgroundAssetPath: AssetPath;
  readonly width: number;
  readonly height: number;
  readonly grid: MapGrid;
}

export type TokenKind = 'PLAYER' | 'NPC' | 'OBJECT';

export interface TokenPosition {
  readonly x: number;
  readonly y: number;
}

export interface Token {
  readonly id: TokenId;
  readonly mapId: MapId;
  readonly kind: TokenKind;
  readonly label: string;
  readonly assetPath?: AssetPath;
  readonly position: TokenPosition;
  readonly ownerPlayerId?: PlayerId;
}

export type PlayerTab = 'CHARACTER' | 'MAP' | 'INVENTORY' | 'MESSAGES' | 'OBJECTIVES';

export interface Scene {
  readonly id: SceneId;
  readonly name: string;
  readonly mapId?: MapId;
  readonly playerTabs: readonly PlayerTab[];
  readonly enabledEventIds: readonly string[];
}

export type MessageRecipient =
  | { readonly kind: 'ALL' }
  | { readonly kind: 'PLAYER'; readonly playerId: PlayerId }
  | { readonly kind: 'ROLE'; readonly roleId: RoleId };

export interface Message {
  readonly id: MessageId;
  readonly createdAt: IsoTimestamp;
  readonly sender: ClientRole;
  readonly recipient: MessageRecipient;
  readonly text: string;
}

export type PresentationMode =
  | 'LOBBY'
  | 'MAP'
  | 'STORY'
  | 'EVENT'
  | 'IMAGE'
  | 'MESSAGE'
  | 'TIMER'
  | 'VIDEO'
  | 'BLACK'
  | 'CUSTOM';

export interface PresentationTimer {
  readonly startedAt: IsoTimestamp;
  readonly durationSeconds: number;
}

export interface PresentationState {
  readonly mode: PresentationMode;
  readonly title?: string;
  readonly body?: string;
  readonly mapId?: MapId;
  readonly mediaAssetPath?: AssetPath;
  readonly timer?: PresentationTimer;
}

export type SessionFlagValue = boolean | number | string;

/**
 * The complete internal state of a prepared or running session.
 *
 * This model may contain private player data. It must therefore only be handed
 * to the game-master projection; player and presentation snapshots are defined
 * separately.
 */
export interface Session {
  readonly id: SessionId;
  readonly name: string;
  readonly joinCode: string;
  readonly lobbyState: LobbyState;
  readonly players: readonly Player[];
  readonly roles: readonly Role[];
  readonly characters: readonly Character[];
  readonly maps: readonly GameMap[];
  readonly tokens: readonly Token[];
  readonly scenes: readonly Scene[];
  readonly messages: readonly Message[];
  readonly activeSceneId?: SceneId;
  readonly presentation: PresentationState;
  readonly flags: Readonly<Record<string, SessionFlagValue>>;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}
