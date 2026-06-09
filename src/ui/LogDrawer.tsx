import { useState } from 'react';
import { narrateEvent } from '../gameIso/combatNarration';
import type { CombatEvent } from '../state/combatLog';

/** Forme minimale acceptée pour les combattants (suffit à `narrateEvent` — id/name/kind). */
interface ComLite { id: string; name: string; kind: string; }

/**
 * Journal en TIROIR (bas-droite, replié par défaut — façon BG3, mobile-first).
 * Deux contenus, un composant : en combat les événements structurés `battle.log` rendus par
 * `narrateEvent` (icône par kind + noms colorés par camp) ; en exploration le journal du groupe.
 * `initialOpen` = aide de test (SSR sans interaction). Pur à props.
 */
export function LogDrawer({ battle, journal, initialOpen = false }: {
  battle: { log: CombatEvent[]; combatants: ComLite[] } | null;
  journal: string[];
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <div className={`log-drawer ${open ? 'open' : ''}`}>
      {open && (
        <div className="ld-panel">
          <div className="mini-title">{battle ? 'Journal de combat' : 'Journal'}</div>
          {battle
            ? battle.log.slice(-30).map((l, i) => {
                const n = narrateEvent(l, battle.combatants);
                return (
                  <p key={i} className="jr-line">
                    <span className="jr-ic">{n.icon}</span>
                    <span className="jr-tx">
                      {n.segments.map((s, j) =>
                        s.team ? (
                          <b key={j} className={s.team === 'ally' ? 'nm-ally' : 'nm-foe'}>{s.text}</b>
                        ) : (
                          <span key={j}>{s.text}</span>
                        ),
                      )}
                    </span>
                  </p>
                );
              })
            : journal.slice(-30).map((l, i) => (
                <p key={i} className="jr-line"><span className="jr-tx">{l}</span></p>
              ))}
          {!battle && journal.length === 0 && <p className="empty">— rien à signaler —</p>}
        </div>
      )}
      <button type="button" className="ld-btn" onClick={() => setOpen(!open)} title={open ? 'Fermer le journal' : 'Ouvrir le journal'}>
        📜
      </button>
    </div>
  );
}
