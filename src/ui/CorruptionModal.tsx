import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { corruptionGain, EXPOSURE_LABELS } from '../engine/corruption';
import { RollFlowShell, Dice } from './RollFlowShell';

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

  return (
    <RollFlowShell
      variant="test"
      title={<>🕯️ Influence corruptrice ({EXPOSURE_LABELS[pc.level]})</>}
      subtitle={
        <>
          <strong>{hero?.name ?? '?'}</strong> — Test de {pc.skill} Intermédiaire (+0)
          {rolled ? <> · cible {pc.target}</> : null}
        </>
      }
      rolled={rolled}
      onRoll={roll}
      resultOk={gain === 0}
      result={
        rolled && (
          <>
            <span className="dice">
              <Dice roll={pc.roll!} />
            </span>
            <span className="vs">/ {pc.target}</span>
            <span className="verdict">
              {pc.success ? 'Réussite' : 'Échec'} ({(pc.sl ?? 0) >= 0 ? '+' : ''}
              {pc.sl} DR) — {gain === 0 ? 'Influence repoussée' : `+${gain} Point${gain > 1 ? 's' : ''} de Corruption`}
            </span>
          </>
        )
      }
      fortune={hero?.fortune ?? 0}
      rerollable={rolled && canReroll(pc.roll! > (pc.target ?? 0), !!pc.rerolled)}
      onReroll={reroll}
      onBonusSL={bonusSL}
      confirmLabel="Continuer"
      onConfirm={resolve}
    />
  );
}
