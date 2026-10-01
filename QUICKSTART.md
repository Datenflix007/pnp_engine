# Quickstart: Server und Geräte verbinden

Dieser Quickstart beschreibt den tatsächlich verfügbaren Stand nach Schritt
3.01. Der lokale Server, die SQLite-Datenbank, öffentliche Lobby-Metadaten und
die Socket.IO-Transportbasis funktionieren. Eine Game-Master-, Spieler- oder
Präsentations-Browseranwendung gibt es **noch nicht**; sie folgt erst in den
Client-Schritten des Umsetzungsplans.

## 1. Server starten

Vorausgesetzt werden Node.js 22.22.0 oder neuer, Corepack und pnpm. Einmalig im
Repository ausführen:

```powershell
corepack enable
pnpm install --frozen-lockfile
```

Unter Windows startet [quickstart.bat](quickstart.bat) den Server auch direkt
per Doppelklick. Das Skript installiert fehlende Workspace-Abhängigkeiten,
baut das Projekt und startet den Server standardmäßig auf `0.0.0.0:3000`.
Ein offenes Konsolenfenster zeigt anschließend die LAN-Adresse; mit `Ctrl+C`
wird der Server beendet.

Für einen lokalen Probelauf in einem PowerShell-Fenster:

```powershell
$env:PNP_ENGINE_HOST = '127.0.0.1'
$env:PNP_ENGINE_PORT = '3100'
pnpm run build
pnpm --filter @pnp-engine/server run start
```

Der Start legt bei Bedarf `data/pnp-engine.sqlite` an, führt die Migrationen aus
und erzeugt die leere Demo-Sitzung „Das Geheimnis von Ravenhill“ genau einmal.
Beenden mit `Ctrl+C`.

## 2. Server vom selben PC prüfen

In einem zweiten PowerShell-Fenster:

```powershell
Invoke-RestMethod http://127.0.0.1:3100/health
Invoke-RestMethod http://127.0.0.1:3100/api/sessions/official-demo-ravenhill
Invoke-RestMethod http://127.0.0.1:3100/api/lobbies/RAVEN01
```

Die beiden Lobby-Routen liefern öffentliche Metadaten, den Status (`CLOSED` oder
`OPEN`) und die Spielerzahl. Der Join-Code `RAVEN01` dient nur zur Suche und
wird nicht zurückgegeben.

## 3. Für Geräte im lokalen Netzwerk starten

Den Server auf dem Host-PC an eine LAN-Schnittstelle binden, beispielsweise an
Port 3000:

```powershell
Remove-Item Env:PNP_ENGINE_HOST -ErrorAction SilentlyContinue
Remove-Item Env:PNP_ENGINE_PORT -ErrorAction SilentlyContinue
pnpm --filter @pnp-engine/server run start
```

Der Server verwendet dann standardmäßig `0.0.0.0:3000` und gibt beim Start eine
erkannte private IPv4-Adresse aus, zum Beispiel `http://192.168.178.42:3000`.
Auf einem Smartphone oder zweiten Rechner im **gleichen vertrauenswürdigen
WLAN** lässt sich die bestehende HTTP-Schnittstelle so prüfen:

```text
http://192.168.178.42:3000/api/lobbies/RAVEN01
```

Ersetze die Beispieladresse durch die beim Start ausgegebene Adresse. Falls der
Abruf nicht funktioniert, Windows Defender Firewall für Node.js beziehungsweise
den verwendeten TCP-Port nur im privaten Netzwerk freigeben. Keine
Internet-Portfreigabe einrichten.

## 4. Was der Client derzeit kann und noch nicht kann

Socket.IO ist mit dem Server verbunden und verwaltet Sitzungsräume auf dem
Server. Noch gibt es aber absichtlich keinen öffentlichen Socket-Befehl zum
Beitreten: Der nächste Schritt ergänzt die Authentifizierung für Spieler,
Spielleitung und Präsentation. Auch die geplante URL `/join/RAVEN01` und die
grafische Spieler-Lobby existieren noch nicht.

Bis dahin ist der verlässliche technische Client-Check der Server-Test:

```powershell
pnpm --filter @pnp-engine/server test -- realtime.test.ts
```

Er startet einen echten lokalen Socket.IO-Client, verbindet ihn mit Fastify,
prüft die serverseitige Sitzungszuordnung und trennt ihn wieder. Sobald die
Browser-Clients implementiert sind, ersetzt deren eigener Join-Ablauf diesen
technischen Nachweis.

## 5. Vor Änderungen prüfen

```powershell
pnpm run check
```

Der Befehl prüft Formatierung, Linting, Build, Typen sowie alle Unit- und
Integrationstests.
