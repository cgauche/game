import { useState } from 'react';
import { useGame } from '../state/store';
import { CoopInvitePanel, CoopAssignList } from './CoopPanels';

/**
 * Lobby coop (Jalon 7, P1) — connexion par CODES À PARTAGER (arbitrage : zéro système externe).
 *
 * HÔTE : « Inviter un joueur » génère un code d'invitation (à envoyer par le canal de son choix) ;
 * l'invité renvoie son code de réponse, l'hôte le colle → le siège se connecte. L'hôte attribue
 * ensuite N héros à chaque siège (« un certain nombre de personnages décidé dans le lobby ») et
 * lance la partie — les écrans invités REFLÈTENT le sien (snapshots).
 * INVITÉ : coller l'invitation → renvoyer le code de réponse → attendre le lancement.
 */
export function CoopLobby() {
  const setScreen = useGame((s) => s.setScreen);
  const net = useGame((s) => s.net);
  const party = useGame((s) => s.party);
  const hostStart = useGame((s) => s.netHostStart);
  const invite = useGame((s) => s.netInvite);
  const acceptAnswer = useGame((s) => s.netAcceptAnswer);
  const join = useGame((s) => s.netJoin);
  const assign = useGame((s) => s.netAssign);
  const leave = useGame((s) => s.netLeave);

  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [answerIn, setAnswerIn] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [myAnswer, setMyAnswer] = useState('');
  const [error, setError] = useState('');

  const copy = (text: string) => void navigator.clipboard?.writeText(text).catch(() => {});

  if (net.mode === 'local') {
    return (
      <div className="screen coop-lobby">
        <header className="bar">
          <button className="btn small" onClick={() => { leave(); setScreen('menu'); }}>← Menu</button>
          <h2>🌐 Jouer en ligne</h2>
        </header>
        <div className="coop-body">
          <section className="zone-section">
            <h3><span>Votre nom</span></h3>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de joueur" />
          </section>
          <div className="coop-roles">
            <section className="zone-section coop-role">
              <h3><span>Héberger</span></h3>
              <button className="btn btn-primary" disabled={!name.trim() || party.length === 0} onClick={() => hostStart(name.trim())}>
                Héberger
              </button>
              {party.length === 0 && (
                <button className="btn" onClick={() => setScreen('party')}>
                  ➕ Composer le groupe
                </button>
              )}
            </section>
            <section className="zone-section coop-role">
              <h3><span>Rejoindre</span></h3>
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
        </div>
      </div>
    );
  }

  if (net.mode === 'guest') {
    return (
      <div className="screen coop-lobby">
        <header className="bar">
          <button className="btn small" onClick={() => { leave(); setScreen('menu'); }}>← Quitter</button>
          <h2>🌐 Salon — invité</h2>
        </header>
        <div className="coop-body">
          {myAnswer ? (
            <section className="zone-section">
              <h3><span>Code de réponse — à renvoyer à l'hôte</span></h3>
              <textarea readOnly value={myAnswer} rows={3} onFocus={(e) => e.currentTarget.select()} />
              <button className="btn small" onClick={() => copy(myAnswer)}>📋 Copier</button>
            </section>
          ) : null}
          <p className="hint">⏳ En attente de l'hôte…</p>
        </div>
      </div>
    );
  }

  // ── HÔTE ──
  const seats = Object.entries(net.seatNames).map(([s, n]) => ({ seat: Number(s), name: n }));
  return (
    <div className="screen coop-lobby">
      <header className="bar">
        <button className="btn small" onClick={() => { leave(); setScreen('menu'); }}>← Quitter</button>
        <h2>🌐 Salon — hôte</h2>
      </header>
      <div className="coop-body">
        <section className="zone-section">
          <h3><span>Joueurs connectés</span></h3>
          <ul className="coop-seats">
            {seats.map(({ seat, name: n }) => (
              <li key={seat}>{seat === 0 ? '👑' : '🟢'} {n}{seat === 0 ? ' (vous)' : ''}</li>
            ))}
          </ul>
        </section>
        <section className="zone-section">
          <h3><span>Inviter un joueur</span></h3>
          <CoopInvitePanel />
        </section>
        <section className="zone-section">
          <h3><span>Attribution des héros</span></h3>
          <CoopAssignList />
        </section>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={() => setScreen('party')}>
            Continuer vers la partie →
          </button>
        </div>
      </div>
    </div>
  );
}
