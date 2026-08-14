import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

/**
 * VOIE SVG DU MONDE (#1176) — cliquet de fin de chantier.
 *
 * L'ÉCRAN DE JEU N'A PLUS QU'UN PEINTRE (commit C5a) : le monde volumique (`stage/GameStage3D`).
 * `stage/CulledScene`, `FogLayer`, `MountedToken`, `backends/affineHighlights`, les voiles d'ambiance
 * et le voile de météo sont SUPPRIMÉS ; `stage/layers`, `stage/tokens` et `backends/affine*` ont été
 * SCINDÉS — il n'en reste que ce que le PLAN DE STATION (`TopoScene`, murs au trait) et l'APERÇU
 * d'authoring (`ui/editor/EditorCanvas`) consomment encore.
 *
 * Ce cliquet compte donc, désormais, les fichiers hors `backends/`/`pov/` qui consomment encore un
 * module SVG du monde — la population dont la REQUALIFICATION est le lot C5b (« l'éditeur et le plan
 * sans voie affine »). Il ne peut que DÉCROÎTRE ; à zéro, `backends/affine*` se supprime.
 *
 * PÉRIMÈTRE MESURÉ : les modules de PRODUCTION sous `src/gameIso`, hors `backends/` et hors `pov/` —
 * ces deux arborescences sont les IMPLÉMENTATIONS SVG en sursis, pas des consommateurs, et toutes
 * deux sont au périmètre du retrait (#1176, Phase 3 : « Retrait des backends SVG (`affine*`,
 * `pov/`) ») — et hors fichiers de test. La voie POV SVG a donc SON compte, plus bas, avec son
 * unique site de montage (`src/ui/CampaignView.tsx`, hors de cette arborescence). HORS PÉRIMÈTRE,
 * délibérément : `src/ui/editor/EditorCanvas.tsx` — l'éditeur EST au périmètre de la Phase 3 du
 * #1176, mais pas de CE cliquet, qui compte l'écran de jeu (cliquet frère :
 * `src/ui/editor/double-voie-editeur-ratchet.test.ts`).
 *
 * Ce que le compte NE voit PAS : un consommateur qui passerait par un ré-export intermédiaire, ou par
 * un `import()` dynamique. Le test « aucun ré-export » ci-dessous ferme la première porte.
 */
const RACINE = fileURLToPath(new URL('..', import.meta.url)); // src/gameIso/

/** Import d'un module de la voie AFFINE : la couche monde SVG, l'ASSEMBLAGE de ses couches
 *  (`stage/layers` — les sols/murs/toits projetés par les backends affines), ou l'un de ces backends.
 *  Sans `layers`, un consommateur qui n'entre dans la voie affine QUE par l'assemblage de couches
 *  restait invisible au filet — le plan de station (`TopoScene`) en était un. */
const VOIE_AFFINE = /from\s+'[^']*(?:\/|^)(CulledScene|layers|backends\/affine[A-Za-z]*)'/;

function fichiersDeProduction(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'backends' || e.name === 'pov') continue;
      fichiersDeProduction(p, out);
    } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const consommateurs = fichiersDeProduction(RACINE)
  .filter((p) => VOIE_AFFINE.test(readFileSync(p, 'utf8')))
  .map((p) => relative(RACINE, p).replace(/\\/g, '/'))
  .sort();

/**
 * ÉTAT MESURÉ le 2026-08-14 (lot P3-4, commit C5a : 5 → 3). La liste est NOMMÉE : un plafond seul
 * laisserait un consommateur en remplacer un autre sans que rien ne bouge.
 *   - `TopoScene.tsx` (plan de station) assemble la STRUCTURE de son plan par `stage/layers` — sa
 *     matière, elle, passe par l'instantané volumique (`stage/planSnapshot`) ;
 *   - `stage/layers.tsx` ne projette plus QUE les murs, par `backends/affineWalls` ;
 *   - `stage/tokens.tsx` ne projette plus QUE les décors (aperçu d'éditeur), par `backends/affineProps`.
 * DÉCROISSANCE SEULE : jamais relevée, jamais échangée.
 *
 * INVENTAIRE C5b (ce qui doit être traité le jour où cette liste atteint ZÉRO) :
 *   - le PLAN DE STATION doit tirer ses murs de l'instantané volumique (ou assumer son trait, et alors
 *     `affineWalls` devient un module d'AUTHORING, plus un « backend de voie ») ;
 *   - l'ÉDITEUR doit rendre son aperçu WYSIWYG et son aperçu de trait par le monde volumique
 *     (cliquet frère : `src/ui/editor/double-voie-editeur-ratchet.test.ts`) ;
 *   - la voie POV SVG meurt (second cliquet, plus bas), et avec elle `pov/geometry`/`pov/billboards` ;
 *   - le QC (`scripts/qc/*`) consomme encore `affineFloors`/`affineWalls`/`affineRoofs`/`affineDetail` :
 *     zéro ici ne veut pas dire supprimable tant que ces scripts n'ont pas migré.
 */
const CONSOMMATEURS = [
  'TopoScene.tsx',
  'stage/layers.tsx',
  'stage/tokens.tsx',
];

describe('Voie SVG du monde — cliquet de mort des backends affines (#1176)', () => {
  it('les consommateurs restants sont ceux-là, et rien de neuf', () => {
    expect(consommateurs).toEqual(CONSOMMATEURS);
  });

  it('leur nombre ne remonte pas — zéro = `backends/affine*` se supprime', () => {
    expect(consommateurs.length).toBeLessThanOrEqual(CONSOMMATEURS.length);
  });

  it('aucun RÉ-EXPORT ne peut cacher un consommateur derrière un module tiers', () => {
    const reexports = fichiersDeProduction(RACINE)
      .filter((p) => /export\s+(\*|\{[^}]*\})\s+from\s+'[^']*(CulledScene|backends\/affine)/.test(readFileSync(p, 'utf8')))
      .map((p) => relative(RACINE, p).replace(/\\/g, '/'));
    expect(reexports).toEqual([]);
  });
});

/**
 * VOIE POV SVG (#1176, Phase 3) — le MÊME cliquet, pour l'autre peintre SVG en sursis. Le ticket range
 * `pov/` avec `affine*` dans le retrait ; le POV n'est donc pas « une troisième voie hors chantier »,
 * c'est une voie CONDAMNÉE de plus, qui doit se lire ici tant qu'elle vit.
 *
 * Ce qui est compté : l'import d'un module SVG-SEUL du POV — sa géométrie (`pov/geometry`) et ses
 * billboards (`pov/billboards`). PAS `pov/PovStage` : cet écran est l'HÔTE DES DEUX VOIES (il monte
 * `VolumetricWorld` sous l'interrupteur armé, cf. `pov/pov-volumique.test.tsx`) et restera monté par
 * `src/ui/CampaignView.tsx` après le retrait — le compter verrouillerait un zéro INATTEIGNABLE. PAS
 * non plus `pov/camera` ni `pov/billboardCore` : ce sont des MATHS partagées que le backend volumique
 * consomme déjà (`backends/webgl/cameras.ts`, `sceneMeshes.ts`, `stage/GameStage3D.tsx`).
 *
 * ÉTAT TERMINAL : zéro ici = plus personne ne peint le POV en SVG ; l'hôte, lui, se DÉGRAISSE de sa
 * branche SVG (et se renomme si « Pov » n'a plus de sens face au volumique) — il ne se supprime pas.
 *
 * Surface balayée : la production de `src/gameIso` (hors `backends/`, hors `pov/` — l'implémentation)
 * PLUS l'hôte `pov/PovStage.tsx`, ajouté nommément parce qu'il est le consommateur, pas l'implémentation.
 * L'hôte importe SA géométrie en relatif (`'./geometry'`) : le motif admet donc les deux formes, ce qui
 * est sûr ici — hors `pov/`, aucun fichier de la surface n'importe un `./geometry` ni un `./billboards`.
 *
 * ANGLE MORT DÉCLARÉ : la surface s'arrête à `src/`. Le QC d'environnement (`scripts/qc/env-panels.ts`)
 * importe `pov/geometry` et tient donc la géométrie POV EN VIE hors de ce compte — zéro ici ne veut
 * pas dire « supprimable » tant que la Phase 3 n'a pas migré le QC (« migration du QC : `qc:env` →
 * capture WebGL », #1176).
 */
const VOIE_POV_SVG = /from\s+'(\.\/|[^']*pov\/)(geometry|billboards)'/;
const HOTE_POV = fileURLToPath(new URL('../pov/PovStage.tsx', import.meta.url));

const consommateursPov = [...fichiersDeProduction(RACINE), HOTE_POV]
  .filter((p) => VOIE_POV_SVG.test(readFileSync(p, 'utf8')))
  .map((p) => relative(RACINE, p).replace(/\\/g, '/'))
  .sort();

/**
 * ÉTAT MESURÉ le 2026-08-13 (lot P3-4, commit C1) :
 *   - `pov/PovStage.tsx` assemble la liste de dessin SVG (`buildPovDrawList`) et ses billboards.
 * DÉCROISSANCE SEULE : jamais relevée, jamais échangée.
 */
const CONSOMMATEURS_POV = ['pov/PovStage.tsx'];

describe('Voie POV SVG — cliquet de mort du second peintre SVG (#1176, Phase 3)', () => {
  it('les consommateurs de la voie POV SVG sont ceux-là, et rien de neuf', () => {
    expect(consommateursPov).toEqual(CONSOMMATEURS_POV);
  });

  it('leur nombre ne remonte pas — zéro = plus personne ne peint le POV en SVG', () => {
    expect(consommateursPov.length).toBeLessThanOrEqual(CONSOMMATEURS_POV.length);
  });

  it('le compte VOIT bien la voie POV : l’hôte y entre par sa géométrie SVG', () => {
    expect(VOIE_POV_SVG.test(readFileSync(HOTE_POV, 'utf8'))).toBe(true);
  });

  it('ni l’hôte lui-même ni les maths POV partagées avec le volumique ne sont comptés', () => {
    expect(VOIE_POV_SVG.test("import { PovStage } from '../gameIso/pov/PovStage';")).toBe(false);
    expect(VOIE_POV_SVG.test("import { povView } from '../../pov/camera';")).toBe(false);
    expect(VOIE_POV_SVG.test("import { BB_W } from '../../pov/billboardCore';")).toBe(false);
  });
});
