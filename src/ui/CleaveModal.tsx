import { useGame } from '../state/store';
import { cleaveTargets } from '../state/combatFlow';
import { bonus, effectiveChar } from '../engine/characteristics';
import { Modal } from './Modal';

/**
 * Modale de Frappe Mortelle — balayage (LDB 14 - _GoBack.md l.9-12 + 85 l.299). Après la touche
 * d'un héros plus grand, il peut enchaîner une attaque sur d'autres adversaires adjacents, jusqu'à
 * son Bonus de CC fois. Masquée tant qu'une attaque d'enchaînement est en cours (le jet
 * `pendingAttack` prend la main — « un jet = une modale »).
 */
export function CleaveModal() {
  const pc = useGame((s) => s.pendingCleave);
  const pa = useGame((s) => s.pendingAttack);
  const battle = useGame((s) => s.battle);
  const cleaveAttack = useGame((s) => s.cleaveAttack);
  const cleaveEnd = useGame((s) => s.cleaveEnd);
  if (!pc || !battle || pa) return null; // une attaque d'enchaînement en cours → on affiche d'abord son jet
  const attacker = battle.combatants.find((c) => c.id === pc.attackerId);
  if (!attacker) return null;
  const targets = cleaveTargets(battle, attacker, pc.hitIds);
  const bcc = bonus(effectiveChar(attacker, 'CC'));

  return (
    <Modal title="⚔️ Frappe Mortelle" onClose={cleaveEnd}>
        <p className="rm-vs">
          <strong>{attacker.name}</strong> balaie — enchaînement {pc.count + 1} / {bcc}
        </p>
        {targets.length ? (
          <div className="rm-loc">
            <div className="rm-loc-grid">
              {targets.map((t) => (
                <button
                  key={t.id}
                  className="btn small btn-primary"
                  onClick={() => cleaveAttack(t.id)}
                  title="Enchaîne une attaque de mêlée sur cet adversaire adjacent"
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="rm-log">Plus d'adversaire à portée.</p>
        )}
        <div className="modal-actions">
          <button className="btn" onClick={cleaveEnd}>
            Terminer
          </button>
        </div>
    </Modal>
  );
}
