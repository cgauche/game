/**
 * Fichiers NEUFS (non suivis, `??` de `git status --porcelain`) du périmètre, dans `cwd`.
 *
 * `git diff` ne voit QUE le suivi : une migration qui CRÉE un document à chaque passage y est
 * invisible. Ce relevé est la seconde moitié de la mesure d'idempotence du rejeu.
 */
export function neufsDe(cwd: string, perimetre: readonly string[]): string[];
