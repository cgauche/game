import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { EXPOSURE_LABELS } from '../engine/corruption';
import { testValue } from '../engine/skills';
import { refLabel } from '../data';
import { RollFlowShell } from './RollFlowShell';
import { OptionChooser } from './OptionChooser';
import { testBreakdown, testPending } from './breakdown';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { describeCorruption } from '../state/flowOutcomes';

/**
 * Exposition à une Influence corruptrice (LDB 19 l.23-75) : Test de Résistance
 * (Influence physique) ou de Calme (spirituelle) — le gain de Points de Corruption
 * dépend du niveau d'exposition ET du DR, donc la Chance « +1 DR » peut sauver
 * l'âme. Test imposé (pas d'« Annuler »).
 *
 * MÊME modale pour le SEUIL de Corruption (kind 'seuil', LDB 19 l.80) : Test de Résistance
 * au franchissement — succès = contenu « pour cette fois » ; échec = « Je te renie ! »/mutation.
 */
export function CorruptionModal() {
  const pc = useGame((s) => s.pendingCorruption);
  const party = useGame((s) => s.party);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.corruptionRoll);
  const setSkill = useGame((s) => s.corruptionSetSkill);
  const reroll = useGame((s) => s.corruptionReroll);
  const bonusSL = useGame((s) => s.corruptionBonusSL);
  const darkPact = useGame((s) => s.corruptionDarkPact);
  const resolve = useGame((s) => s.resolveCorruption);
  if (!pc) return null;
  const pool = battle?.combatants ?? party;
  const hero = pool.find((c) => c.id === pc.heroId);
  const rolled = pc.roll != null;
  const seuil = pc.kind === 'seuil';
  // Pré-jet (audit M6) : `pc.target` n'existe qu'après resolve → base réelle du Test affichée
  // AVANT le jet (même parité que les autres flux RollFlowShell).
  const base = hero ? testValue(hero, pc.skill) : 0;
  const skillLabel = refLabel('skills', { id: pc.skill }); // 'Résistance' / 'Calme' (affichage)

  return (
    <RollFlowShell
      variant="test"
      title={seuil ? <>🧬 Seuil de Corruption ({hero?.corruption ?? '?'} Points)</> : <>🕯️ Influence corruptrice ({EXPOSURE_LABELS[pc.level ?? 'mineure']})</>}
      subtitle={
        <>
          <strong>{hero?.name ?? '?'}</strong> — Test de {skillLabel} Intermédiaire (+0)
        </>
      }
      rolled={rolled}
      onRoll={roll}
      setup={
        // Compétence indéterminée en amont (LDB 19 l.26) → le joueur tranche Résistance/Calme (cf.
        // Défense). Déterminée par la source (`skillLocked`) ou au seuil → pas de choix.
        !seuil && !pc.skillLocked && hero ? (
          <div className="rm-options">
            <OptionChooser
              layout="seg"
              groupLabel="Compétence"
              options={[
                { key: 'resistance', label: refLabel('skills', { id: 'resistance' }), value: testValue(hero, 'resistance'), selected: pc.skill === 'resistance', title: 'Influence physique', onSelect: () => setSkill('resistance') },
                { key: 'calme', label: refLabel('skills', { id: 'calme' }), value: testValue(hero, 'calme'), selected: pc.skill === 'calme', title: 'Corruption spirituelle', onSelect: () => setSkill('calme') },
              ]}
            />
          </div>
        ) : undefined
      }
      breakdown={rolled ? testBreakdown(`Test de ${skillLabel}`, base, { roll: pc.roll!, target: pc.target, sl: pc.sl, success: pc.success }, 'intermediaire') : undefined}
      pending={testPending(`Test de ${skillLabel}`, base, undefined, 'intermediaire')}
      outcome={rolled && <JournalLine className="rm-journal" event={ev('info', describeCorruption(pc, hero?.name ?? '?'), pc.heroId)} combatants={pool} />}
      fortune={hero?.fortune ?? 0}
      freeReroll={freeRerollOf(hero)}
      rerollable={rolled && canReroll(pc.roll! > (pc.target ?? 0), !!pc.rerolled)}
      onReroll={reroll}
      onBonusSL={bonusSL}
      darkPactable={rolled && pc.roll! > (pc.target ?? 0)}
      onDarkPact={darkPact}
      confirmLabel="Continuer"
      onConfirm={resolve}
    />
  );
}
