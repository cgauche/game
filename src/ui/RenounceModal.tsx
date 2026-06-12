import { useGame } from '../state/store';
import { Modal } from './Modal';

/**
 * « Je te renie ! » (LDB 17 l.71) : le héros a échoué au Test de Résistance du seuil de Corruption —
 * la mutation menace. Il peut sacrifier 1 Point de Résilience pour la REFUSER : « vous pouvez choisir
 * de ne pas développer la mutation obtenue. Et comme vous ne mutez pas, vous ne perdez aucun Point
 * de Corruption. » Sinon, la mutation s'applique (−BFM Points, tirage sur le Tableau).
 */
export function RenounceModal() {
  const pr = useGame((s) => s.pendingRenounce);
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const resolve = useGame((s) => s.renounceResolve);
  if (!pr) return null;
  const hero = (battle?.combatants ?? party).find((c) => c.id === pr.heroId);
  if (!hero) return null;
  const resilience = hero.resilience ?? 0;
  return (
    <Modal title="🧬 La Corruption gagne du terrain" variant="test">
      <p className="rm-log">
        <b>{hero.name}</b> échoue à contenir sa Corruption (Résistance 🎲 {pr.testRoll}/{pr.testTarget}) — une{' '}
        <b>mutation</b> menace de se développer.
      </p>
      <p className="rm-log">
        « Je te renie ! » : sacrifier <b>1 Point de Résilience</b> ({resilience} restant{resilience > 1 ? 's' : ''}) pour
        refuser la mutation. Les Points de Corruption restent — la menace reviendra.
      </p>
      <div className="modal-actions">
        <button className="btn" onClick={() => resolve(false)} title="Laisser la mutation se développer (tirage sur le Tableau des Corruptions)">
          🎲 Subir la mutation
        </button>
        <button className="btn btn-primary" disabled={resilience <= 0} onClick={() => resolve(true)} title="Refuser la mutation — 1 Point de Résilience">
          ✊ Je te renie ! (−1 Résilience)
        </button>
      </div>
    </Modal>
  );
}
