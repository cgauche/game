/**
 * FRONTIÈRE `src/state` ↛ `src/gameIso` — garde STRUCTURELLE (#1715).
 *
 * CLAUDE.md règle 3 : « Le moteur de règles (`src/engine`) reste pur et testé. Le store, l'UI et le
 * rendu en dépendent, jamais l'inverse. » Le rendu (`src/gameIso`) se sert du store ; le store ne se
 * sert JAMAIS du rendu. L'en-tête de `state/sceneEdit.ts` porte la même consigne en prose (« NE JAMAIS
 * importer `../ui/` ni `../gameIso/` ici ») — la prose ne refuse rien, ce test refuse.
 *
 * L'occasion mesurée : la dérivation des toitures avait besoin de la couverture du TYPE de bâtiment
 * (`buildings.json › roofMaterial`), dont la façade vivait dans `gameIso/catalog/buildings` ; c'est la
 * FAÇADE qui a déménagé (`state/buildings.ts`, patron `state/terrain/index.ts` #1690), le store n'a pas
 * traversé la frontière pour aller la chercher.
 *
 * MÉCANIQUE réutilisée, jamais un 2ᵉ parseur d'imports : `IMPORT_RE` + `resolveImport`
 * (`scripts/guards/lib/importGraph.mjs`, partagés avec `genericDomainImport` et le graphe des
 * systèmes). Sont vus les imports statiques, dynamiques (`import('…')`) et à effet de bord.
 *
 * PÉRIMÈTRE : les sources de PRODUCTION de `src/state/**`. Les `*.test.ts(x)` sont hors scan — un test
 * de state compose légitimement un builder ou un écran pour mesurer un bout-en-bout (26 imports de
 * cette forme mesurés le 2026-09-09). La direction `src/state` → `src/ui` est une AUTRE frontière,
 * hors périmètre de cette garde : elle porte 3 sites de production le 2026-09-09
 * (`combatManeuvers.ts`, `revealStep.ts` → `ui/icons` ; `roster.ts` → `ui/creator/draft`).
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { IMPORT_RE, resolveImport } from '../../scripts/guards/lib/importGraph.mjs';

const SRC = fileURLToPath(new URL('../', import.meta.url)).split('\\').join('/');
const STATE = `${SRC}state`;
const RENDU = `${SRC}gameIso/`;

/** Sources de production d'un dossier, récursivement (chemins absolus, séparateur `/`). */
function sourcesDe(dir: string): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const chemin = `${dir}/${ent.name}`;
    if (ent.isDirectory()) { out.push(...sourcesDe(chemin)); continue; }
    if (/\.tsx?$/.test(ent.name) && !/\.test\.tsx?$/.test(ent.name)) out.push(chemin);
  }
  return out;
}

/** Les imports d'un module qui atteignent `src/gameIso`, en `spécificateur → cible relative à src/`.
 *  PUR : le texte est un paramètre, si bien que le cas planté ci-dessous n'a besoin d'aucun fichier. */
export function importsDuRendu(fichierAbs: string, texte: string): { spec: string; cible: string }[] {
  const out: { spec: string; cible: string }[] = [];
  for (const m of texte.matchAll(IMPORT_RE)) {
    const spec = m[1] ?? m[2] ?? m[3];
    const cible = resolveImport(fichierAbs, spec);
    if (cible && cible.startsWith(RENDU)) out.push({ spec, cible: cible.slice(SRC.length) });
  }
  return out;
}

describe('frontière state → gameIso (CLAUDE.md règle 3)', () => {
  const fichiers = sourcesDe(STATE);

  it('le scan voit bien les sources de production de src/state (preuve de câblage)', () => {
    expect(fichiers.length).toBeGreaterThan(50);
    expect(fichiers.some((f) => f.endsWith('/state/sceneEdit.ts'))).toBe(true);
    expect(fichiers.some((f) => /\.test\.tsx?$/.test(f))).toBe(false);
  });

  it('cas planté : un import du rendu est VU, un import de state ne l’est pas (preuve TDD)', () => {
    const faux = `${STATE}/sonde-plantee.ts`;
    expect(importsDuRendu(faux, "import { buildRoofs } from '../gameIso/builders/roofs';")).toEqual([
      { spec: '../gameIso/builders/roofs', cible: 'gameIso/builders/roofs.ts' },
    ]);
    expect(importsDuRendu(faux, "const m = await import('../gameIso/builders/roofs');")).toHaveLength(1);
    expect(importsDuRendu(faux, "import { roofHidden } from './buildings';")).toEqual([]);
    expect(importsDuRendu(faux, "import { materials } from '../data';")).toEqual([]);
  });

  it('aucune source de production de src/state n’importe src/gameIso', () => {
    const fautes: string[] = [];
    for (const f of fichiers)
      for (const { spec, cible } of importsDuRendu(f, readFileSync(f, 'utf8')))
        fautes.push(`${f.slice(SRC.length)} → ${cible}  (« ${spec} »)`);
    expect(
      fautes,
      'Le store importe le RENDU : le rendu dépend du store, jamais l’inverse (CLAUDE.md règle 3). ' +
        'Une donnée dont le store a besoin se lit par une façade qui vit dans `src/state` (patron ' +
        '`state/terrain/index.ts`, `state/buildings.ts`), jamais par un aller-retour dans `src/gameIso`.\n  ' +
        fautes.join('\n  '),
    ).toEqual([]);
  });
});
