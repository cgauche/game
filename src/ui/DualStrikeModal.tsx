import { useGame } from '../state/store';
import { dualStrikeTargets } from '../state/combatFlow';
import { Modal } from './Modal';

/**
 * Modale du Maniement de deux armes (LDB 10 l.638). Après une 1ʳᵉ frappe RÉUSSIE de la main directrice, le
 * héros PEUT viser « un adversaire disponible de votre choix » avec sa main secondaire (jet imposé : d100
 * inversé / valeur du Critique + pénalité de main 2nde, nouveau jet de défense). Optionnel → bouton Renoncer.
 * Masquée tant que le jet de la 2ᵉ frappe est en cours (`pendingAttack` prend la main — « un jet = une modale »).
 */
export function DualStrikeModal() {
  const ds = useGame((s) => s.pendingDualStrike);
  const pa = useGame((s) => s.pendingAttack);
  const battle = useGame((s) => s.battle);
  const dualStrikeAttack = useGame((s) => s.dualStrikeAttack);
  const dualStrikeSkip = useGame((s) => s.dualStrikeSkip);
  if (!ds || !battle || pa) return null; // le jet de la 2ᵉ frappe en cours → on affiche d'abord son jet
  const attacker = battle.combatants.find((c) => c.id === ds.attackerId);
  const off = attacker?.weapons.find((w) => w.uid === ds.offWeaponUid);
  if (!attacker || !off) return null;
  const targets = dualStrikeTargets(battle, attacker, off);

  return (
    <Modal title="⚔️ Des deux armes" onClose={dualStrikeSkip}>
        <p className="rm-vs">
          <strong>{attacker.name}</strong> frappe de sa main secondaire (<em>{off.name}</em>) — cible au choix
        </p>
        {targets.length ? (
          <div className="rm-loc">
            <div className="rm-loc-grid">
              {targets.map((t) => (
                <button
                  key={t.id}
                  className="btn small btn-primary"
                  onClick={() => dualStrikeAttack(t.id)}
                  title="2ᵉ frappe (jet inversé + pénalité de main secondaire) opposée à une nouvelle défense"
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
          <button className="btn" onClick={dualStrikeSkip} title="Ne pas frapper de la 2ᵉ arme (pas d'Avantage gagné)">
            Renoncer
          </button>
        </div>
    </Modal>
  );
}
