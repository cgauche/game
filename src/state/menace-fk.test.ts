import { describe, it, expect } from 'vitest';
import { readFileSync, globSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { menaceIds, isMenaceId } from '../engine/menace';

/**
 * Garde FK du tag `menace` posé AU CODE (#1346) — pendant de la validation de donnée portée par
 * `flowTestSchema` (`data/schemas/common.ts`).
 *
 * Le tag `menace` d'un pending / d'une étape / d'une rangée est une CLÉ ÉTRANGÈRE vers un id de spec
 * de l'entrée `resistance` de `talents.json` (LDB 10 l.1015-1021, liste OUVERTE : l'auteur ajoute une
 * spec au Compendium, aucun code à toucher). Rien, à la lecture, ne distingue un tag vivant d'un tag
 * MORT : `availableResistance` rend `null` sur un id inconnu et le bouton Résistance ne s'affiche
 * simplement jamais — l'affordance est silencieusement absente (c'est ainsi que `menace: 'Exposition'`
 * a survécu au voyage terrestre, et `menace: 'Poursuite'` à un test). Cette garde rend la perte
 * BRUYANTE et NOMINATIVE : chaque littéral posé en position de tag est nommé `fichier:ligne`.
 */
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SELF = 'src/state/menace-fk.test.ts';

/** `menace: '<littéral>'` (ou `"…"`) en position de VALEUR — pas les déclarations de type
 *  (`menace?: string`), pas les lectures (`p.menace`), pas les affectations par variable. */
const TAG_RX = /\bmenace:\s*(['"])([^'"\n]*)\1/g;

/** Les tags littéraux de `src/**` : `{ site: 'chemin:ligne', valeur }`. Les COMMENTAIRES sont écartés
 *  (une ligne de prose qui cite `menace: 'Poison'` n'est pas un site). */
function tagsLitteraux(): { site: string; valeur: string }[] {
  const out: { site: string; valeur: string }[] = [];
  for (const rel of globSync('src/**/*.{ts,tsx}', { cwd: ROOT })) {
    const chemin = relative(ROOT, join(ROOT, rel)).split('\\').join('/');
    if (chemin === SELF) continue;
    const lignes = readFileSync(join(ROOT, rel), 'utf8').split(/\r?\n/);
    lignes.forEach((ligne, i) => {
      const nu = ligne.trim();
      if (nu.startsWith('//') || nu.startsWith('*') || nu.startsWith('/*')) return;
      for (const m of ligne.matchAll(TAG_RX)) out.push({ site: `${chemin}:${i + 1}`, valeur: m[2] });
    });
  }
  return out;
}

describe('#1346 — intégrité FK du tag `menace` (Résistance (Menace), LDB 10)', () => {
  it('chaque tag `menace` littéral de src/** référence une spec EXISTANTE du talent `resistance`', () => {
    const tags = tagsLitteraux();
    const morts = tags
      .filter((t) => !isMenaceId(t.valeur))
      .map((t) => `${t.site} → « ${t.valeur} »`);
    expect(
      morts,
      `Tag(s) \`menace\` sans spec correspondante sur le talent « resistance » (talents.json).\n` +
        `Valeurs admises : ${menaceIds().join(', ')}\n${morts.join('\n')}`,
    ).toEqual([]);
    expect(tags.length).toBeGreaterThan(0); // le corpus mesuré n'est pas vide (le scan voit quelque chose)
  });

  it('MORSURE du scan : la forme cherchée est bien celle des sites réels, et les tags vivants sont VUS', () => {
    const tags = tagsLitteraux();
    // Les producteurs connus posent leur tag en littéral : le scan les voit tous les trois.
    const vus = new Set(tags.map((t) => `${t.site.split(':')[0]}=${t.valeur}`));
    expect(vus).toContain('src/state/corruptionFlow.ts=mutation');
    expect(vus).toContain('src/state/combatFlow.ts=magie');
    expect(vus).toContain('src/state/combatFlow.ts=maladie');
  });
});
