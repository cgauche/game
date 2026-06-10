import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { corruptionGain, EXPOSURE_LABELS } from '../engine/corruption';
import { RollFlowShell } from './RollFlowShell';
import { testBreakdown } from './breakdown';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';

/**
 * Exposition à une Influence corruptrice (LDB 19 l.23-75) : Test de Résistance
 * (Influence physique) ou de Calme (spirituelle) — le gain de Points de Corruption
 * dépend du niveau d'exposition ET du DR, donc la Chance « +1 DR » peut sauver
 * l'âme. Test imposé (pas d'« Annuler »).
 */
export function CorruptionModal() {
  const pc = useGame((s) => s.pendingCorruption);
  const party = useGame((s) => s.party);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.corruptionRoll);
  const reroll = useGame((s) => s.corruptionReroll);
  const bonusSL = useGame((s) => s.corruptionBonusSL);
  const resolve = useGame((s) => s.resolveCorruption);
  if (!pc) return null;
  const pool = battle?.combatants ?? party;
  const hero = pool.find((c) => c.id === pc.heroId);
  const rolled = pc.roll != null;
  const gain = rolled ? corruptionGain(pc.level, !!pc.success, pc.sl ?? 0) : 0;
  const outcomeText =
    gain === 0
      ? `${hero?.name ?? '?'} repousse l'Influence corruptrice.`
      : `${hero?.name ?? '?'} subit ${gain} Point${gain > 1 ? 's' : ''} de Corruption.`;

  return (
    <RollFlowShell
      variant="test"
      title={<>🕯️ Influence corruptrice ({EXPOSURE_LABELS[pc.level]})</>}
      subtitle={
        <>
          <strong>{hero?.name ?? '?'}</strong> — Test de {pc.skill} Intermédiaire (+0)
        </>
      }
      rolled={rolled}
      onRoll={roll}
      breakdown={rolled ? testBreakdown(`Test de ${pc.skill}`, pc.target ?? 0, { roll: pc.roll!, target: pc.target, sl: pc.sl, success: pc.success }) : undefined}
      outcome={rolled && <JournalLine className="rm-journal" event={ev('info', outcomeText, pc.heroId)} combatants={pool} />}
      fortune={hero?.fortune ?? 0}
      freeReroll={freeRerollOf(hero)}
      rerollable={rolled && canReroll(pc.roll! > (pc.target ?? 0), !!pc.rerolled)}
      onReroll={reroll}
      onBonusSL={bonusSL}
      confirmLabel="Continuer"
      onConfirm={resolve}
    />
  );
}
