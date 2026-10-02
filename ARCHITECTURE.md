# pnp_engine – Architekturentscheidung

Stand: 01.10.2026 · Geltungsbereich: MVP 0.1 und seine kompatible Erweiterung

## Zielbild

`pnp_engine` ist eine lokale Webanwendung für eine Sitzung am Spieltisch. Ein
Tower-PC führt den Server und ist die einzige autoritative Quelle des
Spielzustands. Smartphones, das Game-Master-Dashboard und die Präsentationsansicht
sind Browser-Clients im selben LAN. Ein Internetzugang ist nicht erforderlich.

```text
                             lokales LAN
 ┌──────────────────────────────────────────────────────────────────────┐
 │  Player Client(s)        Game Master             Presentation         │
 │  React / Mobile-first    React / Desktop          React / Fullscreen   │
 └──────────┬────────────────────┬────────────────────────┬─────────────┘
            │ HTTP + Socket.IO   │ HTTP + Socket.IO       │ HTTP + Socket.IO
            └────────────────────┴──────────────┬─────────┘
                                                  │
 ┌────────────────────────────────────────────────▼─────────────────────┐
 │                         Fastify Server                                │
 │  HTTP API · Socket.IO Gateway · authorization · SessionStateManager   │
 │                  repositories · migrations · asset serving            │
 └───────────────────────────────────┬──────────────────────────────────┘
                                     SQLite
```

## Verbindliche Technologieentscheidungen

| Bereich       | Entscheidung                         | Zweck                                                   |
| ------------- | ------------------------------------ | ------------------------------------------------------- |
| Laufzeit/Code | Node.js, TypeScript, pnpm Workspaces | Lokale, gemeinsam typisierte Anwendung                  |
| HTTP-Server   | Fastify                              | kleine, schnelle API und Auslieferung der Frontends     |
| Echtzeit      | Socket.IO                            | Reconnect, Räume und bidirektionale Ereignisse im LAN   |
| Persistenz    | SQLite                               | einzelne, lokale Datei ohne externen Dienst             |
| Oberflächen   | React + Vite                         | Player, Game Master und Presentation als getrennte Apps |
| Karte         | Konva                                | späterer Canvas für Karte, Raster und Tokens            |

NestJS, Cloud-Dienste, Benutzerkonten, Internet-Multiplayer und ein festes
Regelsystem sind nicht Teil des MVP.

## Autorität und Datenfluss

Der Server besitzt immer den kanonischen Zustand. Ein Client schickt niemals
einen neuen State, sondern nur ein klar typisiertes Kommando. Der Server prüft
Authentifizierung, Rolle, Eingaben und fachliche Bedingungen, ändert den State,
persistiert die relevante Änderung und publiziert daraus abgeleitete Updates.

```text
Client-Kommando → Server validiert und autorisiert → State ändern
       → persistieren → projektierten Snapshot/Ereignis an berechtigte Clients senden
```

Beispiel Tokenbewegung: Ein Spieler kann die Position nicht direkt setzen. Er
sendet `MOVE_TOKEN` mit Token-ID und Zielkoordinaten. Der Server prüft Besitzer,
aktiven Bewegungsmodus, Karte und zulässige Grenzen. Erst danach wird die
Position gespeichert und als `TOKEN_MOVED` verteilt.

Der aktive Session-State enthält mindestens:

- Sitzung und aktueller Lobby-Status
- verbundene und freigeschaltete Spieler
- aktiver Charakter, Rollenfreigaben und Nachrichten
- aktive Szene, Karte, Tokens und Spielflags
- aktiver Präsentationsmodus und dessen öffentliche Inhalte

SQLite sichert Sitzungsdaten und relevante Änderungen. Der
`SessionStateManager` hält den laufenden, synchronisierten Zustand und ist der
einzige Schreibpfad für Spiellogik. Repositories schreiben nicht an ihm vorbei.
Er lädt die vorhandenen Sitzungs- und Spielerdaten in einen privaten
Laufzeitzustand, verarbeitet ausschließlich typisierte Kommandos und erzeugt
erst danach die rollenabhängigen Snapshots. Ein Kommando wird zuerst persistiert
und anschließend in den Cache übernommen; direkte Mutation von Socket- oder
HTTP-Daten ist nicht vorgesehen.

## Datenprojektionen und Geheimhaltung

Es gibt absichtlich keinen universellen „Session-State für alle Clients“.
Aus dem internen State erzeugt der Server je eine Projektionsform:

| Empfänger    | Darf erhalten                                                                                  | Darf nicht erhalten                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Game Master  | vollständiger Sitzungsstate und Steuerdaten                                                    | Game-Master-Startgeheimnis anderer Verbindungen                                            |
| Spieler      | eigene Identität, eigener Charakter/Rolle, eigene Nachrichten sowie erlaubte öffentliche Karte | Rollen, Charaktere und private Nachrichten anderer Spieler; nicht sichtbare Kartenbereiche |
| Presentation | ausschließlich gemeinsam sichtbare Lobby-, Karten-, Story- oder Nachrichteninformationen       | Spielernamen, private Rollen, Charakterdetails, private Nachrichten und Steuerdaten        |

Diese Reduktion geschieht ausschließlich serverseitig. Ausgeblendete
Bedienelemente sind keine Zugriffskontrolle. Besonders bei Socket-Ereignissen
muss die Zielgruppe vor dem Senden feststehen.

## HTTP und Socket.IO

HTTP wird für abrufbare, idempotente Ressourcen und den ersten Seitenaufbau
verwendet:

- Auslieferung der drei Frontends und lokaler Medien
- Health- und Konfigurationsstatus
- Sitzungsmetadaten für die Join-Seite
- Initiale, bereits bereinigte Client-Snapshots

Socket.IO wird für Zustand, Kommandos und sofort sichtbare Änderungen verwendet:

- Verbindungsaufbau, Lobby-Beitritt und Reconnect
- Client-Kommandos wie `PLAYER_JOIN`, `MOVE_TOKEN` oder `SEND_MESSAGE`
- Bestätigungen und strukturierte Fehler
- serverseitige Ereignisse wie `PLAYER_JOINED`, `TOKEN_MOVED` oder
  `PRESENTATION_CHANGED`
- vollständiger aktueller Snapshot nach erfolgreicher Verbindung und nach
  Reconnect

Alle Socket-Nachrichten verwenden einen gemeinsamen, versionierten Vertrag aus
`packages/protocol`. Ein Kommando besitzt einen Typ, optional eine `requestId`
und einen validierbaren Payload. Der Server antwortet auf ein Kommando entweder
mit einer Bestätigung oder einem maschinenlesbaren Fehlercode; die tatsächliche
Änderung kommt zusätzlich als berechtigtes State-Ereignis oder Snapshot.

## Rollen, Zugang und Verbindungen

Für das MVP bestehen die Serverrollen `PLAYER`, `GAME_MASTER` und
`PRESENTATION`; `ADMIN` bleibt eine spätere Erweiterung. Jeder Socket wird beim
Connect einer Sitzung und einer Rolle zugeordnet und in einen passenden
Socket.IO-Raum aufgenommen.

- Ein temporärer, begrenzter Session-Code leitet Spieler auf `/join/:sessionCode`.
- Nach einem Join erhält das Gerät einen zufälligen, lokalen Reconnect-Nachweis;
  er ist nicht Teil von URLs oder Logs.
- Das Game-Master-Zugangsmittel ist getrennt vom Spieler-Code. Es wird nur über
  einen geschützten Eingabefluss genutzt und nie in Client-Snapshots, URLs oder
  Serverlogs ausgegeben.
- Die Presentation hat keinen Schreibzugriff und kann nur öffentliche Daten
  abonnieren.

Der Socket.IO-Handshake ist ebenfalls strikt nach Rolle getrennt. Ein Spieler
sendet ausschließlich `{ role: 'PLAYER', joinCode }`; der Server akzeptiert nur
einen syntaktisch begrenzten, aktiven Code. Ein Game Master sendet
`{ role: 'GAME_MASTER', sessionId, gameMasterSecret }`; das Geheimnis stammt
allein aus `PNP_ENGINE_GAME_MASTER_SECRET`, bleibt im Prozessspeicher und wird
weder persistiert noch in Antworten, URLs oder Logs übernommen. Die
Präsentation sendet `{ role: 'PRESENTATION', sessionId }`, erhält nur den
öffentlichen Zugang und ist bei jedem künftigen Schreibkommando serverseitig
ausgeschlossen.

Die lokale Nutzung im privaten LAN erlaubt ein leichtgewichtiges Modell, ersetzt
aber keine Serverprüfung jeder Aktion.

## Workspace-Grenzen

```text
apps/
  server/          Fastify, Socket.IO, SQLite, Autorisierung und Assets
  player-client/   mobile Oberfläche für Gäste
  game-master/     Steueroberfläche für die Spielleitung
  presentation/    Vollbildansicht für TV/Beamer
packages/
  shared/          fachliche TypeScript-Typen und projektionstaugliche Modelle
  protocol/        Socket-Kommando- und Ereignisverträge
  session-engine/  später: zentrale Sitzungszustandslogik
  event-engine/    später: deklarative Events
  map-engine/      später: Karten- und Bewegungslogik
data/              ignorierter Laufzeitbestand einschließlich SQLite
assets/            ignorierte, lokale hochgeladene Medien
sessions/          ignorierte, lokale Exporte und Imports
```

`shared` kennt keine Fastify-, Socket.IO-, React- oder SQLite-Details. Der
Server importiert gemeinsame Typen und implementiert deren Validierung. Die
Frontends verwenden ausschließlich Verträge und bereinigte Projektionen, nicht
die Datenbank oder interne Servermodelle.

## Zuverlässigkeit und Wiederverbindung

Ein Client betrachtet den letzten lokalen Zustand nur als Anzeigehilfe. Nach
einer Socket-Wiederverbindung fordert er einen neuen, für seine Rolle
bereinigten Snapshot an. Dadurch überschreibt der Server einen möglicherweise
veralteten Clientzustand. Kommandos werden mit `requestId` nachvollziehbar
bestätigt oder abgelehnt; sie sind nicht automatisch sicher wiederholbar, sofern
der konkrete Befehl das nicht ausdrücklich definiert.

Im MVP wird kein konfliktfreies Offline-Editing angeboten. Bei WLAN-Ausfall
wartet der Client auf die erneute Verbindung, zeigt den Status klar an und
übernimmt danach den Server-Snapshot.

## Netzwerk und Betrieb

Der Server läuft standardmäßig lokal und kann für eine Spielsitzung explizit auf
einer LAN-Adresse bzw. `0.0.0.0` lauschen. Er ermittelt eine nutzbare lokale
IPv4-Adresse für die Public Lobby. Die Join-URL enthält Host, Port und
Session-Code; daraus wird der QR-Code erzeugt. Loopback- und virtuelle Adapter
dürfen nicht stillschweigend als QR-Ziel verwendet werden.

Alle Medien liegen lokal. SQLite speichert Referenzen und Metadaten, nicht große
Mediendateien. Hochgeladene Daten, Datenbanken, Session-Backups und private
Medien werden über `.gitignore` vom Repository getrennt.

## Erweiterungsregeln

MVP-0.2-Funktionen wie Spielerbewegung, Kartenobjekte, Timer und Events werden
als neue serverautorisierte Kommandos, Ereignisse und State-Felder ergänzt. Der
Session Builder, Import/Export, Fog of War und der Story-Editor folgen erst in
MVP 0.3. Jede Erweiterung muss eine Berechtigungsprüfung, eine passende
Datenprojektion, Validierung und mindestens einen automatisierten Test erhalten.
