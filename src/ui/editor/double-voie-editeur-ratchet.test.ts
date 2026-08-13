import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

/**
 * DOUBLE VOIE DE RENDU DANS L'ÉDITEUR (#1176, P3-3) — cliquet FRÈRE de celui de l'écran de jeu
 * (`gameIso/stage/double-voie-ratchet.test.ts`), qui déclare l'éditeur hors de SON périmètre.
 *
 * La vague A du lot P3-3 monte `GameStage3D` dans `EditorCanvas` : l'éditeur porte donc, lui aussi,
 * DEUX peintres du monde — la voie affine (backends `affine*`) sous l'interrupteur au repos, la voie
 * volumique sous l'interrupteur armé. Ce cliquet compte les fichiers d'authoring qui consomment
 * encore la voie affine ; il ne peut que DÉCROÎTRE.
 *
 * MORT PLANIFIÉE — lot P3-4 (« l'éditeur SANS voie affine ») : quand l'interrupteur tombe et que le
 * volumique devient le seul monde de l'éditeur, cette liste passe à VIDE, et ce fichier se supprime
 * avec les imports qu'il compte. Elle n'est pas dans un ticket : elle est ici, avec le compte.
 *
 * ANGLE MORT DÉCLARÉ — le compte est DIRECT (une regex d'import par fichier) et ne voit donc PAS les
 * dépendances INDIRECTES : `EditorCanvas` consomme la voie affine aussi à travers
 * `gameIso/stage/tokens` (`propLayerObjs`) et `gameIso/EntityToken`, déjà comptés côté JEU par le
 * cliquet frère. « 0 » ici ne voudra donc pas dire « l'éditeur est libre de l'affine » : il voudra
 * dire « plus aucun import DIRECT ». La mort réelle de la voie affine se lit sur les DEUX cliquets à
 * zéro, jamais sur celui-ci seul.
 */
const RACINE = fileURLToPath(new URL('.', import.meta.url)); // src/ui/editor/

/** Import DIRECT d'un module de la voie AFFINE : la couche monde SVG, ou l'un de ses backends. */
const VOIE_AFFINE = /from\s+'[^']*(?:\/|^)(CulledScene|backends\/affine[A-Za-z]*)'/;

function fichiersDeProduction(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) fichiersDeProduction(p, out);
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const consommateurs = fichiersDeProduction(RACINE)
  .filter((p) => VOIE_AFFINE.test(readFileSync(p, 'utf8')))
  .map((p) => relative(RACINE, p).replace(/\\/g, '/'))
  .sort();

/**
 * ÉTAT MESURÉ le 2026-08-13 (vague A du lot P3-3). La liste est NOMMÉE, comme celle du cliquet frère :
 * un plafond seul laisserait un consommateur en remplacer un autre sans que rien ne bouge.
 *   - `EditorCanvas.tsx` : sols/murs/toits par les backends affines quand l'interrupteur est au repos,
 *     et — voie volumique ARMÉE — l'APERÇU du trait de pinceau, qui peint les cases du geste par
 *     `floorSvg` pendant que le monde cuit reste sur l'état d'avant le geste.
 */
const CONSOMMATEURS = ['EditorCanvas.tsx'];

describe('Double voie de rendu dans l’ÉDITEUR — cliquet de mort de la voie affine (#1176, P3-3)', () => {
  it('les consommateurs DIRECTS de la voie affine sont ceux-là, et rien de neuf', () => {
    expect(consommateurs).toEqual(CONSOMMATEURS);
  });

  it('leur nombre ne remonte pas — zéro = plus aucun import direct (lot P3-4)', () => {
    expect(consommateurs.length).toBeLessThanOrEqual(CONSOMMATEURS.length);
  });

  it('aucun RÉ-EXPORT ne peut cacher un consommateur derrière un module tiers', () => {
    const reexports = fichiersDeProduction(RACINE)
      .filter((p) => /export\s+(\*|\{[^}]*\})\s+from\s+'[^']*(CulledScene|backends\/affine)/.test(readFileSync(p, 'utf8')))
      .map((p) => relative(RACINE, p).replace(/\\/g, '/'));
    expect(reexports).toEqual([]);
  });
});
