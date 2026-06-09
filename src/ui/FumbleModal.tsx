import { useGame, type PendingFumble } from '../state/store';
import { TeamPortrait } from './CombatantBadge';
import type { Combatant } from '../engine/types';

/** Vue pure de la modale de Maladresse (testable sans store). Pas de Chance : elle agit AVANT
 *  qu'un Test devienne une Maladresse ; une fois la Maladresse actée, l'Oups ! est subi.
 *  Affiche le portrait du combattant concerné (« à qui ça s'applique »). */
export function FumbleModalView({
  pf,
  name,
  combatant,
  onRoll,
  onConfirm,
}: {
  pf: PendingFumble;
  name: string;
  combatant?: Combatant;
  onRoll: () => void;
  onConfirm: () => void;
}) {
  const r = pf.result;
  return (
    <div className="modal-overlay">
      <div className="modal test-modal">
        <h3>Maladresse !</h3>
        {combatant && (
          <div className="modal-subject">
            <TeamPortrait combatant={combatant} size={38} />
            <strong>{combatant.name}</strong>
          </div>
        )}
        <p className="test-actor">
          <strong>{name}</strong> — Test de combat raté sur un double (Tableau des Oups !, LDB)
        </p>

        {!r ? (
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={onRoll}>
              🎲 Lancer sur le Tableau des Oups !
            </button>
          </div>
        ) : (
          <>
            <div className="test-result fail">
              <span className="dice">{r.roll === 100 ? '00' : String(r.roll).padStart(2, '0')}</span>
              <span className="verdict">{r.label}</span>
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={onConfirm}>
                Appliquer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Maladresse d'un héros (LDB 14 — Tableau des Oups !) : « Lancer » tire l'effet, « Appliquer » le subit. */
export function FumbleModal() {
  const pf = useGame((s) => s.pendingFumble);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.fumbleRoll);
  const confirm = useGame((s) => s.fumbleConfirm);
  if (!pf || !battle) return null;
  const combatant = battle.combatants.find((c) => c.id === pf.combatantId);
  return <FumbleModalView pf={pf} name={combatant?.name ?? '?'} combatant={combatant} onRoll={roll} onConfirm={confirm} />;
}
