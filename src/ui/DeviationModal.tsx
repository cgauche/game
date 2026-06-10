import { useGame } from '../state/store';
import { HIT_LOCATION_LABELS } from '../engine/types';
import { Modal } from './Modal';

/**
 * Déviation Critique (LDB 63 l.63-66) : quand un HÉROS encaisse un Coup Critique, il peut « Dévier » —
 * sacrifier 1 Point d'Armure (durabilité) à la localisation pour IGNORER l'effet critique (il subit alors
 * les Blessures normales recalculées). La modale s'ouvre MÊME sans armure : on INFORME que la déviation
 * existe, mais le bouton « Dévier » est grisé et la protection de la zone (PA) est affichée. Cadre `Modal`.
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
    <Modal title={`💥 Coup Critique — ${HIT_LOCATION_LABELS[loc]}`} subject={target} subjectPv>
      <p className="rm-log">
        {attacker ? `${attacker.name} inflige un Coup Critique à ${target.name}` : `${target.name} encaisse un Coup Critique`} ({HIT_LOCATION_LABELS[loc]}).
      </p>
      <div className={`dev-zone ${canDeviate ? '' : 'bare'}`}>
        🛡️ {HIT_LOCATION_LABELS[loc]} —{' '}
        {canDeviate ? (
          <>
            PA <b>{pa}</b> · dévier la réduirait à {pa - 1}
          </>
        ) : (
          'aucune armure (zone non protégée)'
        )}
      </div>
      <p className="rm-log">
        {canDeviate
          ? "Sacrifier 1 Point d'Armure (durabilité) pour IGNORER l'effet critique ? Le coup inflige alors ses Blessures normales (un peu plus, PA réduite) mais pas de Blessure critique."
          : "Sans armure à cette localisation, la déviation est impossible : le Coup Critique sera subi."}
      </p>
      <div className="modal-actions">
        <button className="btn" onClick={() => apply(false)} title="Encaisser le Coup Critique (table des Critiques)">
          Subir le critique
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
