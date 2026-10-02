export function App() {
  const sessionName = 'Das Geheimnis von Ravenhill';
  const sessionCode = 'RAVEN01';
  const joinUrl = 'http://192.168.178.42:3000/join/RAVEN01';

  return (
    <main className="presentation-shell" aria-live="polite">
      <section className="lobby-screen" aria-labelledby="presentation-title">
        <p className="eyebrow">Public View</p>
        <h1 id="presentation-title">{sessionName}</h1>
        <div className="meta-row">
          <div className="stat">
            <span>Spieler</span>
            <strong>2</strong>
          </div>
          <div className="stat">
            <span>Status</span>
            <strong>Lobby</strong>
          </div>
        </div>

        <div className="qr-panel" aria-label="Einladungslink für Spieler">
          <div className="qr-box" aria-hidden="true">
            <span>QR</span>
          </div>
          <div>
            <p className="section-label">Eintritt</p>
            <code>{joinUrl}</code>
          </div>
        </div>
      </section>

      <footer className="footer-row">
        <span>Session-Code: {sessionCode}</span>
        <span className="connection-indicator">verbunden</span>
      </footer>
    </main>
  );
}
