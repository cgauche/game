import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { corruptionGain, EXPOSURE_LABELS } from '../engine/corruption';
import { testValue } from '../engine/skills';
import { RollFlowShell } from './RollFlowShell';
import { OptionChooser } from './OptionChooser';
import { testBreakdown, testPending } from './breakdown';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';

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
  const gain = rolled && !seuil ? corruptionGain(pc.level ?? 'mineure', !!pc.success, pc.sl ?? 0) : 0;
  const outcomeText = seuil
    ? pc.success
      ? `${hero?.name ?? '?'} contient sa Corruption — pour cette fois.`
      : `${hero?.name ?? '?'} échoue — une mutation menace de se développer…`
    : gain === 0
      ? `${hero?.name ?? '?'} repousse l'Influence corruptrice.`
      : `${hero?.name ?? '?'} subit ${gain} Point${gain > 1 ? 's' : ''} de Corruption.`;

  return (
    <RollFlowShell
      variant="test"
      title={seuil ? <>🧬 Seuil de Corruption ({hero?.corruption ?? '?'} Points)</> : <>🕯️ Influence corruptrice ({EXPOSURE_LABELS[pc.level ?? 'mineure']})</>}
      subtitle={
        <>
          <strong>{hero?.name ?? '?'}</strong> — Test de {pc.skill} Intermédiaire (+0)
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
                { key: 'Résistance', label: 'Résistance', value: testValue(hero, 'Résistance'), selected: pc.skill === 'Résistance', title: 'Influence physique', onSelect: () => setSkill('Résistance') },
                { key: 'Calme', label: 'Calme', value: testValue(hero, 'Calme'), selected: pc.skill === 'Calme', title: 'Corruption spirituelle', onSelect: () => setSkill('Calme') },
              ]}
            />
          </div>
        ) : undefined
      }
      breakdown={rolled ? testBreakdown(`Test de ${pc.skill}`, base, { roll: pc.roll!, target: pc.target, sl: pc.sl, success: pc.success }, 'intermediaire') : undefined}
      pending={testPending(`Test de ${pc.skill}`, base, undefined, 'intermediaire')}
      outcome={rolled && <JournalLine className="rm-journal" event={ev('info', outcomeText, pc.heroId)} combatants={pool} />}
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
