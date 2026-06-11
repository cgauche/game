import { useState } from 'react';
import { useGame } from '../state/store';

/**
 * Briques coop PARTAGÉES (lobby « Jouer en ligne » ET menu ☰ en partie — Jalon 7 P3c
 * reconnexion) : inviter par code / coller la réponse, et attribuer les héros aux sièges.
 * Un invité déconnecté revient par une NOUVELLE invitation (les codes sont à usage unique) ;
 * l'hôte lui réattribue ensuite ses héros ici.
 */
export function CoopInvitePanel() {
  const invite = useGame((s) => s.netInvite);
  const acceptAnswer = useGame((s) => s.netAcceptAnswer);
  const [inviteCode, setInviteCode] = useState('');
  const [answerIn, setAnswerIn] = useState('');
  const [error, setError] = useState('');
  const copy = (text: string) => void navigator.clipboard?.writeText(text).catch(() => {});
  return (
    <div className="coop-invite">
      <button
        className="btn"
        onClick={async () => {
          setError('');
          const code = await invite();
          if (!code) setError('Impossible de générer une invitation.');
          else setInviteCode(code);
        }}
      >
        ➕ Générer une invitation
      </button>
      {inviteCode && (
        <>
          <textarea readOnly value={inviteCode} rows={3} onFocus={(e) => e.currentTarget.select()} />
          <button className="btn small" onClick={() => copy(inviteCode)}>📋 Copier</button>
        </>
      )}
      <textarea value={answerIn} onChange={(e) => setAnswerIn(e.target.value)} placeholder="Coller la réponse de l'invité…" rows={3} />
      <button
        className="btn"
        disabled={!answerIn.trim()}
        onClick={async () => {
          setError('');
          const ok = await acceptAnswer(answerIn);
          if (!ok) setError('Code de réponse invalide.');
          else { setAnswerIn(''); setInviteCode(''); }
        }}
      >
        ✓ Connecter
      </button>
      {error && <p className="hint coop-error">{error}</p>}
    </div>
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

/** Section coop du menu ☰ (HÔTE en partie) : sièges connectés + réinviter + réattribuer. */
export function CoopMenuSection() {
  const net = useGame((s) => s.net);
  if (net.mode !== 'host') return null;
  const seats = Object.entries(net.seatNames).map(([s, n]) => ({ seat: Number(s), name: n }));
  return (
    <div className="gm-section">
      <span className="mini-title">🌐 Coop — joueurs</span>
      <ul className="coop-seats">
        {seats.map(({ seat, name }) => (
          <li key={seat}>{seat === 0 ? '👑' : '🟢'} {name}</li>
        ))}
      </ul>
      <CoopInvitePanel />
      <CoopAssignList />
    </div>
  );
}
