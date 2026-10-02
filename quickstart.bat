@echo off
setlocal EnableExtensions
chcp 65001 >nul

cd /d "%~dp0"

echo.
echo PNP ENGINE - Quickstart
echo.

where node >nul 2>nul
if errorlevel 1 goto :node_missing

where corepack >nul 2>nul
if errorlevel 1 goto :corepack_missing

if exist "node_modules\.pnpm" goto :dependencies_ready

echo Installiere Workspace-Abhaengigkeiten ...
call corepack pnpm install --frozen-lockfile
if errorlevel 1 goto :failed

:dependencies_ready
if not defined PNP_ENGINE_HOST set "PNP_ENGINE_HOST=0.0.0.0"
if not defined PNP_ENGINE_PORT set "PNP_ENGINE_PORT=3000"

if defined PNP_ENGINE_GAME_MASTER_SECRET goto :game_master_secret_ready
echo Hinweis: PNP_ENGINE_GAME_MASTER_SECRET ist nicht gesetzt.
echo Game-Master-Socket-Verbindungen bleiben dadurch deaktiviert.
echo.

:game_master_secret_ready

echo.
echo Baue das Projekt ...
call corepack pnpm run build
if errorlevel 1 goto :failed

echo.
echo Starte den Server auf %PNP_ENGINE_HOST%:%PNP_ENGINE_PORT% ...
echo Zum Testen auf diesem PC nach dem Start:
echo   http://127.0.0.1:%PNP_ENGINE_PORT%/api/lobbies/RAVEN01
echo.
echo Fuer Geraete im LAN die private IPv4-Adresse aus der Startmeldung verwenden.
echo Beenden mit Ctrl+C.
echo.

call corepack pnpm --filter @pnp-engine/server run start
if errorlevel 1 goto :failed

echo.
echo Der Server wurde beendet.
pause
exit /b 0

:node_missing
echo Node.js wurde nicht gefunden. Installiere Node.js 22.22.0 oder neuer und starte erneut.
goto :failed

:corepack_missing
echo Corepack wurde nicht gefunden. Installiere eine aktuelle Node.js-Version und starte erneut.
goto :failed

:failed
echo.
echo Quickstart konnte nicht abgeschlossen werden.
pause
exit /b 1
