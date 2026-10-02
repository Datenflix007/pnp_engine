export function App() {
  return (
    <main className="game-master-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">PNP ENGINE</p>
          <h1>Game Master</h1>
        </div>
        <span className="connection-pill" aria-live="polite">
          Server: getrennt
        </span>
      </header>

      <section className="card overview" aria-labelledby="overview-title">
        <div>
          <p className="section-label">Sitzung</p>
          <h2 id="overview-title">Das Geheimnis von Ravenhill</h2>
        </div>
        <div className="summary-grid">
          <div>
            <span className="summary-label">Lobby</span>
            <strong>Geöffnet</strong>
          </div>
          <div>
            <span className="summary-label">Spieler</span>
            <strong>2 verbunden</strong>
          </div>
          <div>
            <span className="summary-label">Status</span>
            <strong>Bereit</strong>
          </div>
        </div>
      </section>

      <section className="card controls" aria-labelledby="controls-title">
        <p className="section-label" id="controls-title">
          Lobby steuern
        </p>
        <div className="button-row">
          <button type="button">Lobby öffnen</button>
          <button type="button" className="secondary-button">
            Lobby schließen
          </button>
        </div>
      </section>

      <section className="card" aria-labelledby="players-title">
        <p className="section-label" id="players-title">
          Spieler
        </p>
        <ul className="player-list">
          <li>
            <span>Anna</span>
            <span className="badge">Wartet</span>
          </li>
          <li>
            <span>Ben</span>
            <span className="badge released">Freigegeben</span>
          </li>
        </ul>
      </section>
    </main>
  );
}
