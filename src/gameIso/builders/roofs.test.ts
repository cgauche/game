import { describe, it, expect } from 'vitest';
import { buildRoofs, gableEnds, roofPans, massRoomZoneIds, resolveMass, ROOF_SLOPE_M, type RoofShapeSpec } from './roofs';
import type { Face, GP, RoofLine } from './types';
import { WALL_H_M } from '../iso';
import { emptyScene, type BuildingMass, type Scene } from '../../state/scene';

/**
 * Builder de TOITS du pivot : on teste la FUSION EN PANS CONTINUS (le fix de la cause racine « toit
 * mosaïque/zigzag ») — un polygone par pan, cellules-selles scindées en triangles PLANS le long de
 * l'arêtier —, les lignes sémantiques (faîte/arêtier/égout/rangs), les hauteurs en MÈTRES, les vérités
 * de scène (visible, roofOccupied), et la dérivation par MASSE (#823) : `hip` par BFS (noues/croupes
 * automatiques sur un corps en L, plus de boîte englobante) et `roomZoneIds` DÉRIVÉS des zones
 * intérieures que l'emprise recouvre (plus de champ authoré).
 */

const S = ROOF_SLOPE_M;

function rect(x0: number, y0: number, w: number, h: number): Set<string> {
  const out = new Set<string>();
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) out.add(`${x},${y}`);
  return out;
}

/** Pose une COTE métrique de relief sur une couche (toute la couche, ou les seules `cells`) — la
 *  vérité que `heightAt` porte et sur laquelle `buildWalls` assoit ses murs. */
function coter(scene: Scene, z: number, metres: number, cells?: readonly { x: number; y: number }[]): void {
  const layer = scene.layers.find((l) => l.z === z)!;
  const { w, h } = scene.dimensions;
  const height = layer.height ?? new Array<number>(w * h).fill(0);
  for (const c of cells ?? [...Array(w * h)].map((_, i) => ({ x: i % w, y: Math.floor(i / w) }))) height[c.y * w + c.x] = metres;
  layer.height = height;
}

/** Forme HIP par défaut des tests de pavage bruts — reproduit le pavage « sans shape »
 *  (profondeur BFS × `ROOF_SLOPE_M`, la même formule pour toute forme y compris un L). */
const hip = (eaveHeightM = 0, pitch = S): RoofShapeSpec => ({ profile: 'hip', ridge: 'x', pitch, eaveHeightM });

/** Sommets d'un polygone, triés (x,y,h) — compare des boucles sans dépendre du point de départ. */
const vertsOf = (f: Face) => [...f.poly].sort((a, b) => a.x - b.x || a.y - b.y || a.h - b.h);
const partsOf = (faces: Face[]) => faces.map((f) => f.material.part).sort();
const ofKind = (lines: RoofLine[], kind: RoofLine['kind']) => lines.filter((l) => l.kind === kind);

/** Le polygone est-il PLAN ? (fit du plan sur 3 sommets non colinéaires, résidu nul partout). */
function isPlanar(f: Face): boolean {
  const [p0, ...rest] = f.poly;
  let basis: [GP, GP] | null = null;
  for (let i = 0; i < rest.length - 1 && !basis; i++) {
    const a = rest[i], b = rest[i + 1];
    if ((a.x - p0.x) * (b.y - p0.y) - (a.y - p0.y) * (b.x - p0.x) !== 0) basis = [a, b];
  }
  if (!basis) return true; // dégénéré (colinéaire) : rien à vérifier
  const [a, b] = basis;
  const det = (a.x - p0.x) * (b.y - p0.y) - (a.y - p0.y) * (b.x - p0.x);
  const gx = ((a.h - p0.h) * (b.y - p0.y) - (a.y - p0.y) * (b.h - p0.h)) / det;
  const gy = ((a.x - p0.x) * (b.h - p0.h) - (a.h - p0.h) * (b.x - p0.x)) / det;
  return f.poly.every((p) => Math.abs(p0.h + gx * (p.x - p0.x) + gy * (p.y - p0.y) - p.h) < 1e-9);
}

describe('roofPans — rectangle 4×2 : 4 pans EXACTS + faîte (hip, distance BFS = pyramide)', () => {
  const { faces, lines } = roofPans(rect(0, 0, 4, 2), 'tuile', undefined, undefined, hip());

  it('4 pans, un par orientation, tous PLANS', () => {
    expect(faces).toHaveLength(4);
    expect(partsOf(faces)).toEqual(['E', 'N', 'O', 'S']);
    for (const f of faces) {
      expect(f.material).toMatchObject({ domain: 'roof', id: 'tuile' });
      expect(isPlanar(f)).toBe(true);
    }
  });

  it('pan N = trapèze égout(4)→faîte(2) ; pan E = triangle — sommets exacts (GP, coins de grille ±0.5)', () => {
    const north = faces.find((f) => f.material.part === 'N')!;
    expect(vertsOf(north)).toEqual([
      { x: -0.5, y: -0.5, h: 0 },
      { x: 0.5, y: 0.5, h: S },
      { x: 2.5, y: 0.5, h: S },
      { x: 3.5, y: -0.5, h: 0 },
    ]);
    const east = faces.find((f) => f.material.part === 'E')!;
    expect(vertsOf(east)).toEqual([
      { x: 2.5, y: 0.5, h: S },
      { x: 3.5, y: -0.5, h: 0 },
      { x: 3.5, y: 1.5, h: 0 },
    ]);
  });

  it('UN faîte fusionné (colinéaire), 4 arêtiers, 4 égouts (un par façade)', () => {
    const faites = ofKind(lines, 'faite');
    expect(faites).toHaveLength(1);
    expect([faites[0].a, faites[0].b].sort((p, q) => p.x - q.x)).toEqual([
      { x: 0.5, y: 0.5, h: S },
      { x: 2.5, y: 0.5, h: S },
    ]);
    expect(ofKind(lines, 'aretier')).toHaveLength(4);
    expect(ofKind(lines, 'egout')).toHaveLength(4);
  });

  it('rangs : `courses` rangs PAR CRAN de montée, par pan (tuile = 3 → 12), à niveau constant', () => {
    const rangs = ofKind(roofPans(rect(0, 0, 4, 2), 'tuile', 3, undefined, hip()).lines, 'rang');
    expect(rangs).toHaveLength(12);
    for (const r of rangs) {
      expect(r.a.h).toBeCloseTo(r.b.h, 12); // courbe de niveau du pan
      expect(r.a.h).toBeGreaterThan(0);
      expect(r.a.h).toBeLessThan(S);
    }
  });
});

describe('roofPans — pyramide 4×4 : selles du centre TRIANGULÉES, apex partagé', () => {
  const { faces, lines } = roofPans(rect(0, 0, 4, 4), 'tuile', undefined, undefined, hip());

  it('4 pans TRIANGLES nets (aucune selle émise), apex unique à 2 crans', () => {
    expect(faces).toHaveLength(4);
    expect(partsOf(faces)).toEqual(['E', 'N', 'O', 'S']);
    for (const f of faces) {
      expect(f.poly).toHaveLength(3);
      expect(isPlanar(f)).toBe(true);
      expect(f.poly.some((p) => p.x === 1.5 && p.y === 1.5 && Math.abs(p.h - 2 * S) < 1e-9)).toBe(true);
    }
  });

  it('aucun faîte (apex ponctuel), 4 arêtiers pleine diagonale (coin → apex, fusionnés), 4 égouts', () => {
    expect(ofKind(lines, 'faite')).toHaveLength(0);
    const aretiers = ofKind(lines, 'aretier');
    expect(aretiers).toHaveLength(4);
    for (const a of aretiers) {
      const [lo, hi] = [a.a, a.b].sort((p, q) => p.h - q.h);
      expect(lo.h).toBe(0); // du coin d'égout…
      expect(hi).toMatchObject({ x: 1.5, y: 1.5 }); // …jusqu'à l'apex
    }
    expect(ofKind(lines, 'egout')).toHaveLength(4);
  });
});

describe('roofPans — forme en L : arêtiers/noue triangulés SANS selle (hip BFS, croupes ET noues automatiques)', () => {
  const L = new Set([...rect(0, 0, 4, 2), ...rect(0, 2, 2, 2)]);
  const { faces, lines } = roofPans(L, 'tuile', undefined, undefined, hip());

  it('6 pans TOUS PLANS (N, O, 2×E, 2×S) — plus aucune quad-selle', () => {
    expect(partsOf(faces)).toEqual(['E', 'E', 'N', 'O', 'S', 'S']);
    for (const f of faces) expect(isPlanar(f)).toBe(true);
  });

  it('la NOUE du coin rentrant est un arêtier net : (1.5,1.5) au faîte → (1.5,1.5)+1 au creux', () => {
    const noue = ofKind(lines, 'aretier').find(
      (a) => [a.a, a.b].some((p) => p.x === 0.5 && p.y === 0.5) && [a.a, a.b].some((p) => p.x === 1.5 && p.y === 1.5),
    )!;
    expect(noue).toBeTruthy();
    const [lo, hi] = [noue.a, noue.b].sort((p, q) => p.h - q.h);
    expect(hi).toMatchObject({ x: 0.5, y: 0.5, h: S }); // haut de la noue (sommet intérieur)
    expect(lo).toMatchObject({ x: 1.5, y: 1.5, h: 0 }); // creux au coin rentrant
  });

  it('2 faîtes (bras long + bras court)', () => {
    expect(ofKind(lines, 'faite')).toHaveLength(2);
  });
});

describe('roofPans — cas limites', () => {
  it('1×1 : un pan PLAT unique à la base (profil `flat`), pas de faîte/arêtier/rang', () => {
    const { faces, lines } = roofPans(rect(2, 3, 1, 1), 'tuile', 3, undefined, { profile: 'flat', ridge: 'x', pitch: S, eaveHeightM: 0 });
    expect(faces).toHaveLength(1);
    expect(faces[0].material.part).toBe('N');
    expect(faces[0].poly.every((p) => p.h === 0)).toBe(true);
    expect(ofKind(lines, 'egout')).toHaveLength(4);
    expect(lines).toHaveLength(4); // rien d'autre
  });

  it('1×1 en `hip` : PAS un pan plat — la pyramide dégénère en 4 triangles, apex au centre à 0,5 cran', () => {
    const { faces } = roofPans(rect(2, 3, 1, 1), 'tuile', undefined, undefined, hip());
    expect(faces).toHaveLength(4);
    expect(faces.every((f) => f.poly.some((p) => Math.abs(p.h - 0.5 * S) < 1e-9))).toBe(true);
  });

  it('aucune cellule → vide ; déterministe (deux appels identiques)', () => {
    expect(roofPans(new Set(), 'tuile', undefined, undefined, hip())).toEqual({ faces: [], lines: [] });
    const a = roofPans(rect(0, 0, 3, 3), 'ardoise', 3, undefined, hip(1));
    const b = roofPans(rect(0, 0, 3, 3), 'ardoise', 3, undefined, hip(1));
    expect(a).toEqual(b);
  });
});

describe('roofPans — VOLUME d’avant-toit (soffite débordant + fascia par ÉGOUT)', () => {
  const eave = { overhang: 0.3, fasciaDrop: 0.2 };
  const { faces } = roofPans(rect(0, 0, 4, 2), 'tuile', undefined, eave, hip());
  const soffites = faces.filter((f) => f.material.part === 'soffite');
  const fascias = faces.filter((f) => f.material.part === 'fascia');

  it('un soffite + une fascia PAR ÉGOUT (4 façades) ; les 4 pans N/E/S/O intacts', () => {
    expect(soffites).toHaveLength(4);
    expect(fascias).toHaveLength(4);
    expect(faces.filter((f) => ['N', 'E', 'S', 'O'].includes(f.material.part!))).toHaveLength(4);
  });

  it('le bord EXTÉRIEUR du soffite descend SOUS l’égout (débord = pente continuée), PLAN', () => {
    for (const s of soffites) {
      const hs = s.poly.map((p) => p.h);
      expect(Math.min(...hs)).toBeCloseTo(-0.3 * S, 9); // bord extérieur : base − overhang·pente
      expect(Math.max(...hs)).toBeCloseTo(0, 9); // bord intérieur : sur l’égout (base)
      expect(isPlanar(s)).toBe(true); // coplanaire (débord franc, pas de pli)
    }
  });

  it('la fascia PEND verticalement sous le bord extérieur (haut = soffite, bas = − fasciaDrop)', () => {
    for (const fa of fascias) {
      const top = fa.poly.filter((p) => Math.abs(p.h - (-0.3 * S)) < 1e-9);
      const bot = fa.poly.filter((p) => Math.abs(p.h - (-0.3 * S - 0.2)) < 1e-9);
      expect(top).toHaveLength(2); // arête haute sur le bord extérieur du soffite
      expect(bot).toHaveLength(2); // arête basse, fasciaDrop plus bas
    }
  });

  it('SANS EaveSpec (appels historiques) : aucun débord, juste les pans', () => {
    const f = roofPans(rect(0, 0, 4, 2), 'tuile', undefined, undefined, hip()).faces;
    expect(f.every((x) => ['N', 'E', 'S', 'O'].includes(x.material.part!))).toBe(true);
  });

  it('fasciaDrop 0 (chaume, bord mou) : soffite SEUL, pas de fascia dure', () => {
    const f = roofPans(rect(0, 0, 4, 2), 'chaume', undefined, { overhang: 0.36, fasciaDrop: 0 }, hip()).faces;
    expect(f.some((x) => x.material.part === 'soffite')).toBe(true);
    expect(f.some((x) => x.material.part === 'fascia')).toBe(false);
  });

  it('pyramide (hip) : débord sur les 4 ÉGOUTS SEULEMENT, jamais sur les arêtiers', () => {
    const { faces: pf } = roofPans(rect(0, 0, 4, 4), 'tuile', undefined, eave, hip());
    expect(pf.filter((f) => f.material.part === 'soffite')).toHaveLength(4);
    expect(pf.filter((f) => f.material.part === 'fascia')).toHaveLength(4);
  });
});
describe('buildRoofs — masses de bâtiment (#823)', () => {
  const mass = (patch: Partial<BuildingMass> = {}): BuildingMass => ({
    id: 'toit-nef',
    z: 0,
    footprint: [{ x: 2, y: 2, w: 4, h: 2 }],
    levels: 1,
    profile: 'gable',
    ridge: 'x',
    pitchDeg: 45, // tan(45°)=1 ; avec metresPerTile=2 (défaut emptyScene), pitch dérivé = 2 m/case
    material: 'tuile',
    ...patch,
  });
  const sceneWithMasses = (...masses: BuildingMass[]): Scene => {
    const scene = emptyScene(12, 12);
    scene.architecture = [{
      id: 'corps-principal',
      label: 'Corps principal',
      style: 'maison',
      storeys: [],
      facades: [],
      masses,
    }];
    return scene;
  };

  it.each(['x', 'y'] as const)('respecte le faîtage authoré %s', (ridge) => {
    const footprint = [ridge === 'x' ? { x: 2, y: 2, w: 4, h: 2 } : { x: 2, y: 2, w: 2, h: 4 }];
    const out = buildRoofs(sceneWithMasses(mass({ ridge, footprint })));
    expect(new Set(out.map((pan) => pan.ridge))).toEqual(new Set([ridge]));
    expect(out).toHaveLength(2);
  });

  it('sans `ridge` déclaré, résout le LONG axe de l’emprise', () => {
    const out = buildRoofs(sceneWithMasses(mass({ ridge: undefined, footprint: [{ x: 2, y: 2, w: 6, h: 2 }] })));
    expect(new Set(out.map((pan) => pan.ridge))).toEqual(new Set(['x']));
  });

  it.each(['x', 'y'] as const)('gable impair %s reste exactement deux pans sans bande sommitale', (ridge) => {
    const footprint = [ridge === 'x' ? { x: 2, y: 2, w: 4, h: 3 } : { x: 2, y: 2, w: 3, h: 4 }];
    const out = buildRoofs(sceneWithMasses(mass({ ridge, footprint })));
    expect(out).toHaveLength(2);
    expect(new Set(out.map((pan) => pan.faces[0].material.part))).toEqual(
      ridge === 'x' ? new Set(['N', 'S']) : new Set(['O', 'E']),
    );
    expect(out.some((pan) => pan.faces[0].poly.every((point) => point.h === pan.faces[0].poly[0].h))).toBe(false);
  });

  it('deux masses jointives restent deux volumes intentionnels', () => {
    const out = buildRoofs(sceneWithMasses(
      mass({ id: 'aile-ouest', footprint: [{ x: 1, y: 2, w: 4, h: 2 }] }),
      mass({ id: 'pignon-central', footprint: [{ x: 5, y: 2, w: 2, h: 2 }] }),
    ));
    expect([...new Set(out.map((roof) => roof.sectionId))]).toEqual(['aile-ouest', 'pignon-central']);
  });

  it('unit et déduplique les parties rectangulaires d’une masse en L', () => {
    const out = buildRoofs(sceneWithMasses(mass({
      profile: 'flat',
      footprint: [
        { x: 2, y: 2, w: 1, h: 3 },
        { x: 2, y: 4, w: 3, h: 1 },
        { x: 2, y: 4, w: 1, h: 1 },
      ],
    })));
    const cells = new Set(out.flatMap((pan) => pan.cells.map((cell) => `${cell.x},${cell.y}`)));
    expect(cells).toEqual(new Set(['2,2', '2,3', '2,4', '3,4', '4,4']));
  });

  it.each([
    ['gable', 2],
    ['hip', 4],
    ['shed', 1],
    ['flat', 1],
  ] as const)('profile %s produit %s pans indépendants', (profile, count) => {
    const out = buildRoofs(sceneWithMasses(mass({ profile, ...(profile === 'shed' ? { eaveSide: 'N' as const } : {}) })));
    expect(out).toHaveLength(count);
    expect(new Set(out.map((pan) => pan.panId)).size).toBe(count);
    expect(out.every((pan) => pan.faces.length > 0)).toBe(true);
  });

  it('porte les ids relationnels et des bornes serrées par pan', () => {
    const out = buildRoofs(sceneWithMasses(mass()));
    expect(out.map(({ bodyId, sectionId }) => ({ bodyId, sectionId }))).toEqual([
      { bodyId: 'corps-principal', sectionId: 'toit-nef' },
      { bodyId: 'corps-principal', sectionId: 'toit-nef' },
    ]);
    expect(out.map((pan) => pan.span)).toEqual([{ w: 4, h: 1 }, { w: 4, h: 1 }]);
    const slopes = out.flatMap((pan) => pan.faces
      .filter((face) => ['N', 'E', 'S', 'O'].includes(face.material.part!))
      .flatMap((face) => face.poly.map((point) => point.h)));
    expect(Math.min(...slopes)).toBeCloseTo(4); // 1 niveau × WALL_H_M
    expect(Math.max(...slopes)).toBeCloseTo(6); // + 1 case de cross-portée × 2 m/case (pitchDeg=45, mpt=2)
  });

  it('une masse sur une case COTÉE pose sa nappe AU-DESSUS des murs de cette case, jamais en dessous', () => {
    // Bâtiment sur une butte / une terrasse : le mur s'assoit sur le relief de SA case (`buildWalls`
    // lit `heightAt`), l'égout doit lire la MÊME cote — sinon la nappe passe sous le sommet des murs.
    const scene = sceneWithMasses(mass());
    const butteM = 6;
    coter(scene, 0, butteM);
    const out = buildRoofs(scene);
    expect(out.length).toBeGreaterThan(0);
    const sommetDesMurs = butteM + WALL_H_M;
    for (const pan of out) {
      expect(pan.eaveHeightM).toBeCloseTo(sommetDesMurs);
      const hs = pan.faces
        .filter((face) => ['N', 'E', 'S', 'O'].includes(face.material.part!)) // les PANS ; l'avant-toit pend sous l'égout par construction
        .flatMap((face) => face.poly.map((point) => point.h));
      expect(Math.min(...hs)).toBeGreaterThanOrEqual(sommetDesMurs - 1e-9);
    }
  });

  it('une masse à ÉTAGE pose sa nappe AU-DESSUS des murs de son étage (jamais au plancher qu’elle coiffe)', () => {
    // Le geste de l'éditeur : « ajouter une masse » à l'étage 1 pose `levels: 1` (`state/sceneEdit.addBuildingMass`).
    const scene = sceneWithMasses(mass({ z: 1, levels: 1 }));
    scene.layers.push({ z: 1, tiles: new Array(144).fill('sol') });
    const plancherEtage = WALL_H_M; // l'étage repose sur le sommet des murs du rez
    coter(scene, 1, plancherEtage);
    const out = buildRoofs(scene);
    expect(out.length).toBeGreaterThan(0);
    for (const pan of out) {
      expect(pan.eaveHeightM).toBeCloseTo(plancherEtage + WALL_H_M);
      const hs = pan.faces
        .filter((face) => ['N', 'E', 'S', 'O'].includes(face.material.part!))
        .flatMap((face) => face.poly.map((point) => point.h));
      expect(Math.min(...hs)).toBeGreaterThanOrEqual(plancherEtage + WALL_H_M - 1e-9);
    }
  });

  it('roomZoneIds DÉRIVÉS (#823) : les zones intérieures que l’emprise recouvre, plus aucun champ authoré', () => {
    const scene = sceneWithMasses(mass());
    scene.effectZones = [{ id: 'salle', label: 'Salle', presentation: 'interior', z: 0, area: { kind: 'rect', x: 2, y: 2, w: 4, h: 2 } }];
    const out = buildRoofs(scene);
    expect(out.every((pan) => pan.roomZoneIds)).toBe(true);
    expect(new Set(out.flatMap((pan) => pan.roomZoneIds!))).toEqual(new Set(['salle']));
  });

  it.each(['x', 'y'] as const)('hip %s conserve quatre pans proportionnés autour du faîtage authoré', (ridge) => {
    const footprint = [ridge === 'x' ? { x: 2, y: 2, w: 6, h: 2 } : { x: 2, y: 2, w: 2, h: 6 }];
    const out = buildRoofs(sceneWithMasses(mass({ profile: 'hip', ridge, footprint })));
    expect(out).toHaveLength(4);
    expect(new Set(out.map((pan) => pan.ridge))).toEqual(new Set([ridge]));
    expect(Math.max(...out.flatMap((pan) => pan.faces.flatMap((face) => face.poly.map((point) => point.h))))).toBeCloseTo(6);
  });

  it.each(['x', 'y'] as const)('hip impair %s reste exactement quatre pans', (ridge) => {
    const footprint = [ridge === 'x' ? { x: 2, y: 2, w: 5, h: 3 } : { x: 2, y: 2, w: 3, h: 5 }];
    const out = buildRoofs(sceneWithMasses(mass({ profile: 'hip', ridge, footprint })));
    expect(out).toHaveLength(4);
    expect(new Set(out.map((pan) => pan.faces[0].material.part))).toEqual(new Set(['N', 'E', 'S', 'O']));
  });

  it.each([
    ['x', { x: 2, y: 2, w: 3, h: 5 }],
    ['y', { x: 2, y: 2, w: 5, h: 3 }],
  ] as const)('hip ridge %s pilote quatre pans même opposé au grand côté', (ridge, foot) => {
    const scene = sceneWithMasses(mass({ profile: 'hip', ridge, footprint: [foot] }));
    const out = buildRoofs(scene);
    const again = buildRoofs(scene);
    expect(out).toHaveLength(4);
    expect(new Set(out.map((pan) => pan.faces[0].material.part))).toEqual(new Set(['N', 'E', 'S', 'O']));
    expect(out.map(({ key, cell, span }) => ({ key, cell, span })))
      .toEqual(again.map(({ key, cell, span }) => ({ key, cell, span })));
  });

  it.each([
    ['x', { x: 2, y: 2, w: 1, h: 3 }],
    ['y', { x: 2, y: 2, w: 3, h: 1 }],
  ] as const)('hip mince ridge %s se ferme en apex sans pan dégénéré', (ridge, foot) => {
    const out = buildRoofs(sceneWithMasses(mass({ profile: 'hip', ridge, footprint: [foot] })));
    const area = (face: Face) => Math.abs(face.poly.reduce((sum, point, index) => {
      const next = face.poly[(index + 1) % face.poly.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0)) / 2;
    expect(out).toHaveLength(4);
    expect(out.every((pan) => area(pan.faces[0]) > 0)).toBe(true);
    expect(out.flatMap((pan) => pan.faces[0].poly).every((point) =>
      Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.h))).toBe(true);
  });

  it.each(['N', 'O'] as const)('shed %s applique la pente sur toute la portée transverse depuis l’égout déclaré', (eaveSide) => {
    const footprint = [eaveSide === 'N' ? { x: 2, y: 2, w: 4, h: 2 } : { x: 2, y: 2, w: 2, h: 4 }];
    const [pan] = buildRoofs(sceneWithMasses(mass({ profile: 'shed', ridge: undefined, eaveSide, footprint })));
    const heights = pan.faces
      .filter((face) => ['N', 'E', 'S', 'O'].includes(face.material.part!))
      .flatMap((face) => face.poly.map((point) => point.h));
    expect(Math.min(...heights)).toBeCloseTo(4);
    expect(Math.max(...heights)).toBeCloseTo(4 + 2 * 2); // portée 2 cases × 2 m/case (pitchDeg=45)
  });

  it('roofPans consomme RoofShapeSpec RÉSOLU (ridge tranché, pitch en m/case) au lieu de choisir depuis la boîte', () => {
    const shaped = roofPans(
      rect(0, 0, 4, 2),
      'tuile',
      3,
      { overhang: 0.3, fasciaDrop: 0.2 },
      { profile: 'gable', ridge: 'x', pitch: 0.5, eaveHeightM: 4 },
    );
    const slopes = shaped.faces.filter((face) => ['N', 'E', 'S', 'O'].includes(face.material.part!));
    expect(partsOf(slopes)).toEqual(['N', 'S']);
    expect(Math.min(...slopes.flatMap((face) => face.poly.map((point) => point.h)))).toBeCloseTo(4);
    expect(Math.max(...slopes.flatMap((face) => face.poly.map((point) => point.h)))).toBeCloseTo(4.5);
  });

  it('chaque pan authoré porte ses rangs et son volume de bord matériel', () => {
    const out = buildRoofs(sceneWithMasses(mass()));
    for (const pan of out) {
      expect(pan.lines.some((line) => line.kind === 'rang')).toBe(true);
      expect(pan.faces.some((face) => face.material.part === 'soffite')).toBe(true);
      expect(pan.faces.some((face) => face.material.part === 'fascia')).toBe(true);
    }
  });

  it('désactive le détail SVG coûteux d’une grande masse sans supprimer sa géométrie', () => {
    const out = buildRoofs(sceneWithMasses(mass({
      footprint: [{ x: 1, y: 1, w: 10, h: 8 }],
    })));
    expect(out).toHaveLength(2);
    expect(out.every((pan) => pan.simplifiedCourses)).toBe(true);
    expect(out.every((pan) => pan.lines.some((line) => line.kind === 'rang'))).toBe(true);
  });

  it('roofOccupied (cutaway) : vrai si un allié est dans l’empreinte de la masse, faux sinon / sans allies', () => {
    const scene = sceneWithMasses(mass());
    expect(buildRoofs(scene, { allies: [{ x: 3, y: 3 }] }).some((pan) => pan.states.roofOccupied)).toBe(true);
    expect(buildRoofs(scene, { allies: [{ x: 0, y: 0 }] }).every((pan) => !pan.states.roofOccupied)).toBe(true);
    expect(buildRoofs(scene).every((pan) => !pan.states.roofOccupied)).toBe(true);
  });

  it('visible : une masse de toit est l’ENVELOPPE du bâtiment, TOUJOURS visible (#818)', () => {
    const scene = sceneWithMasses(mass());
    expect(buildRoofs(scene).every((pan) => pan.states.visible)).toBe(true);
  });

  it('résout le matériau du catalogue par id (repli tuile pour un id inconnu), et porte l’id authoré sur l’élément', () => {
    const chaume = buildRoofs(sceneWithMasses(mass({ material: 'chaume' })));
    expect(chaume.every((pan) => pan.material === 'chaume')).toBe(true); // id authoré conservé tel quel
    expect(chaume.every((pan) => pan.faces.some((f) => f.material.part === 'soffite'))).toBe(true);
    expect(chaume.some((pan) => pan.faces.some((f) => f.material.part === 'fascia'))).toBe(false); // chaume : pas de fasciaDropM

    const inconnu = buildRoofs(sceneWithMasses(mass({ material: 'introuvable' })));
    expect(inconnu.every((pan) => pan.material === 'introuvable')).toBe(true); // le champ garde l'id BRUT, pas le repli
    expect(inconnu.some((pan) => pan.faces.some((f) => f.material.part === 'fascia'))).toBe(true); // repli tuile (fasciaDropM présent)
  });
});

describe('resolveMass / massRoomZoneIds — dérivation partagée (#823)', () => {
  it('résout le ridge par défaut au LONG axe, et le pitch en m/case (metresPerTile × tan(pitchDeg))', () => {
    const scene = emptyScene(10, 10);
    scene.metresPerTile = 3;
    const { shape } = resolveMass(scene, {
      id: 'm', z: 0, footprint: [{ x: 0, y: 0, w: 6, h: 2 }], levels: 1, profile: 'gable', pitchDeg: 45, material: 'tuile',
    });
    expect(shape.ridge).toBe('x');
    expect(shape.pitch).toBeCloseTo(3); // tan(45°)=1 × metresPerTile=3
    expect(shape.eaveHeightM).toBeCloseTo(WALL_H_M);
  });

  it('l’égout lit le RELIEF sous l’emprise, jamais une cote déduite de l’index d’étage (`levels` n’y entre pas)', () => {
    const scene = emptyScene(10, 10);
    scene.layers.push({ z: 1, tiles: new Array(100).fill('sol') });
    const at = (z: number, levels: number) =>
      resolveMass(scene, { id: 'm', z, footprint: [{ x: 0, y: 0, w: 2, h: 2 }], levels, profile: 'flat', pitchDeg: 30, material: 'tuile' }).shape.eaveHeightM;
    coter(scene, 1, WALL_H_M); // couche d'étage cotée au sommet des murs du rez
    expect(at(1, 1)).toBeCloseTo(2 * WALL_H_M);
    expect(at(1, 1)).toBeCloseTo(at(1, 2)); // `levels` compte les niveaux couverts, pas une hauteur
    // BUTTE : la MÊME masse, au MÊME étage, monte avec le relief de ses cases.
    coter(scene, 0, 6);
    expect(at(0, 1)).toBeCloseTo(6 + WALL_H_M);
  });

  it('emprise NON PLANE : l’égout se prend au point HAUT — aucun mur porté n’est traversé', () => {
    const scene = emptyScene(10, 10);
    coter(scene, 0, WALL_H_M, [{ x: 0, y: 0 }]); // marche haute sous l'emprise (cage d'escalier, terrasse)
    const { shape } = resolveMass(scene, { id: 'm', z: 0, footprint: [{ x: 0, y: 0, w: 2, h: 2 }], levels: 1, profile: 'flat', pitchDeg: 30, material: 'tuile' });
    expect(shape.eaveHeightM).toBeCloseTo(WALL_H_M + WALL_H_M);
    // RÉFUTATION du point BAS : l'égout y serait à `WALL_H_M`, soit la cote du PLANCHER de la case
    // haute — la nappe traverserait son mur de bout en bout.
    expect(shape.eaveHeightM).toBeGreaterThan(WALL_H_M);
  });

  it('massRoomZoneIds : zones intérieures recouvertes par l’emprise, sur toute la plage de niveaux (z − levels + 1 … z)', () => {
    const scene = emptyScene(10, 10);
    scene.layers.push({ z: 1, tiles: new Array(100).fill('vide') });
    scene.effectZones = [
      { id: 'bas', label: 'Bas', presentation: 'interior', z: 0, area: { kind: 'rect', x: 0, y: 0, w: 2, h: 2 } },
      { id: 'haut', label: 'Haut', presentation: 'interior', z: 1, area: { kind: 'rect', x: 0, y: 0, w: 2, h: 2 } },
      { id: 'dehors', label: 'Cour', presentation: 'exterior', z: 0, area: { kind: 'rect', x: 5, y: 5, w: 2, h: 2 } },
    ];
    const mass: BuildingMass = { id: 'm', z: 1, footprint: [{ x: 0, y: 0, w: 2, h: 2 }], levels: 2, profile: 'flat', pitchDeg: 30, material: 'tuile' };
    const cells = new Set(['0,0', '0,1', '1,0', '1,1']);
    expect(new Set(massRoomZoneIds(scene, mass, cells))).toEqual(new Set(['bas', 'haut']));
  });
});

describe('gableEnds — géométrie PURE du triangle de pignon (emprise réelle + pente, aucune donnée nouvelle)', () => {
  const shape = (patch: Partial<RoofShapeSpec> = {}): RoofShapeSpec => ({
    profile: 'gable',
    ridge: 'x',
    pitch: 0.5,
    eaveHeightM: 4,
    ...patch,
  });

  it('un toit gable produit EXACTEMENT deux pignons, un par extrémité du faîtage', () => {
    const ends = gableEnds(rect(0, 0, 4, 2), shape());
    expect(ends).toHaveLength(2);
  });

  it('chaque pignon est un TRIANGLE : base à la hauteur d’ÉGOUT, sommet à la hauteur de FAÎTAGE', () => {
    const ends = gableEnds(rect(0, 0, 4, 2), shape({ eaveHeightM: 4, pitch: 0.5 }));
    for (const end of ends) {
      expect(end.poly).toHaveLength(3);
      const heights = end.poly.map((p) => p.h).sort((a, b) => a - b);
      expect(heights[0]).toBeCloseTo(4); // base = égout
      expect(heights[1]).toBeCloseTo(4); // les DEUX coins de base à l'égout
      expect(heights[2]).toBeCloseTo(4 + 0.5); // sommet = faîtage (crossHalf=1 · pitch)
    }
  });

  it('ridge "y" ferme les pignons Nord/Sud plutôt qu’Est/Ouest — même contrat de hauteurs', () => {
    const ends = gableEnds(rect(0, 0, 2, 4), shape({ ridge: 'y' }));
    expect(ends).toHaveLength(2);
    for (const end of ends) {
      const heights = end.poly.map((p) => p.h).sort((a, b) => a - b);
      expect(heights[0]).toBeCloseTo(4);
      expect(heights[2]).toBeCloseTo(4.5);
    }
  });

  it('un toit hip ou flat ne ferme AUCUN pignon (les rampants rejoignent déjà chaque bord)', () => {
    expect(gableEnds(rect(0, 0, 4, 2), shape({ profile: 'hip' }))).toEqual([]);
    expect(gableEnds(rect(0, 0, 4, 2), shape({ profile: 'flat' }))).toEqual([]);
  });

  it('un toit shed ferme deux pignons en triangle RECTANGLE (mono-pente, pas de sommet centré)', () => {
    const ends = gableEnds(rect(0, 0, 4, 2), shape({ profile: 'shed', eaveSide: 'N' }));
    expect(ends).toHaveLength(2);
    for (const end of ends) {
      expect(end.poly).toHaveLength(3);
      const heights = end.poly.map((p) => p.h);
      expect(Math.min(...heights)).toBeCloseTo(4); // bas côté égout
      expect(Math.max(...heights)).toBeCloseTo(4 + 2 * 0.5); // haut côté faîte (portée 2 · pente)
      expect(heights.filter((h) => Math.abs(h - Math.min(...heights)) < 1e-9)).toHaveLength(2); // base plate
    }
  });

  it('une aile plus étroite que la bbox globale ferme un pignon à SA largeur réelle, pas la bbox', () => {
    const L = new Set([...rect(0, 0, 4, 2), ...rect(0, 2, 2, 2)]); // L : l'extrémité x=4 n'a que la rangée y∈[0,2)
    const ends = gableEnds(L, shape({ eaveHeightM: 0, pitch: 0.5 }));
    const east = ends.find((end) => end.poly.every((p) => p.x === 3.5))!;
    expect(east).toBeTruthy();
    expect(east.poly.map((p) => p.y).sort((a, b) => a - b)).toEqual([-0.5, 0.5, 1.5]); // largeur 2, pas 4
  });

  it('aucune cellule → aucun pignon (déterministe)', () => {
    expect(gableEnds(new Set(), shape())).toEqual([]);
  });
});
