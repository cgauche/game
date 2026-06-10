import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { RollFlowShell, Dice } from './RollFlowShell';

/**
 * Modale d'entrée en Frénésie (LDB 21 l.32) : « Lancer » jette le Test de Force Mentale,
 * « Relancer »/« Réussite garantie » dépensent Chance/Résilience, « Appliquer » fige le résultat
 * (entre en Frénésie sur succès). Test binaire (pas de DR) → pas de « +1 DR ». Invariante « un jet = une modale ».
 */
export function FrenzyModal() {
  const pf = useGame((s) => s.pendingFrenzy);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.frenzyRoll);
  const reroll = useGame((s) => s.frenzyReroll);
  const force = useGame((s) => s.frenzyForceSuccess);
  const confirm = useGame((s) => s.frenzyConfirm);
  const cancel = useGame((s) => s.frenzyCancel);
  if (!pf || !battle) return null;
  const c = battle.combatants.find((x) => x.id === pf.combatantId);
  if (!c) return null;
  const r = pf.result;

  return (
    <RollFlowShell
      title="🐗 Frénésie"
      subtitle={
        <>
          <strong>{c.name}</strong> tente d'entrer en Frénésie (Test de Force Mentale)
        </>
      }
      rolled={!!r}
      onRoll={roll}
      onCancel={cancel}
      resultOk={!!r?.success}
      result={
        r && (
          <>
            <span className="dice">
              <Dice roll={r.roll} />
            </span>
            <span className="verdict">{r.success ? 'Réussi ! +1 BF, immunité psy, attaque obligatoire' : 'Échec — le sang ne monte pas ce tour'}</span>
          </>
        )
      }
      fortune={c.fortune ?? 0}
      rerollable={!!r && !r.success && canReroll(true, !!pf.rerolled)}
      onReroll={reroll}
      resilience={c.resilience ?? 0}
      onForce={force}
      forceShow={!r?.success}
      onConfirm={confirm}
    />
  );
}
