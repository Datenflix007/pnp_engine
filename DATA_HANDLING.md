# pnp_engine – Daten- und Datenschutzgrenzen

Stand: 01.10.2026 · Geltungsbereich: lokale Entwicklung, Spielbetrieb und Export

## Grundsatz

Eine pnp_engine-Installation ist local first. Namen, Rollen, geheime Hinweise,
Nachrichten, Charaktere, Sitzungsfortschritt und hochgeladene Medien können
personenbezogene oder vertrauliche Spielinformationen sein. Sie bleiben auf dem
Spielserver bzw. in dessen lokalem Datenpfad und werden nicht in Git eingecheckt.

Das Repository enthält ausschließlich Quellcode, Migrationen, Dokumentation,
testbare, nicht personenbezogene Fixtures und ausdrücklich freigegebene Demo- oder
Referenzdaten.

## Datenklassen und Ablage

| Klasse                    | Typische Inhalte                                | Ablage im Betrieb                            | Git-Status                             |
| ------------------------- | ----------------------------------------------- | -------------------------------------------- | -------------------------------------- |
| Quellcode und Migrationen | Server, Clients, Datenbankschema                | Workspace                                    | versioniert                            |
| Offizielle Referenzdaten  | anonyme Demo-Session, Test-Fixtures             | klar benannter Quellpfad, später `fixtures/` | nur nach bewusster Prüfung versioniert |
| Laufzeitdaten             | SQLite, Session-State, Logs                     | `data/`                                      | ignoriert                              |
| Imports und Exporte       | `.rpgsession`, Backups                          | `sessions/`, `backups/`                      | ignoriert                              |
| Hochgeladene Medien       | Karten, Fotos, Audio, Video, Avatare            | `assets/`, `uploads/`                        | ignoriert                              |
| Geheimnisse               | Game-Master-Zugangsmittel, lokale Konfiguration | `.env` oder sicherer lokaler Betriebskanal   | ignoriert                              |

Die Verzeichnisse `data/`, `sessions/`, `assets/`, `uploads/` und `backups/`
sind absichtlich vollständig ignoriert. Wenn eine Beispielressource dauerhaft
mitgeliefert werden soll, gehört sie nicht dorthin, sondern in einen eigenen,
öffentlich prüfbaren Referenz- oder Fixture-Pfad.

## Verbindliche Regeln

1. Keine echten Spielernamen, Rollenbeschreibungen, Chatnachrichten,
   Charaktere, Sitzungsdaten oder privaten Medien in Commits, Issues oder Logs
   aufnehmen.
2. Keine Zugangsmittel in Quellcode, URLs, QR-Codes, Browser-Screenshots,
   Testausgaben oder Git einbetten. `.env.example` darf nur Platzhalter
   enthalten.
3. Große Medien werden als Datei lokal verwaltet; SQLite enthält später nur
   geprüfte Referenzen und Metadaten.
4. Jeder neue Laufzeitdatenpfad erhält gleichzeitig eine `.gitignore`-Regel
   und eine kurze Dokumentation seiner Datenklasse.
5. Vor einem Commit ist `git status --short` zu prüfen. Testdaten dürfen nur
   dann eingecheckt werden, wenn sie anonym, klein und als Fixture erkennbar
   sind.
6. Backups und `.rpgsession`-Exporte werden bewusst manuell weitergegeben;
   ihr Inhalt kann Geheimnisse und personenbezogene Daten enthalten.

## Server- und Clientgrenzen

Der Server gibt Daten nach Rolle aus: Spielende erhalten nur ihre eigenen
geheimen Inhalte, die Präsentation nur öffentliche Inhalte und die Spielleitung
den vollständigen Sitzungszustand. Private Informationen werden nicht bloß im
Frontend ausgeblendet, sondern serverseitig aus der jeweiligen Projektion
entfernt. Details stehen in [ARCHITECTURE.md](ARCHITECTURE.md#datenprojektionen-und-geheimhaltung).

Browser speichern lokale, zufällige Reconnect-Nachweise getrennt nach Sitzungs-ID.
Sie werden ausschließlich nach einem erfolgreichen Join übernommen und weder in
URLs, Serverlogs noch Git geschrieben. Bei Verlust des Geräts kann der Game
Master den betreffenden Spielerzugang sperren oder neu zuweisen. Der Server
speichert für einen solchen Nachweis ausschließlich einen SHA-256-Hash in der
bereits ignorierten lokalen SQLite-Datei.

## Betriebsprotokoll

Der ausführbare Server schreibt nur strukturierte Echtzeit-Audit-Ereignisse auf
die Konsole: Verbindungsaufbau und -ende, erfolgreicher Beitritt oder Reconnect,
angenommene beziehungsweise abgewiesene Kommandos und abgewiesene Handshakes.
Ein Eintrag enthält ausschließlich Ereignistyp sowie – sofern die Verbindung
bereits autorisiert ist – Sitzungs-ID, Rolle, Kommandotyp und Fehlercode.

Nicht protokolliert werden Join-Codes, Game-Master-Geheimnisse, Geräte-Tokens,
Request-IDs, Spielernamen oder sonstige Kommando-Payloads. Tests sichern diese
Negativgrenze ausdrücklich ab. Die Standardausgabe bleibt lokal; wenn sie
umgeleitet oder gespeichert wird, ist sie als Laufzeitdatum zu behandeln und
nicht zu committen.

## Prüfschritt

Die Ignore-Regeln sind mit `git check-ignore -v --no-index` gegen
beispielhafte SQLite-, Medien- und Exportpfade zu prüfen. Das Kommando zeigt die
zuständige Regel an, ohne die Testdateien erzeugen zu müssen.
