import { useEffect, useRef, useState } from 'react';

import type { PlayerAdmissionState } from '@pnp-engine/shared';

import { PlayerApiClient, PlayerApiError, type LobbyMetadata } from './lib/api-client.js';
import { createPlayerDeviceTokenStore } from './lib/device-token-store.js';
import { PlayerRealtimeClient, type PlayerConnectionStatus } from './lib/realtime-client.js';
import { getPlayerRoute } from './routes.js';

const featureCards = [
  {
    title: 'Dein Charakter',
    detail: 'Wird sichtbar, sobald die Spielleitung ihn für dich freigibt.',
  },
  {
    title: 'Die Spielwelt',
    detail: 'Karten, Hinweise und Nachrichten bleiben immer bei deiner Sitzung.',
  },
] as const;

/**
 * The initial mobile shell deliberately has no network side effects. Session
 * lookup, joining and reconnecting are added as separate, testable steps.
 */
export function App() {
  const route = getPlayerRoute(window.location.pathname);

  if (route.kind === 'JOIN') {
    return <JoinRoute sessionCode={route.sessionCode} />;
  }

  if (route.kind === 'INVALID_JOIN_CODE') {
    return <JoinProblem title="Dieser Einladungslink ist ungültig." />;
  }

  return (
    <main className="app-shell">
      <section className="welcome-card" aria-labelledby="player-client-title">
        <p className="eyebrow">PNP ENGINE</p>
        <h1 id="player-client-title">Deine Spielrunde beginnt hier.</h1>
        <p className="intro">
          Öffne den Einladungslink der Spielleitung auf diesem Gerät. Dann begleiten wir dich sicher
          durch die Lobby.
        </p>

        <div className="connection-hint" role="status">
          <span className="status-dot" aria-hidden="true" />
          <span>Bereit für eine Einladung</span>
        </div>
      </section>

      <section className="next-step" aria-labelledby="next-step-title">
        <p className="section-label">Nächster Schritt</p>
        <h2 id="next-step-title">Einladungslink öffnen</h2>
        <p>
          Scanne den QR-Code auf dem Bildschirm oder öffne den Link, den du von der Spielleitung
          erhalten hast.
        </p>
        <p className="path-example" aria-label="Beispiel für einen Einladungslink">
          /join/DEIN-CODE
        </p>
      </section>

      <section className="feature-list" aria-label="Was dich erwartet">
        {featureCards.map((feature) => (
          <article className="feature-card" key={feature.title}>
            <h2>{feature.title}</h2>
            <p>{feature.detail}</p>
          </article>
        ))}
      </section>

      <footer>
        <p>PNP ENGINE läuft lokal in deiner Spielrunde.</p>
      </footer>
    </main>
  );
}

function JoinRoute({ sessionCode }: { readonly sessionCode: string }) {
  const [lobby, setLobby] = useState<LobbyMetadata>();
  const [problem, setProblem] = useState<PlayerApiError>();
  const [realtimeClient, setRealtimeClient] = useState<PlayerRealtimeClient>();
  const [connectionStatus, setConnectionStatus] = useState<PlayerConnectionStatus>('DISCONNECTED');
  const [displayName, setDisplayName] = useState('');
  const [admissionState, setAdmissionState] = useState<PlayerAdmissionState>('WAITING');
  const [joinStatus, setJoinStatus] = useState<'READY' | 'JOINING' | 'RESTORING' | 'WAITING'>(
    'READY',
  );
  const [joinProblem, setJoinProblem] = useState<string>();
  const deviceTokenRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    let isCurrent = true;
    const client = new PlayerApiClient({ serverUrl: window.location.origin });
    void client.getLobby(sessionCode).then(
      (nextLobby) => {
        if (isCurrent) {
          setLobby(nextLobby);
        }
      },
      (error: unknown) => {
        if (isCurrent) {
          setProblem(error instanceof PlayerApiError ? error : new PlayerApiError('NETWORK_ERROR'));
        }
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [sessionCode]);

  useEffect(() => {
    if (lobby === undefined || lobby.lobbyState === 'CLOSED') {
      return undefined;
    }

    const deviceTokenStore = createPlayerDeviceTokenStore(window.localStorage);
    deviceTokenRef.current = deviceTokenStore.get(lobby.id);
    const isRestoring = deviceTokenRef.current !== undefined;
    const client = new PlayerRealtimeClient({
      serverUrl: window.location.origin,
      joinCode: sessionCode,
      getDeviceToken: () => deviceTokenRef.current,
    });
    const stopListeningForStatus = client.onStatus((status) => {
      setConnectionStatus(status);
      if (status === 'ERROR') {
        setJoinStatus('READY');
        setJoinProblem(
          isRestoring
            ? 'Die gespeicherte Sitzung konnte nicht wiederhergestellt werden. Bitte tritt erneut bei.'
            : 'Die Verbindung zum Spielserver konnte nicht hergestellt werden.',
        );
      }
    });
    const stopListeningForJoin = client.onJoinAccepted((event) => {
      deviceTokenStore.save(lobby.id, event.payload.deviceToken);
      deviceTokenRef.current = event.payload.deviceToken;
      setDisplayName(event.payload.player.displayName);
      setJoinProblem(undefined);
      setJoinStatus('WAITING');
    });
    const stopListeningForRejection = client.onCommandRejected((event) => {
      setJoinStatus('READY');
      setJoinProblem(getJoinProblem(event.payload.code));
    });
    const stopListeningForSnapshot = client.onSnapshot((snapshot) => {
      if (snapshot.session.id === lobby.id) {
        setDisplayName(snapshot.player.displayName);
        setAdmissionState(snapshot.player.admissionState);
        setJoinProblem(undefined);
        setJoinStatus('WAITING');
      }
    });
    setRealtimeClient(client);
    if (isRestoring) {
      setJoinStatus('RESTORING');
      client.connect();
    }

    return () => {
      stopListeningForStatus();
      stopListeningForJoin();
      stopListeningForRejection();
      stopListeningForSnapshot();
      client.disconnect();
      setRealtimeClient(undefined);
    };
  }, [lobby, sessionCode]);

  if (problem !== undefined) {
    return <JoinProblem title={getProblemTitle(problem)} />;
  }

  if (lobby === undefined) {
    return <JoinLoading />;
  }

  if (lobby.lobbyState === 'CLOSED') {
    return (
      <JoinProblem
        title="Diese Lobby ist geschlossen."
        detail="Bitte frage die Spielleitung nach einem aktuellen Einladungslink."
      />
    );
  }

  return (
    <main className="app-shell">
      <section className="welcome-card" aria-labelledby="lobby-title">
        <p className="eyebrow">Deine Einladung</p>
        <h1 id="lobby-title">{lobby.name}</h1>
        <p className="intro">Die Lobby ist geöffnet und wartet auf dich.</p>
        <div className="connection-hint" role="status">
          <span className="status-dot" aria-hidden="true" />
          <span>{lobby.playerCount} Spielende bereits verbunden</span>
        </div>
      </section>
      <section className="next-step" aria-labelledby="join-next-step-title">
        <p className="section-label">Fast geschafft</p>
        <h2 id="join-next-step-title">Wie möchtest du heißen?</h2>
        {joinStatus === 'WAITING' ? (
          <div className="waiting-state" role="status">
            <span className="status-dot" aria-hidden="true" />
            <div>
              <strong>Willkommen, {displayName}.</strong>
              <p>{getAdmissionText(admissionState)}</p>
            </div>
          </div>
        ) : joinStatus === 'RESTORING' ? (
          <div className="waiting-state" role="status">
            <span className="status-dot" aria-hidden="true" />
            <div>
              <strong>Deine Sitzung wird wiederhergestellt.</strong>
              <p>Bitte halte diese Seite geöffnet.</p>
            </div>
          </div>
        ) : (
          <form
            className="join-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (realtimeClient === undefined || !isDisplayNameValid(displayName)) {
                return;
              }
              setJoinProblem(undefined);
              setJoinStatus('JOINING');
              realtimeClient.join(displayName.trim());
              realtimeClient.connect();
            }}
          >
            <label htmlFor="display-name">Dein Name</label>
            <input
              id="display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              minLength={2}
              maxLength={40}
              autoComplete="name"
              required
              disabled={joinStatus === 'JOINING'}
              aria-invalid={
                displayName.trim().length > 0 && !isDisplayNameValid(displayName) ? 'true' : 'false'
              }
              aria-describedby={
                displayName.trim().length > 0 && !isDisplayNameValid(displayName)
                  ? 'display-name-error'
                  : joinProblem === undefined
                    ? undefined
                    : 'display-name-problem'
              }
              autoFocus
            />
            {displayName.trim().length > 0 && !isDisplayNameValid(displayName) ? (
              <p id="display-name-error" className="form-problem" role="alert">
                Bitte verwende einen Namen mit 2 bis 40 sichtbaren Zeichen.
              </p>
            ) : undefined}
            {joinProblem === undefined ? undefined : (
              <p id="display-name-problem" className="form-problem" role="alert">
                {joinProblem}
              </p>
            )}
            <button
              type="submit"
              disabled={
                realtimeClient === undefined ||
                joinStatus === 'JOINING' ||
                !isDisplayNameValid(displayName)
              }
            >
              {joinStatus === 'JOINING' ? 'Verbinde …' : 'Beitreten'}
            </button>
          </form>
        )}
        <p className="connection-status" aria-live="polite">
          {getConnectionStatusText(connectionStatus)}
        </p>
      </section>
    </main>
  );
}

function JoinLoading() {
  return (
    <main className="app-shell">
      <section className="next-step" aria-live="polite" aria-busy="true">
        <p className="section-label">Einladung wird geprüft</p>
        <h1>Lobby wird geladen …</h1>
        <p>Bitte halte diese Seite geöffnet.</p>
      </section>
    </main>
  );
}

function JoinProblem({ title, detail }: { readonly title: string; readonly detail?: string }) {
  return (
    <main className="app-shell">
      <section className="problem-card" role="alert" aria-labelledby="join-problem-title">
        <p className="section-label">Einladung prüfen</p>
        <h1 id="join-problem-title">{title}</h1>
        <p>
          {detail ?? 'Scanne den QR-Code erneut oder bitte die Spielleitung um einen neuen Link.'}
        </p>
        <a className="secondary-link" href="/">
          Zur Startseite
        </a>
      </section>
    </main>
  );
}

function getProblemTitle(problem: PlayerApiError): string {
  switch (problem.code) {
    case 'NOT_FOUND':
      return 'Diese Sitzung wurde nicht gefunden.';
    case 'NETWORK_ERROR':
      return 'Der Spielserver ist nicht erreichbar.';
    case 'REQUEST_FAILED':
    case 'INVALID_RESPONSE':
      return 'Die Einladung konnte gerade nicht geprüft werden.';
  }
}

function isDisplayNameValid(value: string): boolean {
  const normalized = value.trim().replaceAll(/\s+/g, ' ');
  return normalized.length >= 2 && normalized.length <= 40;
}

function getJoinProblem(code: string): string {
  switch (code) {
    case 'INVALID_PLAYER_NAME':
      return 'Bitte verwende einen Namen mit 2 bis 40 sichtbaren Zeichen.';
    case 'PLAYER_NAME_TAKEN':
      return 'Dieser Name ist in der Sitzung bereits vergeben.';
    case 'PLAYER_ALREADY_JOINED':
      return 'Dieses Gerät ist bereits beigetreten.';
    default:
      return 'Der Beitritt wurde abgewiesen. Bitte versuche es erneut.';
  }
}

function getConnectionStatusText(status: PlayerConnectionStatus): string {
  switch (status) {
    case 'CONNECTED':
      return 'Mit dem Spielserver verbunden.';
    case 'CONNECTING':
      return 'Verbindung wird hergestellt …';
    case 'RECONNECTING':
      return 'Verbindung wird wiederhergestellt …';
    case 'ERROR':
      return 'Verbindung fehlgeschlagen.';
    case 'DISCONNECTED':
      return 'Noch nicht mit dem Spielserver verbunden.';
  }
}

function getAdmissionText(admissionState: PlayerAdmissionState): string {
  return admissionState === 'RELEASED'
    ? 'Du bist von der Spielleitung freigegeben.'
    : 'Du bist verbunden und wartest auf die Freigabe durch die Spielleitung.';
}
