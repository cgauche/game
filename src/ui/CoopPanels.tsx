import { useGame } from '../state/store';

/**
 * Briques coop PARTAGÉES (lobby « Jouer en ligne » ET menu ☰ en partie) : code de room à
 * partager (+ lien d'invitation), sièges avec présence, attribution des héros. La reconnexion
 * d'un invité est automatique (reprise de siège par token) — l'hôte n'a rien à faire.
 */
export function CoopRoomPanel() {
  const net = useGame((s) => s.net);
  const copy = (text: string) => void navigator.clipboard?.writeText(text).catch(() => {});
  if (!net.roomCode) return null;
  const link = `${location.origin}${location.pathname}?join=${net.roomCode}`;
  return (
    <div className="coop-invite">
      <div className="coop-code" title="Copier le code" onClick={() => copy(net.roomCode!)}>{net.roomCode}</div>
      <div className="bar">
        <button className="btn small" onClick={() => copy(net.roomCode!)}>📋 Code</button>
        <button className="btn small" onClick={() => copy(link)}>🔗 Lien d'invitation</button>
      </div>
    </div>
  );
}

/** Sièges + présence (🟢 connecté / 🟠 reconnexion) — partagé lobby et menu ☰. */
export function CoopSeatList() {
  const net = useGame((s) => s.net);
  const seats = Object.entries(net.seatNames).map(([s, n]) => ({ seat: Number(s), name: n }));
  return (
    <ul className="coop-seats">
      {seats.map(({ seat, name }) => (
        <li key={seat} className={net.presence[seat] === 'away' ? 'away' : undefined}>
          {seat === 0 ? '👑' : net.presence[seat] === 'away' ? '🟠' : '🟢'} {name}
          {seat === net.mySeat ? ' (vous)' : ''}
          {net.presence[seat] === 'away' ? ' — reconnexion…' : ''}
        </li>
      ))}
    </ul>
  );
}

/** Attribution des héros par siège (« un certain nombre de personnages décidé dans le lobby »). */
export function CoopAssignList() {
  const net = useGame((s) => s.net);
  const party = useGame((s) => s.party);
  const assign = useGame((s) => s.netAssign);
  const seats = Object.entries(net.seatNames).map(([s, n]) => ({ seat: Number(s), name: n }));
  return (
    <div className="coop-assign">
      {party.map((h) => (
        <label key={h.id} className="coop-assign-row">
          <span>{h.name}</span>
          <select value={net.ownership[h.id] ?? 0} onChange={(e) => assign(h.id, Number(e.target.value))}>
            {seats.map(({ seat, name: n }) => (
              <option key={seat} value={seat}>{n}</option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

/** Section coop du menu ☰ (HÔTE en partie) : sièges connectés + code de room + réattribuer. */
export function CoopMenuSection() {
  const net = useGame((s) => s.net);
  if (net.mode !== 'host') return null;
  return (
    <div className="gm-section">
      <span className="mini-title">🌐 Coop — joueurs</span>
      <CoopSeatList />
      <CoopRoomPanel />
      <CoopAssignList />
    </div>
  );
}
