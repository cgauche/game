import { useGame } from '../state/store';
import { CharFrame } from './CharFrame';
import { Icon } from './Icon';

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
        <button className="btn small" onClick={() => copy(net.roomCode!)}><Icon id="coop/code" size="sm" /> Code</button>
        <button className="btn small" onClick={() => copy(link)}><Icon id="coop/invite" size="sm" /> Lien d'invitation</button>
      </div>
    </div>
  );
}

/** Sièges + présence (connecté / reconnexion) — partagé lobby et menu ☰. */
export function CoopSeatList() {
  const net = useGame((s) => s.net);
  const seats = Object.entries(net.seatNames).map(([s, n]) => ({ seat: Number(s), name: n }));
  return (
    <ul className="coop-seats">
      {seats.map(({ seat, name }) => (
        <li key={seat} className={net.presence[seat] === 'away' ? 'away' : undefined}>
          <Icon id={seat === 0 ? 'coop/host' : net.presence[seat] === 'away' ? 'coop/away' : 'coop/online'} size="sm" /> {name}
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
          {/* Tuile + nom : lobby coop = écran méta (l'invité ne connaît pas encore les visages). */}
          <CharFrame c={h} variant="identity" size="xs" />
          <span>{h.name}</span>
          <select value={net.ownership[h.id] ?? 0} onChange={(e) => assign(h.id, Number(e.target.value))}>
            {seats.map(({ seat, name: n }) => (
              <option key={seat} value={seat}>{n}</option>
            ))}
          </select>
        </label>
      ))}
      <GmSeatSelect />
    </div>
  );
}

/** Rôle MJ (bac-à-sable) : UN siège conduit tout le camp ennemi + les jets du monde (ou « IA » = aucun MJ).
 *  UNIQUE (désigner un MJ retire le rôle à tout autre). Hôte-autoritaire → n'apparaît qu'en mode hôte
 *  (en solo, le siège unique bascule via `GmSoloToggle`). */
export function GmSeatSelect() {
  const net = useGame((s) => s.net);
  const setGmSeat = useGame((s) => s.setGmSeat);
  if (net.mode !== 'host') return null;
  const seats = Object.entries(net.seatNames).map(([s, n]) => ({ seat: Number(s), name: n }));
  return (
    <label className="coop-assign-row gm-seat-row">
      <span>Maître du Jeu</span>
      <select value={net.gmSeat ?? ''} onChange={(e) => setGmSeat(e.target.value === '' ? null : Number(e.target.value))}>
        <option value="">IA (aucun MJ)</option>
        {seats.map(({ seat, name }) => (
          <option key={seat} value={seat}>{name}</option>
        ))}
      </select>
    </label>
  );
}

/** SOLO (mode local) : contrôler aussi les ennemis + les jets du monde (rôle MJ pour le siège unique). */
export function GmSoloToggle() {
  const net = useGame((s) => s.net);
  const setGmSeat = useGame((s) => s.setGmSeat);
  if (net.mode !== 'local') return null;
  return (
    <div className="gm-section gm-solo-toggle">
      <label className="radio">
        <input type="checkbox" checked={net.gmSeat != null} onChange={(e) => setGmSeat(e.target.checked ? 0 : null)} />
        <span>Siège du contrôleur — piloter aussi les ennemis / le monde</span>
      </label>
    </div>
  );
}

/** Section coop du menu ☰ (HÔTE en partie) : sièges connectés + code de room + réattribuer. */
export function CoopMenuSection() {
  const net = useGame((s) => s.net);
  if (net.mode !== 'host') return null;
  return (
    <div className="gm-section">
      <span className="mini-title"><Icon id="nav/online" size="sm" /> Coop — joueurs</span>
      <CoopSeatList />
      <CoopRoomPanel />
      <CoopAssignList />
    </div>
  );
}
