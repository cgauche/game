import { describe, expect, it } from 'vitest';
import { faceColor } from './faceColors';
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
const couleur = (material: Face['material']): string => faceColor(face(material));

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

describe('faceColor — chaque domaine résolu par SON catalogue, jamais un littéral', () => {
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

  it('toit : le ton du pan par orientation', () => {
    expect(couleur({ domain: 'roof', id: 'tuile', part: 'N' })).toBe(TUILE.N);
    expect(couleur({ domain: 'roof', id: 'tuile', part: 'E' })).toBe(TUILE.E);
    expect(couleur({ domain: 'roof', id: 'tuile', part: 'S' })).toBe(TUILE.S);
    expect(couleur({ domain: 'roof', id: 'tuile', part: 'O' })).toBe(TUILE.O);
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
    const bad = faces.filter((f) => typeof faceColor(f) !== 'string' || faceColor(f).length === 0);
    expect(bad).toEqual([]);
  });
});
