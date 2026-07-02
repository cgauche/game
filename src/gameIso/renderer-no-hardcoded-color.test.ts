/**
 * Garde-fou : un renderer d'environnement migré ne porte AUCUN littéral de couleur (identité de
 * matériau). Toute couleur vient du JSON (`src/data/*.json`) ou de `shade.ts`. Forbidder `#hex`/`rgb()`
 * capture aussi les anciennes tables `Record<…>` (hex-valuées). `COVERED` grandit à chaque phase.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));

const COVERED: string[] = [
  'builders/floors.ts', // builder de sols (pivot) — ne porte que des IDS de matériau, jamais une couleur
  'builders/walls.ts', // builder de murs (pivot) — faces par PART de la def, jamais une couleur
  'backends/affineFloors.ts', // backend affine des sols — gradients/variantes + `shade`
  'backends/affineWalls.ts', // backend affine des murs — couleurs par `wallPartColor` + `shade`
  'backends/affineDetail.ts', // matériaux v2 — motifs/accents aux couleurs des RECETTES + `shade`
  'backends/project.ts', // pont monde→écran partagé des backends affines
  'builders/roofs.ts', // builder de toits (pans continus) — géométrie + ids, jamais une couleur
  'backends/affineRoofs.ts', // backend affine des toits — teintes/lignes par `roofMaterial`
  'catalog/ambiance.ts', // defs d'ambiance assemblées depuis `ambiance.json` — jamais un littéral
  'IsoStage.tsx', // stage iso (coquille fine) — orchestration seule, zéro couleur
  'pov/PovStage.tsx', // stage POV — ciel/brumes/vignette depuis la def d'ambiance
  'pov/camera.ts', // caméra POV — brume intérieure depuis la def d'ambiance
  'pov/geometry.ts', // liste de dessin POV — matériaux/recettes partagés, plus de miroir CSS
  'builders/props.ts', // builder de props — ids de dessin (prop/terrain), jamais une couleur
  'builders/tokens.ts', // builder de tokens — identité/position logique, jamais une couleur
  'builders/highlights.ts', // builder de surbrillances — cases sémantiques, couleurs au backend
  'backends/affineProps.ts', // backend affine des props — profondeurs + registre terrain
  'backends/affineHighlights.tsx', // backend affine des surbrillances — tokens :root + teamColors
  'stage/objs.ts', // tri statique + fusion dynamique — aucune couleur
  'stage/layers.tsx', // couches statiques (vérités de vue) — opacités/filtres seuls
  'stage/tokens.tsx', // couche tokens — anneaux/teintes via teamColors, chrome en tokens :root
  'stage/highlightLayer.tsx', // surbrillances de combat — tokens :root
  'stage/movePreview.tsx', // tracé de déplacement partagé — tokens :root
  'stage/CulledScene.tsx', // culling + sandwich de brouillard — aucune couleur
  'stage/DoorOverlays.tsx', // overlay portes — tokens :root
  'stage/SiegeHitAreas.tsx', // hit-areas de siège — transparent + tokens :root
  'stage/Telegraphs.tsx', // télégraphes ennemis — tokens :root
  'stage/ZdeTemplate.tsx', // gabarit de ZdE — tokens :root
  'stage/MoveOverlays.tsx', // curseur + aperçus de déplacement — tokens :root
  'stage/AimOverlay.tsx', // réticule/infobulle de visée — tokens :root
  'stage/CrewTooltip.tsx', // tooltip d'équipage — tokens :root
  'stage/DebugOverlay.tsx', // overlay debug — tokens :root (--dbg-*)
  'stage/Ambiance.tsx', // faune + voiles fixes — defs d'ambiance (donnée)
  'stage/useStageCamera.ts', // caméra du stage — aucune couleur
  'stage/useStagePointer.ts', // pointeur du stage — aucune couleur
  'stage/useHoverTargeting.ts', // visée au survol — aucune couleur
  // Lot 7 → 'sprites.ts' + decor defs
];

// `rgb(`/`hsl(` ne mordent que sur des CANAUX LITTÉRAUX : `rgb(${r},…)` (assemblage d'une couleur
// CALCULÉE, ex. `tint` du POV) n'est pas une identité en dur.
const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*[\d.]|\bhsla?\(\s*[\d.]/;

/** Retire commentaires (bloc + ligne, en préservant `://`) et imports — on ne teste que le code. */
function stripNoise(src: string): string {
  return src
    .replace(new RegExp('/\\*[\\s\\S]*?\\*/', 'g'), '')
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//');
      return i > 0 && l[i - 1] === ':' ? l : i >= 0 ? l.slice(0, i) : l;
    })
    .filter((l) => !/^\s*import\b/.test(l))
    .join('\n');
}

function colorHits(src: string): string[] {
  return stripNoise(src)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => COLOR_LITERAL.test(l));
}

describe('garde-fou — aucune couleur en dur dans un renderer migré', () => {
  it('le détecteur mord', () => {
    expect(colorHits('const a = "#5d4c36";')).toHaveLength(1);
    expect(colorHits('fill = `rgba(0,0,0,0.3)`;')).toHaveLength(1);
    expect(colorHits('const c = shade(app.wood.face, SIDE_N);')).toHaveLength(0);
    expect(colorHits('fill="var(--combat-gold)"')).toHaveLength(0);
    expect(colorHits('// ancien: #5d4c36')).toHaveLength(0);
  });

  it.each(COVERED)('%s : zéro couleur en dur', (rel) => {
    const hits = colorHits(readFileSync(HERE + rel, 'utf8'));
    expect(hits, `Couleurs en dur dans ${rel} :\n${hits.join('\n')}`).toEqual([]);
  });
});
