import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

/**
 * DOUBLE VOIE DE RENDU DU MONDE (#1176) — cliquet de fin de chantier.
 *
 * Tant que la migration volumique dure, l'écran de jeu porte DEUX peintres du monde : la voie AFFINE
 * (couches SVG pré-triées de `stage/CulledScene` + les backends `backends/affine*`) et la voie
 * VOLUMIQUE (`stage/GameStage3D`). Ce cliquet compte les fichiers du CHEMIN DE JEU qui consomment
 * encore la voie affine. Il ne peut que DÉCROÎTRE ; à zéro, la double voie est morte et `CulledScene`
 * + `backends/affine*` se suppriment avec elle (Phase 3).
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
 * ÉTAT MESURÉ le 2026-08-13 (lot P3-4, commit C2). La liste est NOMMÉE : un plafond seul laisserait un
 * consommateur en remplacer un autre sans que rien ne bouge.
 *   - `IsoStage.tsx` monte `CulledScene` et les motifs de détail affines ;
 *   - `TopoScene.tsx` (plan de station) assemble la STRUCTURE de son plan par `stage/layers` — sa
 *     matière, elle, passe par l'instantané volumique (`stage/planSnapshot`) ;
 *   - `stage/layers.tsx` projette sols/murs/toits par les backends affines ;
 *   - `stage/highlightLayer.tsx` et `stage/tokens.tsx` en font autant pour les surbrillances et la
 *     profondeur des décors.
 * DÉCROISSANCE SEULE : jamais relevée, jamais échangée.
 */
const CONSOMMATEURS = [
  'IsoStage.tsx',
  'TopoScene.tsx',
  'stage/highlightLayer.tsx',
  'stage/layers.tsx',
  'stage/tokens.tsx',
];

describe('Double voie de rendu du monde — cliquet de mort de la voie affine (#1176)', () => {
  it('les consommateurs de la voie AFFINE dans le chemin de jeu sont ceux, et rien de neuf', () => {
    expect(consommateurs).toEqual(CONSOMMATEURS);
  });

  it('leur nombre ne remonte pas — zéro = la double voie est morte, `CulledScene` se supprime', () => {
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
