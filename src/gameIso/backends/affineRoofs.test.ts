import { describe, it, expect } from 'vitest';
import { buildRoofs } from '../builders/roofs';
import type { RoofEl } from '../builders/types';
import { roofDepth, roofSvg } from './affineRoofs';
import { diamondPath, footprintDepth, tileCenter, WALL_H, type Dims } from '../../geometry/iso';
import { WALL_H_M } from '../iso';
import { metricToLift } from '../../state/relief';
import { roofMaterial } from '../catalog/roofs';
import { shade, mix } from '../shade';
import { emptyScene, type Roof, type Scene } from '../../state/scene';

/**
 * Backend écran-affine des toits : projette les éléments `roof` du pivot via le pont partagé (`projGP`).
 * On vérifie la teinte PAR PAN (une couleur par orientation, STABLE aux 4 rotations — fini le choix
 * par-cellule), les lignes stylées par la def (`line`/`course`), la PARITÉ de géométrie avec l'ex-nappe
 * (avant-toit à WALL_H px au-dessus du coin de grille), la profondeur de tri (footprintDepth) et les
 * deux modes PLAN (vue du dessus = boîte étiquetée ; éditeur = couverture par-cellule + libellé).
 */

const dims: Dims = { w: 10, h: 10 };

function el(roof: Partial<Roof>, edit?: (s: Scene) => void): RoofEl {
  const s = emptyScene(10, 10);
  s.roofs = [{ id: 'r1', foot: { x: 2, y: 2, w: 4, h: 2 }, style: 'maison', ...roof }];
  edit?.(s);
  return buildRoofs(s)[0];
}

const count = (svg: string, needle: string) => svg.split(needle).length - 1;

function authoredGable(pitch = 0.5): RoofEl[] {
  const scene = emptyScene(10, 10);
  scene.architecture = [{
    id: 'corps',
    style: 'maison',
    storeys: [],
    facades: [],
    roofs: [{
      id: 'toit',
      z: 0,
      foot: { x: 2, y: 2, w: 4, h: 2 },
      profile: 'gable',
      ridge: 'x',
      eaveHeightM: 4,
      pitch,
      material: 'tuile',
      roomZoneIds: ['salle'],
    }],
  }];
  return buildRoofs(scene);
}

function authoredProfile(profile: 'hip' | 'shed', ridge: 'x' | 'y'): RoofEl[] {
  const scene = emptyScene(10, 10);
  scene.architecture = [{
    id: 'corps',
    style: 'maison',
    storeys: [],
    facades: [],
    roofs: [{
      id: `toit-${profile}-${ridge}`,
      z: 0,
      foot: ridge === 'x' ? { x: 2, y: 2, w: 4, h: 2 } : { x: 2, y: 2, w: 2, h: 4 },
      profile,
      ridge,
      eaveHeightM: 4,
      pitch: 0.5,
      material: 'tuile',
      roomZoneIds: ['salle'],
    }],
  }];
  return buildRoofs(scene);
}

describe('roofSvg — pans : UNE teinte par pan, par ORIENTATION de la def, stable aux 4 rotations', () => {
  const tuile = roofMaterial('tuile');
  it.each([0, 1, 2, 3] as const)('cran %s : 4 pans remplis N/E/S/O de la donnée, exactement un chacun', (rot) => {
    const svg = roofSvg(el({}), { ...dims, rot });
    for (const part of ['N', 'E', 'S', 'O'] as const) expect(count(svg, `fill="${tuile[part]}"`)).toBe(1);
  });

  it('edge-on : mêmes 4 pans (la nappe suit la projection, pas la boîte-plan)', () => {
    const svg = roofSvg(el({}), { ...dims, rot: 1, edge: true });
    for (const part of ['N', 'E', 'S', 'O'] as const) expect(count(svg, `fill="${tuile[part]}"`)).toBe(1);
  });

  it('matériau des params (ardoise) : teintes de SA def', () => {
    const svg = roofSvg(el({ params: { roofMaterial: 'ardoise' } }), dims);
    expect(svg).toContain(`fill="${roofMaterial('ardoise').N}"`);
    expect(svg).not.toContain(`fill="${tuile.N}"`);
  });

  it('1×1 : pan PLAT au ton N + son avant-toit (4 soffites + 4 fascias débordants)', () => {
    const svg = roofSvg(el({ foot: { x: 3, y: 3, w: 1, h: 1 } }), dims);
    expect(count(svg, '<path')).toBe(9); // 1 pan + 4 soffites + 4 fascias (un débord par égout)
    expect(count(svg, `fill="${tuile.N}"`)).toBe(1); // le pan reste au ton N
    expect(svg).toContain(`fill="${tuile.soffite}"`); // dessous débordant ombré
    expect(svg).toContain(`fill="${tuile.fascia}"`); // planche de rive sombre
  });
});

describe('roofSvg — lignes stylées par la def (liseré + rangs de la recette)', () => {
  it('faîte/arêtiers/égouts au liseré `line`, rangs de tuiles au ton `detail.courses.joint`', () => {
    const tuile = roofMaterial('tuile');
    const svg = roofSvg(el({}), dims, { zoom: 0.4 }); // LOD 0 : rendu historique, rangs droits seuls
    // 1 faîte + 4 arêtiers + 4 égouts = 9 lignes de structure ; 3 rangs × 4 pans = 12 rangs
    // (pas hM = 0.24 m → 3 rangs par cran de montée, source unique builder/backend).
    expect(count(svg, `stroke="${tuile.line}"`)).toBe(9);
    expect(count(svg, `stroke="${tuile.detail!.courses!.joint}"`)).toBe(12);
    expect(svg).not.toContain('<clipPath'); // aucun détail de couverture en LOD 0
  });

  it('faîtage : liseré CLAIR `ridgeCap` par-dessus le trait de base → couronnement volumique', () => {
    const tuile = roofMaterial('tuile');
    const svg = roofSvg(el({}), dims, { zoom: 0.4 });
    expect(svg).toContain(`stroke="${tuile.ridgeCap}"`);
    // chaume = crête molle : pas de couronnement — sa faîte n'emprunte AUCUN autre ton que `line`.
    expect(roofMaterial('chaume').ridgeCap).toBeUndefined();
  });
});

describe('roofSvg — VOLUME d’avant-toit (le toit DÉBORDE, ne pose plus à ras)', () => {
  const tuile = roofMaterial('tuile');
  it.each([0, 1, 2, 3] as const)('cran %s : soffites + fascias débordants au ton dédié de la def', (rot) => {
    const svg = roofSvg(el({}), { ...dims, rot });
    expect(count(svg, `fill="${tuile.soffite}"`)).toBeGreaterThan(0); // dessous ombré
    expect(count(svg, `fill="${tuile.fascia}"`)).toBeGreaterThan(0); // planche de rive sombre
  });
  it('edge-on : le débord suit la projection (soffites + fascias présents)', () => {
    const svg = roofSvg(el({}), { ...dims, rot: 1, edge: true });
    expect(svg).toContain(`fill="${tuile.soffite}"`);
    expect(svg).toContain(`fill="${tuile.fascia}"`);
  });
  it('chaume : soffite débordant mais AUCUNE fascia dure (bord arrondi)', () => {
    const chaume = roofMaterial('chaume');
    const svg = roofSvg(el({ params: { roofMaterial: 'chaume' } }), dims);
    expect(svg).toContain(`fill="${chaume.soffite}"`);
    expect(chaume.fascia).toBeUndefined();
  });
});

describe('roofSvg — détail de couverture (matériaux v2, LOD ≥ 1)', () => {
  const tuile = roofMaterial('tuile');
  const pv = tuile.detail!.courses!.paletteVar!;
  const nuances = (['N', 'E', 'S', 'O'] as const).flatMap((p) => [shade(tuile[p]!, 1 + pv * 1.5), shade(tuile[p]!, 1 - pv * 1.5)]);
  it('tuile : bardeaux + nuances par pan, CLIPPÉS au polygone du pan, déterministes', () => {
    const svg = roofSvg(el({}), dims);
    expect(svg).toBe(roofSvg(el({}), dims));
    expect(count(svg, '<clipPath')).toBeGreaterThan(0);
    expect(count(svg, 'clip-path="url(#rfc-0-')).toBe(count(svg, '<clipPath')); // 1 groupe par clip, id par projection
    // Nuances de bardeau (LOD 2) : chemins clairs/sombres dérivés du fill du pan par `shade`.
    expect(nuances.some((c) => svg.includes(`fill="${c}"`))).toBe(true);
  });
  it('LOD 1 : bardeaux (joints) sans nuances ; ids de clip étiquetés par rotation', () => {
    const svg = roofSvg(el({}), { ...dims, rot: 2 }, { zoom: 0.6 });
    expect(svg).toContain('clip-path="url(#rfc-2-');
    for (const c of nuances) expect(svg).not.toContain(`fill="${c}"`);
  });
  it('chaume : rangs TREMBLÉS (plus aucune <line> de rang droite) + brins de paille ancrés au pan', () => {
    const chaume = roofMaterial('chaume');
    const svg = roofSvg(el({ params: { roofMaterial: 'chaume' } }), dims);
    const droits = count(svg, `<line`) - 9; // 9 lignes de structure (faîte/arêtiers/égouts)
    expect(droits).toBe(0);
    expect(count(svg, `stroke="${chaume.detail!.courses!.joint}"`)).toBeGreaterThan(0); // polylignes organiques
    // Paille : teinte de la recette MIXÉE au fill de son pan (jamais la couleur brute qui claque).
    const straws = (['N', 'E', 'S', 'O'] as const).flatMap((p) => chaume.detail!.tufts!.colors.map((c) => mix(chaume[p]!, c, 0.55)));
    expect(straws.some((c) => svg.includes(`stroke="${c}"`))).toBe(true);
  });
});

describe('roofSvg — parité de géométrie avec l’ex-nappe (base WALL_H px au-dessus du coin de grille)', () => {
  it.each([0, 1, 2, 3] as const)('cran %s : le coin d’avant-toit NO passe par tileCenter(x−0.5,y−0.5) − WALL_H', (rot) => {
    const d: Dims = { ...dims, rot };
    const svg = roofSvg(el({}), d);
    const { cx, cy } = tileCenter(1.5, 1.5, d, metricToLift(WALL_H_M)); // coin de grille (2,2) soulevé de WALL_H px
    expect(svg).toContain(`${cx},${cy}`);
    expect(metricToLift(WALL_H_M) * 96).toBe(WALL_H); // la conversion m⇔px retombe sur la vérité partagée
  });

  it('la hauteur MÉTRIQUE de la case soulève toute la nappe (tuiles à 4 m → +1 niveau écran)', () => {
    const lifted = el({}, (s) => { s.layers[0].height = new Array(100).fill(4); });
    const svg = roofSvg(lifted, dims);
    const { cx, cy } = tileCenter(1.5, 1.5, dims, metricToLift(4 + WALL_H_M));
    expect(svg).toContain(`${cx},${cy}`);
  });
});

describe('roofDepth — footprintDepth de l’empreinte à l’index de couche', () => {
  it.each([0, 1, 2, 3] as const)('cran %s', (rot) => {
    const d: Dims = { ...dims, rot };
    expect(roofDepth(el({}), d)).toBe(footprintDepth(2, 2, 4, 2, d, 0));
  });

  it.each([0, 1, 2, 3] as const)('section authorée cran %s : profondeur calculée sur la borne serrée du pan', (rot) => {
    const d: Dims = { ...dims, rot };
    const pans = authoredGable();
    expect(pans.map((pan) => roofDepth(pan, d))).toEqual(
      pans.map((pan) => footprintDepth(pan.cell.x, pan.cell.y, pan.span.w, pan.span.h, d, pan.cell.z)),
    );
    expect(pans.map((pan) => pan.span)).toEqual([{ w: 4, h: 1 }, { w: 4, h: 1 }]);
  });
});

describe('roofSvg — pans authorés indépendants', () => {
  it.each([0, 1, 2, 3] as const)('cran %s conserve les deux orientations monde du gable', (rot) => {
    const tuile = roofMaterial('tuile');
    const svg = authoredGable().map((pan) => roofSvg(pan, { ...dims, rot })).join('');
    expect(count(svg, `fill="${tuile.N}"`)).toBe(1);
    expect(count(svg, `fill="${tuile.S}"`)).toBe(1);
  });

  it.each([
    ['hip', 'x'],
    ['hip', 'y'],
    ['shed', 'x'],
    ['shed', 'y'],
  ] as const)('%s faîtage %s reste stable aux quatre rotations avec détail matériel', (profile, ridge) => {
    const outputs = ([0, 1, 2, 3] as const).map((rot) =>
      authoredProfile(profile, ridge).map((pan) => roofSvg(pan, { ...dims, rot })).join(''));
    for (const svg of outputs) {
      expect(svg).toContain(`fill="${roofMaterial('tuile').soffite}"`);
      expect(svg).toContain(`fill="${roofMaterial('tuile').fascia}"`);
      expect(svg).toContain(`stroke="${roofMaterial('tuile').detail!.courses!.joint}"`);
    }
  });

  it('détail SVG : le pas de bardeau suit pitch/courses authorés, pas ROOF_SLOPE_M', () => {
    const [pan] = authoredGable(0.96);
    const rangs = pan.lines.filter((line) => line.kind === 'rang');
    const levels = [...new Set(rangs.map((line) => line.a.h))].sort((a, b) => a - b);
    const fallback: RoofEl = { ...pan, pitch: undefined };
    const authoredSvg = roofSvg(pan, dims);
    const fallbackSvg = roofSvg(fallback, dims);
    expect(levels[1] - levels[0]).toBeCloseTo(0.24);
    expect(roofSvg(pan, dims, { zoom: 0.4 })).toBe(roofSvg(fallback, dims, { zoom: 0.4 }));
    expect(authoredSvg).not.toBe(fallbackSvg);
    expect(authoredSvg).toContain('<clipPath');
    expect(authoredSvg).not.toContain('NaN');
  });
});

describe('roofSvg — modes PLAN', () => {
  it('vue du dessus : empreinte exacte étiquetée (planBody/planEdge/planText + nom)', () => {
    const plan = roofMaterial('plan');
    const svg = roofSvg(el({ label: 'Taverne' }), { ...dims, view: 'top' });
    expect(svg).toContain(`fill="${plan.planBody}"`);
    expect(svg).toContain(`stroke="${plan.planEdge}"`);
    expect(svg).toContain(`fill="${plan.planText}"`);
    expect(svg).toContain('>Taverne</text>');
    expect(svg).not.toContain(`fill="${roofMaterial('tuile').N}"`); // pas de pans en plan
  });

  it('éditeur ({ plan: true }) : une tuile semi-transparente PAR CASE de l’empreinte + libellé', () => {
    const svg = roofSvg(el({ label: 'Forge' }), dims, { plan: true });
    expect(count(svg, '<path')).toBe(8); // 4×2 cases
    expect(count(svg, 'opacity="0.7"')).toBe(8);
    expect(svg).toContain(`fill="${roofMaterial('tuile').O}"`); // teinte du matériau de couverture
    expect(svg).toContain('>Forge</text>');
  });

  it('libellé échappé (XML) dans les deux modes plan', () => {
    const evil = el({ label: 'A<B & C>' });
    expect(roofSvg(evil, { ...dims, view: 'top' })).toContain('A&lt;B &amp; C&gt;');
    expect(roofSvg(evil, dims, { plan: true })).toContain('A&lt;B &amp; C&gt;');
  });

  it('vue du dessus : peint seulement les cellules exactes d’une union en L', () => {
    const s = emptyScene(10, 10);
    s.roofs = [
      { id: 'verticale', groupId: 'g', foot: { x: 0, y: 0, w: 1, h: 3 }, style: 'maison' },
      { id: 'horizontale', groupId: 'g', foot: { x: 1, y: 2, w: 2, h: 1 }, style: 'maison' },
    ];
    const grouped = buildRoofs(s)[0];
    const svg = roofSvg(grouped, { ...dims, view: 'top' });
    expect(count(svg, '<path')).toBe(5);
    expect(svg).not.toContain(`d="${diamondPath(1, 0, { ...dims, view: 'top' })}"`);
  });
});
