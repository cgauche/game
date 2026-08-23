/**
 * Le TEXTE d'une Difficulté affichée — SOURCE UNIQUE de l'AFFICHAGE : modale de jet (`ui/RollLine`),
 * réticule et badges du stage (`gameIso/stage`). Le cran de l'échelle quand la composition en atteint
 * un, sinon le modificateur RÉEL nommé « Combinée (−15) » (`LDB 14 l.91-96` ne nomme que la combinaison
 * qui tombe sur un cran). Jamais le cran VOISIN, jamais la Difficulté déclarée seule quand `combined`
 * est posé.
 *
 * Vit dans l'UI, et pas dans le moteur ni l'état : le mot « Combinée » est un fait d'affichage, que ces
 * deux couches n'ont pas le droit de manipuler (garde `state/roll-line-combat.test.ts`). Le moteur et
 * l'état transportent la DONNÉE (`difficulty` + `difficultyCombined`) ; ce module la met en mots.
 */
import { DIFFICULTY_LABELS, type Difficulty } from '../engine/types';
import type { DifficultyShown } from '../engine/combat';
import { t } from '../i18n';

export function difficultyText(difficulty: Difficulty, combined?: number): string {
  return combined != null
    ? t('difficulty.combinee', { mod: `${combined >= 0 ? '+' : '−'}${Math.abs(combined)}` })
    : DIFFICULTY_LABELS[difficulty];
}

/** Même texte depuis la Difficulté transportée — `null` quand aucune n'a été résolue. */
export function difficultyShownText(d: DifficultyShown | undefined): string | null {
  return d ? difficultyText(d.difficulty, d.difficultyCombined) : null;
}
