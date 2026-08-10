import { useGame } from '../state/store';
import { Modal } from './Modal';
import { OptionChooser, ChoiceButtons } from './OptionChooser';
import { Icon } from './Icon';
import { flowStakeRef } from '../data';
import { StakeNote, StakeRule, stakeRuleOf } from './StakeNote';

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
  const stake = flowStakeRef('fateSave', 'choice');

  return (
    /* Décision DE COMBAT : coquille de jet (voile allégé + ancrage haut) — le coup fatal se lit sous la fenêtre. */
    <Modal title={<><Icon id="resource/fate" size="sm" /> Le Destin <StakeRule rule={stakeRuleOf(stake)} label="Le Destin" /></>} subject={hero}>
      <p className="rm-log">
        {p.source === 'hit' ? 'Un coup fatal le frappe !' : 'Ses blessures l’emportent…'} Sacrifier un Point de Destin ?
        (il en reste {fate})
      </p>
      {/* Z3b : la fenêtre de décision dit ce qu'elle met en jeu — même primitive, même donnée. */}
      <StakeNote stake={stake} />
      <div className="rm-options">
        <OptionChooser
          layout="grid"
          options={[
            { key: 'negate', label: <><Icon id="resource/fortune" size="sm" /> Comment ça a pu rater ?</>, hidden: p.source !== 'hit', onSelect: negate, title: 'Évite tout le coup et reste en combat (Destin −1)' },
            { key: 'survive', label: <><Icon id="resource/lifeline" size="sm" /> Meurs un autre jour</>, onSelect: survive, title: 'Survit mais quitte le combat (Destin −1)' },
          ]}
        />
      </div>
      <ChoiceButtons options={[{ key: 'accept', label: <><Icon id="journal/death" size="sm" /> Accepter le sort</>, primary: true, onSelect: accept, title: 'Le héros meurt' }]} />
    </Modal>
  );
}
