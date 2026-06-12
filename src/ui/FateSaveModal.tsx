import { useGame } from '../state/store';
import { Modal } from './Modal';

/**
 * Sauvetage par le Destin (LDB « Destin et Résistance » ch.17 l.31-35) : quand un héros à Destin
 * est sur le point de mourir (coup létal ou mort lente), on suspend et on propose de sacrifier un
 * Point de Destin — « Comment ça a pu rater ? » (annule le coup, coup létal seulement),
 * « Meurs un autre jour » (survit mais quitte la rencontre), ou accepter la mort.
 */
export function FateSaveModal() {
  const p = useGame((s) => s.pendingFateSave);
  const battle = useGame((s) => s.battle);
  const negate = useGame((s) => s.fateNegate);
  const survive = useGame((s) => s.fateSurvive);
  const accept = useGame((s) => s.fateAccept);
  if (!p || !battle) return null;
  const hero = battle.combatants.find((c) => c.id === p.heroId);
  if (!hero) return null;
  const fate = hero.fate ?? 0;

  return (
    <Modal title="☄️ Le Destin" subject={hero} variant="test">
      <p className="rm-log">
        {p.source === 'hit' ? 'Un coup fatal le frappe !' : 'Ses blessures l’emportent…'} Sacrifier un Point de Destin ?
        (il en reste {fate})
      </p>
      <div className="rm-options">
        <div className="rm-loc-grid">
          {p.source === 'hit' && (
            <button className="btn small" onClick={negate} title="Évite tout le coup et reste en combat (Destin −1)">
              🍀 Comment ça a pu rater ?
            </button>
          )}
          <button className="btn small" onClick={survive} title="Survit mais quitte le combat (Destin −1)">
            🛟 Meurs un autre jour
          </button>
        </div>
      </div>
      <div className="modal-actions">
        <button className="btn btn-primary" onClick={accept} title="Le héros meurt">
          ☠️ Accepter le sort
        </button>
      </div>
    </Modal>
  );
}
