import { describe, expect, it } from 'vitest';

import { SHARED_PACKAGE_NAME } from '@pnp-engine/shared';
import type { Session } from '@pnp-engine/shared';

const ravenhillSession = {
  id: 'ravenhill',
  name: 'Das Geheimnis von Ravenhill',
  joinCode: '7HTK9Q',
  lobbyState: 'OPEN',
  players: [
    {
      id: 'player-anna',
      displayName: 'Anna',
      connectionState: 'CONNECTED',
      characterId: 'character-detective',
      roleId: 'role-informant',
    },
  ],
  roles: [
    {
      id: 'role-informant',
      name: 'Informant',
      privateDescription: 'Du arbeitest für die Polizei.',
      objective: 'Finde den gestohlenen Brief.',
      secretHints: ['Das Fenster wurde von innen geöffnet.'],
    },
  ],
  characters: [
    {
      id: 'character-detective',
      name: 'Anna Weber',
      className: 'Detektivin',
      attributes: { observation: 4 },
      abilities: ['Befragen'],
      inventory: [
        {
          id: 'item-notebook',
          name: 'Notizbuch',
          quantity: 1,
        },
      ],
      hitPoints: 10,
      status: [],
      notes: 'Private Ermittlungsnotizen.',
    },
  ],
  maps: [
    {
      id: 'map-mansion',
      name: 'Ravenhill-Anwesen',
      backgroundAssetPath: 'maps/ravenhill-mansion.png',
      width: 1920,
      height: 1080,
      grid: {
        enabled: true,
        cellSize: 48,
        offsetX: 0,
        offsetY: 0,
      },
    },
  ],
  tokens: [
    {
      id: 'token-anna',
      mapId: 'map-mansion',
      kind: 'PLAYER',
      label: 'Anna Weber',
      position: { x: 240, y: 360 },
      ownerPlayerId: 'player-anna',
    },
  ],
  scenes: [
    {
      id: 'scene-arrival',
      name: 'Ankunft',
      mapId: 'map-mansion',
      playerTabs: ['CHARACTER', 'MESSAGES'],
      enabledEventIds: [],
    },
  ],
  messages: [
    {
      id: 'message-1',
      createdAt: '2026-10-01T21:00:00.000Z',
      sender: 'GAME_MASTER',
      recipient: { kind: 'PLAYER', playerId: 'player-anna' },
      text: 'Dir fällt das geöffnete Fenster auf.',
    },
  ],
  activeSceneId: 'scene-arrival',
  presentation: {
    mode: 'LOBBY',
    title: 'Das Geheimnis von Ravenhill',
  },
  flags: { powerOn: true },
  createdAt: '2026-10-01T20:00:00.000Z',
  updatedAt: '2026-10-01T21:00:00.000Z',
} satisfies Session;

describe('@pnp-engine/shared', () => {
  it('exports its public entry point', () => {
    expect(SHARED_PACKAGE_NAME).toBe('@pnp-engine/shared');
  });

  it('describes a complete internal session state', () => {
    expect(ravenhillSession.tokens[0]?.position).toEqual({ x: 240, y: 360 });
    expect(ravenhillSession.presentation.mode).toBe('LOBBY');
  });
});
