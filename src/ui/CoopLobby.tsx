import { useState, type ReactNode } from 'react';
import { useGame } from '../state/store';
import { CoopInvitePanel, CoopAssignList } from './CoopPanels';
import { SaveLoadModal } from './SaveLoadModal';

/**
 * Lobby coop (Jalon 7, P1) — connexion par CODES À PARTAGER (arbitrage : zéro système externe).
 *
 * HÔTE : « Inviter un joueur » génère un code d'invitation (à envoyer par le canal de son choix) ;
 * l'invité renvoie son code de réponse, l'hôte le colle → le siège se connecte. L'hôte continue
 * ensuite vers l'écran d'équipe, où il attribue les EMPLACEMENTS aux joueurs — chacun remplit
 * les siens (créer / roster local / pré-tiré) ; les écrans invités REFLÈTENT le sien (snapshots).
 * INVITÉ : coller l'invitation → renvoyer le code de réponse → attendre le lancement.
 *
 * Présentation (Jalon 9) : carte centrée sur la charte (même coquille que le menu principal),
 * sections en `.panel` — fini la colonne haute avec une zone morte en bas.
 */

/** Coquille de carte centrée, partagée par les 3 états du lobby (local / invité / hôte). */
function CoopShell({
  title,
  backLabel,
  onBack,
  wide,
  children,
}: {
  title: string;
  backLabel: string;
  onBack: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="menu coop-lobby">
      <div className={`menu-card coop-card${wide ? ' wide' : ''}`}>
        <div className="coop-top">
          <button className="btn small btn-ghost" onClick={onBack}>
            {backLabel}
          </button>
        </div>
        <h1 className="coop-title">🌐 {title}</h1>
        <div className="rule-fleur" aria-hidden>⚜</div>
        {children}
      </div>
    </div>
  );
}

export function CoopLobby() {
  const setScreen = useGame((s) => s.setScreen);
  const net = useGame((s) => s.net);
  const hostStart = useGame((s) => s.netHostStart);
  const join = useGame((s) => s.netJoin);
  const leave = useGame((s) => s.netLeave);

  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [myAnswer, setMyAnswer] = useState('');
  const [error, setError] = useState('');
  const [loadOpen, setLoadOpen] = useState(false);

  const copy = (text: string) => void navigator.clipboard?.writeText(text).catch(() => {});

  if (net.mode === 'local') {
    return (
      <CoopShell title="Jouer en ligne" backLabel="← Menu" onBack={() => { leave(); setScreen('menu'); }}>
        <label className="field coop-name">
          <span>Votre nom</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de joueur" autoFocus />
        </label>
        <div className="coop-roles">
          <section className="panel coop-role">
            <div className="mini-title">Héberger une partie</div>
            <p className="hint">Le groupe se compose ensemble : vous attribuerez les emplacements aux joueurs connectés.</p>
            <button className="btn btn-primary" disabled={!name.trim()} onClick={() => hostStart(name.trim())}>
              Héberger
            </button>
          </section>
          <section className="panel coop-role">
            <div className="mini-title">Rejoindre une partie</div>
            <textarea value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="Collez le code d'invitation (W4C1.…)" rows={3} />
            <button
              className="btn btn-primary"
              disabled={!name.trim() || !joinCode.trim()}
              onClick={async () => {
                setError('');
                const answer = await join(joinCode, name.trim());
                if (!answer) setError('Code d’invitation invalide.');
                else setMyAnswer(answer);
              }}
            >
              Rejoindre
            </button>
            {error && <p className="hint coop-error">{error}</p>}
          </section>
        </div>
      </CoopShell>
    );
  }

  if (net.mode === 'guest') {
    return (
      <CoopShell title="Salon — invité" backLabel="← Quitter" onBack={() => { leave(); setScreen('menu'); }}>
        {myAnswer ? (
          <section className="panel coop-role">
            <div className="mini-title">Code de réponse — à renvoyer à l'hôte</div>
            <textarea readOnly value={myAnswer} rows={3} onFocus={(e) => e.currentTarget.select()} />
            <button className="btn small" onClick={() => copy(myAnswer)}>📋 Copier</button>
          </section>
        ) : null}
        <p className="hint coop-waiting">⏳ En attente de l'hôte…</p>
      </CoopShell>
    );
  }

  // ── HÔTE ──
  const seats = Object.entries(net.seatNames).map(([s, n]) => ({ seat: Number(s), name: n }));
  return (
    <CoopShell title="Salon — hôte" backLabel="← Quitter" onBack={() => { leave(); setScreen('menu'); }} wide>
      <section className="panel coop-role">
        <div className="mini-title">Joueurs connectés</div>
        <ul className="coop-seats">
          {seats.map(({ seat, name: n }) => (
            <li key={seat}>{seat === 0 ? '👑' : '🟢'} {n}{seat === 0 ? ' (vous)' : ''}</li>
          ))}
        </ul>
      </section>
      <section className="panel coop-role">
        <div className="mini-title">Inviter un joueur</div>
        <CoopInvitePanel />
      </section>
      <section className="panel coop-role">
        <div className="mini-title">Attribution des héros</div>
        <CoopAssignList />
      </section>
      {/* Charger en session : le salon survit (`applyLoadedSave` préserve `net`), l'invité
          suit au snapshot — c'est LE chemin pour reprendre une partie coop sauvegardée. */}
      <div className="coop-actions">
        <button className="btn" onClick={() => setLoadOpen(true)}>📂 Charger une partie</button>
        <button className="btn btn-primary" onClick={() => setScreen('party')}>
          Composer le groupe →
        </button>
      </div>
      {loadOpen && <SaveLoadModal mode="load" onClose={() => setLoadOpen(false)} />}
    </CoopShell>
  );
}
