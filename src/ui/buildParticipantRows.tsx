import type { ReactNode } from 'react';
import type { Combatant } from '../engine/types';
import { canReroll } from '../engine/fortune';
import type { RollRowData } from './RollShell';
import type { PanelRowData } from './RollPanel';

/**
 * SOURCE UNIQUE des rangées-participants d'une modale MULTI (#328) — les DÉRIVATIONS d'éligibilité
 * d'influence (`rerollable`/`darkPactable`/`forceShow`) sont des INVARIANTS (credo : mutualiser
 * l'invariant) : une évolution de la règle du Pacte/Chance ne se retouche QU'ICI, jamais dans les 6
 * modales (`CascadeModal` batch, `CrewTestModal`, `ShipBatteryModal`, `ShipManeuverModal`,
 * `ForceDoorModal`, `DisengageModal`). Chaque modale ne fournit QUE la PRÉSENTATION de sa rangée
 * (`row`, propre à son vocabulaire de données) + son bundle d'actions de flux. `failed` se dérive de
 * `result.success` s'il existe (`CascadeRoll`), sinon de `roll > target` (`CrewRoleRoll` nu).
 */
export interface ParticipantRow {
  id: string;
  interactive?: boolean;
  rerolled?: boolean;
  result: { roll: number; target: number; sl: number; success?: boolean } | null;
}

export interface ParticipantRowBundle<P extends ParticipantRow> {
  /** Actions de flux du domaine (routées par id de participant). */
  onRoll: (id: string) => void;
  onReroll: (id: string) => void;
  onBonusSL: (id: string) => void;
  onDarkPact: (id: string) => void;
  onForce: (id: string) => void;
  /** PRÉSENTATION de la rangée (pré-jet en attente puis résultat) — propre au vocabulaire de la modale. */
  row: (part: P, actor: Combatant, res: P['result']) => PanelRowData;
  /** Rangée INTERACTIVE ? (défaut : `part.interactive !== false`). Le naval y greffe le gate `owns`. */
  interactiveOf?: (part: P, actor: Combatant) => boolean;
  /** Issue courte sous la ligne (DR ×2 essentiel…) — rendue APRÈS le jet seulement. */
  extra?: (part: P, actor: Combatant, res: NonNullable<P['result']>) => ReactNode;
  /** DONNÉE de Test ÉTENDU d'une rangée (cartographie de voyage…) : la barre est rendue par `RollRow`
   *  (site UNIQUE), visible avant/après le jet et persistante. Le bundle ne pose que la donnée. */
  extendedDrOf?: (part: P, actor: Combatant) => { cum: number; target: number } | undefined;
  /** Libellé du bouton « Lancer » de rangée (ex. « Frapper » pour l'enfoncement de porte). */
  rollLabel?: ReactNode;
}

/** Un participant est-il en ÉCHEC ? `success` fait foi quand il existe (bandes auto LDB 12), sinon
 *  `roll > target` (résultat de rôle nu). Absent de résultat → pas d'échec (rien à influencer). */
function participantFailed(res: ParticipantRow['result']): boolean {
  if (!res) return false;
  return res.success != null ? !res.success : res.roll > res.target;
}

/** Action « Tout lancer » PAR RANGÉES (mutualisée #328) : lance d'un coup toutes les rangées
 *  INTERACTIVES non encore lancées — renvoyée seulement s'il en reste ≥ 2 (en deçà, le bouton « Lancer »
 *  par rangée suffit). `null` sinon. Consommée par les modales MULTI (batch cascade + naval). */
export function rollAllUnrolledRows<P extends ParticipantRow>(
  participants: P[],
  roll: (id: string) => void,
  isInteractive: (p: P) => boolean = (p) => p.interactive !== false,
): (() => void) | null {
  const unrolled = participants.filter((p) => isInteractive(p) && !p.result);
  return unrolled.length >= 2 ? () => unrolled.forEach((p) => roll(p.id)) : null;
}

export function buildParticipantRows<P extends ParticipantRow>(
  participants: P[],
  pool: Combatant[],
  bundle: ParticipantRowBundle<P>,
): RollRowData[] {
  return participants.flatMap((part) => {
    const actor = pool.find((c) => c.id === part.id);
    if (!actor) return [];
    const res = part.result;
    const failed = participantFailed(res);
    const extendedDr = bundle.extendedDrOf?.(part, actor);
    return [{
      key: part.id,
      actor,
      row: bundle.row(part, actor, res),
      rolled: !!res,
      interactive: bundle.interactiveOf ? bundle.interactiveOf(part, actor) : part.interactive !== false,
      ...(bundle.rollLabel != null ? { rollLabel: bundle.rollLabel } : {}),
      onRoll: () => bundle.onRoll(part.id),
      rerollable: !!res && canReroll(failed, !!part.rerolled),
      onReroll: () => bundle.onReroll(part.id),
      onBonusSL: () => bundle.onBonusSL(part.id),
      darkPactable: actor.kind === 'hero' && failed,
      onDarkPact: () => bundle.onDarkPact(part.id),
      onForce: () => bundle.onForce(part.id),
      forceShow: !!res,
      ...(extendedDr ? { extendedDr } : {}),
      ...(bundle.extra && res ? { extra: bundle.extra(part, actor, res) } : {}),
    }];
  });
}
