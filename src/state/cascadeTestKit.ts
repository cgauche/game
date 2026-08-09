/**
 * Kit de TEST pour `cascade.ts` — `spyApplier` mutualise le motif dupliqué (~13 sites,
 * `cascade.test.ts`/`rollSeam.test.ts`/`cadence-rapide.test.ts`) : un `registerCascadeApplier` qui
 * PUSH une entrée dérivée de l'étape validée dans un tableau `applied` puis renvoie une conséquence
 * (`journal`/`insert`/…) optionnelle. N'importer que depuis des `*.test.ts` — module de test, pas de
 * périmètre runtime.
 */
import { registerCascadeApplier, type CascadeApplier } from './cascade';
import type { CascadeStep } from './pendings';
import { DIFFICULTY_MODIFIERS, type Difficulty } from '../engine/types';
import type { ModLine } from '../engine/combat';
import { RULE_REF } from '../engine/ruleRefs';

/** Ce qu'il faut porter pour être JUGEABLE par `inexplique` — les quatre grandeurs d'une ligne de jet,
 *  toutes optionnelles. STRUCTUREL, jamais un type de porteur : `CascadeStep`, `BatchParticipant`,
 *  `RollBreakdown`/`PendingRoll` et les `Pending*` du combat les portent chacun à leur façon. */
export interface LigneJugeable { base?: number; mods?: ModLine[]; target?: number; difficulty?: Difficulty; clamped?: number }

/**
 * CLIQUET « zéro chip anonyme » (#1117/#1153) : la part de l'écart base→cible qu'une étape n'explique
 * PAS. Tout ce que la ligne SAIT dire s'en retire — la Difficulté (texte de la ligne), ses
 * modificateurs NOMMÉS (`mods` : Soutien, États, passifs, malus RAW) et l'écrêtage MESURÉ (`clamped`,
 * rendu « plafond 99 »). Reste ≠ 0 ⇒ le réconciliateur de `RollLine` avouera une chip « autres » : un
 * fait que personne ne nomme. À asserter `toBe(0)` sur toute étape-jet produite par un flux.
 */
export function inexplique(st: LigneJugeable): number {
  return (st.target ?? 0) - (st.base ?? 0)
    - (st.difficulty ? DIFFICULTY_MODIFIERS[st.difficulty] : 0)
    - (st.mods ?? []).reduce((sum, m) => sum + m.value, 0)
    - (st.clamped ?? 0);
}

/** Le Soutien (LDB 12) porté par une étape, tel qu'il s'AFFICHE : la ou les lignes de mod identifiées
 *  par leur RÈGLE (`soutienMod` — `ref.id`), jamais par leur libellé. `0` si l'étape n'en porte pas. */
export function soutienDe(st: CascadeStep): number {
  return (st.mods ?? [])
    .filter((m) => m.ref?.id === RULE_REF.soutien.id)
    .reduce((sum, m) => sum + m.value, 0);
}

/** Enregistre un applier-espion `kind` : `mapper(step)` alimente `applied`, `out(step)` (défaut : rien)
 *  fournit la conséquence renvoyée à `commitStep` (`journal`/`consequences`/`insert`). */
export function spyApplier<T>(
  kind: string,
  applied: T[],
  mapper: (step: CascadeStep) => T,
  out?: (step: CascadeStep) => ReturnType<CascadeApplier>,
): void {
  registerCascadeApplier(kind, (_get, _set, step) => {
    applied.push(mapper(step));
    return out ? out(step) : undefined;
  });
}
