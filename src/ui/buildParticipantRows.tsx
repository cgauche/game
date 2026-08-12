import { createElement, Fragment, type ReactNode } from 'react';
import type { Combatant } from '../engine/types';
import { canReroll } from '../engine/fortune';
import { refLabel } from '../data';
import type { PanelRowData } from './RollPanel';
import { participantRow, type BuiltRollRow } from './rollRowBuild';

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
  /** Compétence RÉELLEMENT lancée (paire id + spécialisation) — le libellé de ligne s'en DÉRIVE. */
  skillId?: string;
  spec?: string;
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
  /** Issue courte sous la ligne (DR ×2 essentiel…) — rendue APRÈS le jet seulement, dans le CANAL
   *  UNIQUE de sous-ligne (`PanelRowData.note`, `.rr-note`). */
  note?: (part: P, actor: Combatant, res: NonNullable<P['result']>) => ReactNode;
  /** ISSUES de la rangée (#1117) — les deux branches annoncées AVANT le jet, la branche réalisée APRÈS :
   *  rendue aux DEUX phases (c'est ce qui la distingue de `note`, qui ne dit que la conséquence subie).
   *  Elle occupe la MÊME sous-ligne, en tête ; un site qui fournit les deux les empile dans cet ordre. */
  issues?: (part: P, actor: Combatant, res: P['result']) => ReactNode;
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
): BuiltRollRow[] {
  return participants.flatMap((part) => {
    const actor = pool.find((c) => c.id === part.id);
    if (!actor) return [];
    const res = part.result;
    const failed = participantFailed(res);
    const extendedDr = bundle.extendedDrOf?.(part, actor);
    // Z5 (docs/charte-ui.md) — SOURCE UNIQUE du libellé de LIGNE d'une rangée-participant : la
    // Compétence lancée, DÉRIVÉE de la paire `{skillId, spec}` par le résolveur canonique (« Voile
    // (Chaland) »). Le producteur ne fournit plus de libellé libre : un `part.label` ne peut plus
    // faire passer un RÔLE (« Timonier ») pour la Compétence (#1117).
    const skillLabel = part.skillId ? refLabel('skills', { id: part.skillId, spec: part.spec }) : undefined;
    const panelRow0 = bundle.row(part, actor, res);
    const panelRow = skillLabel
      ? {
          ...panelRow0,
          ...(panelRow0.d ? { d: { ...panelRow0.d, label: skillLabel } } : {}),
          ...(panelRow0.pending ? { pending: { ...panelRow0.pending, label: skillLabel } } : {}),
        }
      : panelRow0;
    const note = bundle.note && res ? bundle.note(part, actor, res) : undefined;
    const issues = bundle.issues ? bundle.issues(part, actor, res) : undefined;
    // Sous-ligne UNIQUE de la rangée : les issues (avant/après le jet) puis la conséquence subie.
    const sub = issues != null || note != null ? createElement(Fragment, null, issues, note) : undefined;
    // La rangée naît de la PORTE (#1262) — `rolled` y est dérivé de la donnée affichée (`row.d`),
    // définition unique du socle : le multi ne la recalcule plus depuis `part.result`.
    return [participantRow({
      key: part.id,
      actor,
      row: sub != null ? { ...panelRow, note: sub } : panelRow,
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
    })];
  });
}
