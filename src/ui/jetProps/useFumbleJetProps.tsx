import type { ComponentProps } from 'react';
import { useGame } from '../../state/store';
import { RollFlowShell } from '../RollFlowShell';
import { TableRollLine } from '../RollLine';

/**
 * PARAMÉTRAGE de la coquille partagée `RollFlowShell` pour le JET de Maladresse (Tableau des Oups !,
 * LDB 14) — rendu À L'IDENTIQUE par la séquence de combat (`CascadeModal` rend l'étape `jet:'fumble'`
 * via ce hook). La Maladresse est une CONSÉQUENCE du Test raté sur un double : comme le Critique, elle
 * vit DANS la MÊME fenêtre que l'attaque/défense, plus dans une modale d'arbitre séparée. AUCUNE influence
 * (la Chance agit AVANT qu'un Test ne devienne Maladresse ; une fois actée, l'Oups ! est subi). Le jet est
 * un tirage de TABLE (pas de cible / DR) : `Lancer` → `result`, `Appliquer` → applyOups. `null` si aucune
 * Maladresse en attente.
 */
export function useFumbleJetProps(): ComponentProps<typeof RollFlowShell> | null {
  const pc = useGame((s) => s.pendingCascade);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.fumbleRoll);
  const confirm = useGame((s) => s.fumbleConfirm);
  const step = pc?.participants[pc.cursor]; // SOURCE UNIQUE : l'étape courante PORTE la maladresse (`step.fumble`)
  if (!battle || !pc || step?.jet !== 'fumble' || !step.fumble) return null;
  const combatant = battle.combatants.find((c) => c.id === step.actorId);
  if (!combatant) return null;
  const r = step.fumble.result;
  return {
    variant: 'test',
    title: '🎲 Maladresse',
    subtitle: `${combatant.name} — Test de combat raté sur un double (Tableau des Oups !).`,
    rolled: !!r,
    rollLabel: '🎲 Lancer sur le Tableau des Oups !',
    onRoll: roll,
    rollFrisson: true,
    outcome: r ? <TableRollLine table="Tableau des Oups !" roll={r.roll} result={r.label} /> : null,
    onConfirm: confirm,
    // Aucune influence : la Chance agit AVANT qu'un Test ne devienne une Maladresse ; une fois actée, on subit.
    fortune: 0,
    rerollable: false,
    onReroll: () => {},
  };
}
