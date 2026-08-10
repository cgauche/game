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
 * PÉRIMÈTRE MESURÉ : les modules de PRODUCTION sous `src/gameIso`, hors `backends/` (les backends
 * affines sont l'implémentation mesurée, pas ses consommateurs), hors `pov/` (le POV est une
 * TROISIÈME voie, hors de ce chantier) et hors fichiers de test. HORS PÉRIMÈTRE, délibérément :
 * `src/ui/editor/EditorCanvas.tsx` — l'éditeur de carte n'est pas l'écran de jeu, et rien au #1176 ne
 * prévoit de l'y faire passer.
 *
 * Ce que le compte NE voit PAS : un consommateur qui passerait par un ré-export intermédiaire, ou par
 * un `import()` dynamique. Le test « aucun ré-export » ci-dessous ferme la première porte.
 */
const RACINE = fileURLToPath(new URL('..', import.meta.url)); // src/gameIso/

/** Import d'un module de la voie AFFINE : la couche monde SVG, ou l'un de ses backends. */
const VOIE_AFFINE = /from\s+'[^']*(?:\/|^)(CulledScene|backends\/affine[A-Za-z]*)'/;

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
 * ÉTAT MESURÉ le 2026-08-10 (fin du lot P2-2). La liste est NOMMÉE : un plafond seul laisserait un
 * consommateur en remplacer un autre sans que rien ne bouge.
 *   - `IsoStage.tsx` monte `CulledScene` et les motifs de détail affines ;
 *   - `stage/layers.tsx` projette sols/murs/toits par les backends affines ;
 *   - `stage/highlightLayer.tsx` et `stage/tokens.tsx` en font autant pour les surbrillances et la
 *     profondeur des décors.
 * DÉCROISSANCE SEULE : jamais relevée, jamais échangée.
 */
const CONSOMMATEURS = [
  'IsoStage.tsx',
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
