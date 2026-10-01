import type {
  Character,
  GameMap,
  LobbyState,
  Message,
  Player,
  PlayerId,
  PresentationState,
  Role,
  Scene,
  Session,
  Token,
} from './domain.js';

export interface GameMasterSessionSnapshot {
  readonly audience: 'GAME_MASTER';
  readonly session: Session;
}

export interface VisibleScene {
  readonly id: Scene['id'];
  readonly name: Scene['name'];
  readonly mapId?: Scene['mapId'];
  readonly playerTabs: Scene['playerTabs'];
}

/** A map token stripped of the player identity that owns it. */
export interface VisibleToken {
  readonly id: Token['id'];
  readonly mapId: Token['mapId'];
  readonly kind: Token['kind'];
  readonly assetPath?: Token['assetPath'];
  readonly position: Token['position'];
}

export interface PlayerSessionSnapshot {
  readonly audience: 'PLAYER';
  readonly session: {
    readonly id: Session['id'];
    readonly name: Session['name'];
    readonly lobbyState: LobbyState;
  };
  readonly player: Player;
  readonly character?: Character;
  readonly role?: Role;
  readonly activeScene?: VisibleScene;
  readonly map?: GameMap;
  readonly tokens: readonly VisibleToken[];
  readonly messages: readonly Message[];
  readonly presentation: PresentationState;
}

export interface PresentationSessionSnapshot {
  readonly audience: 'PRESENTATION';
  readonly session: {
    readonly id: Session['id'];
    readonly name: Session['name'];
    readonly lobbyState: LobbyState;
    readonly playerCount: number;
  };
  readonly activeScene?: VisibleScene;
  readonly map?: GameMap;
  readonly tokens: readonly VisibleToken[];
  readonly presentation: PresentationState;
}

export type SessionSnapshot =
  GameMasterSessionSnapshot | PlayerSessionSnapshot | PresentationSessionSnapshot;

export function toGameMasterSessionSnapshot(session: Session): GameMasterSessionSnapshot {
  return { audience: 'GAME_MASTER', session };
}

/**
 * Builds the private snapshot for exactly one player. Other players, their
 * characters, roles and messages are intentionally absent.
 */
export function toPlayerSessionSnapshot(
  session: Session,
  playerId: PlayerId,
): PlayerSessionSnapshot | undefined {
  const player = session.players.find((candidate) => candidate.id === playerId);

  if (player === undefined) {
    return undefined;
  }

  const character =
    player.characterId === undefined
      ? undefined
      : session.characters.find((candidate) => candidate.id === player.characterId);
  const role =
    player.roleId === undefined
      ? undefined
      : session.roles.find((candidate) => candidate.id === player.roleId);
  const activeScene = getActiveScene(session);
  const map = getActiveMap(session, activeScene);

  return {
    audience: 'PLAYER',
    session: {
      id: session.id,
      name: session.name,
      lobbyState: session.lobbyState,
    },
    player,
    ...(character === undefined ? {} : { character }),
    ...(role === undefined ? {} : { role }),
    ...(activeScene === undefined ? {} : { activeScene: toVisibleScene(activeScene) }),
    ...(map === undefined ? {} : { map }),
    tokens: getVisibleTokens(session, map),
    messages: getMessagesForPlayer(session, player),
    presentation: session.presentation,
  };
}

/** Builds a public display snapshot that contains no player-identifying or private data. */
export function toPresentationSessionSnapshot(session: Session): PresentationSessionSnapshot {
  const activeScene = getActiveScene(session);
  const map = getActiveMap(session, activeScene);

  return {
    audience: 'PRESENTATION',
    session: {
      id: session.id,
      name: session.name,
      lobbyState: session.lobbyState,
      playerCount: session.players.filter((player) => player.connectionState !== 'REMOVED').length,
    },
    ...(activeScene === undefined ? {} : { activeScene: toVisibleScene(activeScene) }),
    ...(map === undefined ? {} : { map }),
    tokens: getVisibleTokens(session, map),
    presentation: session.presentation,
  };
}

function getActiveScene(session: Session): Scene | undefined {
  return session.activeSceneId === undefined
    ? undefined
    : session.scenes.find((scene) => scene.id === session.activeSceneId);
}

function getActiveMap(session: Session, activeScene: Scene | undefined): GameMap | undefined {
  return activeScene?.mapId === undefined
    ? undefined
    : session.maps.find((map) => map.id === activeScene.mapId);
}

function getVisibleTokens(session: Session, map: GameMap | undefined): readonly VisibleToken[] {
  if (map === undefined) {
    return [];
  }

  return session.tokens
    .filter((token) => token.mapId === map.id)
    .map((token) => ({
      id: token.id,
      mapId: token.mapId,
      kind: token.kind,
      ...(token.assetPath === undefined ? {} : { assetPath: token.assetPath }),
      position: token.position,
    }));
}

function getMessagesForPlayer(session: Session, player: Player): readonly Message[] {
  return session.messages.filter((message) => {
    switch (message.recipient.kind) {
      case 'ALL':
        return true;
      case 'PLAYER':
        return message.recipient.playerId === player.id;
      case 'ROLE':
        return message.recipient.roleId === player.roleId;
    }
  });
}

function toVisibleScene(scene: Scene): VisibleScene {
  return {
    id: scene.id,
    name: scene.name,
    ...(scene.mapId === undefined ? {} : { mapId: scene.mapId }),
    playerTabs: scene.playerTabs,
  };
}
