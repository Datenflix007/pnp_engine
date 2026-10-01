# pnp_engine

Lokale Spielleitungs-Engine für Pen-&-Paper-, Rollenspiel- und Party-Sessions.
Ein zentraler Server verwaltet die Sitzung; Game Master, Spielende und eine
Präsentation verbinden sich später über Browser im lokalen Netzwerk. Das Projekt
ist local first: Für den Spielbetrieb ist kein Internetdienst vorgesehen.

Der aktuelle Stand enthält das TypeScript-Monorepo, gemeinsame Domänen- und
Protokollverträge sowie eine erste Fastify-Vertikalscheibe. Sie liefert eine
Beispiel-Sitzung über HTTP aus. Der Server hat außerdem ein Socket.IO-Gateway
mit serverseitig verwalteten Sitzungsräumen; Lobby, Benutzeroberflächen und die
Authentifizierung folgen schrittweise gemäß [TODO.md](TODO.md).

Für den direkten Start des Servers und die Verbindung eines Geräts im lokalen
Netzwerk steht eine kompakte, standgenaue [QUICKSTART.md](QUICKSTART.md) bereit.
Unter Windows kann dafür auch [quickstart.bat](quickstart.bat) per Doppelklick
gestartet werden.

## Voraussetzungen

- Node.js 22.22.0 oder neuer
- Corepack (bei Node.js enthalten)
- pnpm 10.28.1 oder neuer, über Corepack bereitgestellt

Die verwendete pnpm-Version ist in `package.json` festgeschrieben. Unter
Windows in PowerShell einmalig beziehungsweise nach einer Node-Neuinstallation:

```powershell
corepack enable
```

## Installation

```powershell
pnpm install --frozen-lockfile
```

Wenn die Lockdatei bewusst aktualisiert werden soll, wird stattdessen `pnpm
install` verwendet. Abhängigkeiten werden nicht mit npm oder yarn installiert.

## Prüfen und testen

Der vollständige Projektcheck ist der Standard vor jedem Commit:

```powershell
pnpm run check
```

Er führt Formatprüfung, ESLint, Build, TypeScript-Prüfung und Vitest aus. Die
einzelnen Schritte stehen ebenfalls zur Verfügung:

```powershell
pnpm run format:check
pnpm run lint
pnpm run build
pnpm run typecheck
pnpm run test
```

Zum bewussten Formatieren aller passenden, nicht ignorierten Dateien:

```powershell
pnpm run format
```

## Aktuellen Server starten

Die bisherige Vertikalscheibe wird zunächst gebaut und anschließend gestartet:

```powershell
pnpm run build
pnpm --filter @pnp-engine/server run start
```

Standardmäßig lauscht der Server für das lokale Netzwerk auf `0.0.0.0:3000`.
Auf dem Server selbst lässt sich der Beispielvertrag in einem zweiten
PowerShell-Fenster prüfen:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/hello-session
```

Die Antwort beschreibt die Beispiel-Sitzung „Das Geheimnis von Ravenhill“ mit
Sitzungs-ID, Name, Lobby-Status und Spielerzahl. Beenden mit `Ctrl+C`.

Die persistierten Lobby-Metadaten sind außerdem über zwei rein lesende Routen
abrufbar. Ein Join-Code wird dabei nur zur Suche verwendet und nie in der
Antwort wiederholt:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/sessions/official-demo-ravenhill
Invoke-RestMethod http://127.0.0.1:3000/api/lobbies/RAVEN01
```

Eine Sitzungs-ID besteht aus Kleinbuchstaben, Ziffern und Bindestrichen; ein
Join-Code aus 4 bis 16 Großbuchstaben oder Ziffern. Ungültige Werte erhalten
eine strukturierte `400`-Antwort, unbekannte aber syntaktisch gültige Sitzungen
eine strukturierte `404`-Antwort. Die Endpunkte verändern keinen Lobby-Status;
das folgt erst mit dem autorisierten Game-Master-Zugang.

Die Konfiguration erfolgt pro Prozess über Umgebungsvariablen:

| Variable                   | Standard            | Zweck                                                |
| -------------------------- | ------------------- | ---------------------------------------------------- |
| `PNP_ENGINE_HOST`          | `0.0.0.0`           | Bindeadresse des Servers                             |
| `PNP_ENGINE_PORT`          | `3000`              | TCP-Port von 1 bis 65535                             |
| `PNP_ENGINE_DATA_DIR`      | `data`              | Datenverzeichnis relativ zum Repository oder absolut |
| `PNP_ENGINE_DATABASE_FILE` | `pnp-engine.sqlite` | Dateiname der künftigen SQLite-Datenbank             |

Zum lokalen, nicht im LAN erreichbaren Start etwa:

```powershell
$env:PNP_ENGINE_HOST = '127.0.0.1'
$env:PNP_ENGINE_PORT = '3100'
pnpm --filter @pnp-engine/server run start
```

`pnpm run dev` ist bereits als Workspace-Skript vorhanden, startet aber bis zu
den folgenden Client-Schritten noch keine Entwicklungsoberfläche.

## Lokales Netzwerk

Mit der Standardbindung kann ein Gerät im selben LAN die aktuelle Example-Route
über die IPv4-Adresse des Server-PCs und Port 3000 erreichen, beispielsweise
`http://192.168.178.42:3000/api/hello-session`. Die Firewall muss eingehende
Verbindungen zum gewählten Port zulassen. Keine Internet-Portfreigabe einrichten.

Beim Start wählt der Server automatisch eine private IPv4-Adresse und gibt die
lokale URL aus. Loopback-, virtuelle, Link-Local, öffentliche und ungültige
Adressen werden bewusst nicht als LAN-Ziel gewählt. Falls keine geeignete
Adresse vorhanden ist, zeigt der Server stattdessen die localhost-URL an. Der
QR-Code folgt erst mit der Präsentationsoberfläche. Die aktuelle Route ist nicht
der spätere Spielerbeitritt, sondern nur der technische HTTP-Nachweis.

Nach dieser Umsetzung wird der vorgesehene Ablauf sein:

1. Server auf dem Tower-PC starten.
2. Ermittelten LAN-Link oder QR-Code auf der Präsentation anzeigen.
3. Smartphones im selben WLAN über diesen Link der Sitzung beitreten lassen.

Für Spielgeräte nur dasselbe vertrauenswürdige lokale WLAN verwenden.

## Workspace-Struktur

```text
apps/
  server/       Fastify-Server und HTTP-/Socket-Gateway
packages/
  shared/       frameworkfreie Domänenmodelle und sichere Projektionen
  protocol/     versionierte Nachrichtenhüllen für Echtzeitkommunikation
```

Die Root-Skripte führen Build und Typprüfung rekursiv über alle Workspace-Pakete
aus. Gemeinsame Typen werden als `@pnp-engine/shared`, der Nachrichtenvertrag
als `@pnp-engine/protocol` importiert.

## Lokale Daten und Geheimnisse

Folgende Pfade sind absichtlich nicht versioniert:

- `data/` – SQLite-Datenbanken, Laufzeitstate und Logs
- `assets/`, `uploads/` – lokale Karten, Avatare, Bilder, Audio und Video
- `sessions/`, `backups/`, `*.rpgsession` – Importe, Exporte und Backups
- `.env` – lokale Konfiguration und Zugangsmittel

Beim ersten Serverstart legt pnp_engine standardmäßig `data/pnp-engine.sqlite`
an und führt ausstehende SQLite-Migrationen automatisch aus. Die Datenbank,
ihre WAL-/SHM-Journaldateien und sämtliche alternative Datenpfade sind durch
`.gitignore` geschützt.

Zusätzlich wird einmalig die leere, offizielle Referenzsitzung „Das Geheimnis
von Ravenhill“ (`official-demo-ravenhill`, Join-Code `RAVEN01`) angelegt. Sie
enthält keine Spieler oder privaten Inhalte; eigene Sitzungen und Daten werden
dabei niemals überschrieben.

Keine echten Spielerdaten, Rollenbeschreibungen, Nachrichten, privaten Medien
oder Zugangsmittel committen. Bereinigte, kleine Test-Fixtures gehören später in
einen klar gekennzeichneten Quellpfad, nicht in die Laufzeitordner. Details:
[DATA_HANDLING.md](DATA_HANDLING.md).

## Architektur

Die Architektur ist serverautoritär: Clients senden Befehle, der Server prüft
sie und veröffentlicht nur für die jeweilige Rolle bereinigte Snapshots. Die
Präsentation erhält beispielsweise keine Spielernamen, Rollen oder privaten
Nachrichten. Weitere Entscheidungen stehen in [ARCHITECTURE.md](ARCHITECTURE.md).
