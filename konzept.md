# pnp_engine – Konzept

## 1. Projektidee

`pnp_engine` ist eine lokal betriebene Engine für Pen-&-Paper-, Rollenspiel- und interaktive Party-Sessions.

Der zentrale Gedanke ist:

- Ein leistungsfähiger Tower-PC dient als lokaler Server.
- Der Spielleiter / Host bereitet eine Sitzung vor.
- Gäste verbinden sich mit ihren Smartphones über das lokale Netzwerk.
- Der Einstieg erfolgt möglichst einfach über einen QR-Code.
- Auf den Smartphones läuft keine native App, sondern eine responsive Weboberfläche.
- Der Spielleiter steuert die Sitzung zentral.
- Ein zusätzliches Präsentationsfenster zeigt auf einem Fernseher, Beamer oder zweiten Monitor den für alle sichtbaren Zustand der Sitzung.

Die Software soll **kein vollständig digitales Rollenspiel** werden.

Sie soll vielmehr als digitale Spielleitung, Kartenoberfläche und Kommunikationsschicht für ein reales Pen-&-Paper-Spiel dienen.

Physische Elemente wie Würfel, Requisiten, Karten, Gegenstände, Getränke, Rätsel oder Gespräche am Tisch sollen bewusst Teil des Spiels bleiben.

---

# 2. Grundprinzip

Die Architektur basiert auf einem lokalen Client-Server-Modell.

```text
                         ┌──────────────────────────────┐
                         │       Tower-PC / Server      │
                         │                              │
                         │       pnp_engine Server      │
                         │                              │
                         │  Session State               │
                         │  Karten                      │
                         │  Charaktere                  │
                         │  Events                      │
                         │  Story                       │
                         │  Rollen                      │
                         └──────────────┬───────────────┘
                                        │
                          lokales WLAN / LAN
                                        │
          ┌─────────────────────────────┼─────────────────────────────┐
          │                             │                             │
          ▼                             ▼                             ▼
┌──────────────────┐          ┌──────────────────┐          ┌──────────────────┐
│ Smartphone       │          │ Smartphone       │          │ Smartphone       │
│ Spieler A        │          │ Spieler B        │          │ Spieler C        │
│                  │          │                  │          │                  │
│ Character Sheet  │          │ Character Sheet  │          │ Character Sheet  │
│ Rolleninfo       │          │ Rolleninfo       │          │ Rolleninfo       │
│ Aktionen         │          │ Aktionen         │          │ Aktionen         │
└──────────────────┘          └──────────────────┘          └──────────────────┘


                    ┌────────────────────────────────────┐
                    │ Präsentationsfenster / Public View │
                    │                                    │
                    │ Lobby QR-Code                      │
                    │ Karte                              │
                    │ Storyinformationen                 │
                    │ Aufforderungen                     │
                    │ Ereignisse                         │
                    └────────────────────────────────────┘
```

---

# 3. Ziel

Die Engine soll eine vorbereitete Pen-&-Paper-Sitzung technisch unterstützen.

Der Spielleiter soll vor der Feier beispielsweise vorbereiten können:

- Karten
- Orte
- Level
- Szenen
- Charaktervorlagen
- Rollen
- geheime Informationen
- NPCs
- Gegenstände
- Storyabschnitte
- Ereignisse
- Rätsel
- Trigger
- Bilder
- Texte
- Soundeffekte
- Musik
- Spieleraktionen

Während der Sitzung steuert der Spielleiter, welche Inhalte sichtbar werden.

---

# 4. Rollen im System

## 4.1 Server

Der Server läuft auf dem Tower-PC.

Er verwaltet:

- Sitzung
- Netzwerkverbindungen
- Spieler
- Charaktere
- Rollen
- Kartenzustand
- Events
- Storyfortschritt
- Zustandsänderungen
- Medien
- Logs

Der Server ist die einzige autoritative Quelle des Spielzustands.

---

## 4.2 Game Master / Host

Der Game Master kontrolliert die Sitzung über eine eigene Oberfläche.

Beispielsweise:

```text
/game-master
```

Die Oberfläche sollte vorzugsweise auf einem Laptop oder zweiten Rechner geöffnet werden können.

Der Game Master kann:

- Sitzung starten
- Lobby öffnen
- Spieler sehen
- Spieler freischalten
- Rollen vergeben
- Charaktere bearbeiten
- Events starten
- Karten wechseln
- Spielfiguren bewegen
- Spielerbewegungen erlauben oder blockieren
- Storyabschnitte aktivieren
- Nachrichten senden
- geheime Informationen senden
- Timer starten
- Medien anzeigen
- Sounds abspielen
- Spielzustände ändern

---

# 5. Spieler-Client

Der Spieler öffnet mit seinem Smartphone beispielsweise:

```text
http://192.168.178.42:3000
```

oder scannt den QR-Code.

Nach dem Öffnen erscheint die Lobby.

Beispiel:

```text
┌──────────────────────────────┐
│        PNP ENGINE            │
│                              │
│ Sitzung:                     │
│ Das Geheimnis von Ravenhill  │
│                              │
│ Dein Name                    │
│ [________________________]   │
│                              │
│        [ BEITRETEN ]         │
└──────────────────────────────┘
```

---

# 6. Lobby

Die Lobby ist der Einstiegspunkt in eine Sitzung.

Das Präsentationsfenster zeigt:

- Namen der Sitzung
- QR-Code
- lokale IPv4-Adresse
- Port
- Anzahl verbundener Spieler
- optional Spielernamen

Beispiel:

```text
┌─────────────────────────────────────────────┐
│                                             │
│              DAS GEHEIMNIS                  │
│              VON RAVENHILL                  │
│                                             │
│              ██████████                     │
│              ██ QR CODE ██                  │
│              ██████████                     │
│                                             │
│       Mit Smartphone scannen                │
│                                             │
│       192.168.178.42:3000                   │
│                                             │
│       Spieler verbunden: 5 / 8              │
│                                             │
└─────────────────────────────────────────────┘
```

---

# 7. Präsentationsmodus

Der Tower-PC stellt eine eigene Public-View bereit.

Beispielsweise:

```text
/presentation
```

Diese Oberfläche wird auf:

- Fernseher
- Beamer
- zweitem Monitor

angezeigt.

Der Game Master sieht parallel eine eigene Steueroberfläche.

## Präsentationsmodi

Mögliche Modi:

```text
LOBBY
MAP
STORY
EVENT
IMAGE
MESSAGE
TIMER
VIDEO
BLACK
CUSTOM
```

Der Spielleiter kann jederzeit zwischen diesen Zuständen wechseln.

---

# 8. Karten-System

Die Karte ist eines der zentralen Module.

Eine Karte besteht beispielsweise aus:

```text
Map
 ├── Background
 ├── Grid
 ├── Tokens
 ├── Interactive Objects
 ├── Regions
 ├── Fog of War
 └── Events
```

---

# 9. Tokens / Spielfiguren

Spieler können auf einer Karte durch Tokens repräsentiert werden.

Beispiel:

```json
{
  "id": "player_01",
  "name": "Anna",
  "token": "wizard_blue",
  "position": {
    "x": 342,
    "y": 518
  }
}
```

Der Server besitzt immer die autoritative Position.

---

# 10. Bewegung

Bewegungen können unterschiedliche Modi besitzen.

## Modus A – Game Master bewegt Figuren

Nur der Game Master kann Figuren bewegen.

Geeignet für:

- Storysequenzen
- taktische Kontrolle
- Rätsel

## Modus B – Spieler bewegen eigene Figur

Der Game Master aktiviert:

```text
ALLOW_PLAYER_MOVEMENT
```

Der Spieler kann daraufhin seine Figur auf dem Smartphone verschieben.

Der Server validiert die Position.

Danach wird die Bewegung auf allen Clients synchronisiert.

## Modus C – Bewegung bestätigen

Spieler schlägt eine Position vor.

Der Game Master bestätigt sie.

---

# 11. Interaktive Karte

Objekte auf der Karte können anklickbar sein.

Beispiele:

```text
Tür
Schrank
Truhe
Terminal
Person
Gemälde
Fenster
Geheimtür
Leiche
Brief
Computer
Hebel
```

Ein Objekt kann ein Event auslösen.

Beispiel:

```text
Spieler klickt auf Truhe
          │
          ▼
Server prüft Bedingungen
          │
          ▼
Event wird ausgelöst
          │
          ├── Nachricht an Spieler
          ├── Nachricht an Game Master
          ├── Item erhalten
          └── Präsentation ändern
```

---

# 12. Charaktere

Spieler können entweder:

1. einen Charakter erstellen
2. einen vorbereiteten Charakter erhalten
3. einen Charakter auswählen

Ein Charakter kann enthalten:

```text
Name
Avatar
Klasse
Beruf
Alter
Attribute
Fähigkeiten
Inventar
Notizen
Lebenspunkte
Status
geheime Informationen
Rolle
```

---

# 13. Rollen-System

Zusätzlich zum Charakter kann jeder Spieler eine geheime Rolle besitzen.

Beispiele:

```text
Detektiv
Mörder
Spion
Verräter
Arzt
Zeuge
Kultist
Polizist
Informant
```

Nach dem Start einer Sitzung kann der Spieler auf seinem Smartphone beispielsweise sehen:

```text
┌──────────────────────────────┐
│ DEINE ROLLE                  │
│                              │
│ Der Informant                │
│                              │
│ Niemand darf wissen, dass    │
│ du für die Polizei arbeitest.│
│                              │
│ Dein Ziel:                   │
│ Finde heraus, wer den Brief  │
│ gestohlen hat.               │
│                              │
│ [ VERSTANDEN ]               │
└──────────────────────────────┘
```

Andere Spieler sehen diese Information nicht.

---

# 14. Private Nachrichten

Der Game Master kann Nachrichten senden an:

```text
alle Spieler
einen Spieler
eine Gruppe
eine Rolle
```

Beispiel:

```text
Nur Spieler mit Rolle "Detektiv":

"Dir fällt auf, dass das Fenster von innen geöffnet wurde."
```

---

# 15. Event-System

Das Event-System bildet den Kern der Spiellogik.

Ein Event kann beispielsweise ausgelöst werden durch:

```text
Game Master
Spieleraktion
Karteninteraktion
Storyfortschritt
Timer
Bedingung
Position
Inventar
```

Beispiel:

```yaml
event:
  id: library_secret_door

trigger:
  type: interaction
  object: bookshelf_04

conditions:
  player_has_item: old_key

actions:
  - reveal_map_region: secret_room
  - send_message:
      target: player
      text: 'Hinter dem Regal hörst du ein leises Klicken.'
  - notify_game_master: true
```

---

# 16. Physische Spielmechaniken

Die Engine soll bewusst nicht alle Spielmechaniken digitalisieren.

Insbesondere folgende Elemente können weiterhin physisch stattfinden:

## Würfel

Spieler würfeln mit echten Würfeln.

Der Spielleiter kann anschließend das Ergebnis eintragen.

Beispiel:

```text
Spieler würfelt W20.

Ergebnis: 17

Game Master:
[ Wurf eintragen: 17 ]
```

Optional kann später zusätzlich ein digitaler Würfel angeboten werden.

---

## Requisiten

Beispiele:

- Schlüssel
- Briefe
- Karten
- Münzen
- Bücher
- Flaschen
- Artefakte
- Fotos
- Umschläge
- QR-Codes
- physische Rätsel

Die Engine kann Hinweise liefern, wann ein Gegenstand verwendet werden soll.

Beispielsweise:

```text
GAME MASTER ONLY

Jetzt Umschlag Nr. 4 an Spieler Lena geben.
```

---

# 17. Session Builder

Langfristig sollte die Engine einen Editor besitzen.

Darin wird eine Sitzung vorbereitet.

```text
Session
 │
 ├── Metadata
 │
 ├── Players
 │
 ├── Character Templates
 │
 ├── Roles
 │
 ├── Maps
 │
 ├── Scenes
 │
 ├── Story
 │
 ├── Events
 │
 ├── Items
 │
 ├── NPCs
 │
 └── Media
```

---

# 18. Story-System

Eine Story könnte aus Szenen bestehen.

```text
Session
 │
 ├── Scene 01 – Arrival
 │
 ├── Scene 02 – Dinner
 │
 ├── Scene 03 – Murder
 │
 ├── Scene 04 – Investigation
 │
 └── Scene 05 – Finale
```

Eine Szene kann wiederum enthalten:

```text
Map
Events
Music
NPCs
Messages
Items
Objectives
Presentation State
```

---

# 19. Beispiel einer Sitzung

```text
Session: Murder at Ravenhill

Scene 01
Arrival

↓ Game Master

Scene 02
Dinner

↓ Event

Lights Out

↓ Presentation

BLACK SCREEN

↓ Sound

Glass Breaking

↓ Event

Player 3 receives secret message

↓ Physical Action

Game Master places envelope on table

↓ Scene

Investigation

↓ Map

Mansion Floor Plan
```

---

# 20. Technische Architektur – erste Idee

Eine mögliche Architektur:

```text
                        ┌──────────────────────────┐
                        │       Web Frontend       │
                        │                          │
                        │ React / Vue / Svelte     │
                        └─────────────┬────────────┘
                                      │
                           HTTP + WebSocket
                                      │
                        ┌─────────────▼────────────┐
                        │       Backend API        │
                        │                          │
                        │ Node.js / TypeScript     │
                        │ Fastify / NestJS         │
                        └─────────────┬────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
             Session Engine      Event Engine       Map Engine

                    │                 │                 │
                    └─────────────────┼─────────────────┘
                                      │
                                      ▼
                                State Manager
                                      │
                                      ▼
                                    SQLite
```

---

# 21. Technologie-Vorschlag

## Backend

Empfehlung:

```text
Node.js
TypeScript
Fastify
WebSocket / Socket.IO
```

Alternativ:

```text
NestJS
```

Für einen ersten Prototyp ist Fastify vermutlich ausreichend und weniger komplex.

---

# 22. Frontend

Mögliche Technologien:

```text
React
Vite
TypeScript
```

oder:

```text
Svelte
SvelteKit
```

Für die Engine wäre React + TypeScript eine pragmatische Wahl.

---

# 23. Echtzeitkommunikation

Da Änderungen sofort auf allen Geräten erscheinen müssen, sollte WebSocket verwendet werden.

Beispiele:

```text
PLAYER_JOINED
PLAYER_READY
CHARACTER_UPDATED
ROLE_ASSIGNED
MAP_CHANGED
TOKEN_MOVED
EVENT_TRIGGERED
MESSAGE_RECEIVED
SCENE_CHANGED
PRESENTATION_CHANGED
```

---

# 24. State Management

Der Server ist die autoritative Quelle.

Clients schicken nur Aktionen.

Beispiel:

```text
Smartphone

MOVE_TOKEN
x = 340
y = 520

        │
        ▼

Server

validateMovement()

        │
        ▼

Update Session State

        │
        ▼

Broadcast

TOKEN_MOVED
```

Dadurch bleiben alle Clients synchron.

---

# 25. Datenbank

Für lokale Nutzung bietet sich SQLite an.

Beispieltabellen:

```text
sessions
players
characters
roles
maps
map_objects
events
scenes
items
messages
session_state
```

---

# 26. Dateien und Medien

Größere Medien sollten nicht direkt in SQLite gespeichert werden.

Beispielsweise:

```text
data/

sessions/

assets/

maps/

characters/

audio/

images/

videos/
```

SQLite speichert nur die Referenzen.

---

# 27. Repository-Struktur

Erste mögliche Struktur:

```text
pnp_engine/
│
├── README.md
├── konzept.md
├── ARCHITECTURE.md
│
├── apps/
│   │
│   ├── server/
│   │
│   ├── player-client/
│   │
│   ├── game-master/
│   │
│   └── presentation/
│
├── packages/
│   │
│   ├── shared/
│   ├── protocol/
│   ├── session-engine/
│   ├── event-engine/
│   └── map-engine/
│
├── data/
│
├── sessions/
│
├── assets/
│
└── docs/
```

Eine Monorepo-Struktur ist sinnvoll, weil Server, Spieleroberfläche, Game-Master-UI und Präsentationsansicht viele gemeinsame TypeScript-Typen verwenden.

---

# 28. Gemeinsames Protokoll

Ein eigenes Shared-Package sollte Events definieren.

Beispiel:

```ts
type ServerEvent =
  | PlayerJoinedEvent
  | PlayerLeftEvent
  | CharacterUpdatedEvent
  | TokenMovedEvent
  | SceneChangedEvent
  | EventTriggeredEvent;
```

Dadurch verwenden Server und Clients dieselben Datenstrukturen.

---

# 29. Netzwerk

Der Server soll im lokalen Netzwerk erreichbar sein.

Beim Start:

```text
PNP ENGINE

Server gestartet.

Local:
http://localhost:3000

Network:
http://192.168.178.42:3000
```

Der Server erkennt nach Möglichkeit automatisch die IPv4-Adresse.

Aus dieser URL wird der Lobby-QR-Code generiert.

---

# 30. Kein Internet erforderlich

Ein Kernziel ist:

```text
Internet = optional
lokales Netzwerk = erforderlich
```

Dadurch funktioniert das System auch unabhängig von externen Diensten.

Voraussetzung ist lediglich, dass alle Geräte dasselbe lokale Netzwerk erreichen können.

---

# 31. Sicherheitsmodell

Da das System primär im privaten LAN betrieben wird, kann das Sicherheitsmodell zunächst relativ leichtgewichtig bleiben.

Trotzdem sollten Clients Rollen besitzen:

```text
PLAYER
GAME_MASTER
PRESENTATION
ADMIN
```

Game-Master-Funktionen dürfen niemals nur über ausgeblendete UI-Elemente geschützt werden.

Der Server muss jede Aktion autorisieren.

---

# 32. Session Join Token

Der QR-Code sollte später nicht nur die IP-Adresse enthalten.

Beispiel:

```text
http://192.168.178.42:3000/join/7HTK9Q
```

`7HTK9Q` ist ein temporärer Session-Code.

Dadurch landet ein Gast direkt in der richtigen Lobby.

---

# 33. Geräteaufteilung

Ein sinnvoller Aufbau für eine Feier könnte sein:

```text
Tower-PC
│
├── pnp_engine Server
│
├── Datenbank
│
├── Session State
│
└── Präsentationsfenster
       │
       └── HDMI → Fernseher / Beamer


Game-Master Laptop
│
└── Browser
    └── Game-Master Dashboard


Smartphones
│
└── Browser
    └── Player Client
```

Der Game-Master-Laptop benötigt damit keine vollständige Installation.

Er öffnet lediglich die lokale Weboberfläche des Servers.

---

# 34. Game-Master Dashboard

Erste UI-Idee:

```text
┌────────────────────────────────────────────────────────────────┐
│ PNP ENGINE – GAME MASTER                                      │
├─────────────┬───────────────────────────────┬──────────────────┤
│             │                               │                  │
│ SCENES      │             MAP               │ PLAYERS          │
│             │                               │                  │
│ Arrival     │                               │ Anna ●           │
│ Dinner      │                               │ Ben  ●           │
│ Murder      │                               │ Tim  ●           │
│ Search      │                               │ Lisa ●           │
│ Finale      │                               │                  │
│             │                               │                  │
├─────────────┴───────────────────────────────┴──────────────────┤
│ EVENTS                                                         │
│                                                               │
│ [Lights Out] [Reveal Corpse] [Secret Message] [Open Door]     │
└────────────────────────────────────────────────────────────────┘
```

---

# 35. Spieleroberfläche

Die Spieleroberfläche muss konsequent Mobile First gestaltet werden.

Tabs könnten sein:

```text
Character
Map
Inventory
Messages
Objectives
```

Nicht jeder Tab muss jederzeit verfügbar sein.

Der Game Master kann Funktionen abhängig von der Szene aktivieren.

---

# 36. Aufforderungen

Die Engine sollte Spieler gezielt auffordern können.

Beispiele:

```text
"Öffne jetzt deine Charakterseite."

"Wähle einen Gegenstand."

"Bewege deine Figur."

"Schließe deine Augen."

"Nimm Umschlag Nr. 3."

"Würfle einen W20."

"Zeige dein Ergebnis dem Spielleiter."
```

Damit fungiert die Anwendung teilweise als Regie- und Spielsteuerungssystem.

---

# 37. Session State

Ein zentraler Session State könnte beispielsweise so aussehen:

```json
{
  "sessionId": "ravenhill",
  "scene": "investigation",
  "presentationMode": "map",
  "players": [],
  "map": {},
  "activeEvents": [],
  "flags": {
    "secretDoorOpen": false,
    "powerOn": true
  }
}
```

---

# 38. Event-Graph

Langfristig könnten Ereignisse als Graph modelliert werden.

```text
START
  │
  ▼
Dinner
  │
  ▼
Lights Out
  │
  ▼
Murder
  │
  ├───────────────┐
  ▼               ▼
Find Key       Question NPC
  │               │
  └───────┬───────┘
          ▼
     Secret Room
          │
          ▼
        Finale
```

Damit wären auch verzweigte Geschichten möglich.

---

# 39. Session-Dateiformat

Sitzungen sollten exportierbar sein.

Beispielsweise:

```text
.rpgsession
```

Intern könnte dies zunächst einfach ein ZIP-Archiv sein.

```text
session.json
maps/
characters/
audio/
images/
events/
```

Dadurch könnten Sitzungen später geteilt werden.

---

# 40. MVP

Die erste Version sollte bewusst klein bleiben.

## MVP 0.1

Enthalten:

- lokaler Server
- automatische IPv4-Erkennung
- QR-Code
- Lobby
- Spielerbeitritt
- Spielerliste
- einfache Charakterbögen
- Rollenvergabe
- private Rollenanzeige
- Game-Master Dashboard
- Präsentationsfenster
- eine Karte
- Tokens
- Tokenbewegung durch Game Master
- WebSocket-Synchronisierung
- einfache Nachrichten
- SQLite Session Storage

Noch nicht enthalten:

- komplexer Storyeditor
- Fog of War
- komplexes Inventar
- eigener Eventgraph-Editor
- Sprachchat
- Benutzerkonten
- Cloud
- Internet-Multiplayer
- KI
- komplexe Regelwerke

---

# 41. MVP 0.2

Danach:

- Spieler bewegen eigene Tokens
- Kartenobjekte
- Event-System
- Inventar
- Items
- geheime Nachrichten
- Szenen
- Präsentationsmodi
- Soundeffekte
- Timer

---

# 42. MVP 0.3

Danach:

- Session Builder
- Event-Editor
- Storygraph
- Fog of War
- NPC-System
- Medienbibliothek
- Session Import / Export

---

# 43. Langfristige Möglichkeiten

Optional könnten später Module entstehen für:

```text
Murder Mystery
Fantasy RPG
Sci-Fi RPG
Escape Room
Social Deduction
Krimidinner
Interactive Story
Educational Roleplay
```

Die Engine sollte deshalb nicht an ein konkretes Regelwerk gekoppelt werden.

---

# 44. Architekturprinzipien

Die Entwicklung sollte folgende Prinzipien berücksichtigen:

## Local First

Das System funktioniert vollständig lokal.

## Server Authoritative

Der Server besitzt den gültigen Spielzustand.

## Mobile First

Spieler verwenden überwiegend Smartphones.

## Game Master Controlled

Der Spielleiter entscheidet, wann Informationen sichtbar werden.

## Physical + Digital

Die Software ergänzt reale Spielmechaniken, ersetzt sie aber nicht vollständig.

## Modular

Map Engine, Event Engine und Story Engine sollten getrennt entwickelt werden.

## Rule-System Agnostic

Die Engine soll nicht ausschließlich an D&D oder ein anderes Regelwerk gekoppelt sein.

---

# 45. Vorläufige Architektur

```text
                        PNP ENGINE

                ┌───────────────────────┐
                │     Session Engine    │
                └───────────┬───────────┘
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
         ▼                  ▼                  ▼

    Event Engine        Map Engine        Story Engine

         │                  │                  │
         └──────────────────┼──────────────────┘
                            │
                            ▼
                     State Manager
                            │
                            ▼
                         SQLite

                            │
                            ▼

                     WebSocket Layer

         ┌──────────────────┼──────────────────────┐
         │                  │                      │
         ▼                  ▼                      ▼

     Player UI        Game Master UI        Presentation UI
```

---

# 46. Nächste Architekturfragen

Vor der eigentlichen Implementierung sollten insbesondere folgende Fragen geklärt werden:

1. React oder Svelte für die Oberflächen?
2. Fastify oder NestJS für den Server?
3. Socket.IO oder native WebSockets?
4. Wie wird die Karte technisch dargestellt?
   - Canvas
   - SVG
   - PixiJS
   - Phaser
5. Wie werden Sessions gespeichert?
6. Wie werden Assets verwaltet?
7. Wie flexibel soll das Event-System werden?
8. Soll ein visueller Story-/Eventeditor entstehen?
9. Wie werden Session-Saves und Backups realisiert?
10. Wie werden mobile Clients bei kurzzeitigem WLAN-Verlust synchronisiert?

---

# 47. Empfohlene erste Umsetzung

Für einen ersten Prototypen:

```text
TypeScript

Backend:
Node.js
Fastify
Socket.IO
SQLite

Frontend:
React
Vite

Map:
PixiJS oder Konva

QR-Code:
qrcode

Monorepo:
pnpm workspaces
```

Diese Kombination erlaubt eine vollständig lokale Anwendung und eine gemeinsame TypeScript-Codebasis zwischen Server und Clients.

---

# 48. Vision

`pnp_engine` soll letztlich eine Art lokales Betriebssystem für interaktive Pen-&-Paper- und Party-Rollenspiele werden.

Der Spielleiter besitzt die Kontrolle über:

```text
Story
+
Karte
+
Spieler
+
Charaktere
+
Rollen
+
Events
+
Medien
+
Spielzustand
```

Die Smartphones der Gäste dienen dabei als persönliche Schnittstelle zur Spielwelt.

Der große Bildschirm bildet die gemeinsame digitale Spielfläche.

Das eigentliche Rollenspiel findet weiterhin gemeinsam am Tisch statt.
