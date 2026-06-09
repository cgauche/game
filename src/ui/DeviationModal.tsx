import { useGame } from '../state/store';
import { HIT_LOCATION_LABELS } from '../engine/types';
import { TeamPortrait } from './CombatantBadge';

/**
 * Déviation Critique (Livre de base p.63 l.63-66) : quand un HÉROS encaisse un Coup Critique à une
 * localisation où il porte de la PA, il peut « Dévier » — sacrifier 1 Point d'Armure (la pièce perd
 * 1 de durabilité) pour IGNORER le Critique. Il subit alors les Blessures normales recalculées avec
 * la PA réduite (typiquement +1 Blessure), mais évite l'effet de la table des Critiques. Sinon il
 * « Subit » le Coup Critique. Les ennemis dévient automatiquement (résolu sans modale, combatFlow).
 */
export function DeviationModal() {
  const pdv = useGame((s) => s.pendingDeviation);
  const battle = useGame((s) => s.battle);
  const apply = useGame((s) => s.deviationApply);
  if (!pdv || !battle) return null;
  const target = battle.combatants.find((c) => c.id === pdv.targetId);
  if (!target) return null;
  const loc = pdv.res.location ?? 'corps';
  const pa = target.armour[loc] ?? 0;
  return (
    <div className="modal-overlay">
      <div className="modal roll-modal">
        <h3>Coup Critique — {HIT_LOCATION_LABELS[loc]}</h3>
        <div className="modal-subject">
          <TeamPortrait combatant={target} size={38} />
          <strong>{target.name}</strong>
        </div>
        <p className="rm-log">
          {target.name} encaisse un Coup Critique ({HIT_LOCATION_LABELS[loc]}). Sacrifier 1 PA
          d'armure (PA {pa} → {Math.max(0, pa - 1)}) pour l'ignorer ? Le coup inflige alors ses
          Blessures normales (un peu plus, PA réduite) mais sans effet critique.
        </p>
        <div className="modal-actions">
          <button className="btn" onClick={() => apply(false)} title="Encaisser le Coup Critique (table des Critiques)">
            Subir le critique
          </button>
          <button
            className="btn btn-primary"
            onClick={() => apply(true)}
            title="Sacrifier 1 Point d'Armure pour ignorer le Coup Critique"
          >
            🛡️ Dévier (−1 PA)
          </button>
        </div>
      </div>
    </div>
  );
}
