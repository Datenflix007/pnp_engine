import { describe, expect, it } from 'vitest';

import {
  toGameMasterSessionSnapshot,
  toPlayerSessionSnapshot,
  toPresentationSessionSnapshot,
} from '@pnp-engine/shared';
import type { Character, Session } from '@pnp-engine/shared';

function createCharacter(id: string, name: string): Character {
  return {
    id,
    name,
    attributes: {},
    abilities: [],
    inventory: [],
    hitPoints: 10,
    status: [],
    notes: `${name}s private notes`,
  };
}

const session: Session = {
  id: 'ravenhill',
  name: 'Das Geheimnis von Ravenhill',
  joinCode: '7HTK9Q',
  lobbyState: 'OPEN',
  players: [
    {
      id: 'player-anna',
      displayName: 'Anna',
      connectionState: 'CONNECTED',
      characterId: 'character-anna',
      roleId: 'role-informant',
    },
    {
      id: 'player-ben',
      displayName: 'Ben',
      connectionState: 'CONNECTED',
      characterId: 'character-ben',
      roleId: 'role-cultist',
    },
  ],
  roles: [
    {
      id: 'role-informant',
      name: 'Informant',
      privateDescription: 'Du arbeitest für die Polizei.',
      objective: 'Finde den Brief.',
      secretHints: ['Das Fenster war offen.'],
    },
    {
      id: 'role-cultist',
      name: 'Kultist',
      privateDescription: 'Du dienst dem Kult.',
      objective: 'Verberge das Ritual.',
      secretHints: ['Der Schlüssel liegt im Keller.'],
    },
  ],
  characters: [createCharacter('character-anna', 'Anna'), createCharacter('character-ben', 'Ben')],
  maps: [
    {
      id: 'map-mansion',
      name: 'Anwesen',
      backgroundAssetPath: 'maps/mansion.png',
      width: 1920,
      height: 1080,
      grid: { enabled: true, cellSize: 48, offsetX: 0, offsetY: 0 },
    },
  ],
  tokens: [
    {
      id: 'token-anna',
      mapId: 'map-mansion',
      kind: 'PLAYER',
      label: 'Anna',
      position: { x: 100, y: 100 },
      ownerPlayerId: 'player-anna',
    },
  ],
  scenes: [
    {
      id: 'scene-arrival',
      name: 'Ankunft',
      mapId: 'map-mansion',
      playerTabs: ['CHARACTER', 'MESSAGES'],
      enabledEventIds: ['lights-out'],
    },
  ],
  messages: [
    {
      id: 'message-all',
      createdAt: '2026-10-01T21:00:00.000Z',
      sender: 'GAME_MASTER',
      recipient: { kind: 'ALL' },
      text: 'Die Gäste treffen ein.',
    },
    {
      id: 'message-anna',
      createdAt: '2026-10-01T21:01:00.000Z',
      sender: 'GAME_MASTER',
      recipient: { kind: 'PLAYER', playerId: 'player-anna' },
      text: 'Achte auf das Fenster.',
    },
    {
      id: 'message-informant',
      createdAt: '2026-10-01T21:02:00.000Z',
      sender: 'GAME_MASTER',
      recipient: { kind: 'ROLE', roleId: 'role-informant' },
      text: 'Du erkennst den Polizeicode.',
    },
    {
      id: 'message-ben',
      createdAt: '2026-10-01T21:03:00.000Z',
      sender: 'GAME_MASTER',
      recipient: { kind: 'PLAYER', playerId: 'player-ben' },
      text: 'Verstecke den Schlüssel.',
    },
  ],
  activeSceneId: 'scene-arrival',
  presentation: { mode: 'MAP', mapId: 'map-mansion' },
  flags: { powerOn: true },
  createdAt: '2026-10-01T20:00:00.000Z',
  updatedAt: '2026-10-01T21:00:00.000Z',
};

describe('session snapshots', () => {
  it('only sends a player their own secret data and messages', () => {
    const snapshot = toPlayerSessionSnapshot(session, 'player-anna');

    expect(snapshot).toBeDefined();
    expect(snapshot?.role?.name).toBe('Informant');
    expect(snapshot?.messages.map((message) => message.id)).toEqual([
      'message-all',
      'message-anna',
      'message-informant',
    ]);
    expect(snapshot).not.toHaveProperty('session.joinCode');
    expect(snapshot).not.toHaveProperty('players');
    expect(snapshot).not.toHaveProperty('roles');
    expect(snapshot).not.toHaveProperty('characters');
    expect(snapshot?.tokens[0]).not.toHaveProperty('ownerPlayerId');
  });

  it('keeps player identities, roles and messages out of the presentation snapshot', () => {
    const snapshot = toPresentationSessionSnapshot(session);
    const serialisedSnapshot = JSON.stringify(snapshot);

    expect(snapshot.session.playerCount).toBe(2);
    expect(snapshot).not.toHaveProperty('players');
    expect(serialisedSnapshot).not.toContain('Anna');
    expect(serialisedSnapshot).not.toContain('Informant');
    expect(serialisedSnapshot).not.toContain('Polizeicode');
    expect(serialisedSnapshot).not.toContain('7HTK9Q');
    expect(snapshot.tokens[0]).not.toHaveProperty('ownerPlayerId');
  });

  it('reserves the complete state for the game master', () => {
    const snapshot = toGameMasterSessionSnapshot(session);

    expect(snapshot.session.roles).toHaveLength(2);
    expect(snapshot.session.messages).toHaveLength(4);
    expect(snapshot.session.joinCode).toBe('7HTK9Q');
  });
});
