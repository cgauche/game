import { describe, expect, it } from 'vitest';
import { faceSurface, surfaceKeyOf, tintVarFactor } from './faceColors';
import { coursesPeriodM, groundPeriodM } from '../../detail/courses';
import { terrainFillGradient } from '../affineDetail';
import { TINT_SPREAD } from '../../detail/expand';
import { reliefMaterial } from '../../catalog/relief';
import { roofMaterial } from '../../catalog/roofs';
import { structureAppearance } from '../../catalog/structures';
import { TERRAIN_DEFS } from '../../../state/terrain';
import { buildFloors } from '../../builders/floors';
import { buildWalls } from '../../builders/walls';
import { buildRoofs } from '../../builders/roofs';
import { buildScene } from '../../../state/mapSpec';
import { spec as siegeSpec } from '../../../scenes/test-scenarios/siege-enceinte';
import type { Face } from '../../builders/types';

/**
 * Les attendus sont LUS DANS LA DONNÉE, pas récités depuis l'implémentation : chaque couleur ci-dessous
 * est le littéral de son entrée (`src/data/structureAppearance.json` « mur-en-bois »,
 * `src/data/reliefMaterials.json` « pierre »/« sol-inconnu », `src/data/roofMaterials.json` « tuile »,
 * `src/state/terrain/defs/herbe.ts`). Un ordre de repli INVERSÉ dans `faceColors.ts` (un `??` retourné)
 * choisirait une autre couleur de la MÊME entrée : le test le voit.
 */
const BOIS = {
  face: '#6e5940',
  post: '#352b1f',
  inset: '#594732',
  frame: '#7c6647',
  skirt: '#473829',
  cap: '#917a58',
};
const PIERRE = { face: '#6b6f76', slopeTop: '#878c95' };
const TUILE = {
  N: '#a04836',
  E: '#732a20',
  S: '#531b13',
  O: '#8a3527',
  line: '#411409',
  soffite: '#3d130c',
  fascia: '#2e0e07',
};
const HERBE_SWATCH = '#3d6630';
const SOL_INCONNU = '#6b6250';

const scene = buildScene(siegeSpec);
const face = (material: Face['material']): Face => ({ poly: [], material });
const couleur = (material: Face['material']): string => faceSurface(face(material)).color;

describe('la DONNÉE dit bien ce que le test attend (sinon l’attendu ment)', () => {
  it('les littéraux du test sont ceux des catalogues', () => {
    const bois = structureAppearance('mur-en-bois');
    expect({ face: bois.face, post: bois.post }).toEqual({ face: BOIS.face, post: BOIS.post });
    expect(bois.wood).toMatchObject({ inset: BOIS.inset, frame: BOIS.frame, skirt: BOIS.skirt, cap: BOIS.cap });
    expect(reliefMaterial('pierre')).toMatchObject(PIERRE);
    expect(reliefMaterial('sol-inconnu').face).toBe(SOL_INCONNU);
    expect(roofMaterial('tuile')).toMatchObject(TUILE);
    expect(TERRAIN_DEFS.find((t) => t.id === 'herbe')?.swatch).toBe(HERBE_SWATCH);
  });
});

describe('faceSurface — chaque domaine résolu par SON catalogue, jamais un littéral', () => {
  it('mur : chaque partie prend SA couleur de bois, jamais la face générique', () => {
    expect(couleur({ domain: 'structure', id: 'mur-en-bois', part: 'face' })).toBe(BOIS.face);
    expect(couleur({ domain: 'structure', id: 'mur-en-bois', part: 'panneau' })).toBe(BOIS.inset);
    expect(couleur({ domain: 'structure', id: 'mur-en-bois', part: 'moulure' })).toBe(BOIS.frame);
    expect(couleur({ domain: 'structure', id: 'mur-en-bois', part: 'plinthe' })).toBe(BOIS.skirt);
    expect(couleur({ domain: 'structure', id: 'mur-en-bois', part: 'couronnement' })).toBe(BOIS.cap);
    expect(couleur({ domain: 'structure', id: 'mur-en-bois', part: 'poteau' })).toBe(BOIS.post);
  });

  it('relief : `face` pour une falaise, `slopeTop` pour une rampe', () => {
    expect(couleur({ domain: 'relief', id: 'pierre', part: 'cliff' })).toBe(PIERRE.face);
    expect(couleur({ domain: 'relief', id: 'pierre', part: 'ramp' })).toBe(PIERRE.slopeTop);
  });

  it('toit : les QUATRE cardinaux d’un pan rendent la MÊME matière (la teinte de référence `N`)', () => {
    for (const part of ['N', 'E', 'S', 'O'])
      expect(couleur({ domain: 'roof', id: 'tuile', part })).toBe(TUILE.N);
    // Les trois autres teintes de la donnée sont de l'ombrage cuit par le peintre affine : aucune
    // n'atteint ce backend, dont la lumière fait le travail.
    for (const cuit of [TUILE.E, TUILE.S, TUILE.O]) expect(cuit).not.toBe(TUILE.N);
  });

  it('toit : le volume d’avant-toit a SES tons (`soffite`, `fascia`), pas ceux d’un pan ni du liseré', () => {
    expect(couleur({ domain: 'roof', id: 'tuile', part: 'soffite' })).toBe(TUILE.soffite);
    expect(couleur({ domain: 'roof', id: 'tuile', part: 'fascia' })).toBe(TUILE.fascia);
  });

  it('terrain : le `swatch` du registre, comme le POV', () => {
    expect(couleur({ domain: 'terrain', id: 'herbe' })).toBe(HERBE_SWATCH);
  });

  it('id absent d’un catalogue : repli VISIBLE, jamais l’apparence d’un autre matériau', () => {
    const missing = couleur({ domain: 'terrain', id: 'terrain-qui-n-existe-pas' });
    expect(missing).toBe(SOL_INCONNU);
    expect(TERRAIN_DEFS.some((t) => t.swatch === missing)).toBe(false);
  });

  it('toutes les faces de siege-enceinte reçoivent une couleur (aucune indéfinie)', () => {
    const faces = [...buildFloors(scene), ...buildWalls(scene), ...buildRoofs(scene)].flatMap((el) => el.faces);
    expect(faces.length).toBeGreaterThan(100);
    const bad = faces.filter((f) => typeof faceSurface(f).color !== 'string' || faceSurface(f).color.length === 0);
    expect(bad).toEqual([]);
  });
});

describe('faceSurface — la RECETTE et l’échelle d’UV viennent de la même def que la couleur', () => {
  it('terrain appareillé : la recette est celle de sa def, l’échelle d’UV est la période de SOL', () => {
    const dalle = TERRAIN_DEFS.find((t) => t.id === 'dalle')!;
    const s = faceSurface(face({ domain: 'terrain', id: 'dalle' }));
    expect(s.recipe).toBe(dalle.detail);
    expect(s.uvScaleM).toEqual(groundPeriodM(dalle.detail!.courses!));
  });

  it('mur appareillé : même recette, mais la période VERTICALE (un mur n’est pas un pavage de place)', () => {
    const app = structureAppearance('mur-en-pierre');
    expect(app.detail?.courses).toBeDefined();
    const s = faceSurface(face({ domain: 'structure', id: 'mur-en-pierre', part: 'face' }));
    expect(s.recipe).toBe(app.detail);
    expect(s.uvScaleM).toEqual(coursesPeriodM(app.detail!.courses!));
    expect(s.uvScaleM).not.toEqual(groundPeriodM(app.detail!.courses!));
  });

  it('surface lisse (aucune assise) : pas d’échelle d’UV — rien ne s’y répète', () => {
    const s = faceSurface(face({ domain: 'terrain', id: 'herbe' }));
    expect(s.recipe?.tintVar).toBe(0.07);
    expect(s.uvScaleM).toBeUndefined();
  });

  it('la clé de surface DÉPEND de la recette autant que de la couleur (même teinte, autre appareillage ⇒ autre clé)', () => {
    const pierre = reliefMaterial('pierre');
    expect(pierre.detail?.courses).toBeDefined();
    const lisse = surfaceKeyOf(pierre.face);
    const àAssises = surfaceKeyOf(pierre.face, pierre.detail);
    const autreAssise = surfaceKeyOf(pierre.face, {
      ...pierre.detail!,
      courses: { ...pierre.detail!.courses!, hM: pierre.detail!.courses!.hM * 2 },
    });
    expect(new Set([lisse, àAssises, autreAssise]).size).toBe(3);
    expect(surfaceKeyOf(pierre.face, pierre.detail)).toBe(àAssises); // déterministe
  });

  it('deux faces de MÊME matériau et MÊME part partagent leur clé ; deux couleurs distinctes non', () => {
    const a = faceSurface(face({ domain: 'structure', id: 'mur-en-bois', part: 'face' }));
    const b = faceSurface(face({ domain: 'structure', id: 'mur-en-bois', part: 'face' }));
    const autrePart = faceSurface(face({ domain: 'structure', id: 'mur-en-bois', part: 'plinthe' }));
    expect(a.surfaceKey).toBe(b.surfaceKey);
    expect(autrePart.surfaceKey).not.toBe(a.surfaceKey);
  });

  it('la clé d’une face est bien celle de son COUPLE (couleur, recette)', () => {
    const s = faceSurface(face({ domain: 'terrain', id: 'dalle' }));
    expect(s.surfaceKey).toBe(surfaceKeyOf(s.color, s.recipe));
  });

  it('toutes les faces de siege-enceinte reçoivent une clé de surface non vide', () => {
    const faces = [...buildFloors(scene), ...buildWalls(scene), ...buildRoofs(scene)].flatMap((el) => el.faces);
    expect(faces.filter((f) => !faceSurface(f).surfaceKey)).toEqual([]);
  });
});

describe('tintVarFactor — la variance de teinte par case, à l’identité MONDE', () => {
  const HERBE = TERRAIN_DEFS.find((t) => t.id === 'herbe')!.detail!;

  it('sans `tintVar` : facteur NEUTRE (1) — aucune surface n’est repeinte au hasard', () => {
    expect(tintVarFactor(undefined, { x: 1, y: 2, z: 0 })).toBe(1);
    expect(tintVarFactor({ seedScope: 'tile' }, { x: 1, y: 2, z: 0 })).toBe(1);
  });

  it('BORNÉ par l’amplitude de la recette : 1 ± tintVar, jamais au-delà', () => {
    const vals: number[] = [];
    for (let x = 0; x < 40; x++) for (let y = 0; y < 40; y++) vals.push(tintVarFactor(HERBE, { x, y, z: 0 }));
    expect(Math.min(...vals)).toBeGreaterThanOrEqual(1 - HERBE.tintVar!);
    expect(Math.max(...vals)).toBeLessThanOrEqual(1 + HERBE.tintVar!);
    // …et il VARIE (une constante 1 passerait les bornes sans rien nuancer).
    expect(new Set(vals).size).toBeGreaterThan(1);
  });

  it('SEED-STABLE : la même case redonne exactement la même nuance, une autre case peut diverger', () => {
    expect(tintVarFactor(HERBE, { x: 3, y: 7, z: 1 })).toBe(tintVarFactor(HERBE, { x: 3, y: 7, z: 1 }));
    const parCase = new Set([0, 1, 2, 3, 4, 5, 6, 7].map((x) => tintVarFactor(HERBE, { x, y: 0, z: 0 })));
    expect(parCase.size).toBeGreaterThan(1);
  });

  it('PARITÉ avec l’affine : la case tire la MÊME variante de dégradé que `terrainFillGradient`', () => {
    for (const cell of [
      { x: 0, y: 0, z: 0 },
      { x: 3, y: 7, z: 1 },
      { x: 12, y: 5, z: 0 },
    ]) {
      const id = terrainFillGradient('herbe', cell, 1)!;
      const k = Number(id.slice(id.indexOf('-v') + 2));
      expect(id).toBe(`g_grass-v${k}`); // la variante que l'affine PEINT
      expect(tintVarFactor(HERBE, cell)).toBeCloseTo(1 + HERBE.tintVar! * TINT_SPREAD[k], 12);
    }
  });
});
