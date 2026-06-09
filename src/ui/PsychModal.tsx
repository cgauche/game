import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { CIBLE_TYPES } from '../engine/psychology';
import { RollFlowShell, Dice } from './RollFlowShell';

/** Libellés des Traits psy ciblés (LDB 21). */
const CIBLE_LABEL: Record<string, { emoji: string; label: string }> = {
  animosite: { emoji: '😤', label: 'Animosité' },
  haine: { emoji: '😡', label: 'Haine' },
  prejuge: { emoji: '🙄', label: 'Préjugé' },
  amour: { emoji: '❤️', label: 'Amour' },
  camaraderie: { emoji: '🤝', label: 'Camaraderie' },
  phobie: { emoji: '🕷️', label: 'Phobie' },
};

/**
 * Modale de Test de Psychologie (Calme) du héros (LDB 21) : Peur (Test ÉTENDU — cumuler le DR vers
 * l'Indice), Terreur (1ʳᵉ rencontre → Brisé), ou Trait CIBLÉ (Animosité/Haine/… — Test binaire visant
 * un groupe). « Lancer » → « Chance » → « Appliquer ». Test obligatoire (pas d'« Annuler »).
 * Invariante « un jet = une modale ».
 */
export function PsychModal() {
  const pp = useGame((s) => s.pendingPsych);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.psychRoll);
  const reroll = useGame((s) => s.psychReroll);
  const bonusSL = useGame((s) => s.psychBonusSL);
  const force = useGame((s) => s.psychForceSuccess);
  const confirm = useGame((s) => s.psychConfirm);
  if (!pp || !battle) return null;
  const c = battle.combatants.find((x) => x.id === pp.combatantId);
  const source = battle.combatants.find((x) => x.id === pp.sourceId);
  if (!c) return null;
  const r = pp.result;
  const isTerreur = pp.kind === 'terreur';
  const isCible = CIBLE_TYPES.has(pp.kind);
  const failed = r ? (isCible || isTerreur ? !r.success : (r.dr ?? 0) === 0) : false;
  const ok = r ? (isCible || isTerreur ? !!r.success : !!r.vaincue) : false;
  const cl = isCible ? CIBLE_LABEL[pp.kind] : null;

  return (
    <RollFlowShell
      title={cl ? `${cl.emoji} ${cl.label}${pp.cible ? ` (${pp.cible})` : ''}` : `${isTerreur ? '😱 Terreur' : '😨 Peur'} ${pp.indice}`}
      subtitle={
        isCible ? (
          <>
            <strong>{c.name}</strong> doit garder son sang-froid face à <strong>{source?.name ?? pp.cible ?? '?'}</strong>
          </>
        ) : (
          <>
            <strong>{c.name}</strong> doit garder son sang-froid face à <strong>{source?.name ?? '?'}</strong>
            {!isTerreur && ` (${pp.prevDR}/${pp.indice} DR)`}
          </>
        )
      }
      rolled={!!r}
      rollLabel="🎲 Test de Calme"
      onRoll={roll}
      resultOk={ok}
      result={
        r && (
          <>
            <span className="dice">
              <Dice roll={r.roll} />
            </span>
            <span className="verdict">
              {isCible
                ? r.success
                  ? 'Sang-froid gardé.'
                  : `En proie à son ${cl?.label.toLowerCase() ?? pp.kind}.`
                : isTerreur
                  ? r.success
                    ? 'Sang-froid gardé.'
                    : `Terrifié : ${r.brise} État(s) Brisé, puis Peur ${pp.indice}.`
                  : r.vaincue
                    ? `Peur surmontée ! (${r.calmeDR}/${pp.indice} DR)`
                    : `Toujours apeuré (${r.calmeDR}/${pp.indice} DR).`}
            </span>
          </>
        )
      }
      fortune={c.fortune ?? 0}
      rerollable={!!r && canReroll(failed, !!pp.rerolled)}
      onReroll={reroll}
      /* Trait ciblé = Test binaire → pas de « +1 DR » (bouton Relancer simple). */
      onBonusSL={isCible ? undefined : bonusSL}
      resilience={c.resilience ?? 0}
      onForce={force}
      forceShow={!ok}
      onConfirm={confirm}
    />
  );
}
