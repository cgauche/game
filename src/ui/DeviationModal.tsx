import { useGame } from '../state/store';
import { HIT_LOCATION_LABELS } from '../engine/types';
import { Modal } from './Modal';
import { CriticalBody } from './RevealModal';

/**
 * Déviation Critique (LDB 63 l.63-66) : quand un HÉROS encaisse un Coup Critique, il peut « Dévier » —
 * sacrifier 1 Point d'Armure à la localisation pour IGNORER l'effet critique (il subit alors les Blessures
 * normales recalculées, PA réduite). Le Coup Critique pré-tiré est AFFICHÉ ici (même rendu que la modale de
 * Critique, via `CriticalBody`) : le choix Dévier/Subir et la révélation sont sur UNE SEULE modale. « Subir »
 * applique exactement ce Critique. Sans armure à la zone, « Dévier » est grisé (on informe quand même).
 */
export function DeviationModal() {
  const pdv = useGame((s) => s.pendingDeviation);
  const battle = useGame((s) => s.battle);
  const apply = useGame((s) => s.deviationApply);
  if (!pdv || !battle) return null;
  const target = battle.combatants.find((c) => c.id === pdv.targetId);
  const attacker = battle.combatants.find((c) => c.id === pdv.attackerId);
  if (!target) return null;
  const loc = pdv.res.location ?? 'corps';
  const pa = target.armour[loc] ?? 0;
  const canDeviate = pa > 0;
  return (
    <Modal title="💥 Coup Critique" variant="test">
      <CriticalBody entry={pdv.reveal} actor={attacker} subject={target} />
      <div className={`dev-zone ${canDeviate ? '' : 'bare'}`}>
        🛡️ {HIT_LOCATION_LABELS[loc]} —{' '}
        {canDeviate ? <>PA <b>{pa}</b> · dévier la réduirait à {pa - 1}</> : 'aucune armure (zone non protégée)'}
      </div>
      <p className="rm-log">
        {canDeviate
          ? "Dévier : sacrifier 1 Point d'Armure pour IGNORER ce Critique (le coup inflige alors ses Blessures normales recalculées, PA réduite)."
          : "Sans armure à cette localisation, la déviation est impossible : le Coup Critique sera subi."}
      </p>
      <div className="modal-actions">
        <button className="btn" onClick={() => apply(false)} title="Encaisser le Coup Critique affiché ci-dessus">
          Subir
        </button>
        <button
          className="btn btn-primary"
          disabled={!canDeviate}
          onClick={() => apply(true)}
          title={canDeviate ? "Sacrifier 1 Point d'Armure pour ignorer le Coup Critique (LDB 63 l.63-66)" : 'Aucune armure à sacrifier à cette localisation'}
        >
          🛡️ Dévier (−1 PA)
        </button>
      </div>
    </Modal>
  );
}
