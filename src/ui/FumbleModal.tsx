import { useGame, type PendingFumble } from '../state/store';
import { Modal } from './Modal';
import { TableRollLine } from './RollLine';
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
    <Modal title="🎲 Maladresse !" subject={combatant} variant="test">
      <p className="test-actor">
        <strong>{name}</strong> — Test de combat raté sur un double (Tableau des Oups !)
      </p>

      {!r ? (
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onRoll}>
            🎲 Lancer sur le Tableau des Oups !
          </button>
        </div>
      ) : (
        <>
          <TableRollLine table="Tableau des Oups !" roll={r.roll} result={r.label} />
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={onConfirm}>
              Appliquer
            </button>
          </div>
        </>
      )}
    </Modal>
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
