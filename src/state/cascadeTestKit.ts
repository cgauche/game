/**
 * Kit de TEST pour `cascade.ts` — `spyApplier` mutualise le motif dupliqué (~13 sites,
 * `cascade.test.ts`/`rollSeam.test.ts`/`cadence-rapide.test.ts`) : un `registerCascadeApplier` qui
 * PUSH une entrée dérivée de l'étape validée dans un tableau `applied` puis renvoie une conséquence
 * (`journal`/`insert`/…) optionnelle. N'importer que depuis des `*.test.ts` — module de test, pas de
 * périmètre runtime.
 */
import { registerCascadeApplier, type CascadeApplier } from './cascade';
import type { CascadeStep } from './pendings';

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
