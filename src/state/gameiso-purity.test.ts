import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * GARDE DE PURETÉ state→gameIso (CLAUDE.md règle 3 ; #161). `src/state` (store + flux) est en amont de
 * `src/gameIso` (rendu iso) : le rendu dépend du store, JAMAIS l'inverse. Ce test ÉCHOUE si un fichier
 * de `src/state` (hors `*.test.ts`) importe RUNTIME quoi que ce soit de `src/gameIso` — `from
 * '../gameIso/…'`, `import('../gameIso/…')`, y compris depuis un sous-dossier (`'../../gameIso/…'`).
 *
 * Les fichiers de TEST sont exclus du scan : ils exercent légitimement des helpers `gameIso`
 * (rig, sprites…) pour préparer leurs fixtures — ce sont des consommateurs, pas la couche `state`.
 *
 * Audit de pureté Lot 0bis (#161) : 11 fichiers `state` importaient du RUNTIME `gameIso`
 * (`facingToward`/`DIR8_DELTA`, `tileCenter`/`Dims`, `walkMs`, `hashSeed`, `getViewZ`/`setViewZ`,
 * `combatFeed`/`CombatTone`, `bodyPlanById`, `riggedAppearance`/`weaponFromLabel`) — de la
 * géométrie/simulation pure que `state` recadence ou reprojette pour SA PROPRE logique (curseur de
 * combat, IA, cadence des beats), pas du rendu. Extraits vers `src/geometry/` (projection iso,
 * interpolation de marche — zéro dépendance framework), `state/dir8.ts` (Dir8 est déjà un type
 * `state`), `state/viewLevel.ts` (override d'étage affiché, désormais SOURCE dans `state`, lu par
 * `gameIso/SurcoucheIso`), `state/combatLog.ts` (tonalité/importance d'un évènement, colocées avec
 * `CombatEventKind`) et `engine/dice.ts` (`hashSeed`, utilitaire générique de seed).
 */

const STATE_DIR = fileURLToPath(new URL('.', import.meta.url));

/** Exceptions au balayage runtime — clé = chemin RELATIF complet (pas la seule base : `state/terrain/`
 *  et `state/merchants/` ont chacun un `types.ts`, une clé de base collisionnerait). Raison FACTUELLE
 *  requise (jamais une excuse). */
const ALLOWLIST = new Set<string>([]);

/** Tout import (statique `from`, dynamique/inline `import(`, ou side-effect `import '…'`) ciblant un
 *  chemin `…/gameIso/…` (un ou plusieurs `../`). */
const GAMEISO_IMPORT = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)['"](?:\.\.\/)+gameIso\//;

/** Retire commentaires de bloc et de ligne (une réf à `../gameIso/…` en commentaire/doc n'est pas un import). */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//');
      return i >= 0 ? l.slice(0, i) : l;
    })
    .join('\n');
}

/** Tous les `.ts`/`.tsx` de `src/state` (récursif), hors `*.test.ts(x)`. Chemins relatifs à STATE_DIR. */
function stateSources(dir = STATE_DIR, rel = ''): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${ent.name}` : ent.name;
    if (ent.isDirectory()) out.push(...stateSources(`${dir}/${ent.name}`, relPath));
    else if (/\.tsx?$/.test(ent.name) && !/\.test\.tsx?$/.test(ent.name)) out.push(relPath);
  }
  return out;
}

describe('pureté de state — src/state ne dépend JAMAIS (runtime) de src/gameIso (règle 3, #161)', () => {
  const files = stateSources();

  it('aucun fichier state (hors tests) n\'importe RUNTIME de src/gameIso (sauf allowlist)', () => {
    const offenders: string[] = [];
    for (const f of files) {
      if (ALLOWLIST.has(f)) continue;
      const code = stripComments(readFileSync(`${STATE_DIR}/${f}`, 'utf8'));
      if (code.split('\n').some((l) => GAMEISO_IMPORT.test(l))) offenders.push(f);
    }
    expect(
      offenders,
      `Inversion de couche state→gameIso interdite (règle 3, #161). Fichiers fautifs :\n  ${offenders.join('\n  ')}\n` +
        'Le store/flux ne doit jamais dépendre de src/gameIso — extraire la géométrie/simulation partagée ' +
        'vers src/geometry (ou le module neutre pertinent), ou passer en allowlist documentée si le cas est ' +
        'un rendu authentique hors de portée immédiate (avec une issue de suivi).',
    ).toEqual([]);
  });

  it('le scan couvre bien la couche state (sanity : > 30 fichiers)', () => {
    expect(files.length).toBeGreaterThan(30);
  });
});
