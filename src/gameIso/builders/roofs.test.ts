import { describe, it, expect } from 'vitest';
import { buildRoofs, roofPans, ROOF_SLOPE_M } from './roofs';
import type { Face, GP, RoofEl, RoofLine } from './types';
import { WALL_H_M } from '../iso';
import { emptyScene, type Roof, type RoofSection, type Scene } from '../../state/scene';

/**
 * Builder de TOITS du pivot : on teste la FUSION EN PANS CONTINUS (le fix de la cause racine « toit
 * mosaïque/zigzag ») — un polygone par pan, cellules-selles scindées en triangles PLANS le long de
 * l'arêtier —, les lignes sémantiques (faîte/arêtier/égout/rangs), les hauteurs en MÈTRES et les
 * vérités de scène (visible, roofOccupied).
 */

const S = ROOF_SLOPE_M;

function rect(x0: number, y0: number, w: number, h: number): Set<string> {
  const out = new Set<string>();
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) out.add(`${x},${y}`);
  return out;
}

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

describe('roofPans — rectangle 4×2 : 4 pans EXACTS + faîte', () => {
  const { faces, lines } = roofPans(rect(0, 0, 4, 2), 0, 'tuile');

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
    const rangs = ofKind(roofPans(rect(0, 0, 4, 2), 0, 'tuile', 3).lines, 'rang');
    expect(rangs).toHaveLength(12);
    for (const r of rangs) {
      expect(r.a.h).toBeCloseTo(r.b.h, 12); // courbe de niveau du pan
      expect(r.a.h).toBeGreaterThan(0);
      expect(r.a.h).toBeLessThan(S);
    }
  });
});

describe('roofPans — pyramide 4×4 : selles du centre TRIANGULÉES, apex partagé', () => {
  const { faces, lines } = roofPans(rect(0, 0, 4, 4), 0, 'tuile');

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

describe('roofPans — forme en L : arêtiers/noue triangulés SANS selle', () => {
  const L = new Set([...rect(0, 0, 4, 2), ...rect(0, 2, 2, 2)]);
  const { faces, lines } = roofPans(L, 0, 'tuile');

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
  it('1×1 : un pan PLAT unique à la base (ton N historique), pas de faîte/arêtier/rang', () => {
    const { faces, lines } = roofPans(rect(2, 3, 1, 1), 0, 'tuile', 3);
    expect(faces).toHaveLength(1);
    expect(faces[0].material.part).toBe('N');
    expect(faces[0].poly.every((p) => p.h === 0)).toBe(true);
    expect(ofKind(lines, 'egout')).toHaveLength(4);
    expect(lines).toHaveLength(4); // rien d'autre
  });

  it('aucune cellule → vide ; déterministe (deux appels identiques)', () => {
    expect(roofPans(new Set(), 0, 'tuile')).toEqual({ faces: [], lines: [] });
    const a = roofPans(rect(0, 0, 3, 3), 1, 'ardoise', 3);
    const b = roofPans(rect(0, 0, 3, 3), 1, 'ardoise', 3);
    expect(a).toEqual(b);
  });
});

describe('roofPans — VOLUME d’avant-toit (soffite débordant + fascia par ÉGOUT)', () => {
  const eave = { overhang: 0.3, fasciaDrop: 0.2 };
  const { faces } = roofPans(rect(0, 0, 4, 2), 0, 'tuile', undefined, eave);
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
    const f = roofPans(rect(0, 0, 4, 2), 0, 'tuile').faces;
    expect(f.every((x) => ['N', 'E', 'S', 'O'].includes(x.material.part!))).toBe(true);
  });

  it('fasciaDrop 0 (chaume, bord mou) : soffite SEUL, pas de fascia dure', () => {
    const f = roofPans(rect(0, 0, 4, 2), 0, 'chaume', undefined, { overhang: 0.36, fasciaDrop: 0 }).faces;
    expect(f.some((x) => x.material.part === 'soffite')).toBe(true);
    expect(f.some((x) => x.material.part === 'fascia')).toBe(false);
  });

  it('pyramide (hip) : débord sur les 4 ÉGOUTS SEULEMENT, jamais sur les arêtiers', () => {
    const { faces: pf } = roofPans(rect(0, 0, 4, 4), 0, 'tuile', undefined, eave);
    expect(pf.filter((f) => f.material.part === 'soffite')).toHaveLength(4);
    expect(pf.filter((f) => f.material.part === 'fascia')).toHaveLength(4);
  });
});

describe('buildRoofs — hauteurs MÈTRES et vérités de scène', () => {
  function sceneWith(roof: Roof, edit?: (s: Scene) => void): Scene {
    const s = emptyScene(8, 8);
    s.roofs = [roof];
    edit?.(s);
    return s;
  }
  const roof: Roof = { id: 'r1', foot: { x: 2, y: 2, w: 4, h: 2 }, style: 'maison' };
  const ORIENT = ['N', 'E', 'S', 'O'];
  const pansOf = (el: RoofEl) => el.faces.filter((f) => ORIENT.includes(f.material.part!));

  it('avant-toit = hauteur métrique de la case la plus haute + WALL_H_M ; faîte + ROOF_SLOPE_M', () => {
    const s = sceneWith(roof, (sc) => {
      sc.layers[0].height = new Array(64).fill(0);
      sc.layers[0].height![2 * 8 + 3] = 2; // une case de l'empreinte à 2 m
    });
    const el = buildRoofs(s)[0];
    const hs = pansOf(el).flatMap((f) => f.poly.map((p) => p.h)); // les PANS : égout (base) → faîte (+S)
    expect(Math.min(...hs)).toBeCloseTo(2 + WALL_H_M, 9);
    expect(Math.max(...hs)).toBeCloseTo(2 + WALL_H_M + S, 9);
    // le VOLUME d'avant-toit débord SOUS l'égout (matériau maison = tuile : fascia dure).
    const below = el.faces.flatMap((f) => f.poly.map((p) => p.h));
    expect(Math.min(...below)).toBeLessThan(2 + WALL_H_M - 1e-6);
  });

  it('identité : key/cell/span/material (params > style)/label, 4 pans (+ avant-toit)', () => {
    const el = buildRoofs(sceneWith({ ...roof, label: 'Maison du charron', params: { roofMaterial: 'ardoise' } }))[0];
    expect(el.key).toBe('roof:r1');
    expect(el.cell).toEqual({ x: 2, y: 2, z: 0 });
    expect(el.span).toEqual({ w: 4, h: 2 });
    expect(el.material).toBe('ardoise');
    expect(el.label).toBe('Maison du charron');
    expect(pansOf(el)).toHaveLength(4); // 4 pans + soffites/fascias débordants
    expect(el.faces.some((f) => f.material.part === 'soffite')).toBe(true);
  });

  it('material par défaut = styleRoofMaterial (echoppe → chaume) ; label par défaut = style', () => {
    const el = buildRoofs(sceneWith({ ...roof, style: 'echoppe' }))[0];
    expect(el.material).toBe('chaume');
    expect(el.label).toBe('echoppe');
  });

  it('roofOccupied (cutaway) : vrai si UN allié est dans l’empreinte, faux sinon / sans allies', () => {
    const s = sceneWith(roof);
    expect(buildRoofs(s, undefined, { allies: [{ x: 3, y: 3 }] })[0].states.roofOccupied).toBe(true);
    expect(buildRoofs(s, undefined, { allies: [{ x: 0, y: 0 }] })[0].states.roofOccupied).toBe(false);
    expect(buildRoofs(s)[0].states.roofOccupied).toBe(false);
  });

  it('visible : une case de l’empreinte ÉLARGIE d’1 en vue suffit ; set absent ⇒ visible', () => {
    const s = sceneWith(roof);
    expect(buildRoofs(s, new Set(['1,1,0']))[0].states.visible).toBe(true); // coin du pourtour
    expect(buildRoofs(s, new Set(['0,0,0']))[0].states.visible).toBe(false);
    expect(buildRoofs(s)[0].states.visible).toBe(true);
  });

  it('teintes par orientation = vérité MONDE (parts indépendantes de toute caméra, stables par rotation)', () => {
    const el = buildRoofs(sceneWith(roof))[0];
    expect(partsOf(pansOf(el))).toEqual(['E', 'N', 'O', 'S']); // le builder ne connaît aucune Dims
  });
});

describe('buildRoofs — groupId et empreintes exactes', () => {
  const grouped = (roofs: Roof[], edit?: (scene: Scene) => void) => {
    const scene = emptyScene(10, 10);
    scene.roofs = roofs;
    edit?.(scene);
    return buildRoofs(scene);
  };
  const roof = (id: string, x: number, y: number, w: number, h: number): Roof => ({
    id,
    groupId: 'g',
    foot: { x, y, w, h },
    style: 'maison',
  });
  const cellKeys = (el: RoofEl) => el.cells.map(({ x, y }) => `${x},${y}`);

  it('calcule la même base et la même géométrie pour une union identique découpée différemment', () => {
    const build = (roofs: Roof[]) => grouped(roofs);
    const whole = build([roof('bloc', 1, 1, 2, 2)]);
    const partitioned = build([
      roof('nord', 1, 1, 2, 1),
      roof('sud-ouest', 1, 2, 1, 1),
      roof('sud-est', 2, 2, 1, 1),
    ]);

    expect(partitioned).toEqual(whole);
    const pans = whole[0].faces.filter((face) => ['N', 'E', 'S', 'O'].includes(face.material.part!));
    expect(Math.min(...pans.flatMap((face) => face.poly.map((point) => point.h)))).toBe(WALL_H_M);
  });

  it('fusionne une union en L contiguë en un seul élément sans remplir son trou', () => {
    const els = grouped([roof('verticale', 0, 0, 1, 3), roof('horizontale', 1, 2, 2, 1)]);
    expect(els).toHaveLength(1);
    expect(els[0].cell).toEqual({ x: 0, y: 0, z: 0 });
    expect(els[0].span).toEqual({ w: 3, h: 3 });
    expect(cellKeys(els[0])).toEqual(['0,0', '0,1', '0,2', '1,2', '2,2']);
    expect(cellKeys(els[0])).not.toContain('1,0');
  });

  it('scinde une union disjointe en deux composantes déterministes', () => {
    const els = grouped([roof('droite', 5, 5, 1, 1), roof('gauche', 1, 1, 1, 1)]);
    expect(els).toHaveLength(2);
    expect(els.map((el) => el.cell)).toEqual([
      { x: 1, y: 1, z: 0 },
      { x: 5, y: 5, z: 0 },
    ]);
    expect(els.map((el) => el.key)).toEqual([...els.map((el) => el.key)].sort());
  });

  it('ne fusionne pas des rectangles de bases métriques différentes', () => {
    const els = grouped([roof('bas', 1, 1, 1, 1), roof('haut', 4, 1, 1, 1)], (scene) => {
      scene.layers[0].height = new Array(100).fill(0);
      scene.layers[0].height![1 * 10 + 4] = 4;
    });
    expect(els).toHaveLength(2);
    expect(els.map((el) => Math.min(...el.faces
      .filter((face) => ['N', 'E', 'S', 'O'].includes(face.material.part!))
      .flatMap((face) => face.poly.map((point) => point.h))))).toEqual([WALL_H_M, 4 + WALL_H_M]);
  });

  it('ne fusionne pas deux rectangles contigus de même groupId mais de bases différentes', () => {
    const els = grouped([roof('bas', 1, 1, 1, 1), roof('haut', 2, 1, 1, 1)], (scene) => {
      scene.layers[0].height = new Array(100).fill(0);
      scene.layers[0].height![1 * 10 + 2] = 4;
    });
    expect(els).toHaveLength(2);
    expect(els.map((el) => el.eaveHeightM)).toEqual([WALL_H_M, 4 + WALL_H_M]);
  });

  it('roofOccupied teste les cellules exactes, pas le trou de la bbox', () => {
    const roofs = [roof('verticale', 0, 0, 1, 3), roof('horizontale', 1, 2, 2, 1)];
    const scene = emptyScene(10, 10);
    scene.roofs = roofs;
    expect(buildRoofs(scene, undefined, { allies: [{ x: 1, y: 0 }] })[0].states.roofOccupied).toBe(false);
    expect(buildRoofs(scene, undefined, { allies: [{ x: 1, y: 2 }] })[0].states.roofOccupied).toBe(true);
  });
});

describe('buildRoofs — sections de toiture authorées', () => {
  const section = (patch: Partial<RoofSection> = {}): RoofSection => ({
    id: 'toit-nef',
    z: 0,
    parts: [{ x: 2, y: 2, w: 4, h: 2 }],
    profile: 'gable',
    ridge: 'x',
    eaveHeightM: 4,
    pitch: 0.5,
    material: 'tuile',
    roomZoneIds: ['salle'],
    ...patch,
  });
  const sceneWithSections = (...roofs: RoofSection[]): Scene => {
    const scene = emptyScene(12, 12);
    scene.architecture = [{
      id: 'corps-principal',
      label: 'Corps principal',
      style: 'maison',
      storeys: [],
      facades: [],
      roofs,
    }];
    return scene;
  };

  it.each(['x', 'y'] as const)('respecte le faîtage authoré %s', (ridge) => {
    const foot = ridge === 'x'
      ? { x: 2, y: 2, w: 4, h: 2 }
      : { x: 2, y: 2, w: 2, h: 4 };
    const out = buildRoofs(sceneWithSections(section({ ridge, parts: [foot] })));
    expect(new Set(out.map((pan) => pan.ridge))).toEqual(new Set([ridge]));
    expect(out).toHaveLength(2);
  });

  it.each(['x', 'y'] as const)('gable impair %s reste exactement deux pans sans bande sommitale', (ridge) => {
    const foot = ridge === 'x'
      ? { x: 2, y: 2, w: 4, h: 3 }
      : { x: 2, y: 2, w: 3, h: 4 };
    const out = buildRoofs(sceneWithSections(section({ ridge, parts: [foot] })));
    expect(out).toHaveLength(2);
    expect(new Set(out.map((pan) => pan.faces[0].material.part))).toEqual(
      ridge === 'x' ? new Set(['N', 'S']) : new Set(['O', 'E']),
    );
    expect(out.some((pan) => pan.faces[0].poly.every((point) => point.h === pan.faces[0].poly[0].h))).toBe(false);
  });

  it('deux sections jointives restent deux volumes intentionnels', () => {
    const out = buildRoofs(sceneWithSections(
      section({ id: 'aile-ouest', parts: [{ x: 1, y: 2, w: 4, h: 2 }] }),
      section({ id: 'pignon-central', parts: [{ x: 5, y: 2, w: 2, h: 2 }] }),
    ));
    expect([...new Set(out.map((roof) => roof.sectionId))]).toEqual(['aile-ouest', 'pignon-central']);
  });

  it('unit et déduplique les parties rectangulaires d’une section en L', () => {
    const out = buildRoofs(sceneWithSections(section({
      profile: 'flat',
      parts: [
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
    const out = buildRoofs(sceneWithSections(section({ profile })));
    expect(out).toHaveLength(count);
    expect(new Set(out.map((pan) => pan.panId)).size).toBe(count);
    expect(out.every((pan) => pan.faces.length > 0)).toBe(true);
  });

  it('porte les ids relationnels, la pente et des bornes serrées par pan', () => {
    const out = buildRoofs(sceneWithSections(section()));
    expect(out.map(({ bodyId, sectionId, roomZoneIds, pitch, eaveHeightM }) => ({
      bodyId, sectionId, roomZoneIds, pitch, eaveHeightM,
    }))).toEqual([
      { bodyId: 'corps-principal', sectionId: 'toit-nef', roomZoneIds: ['salle'], pitch: 0.5, eaveHeightM: 4 },
      { bodyId: 'corps-principal', sectionId: 'toit-nef', roomZoneIds: ['salle'], pitch: 0.5, eaveHeightM: 4 },
    ]);
    expect(out.map((pan) => pan.span)).toEqual([{ w: 4, h: 1 }, { w: 4, h: 1 }]);
    const slopes = out.flatMap((pan) => pan.faces
      .filter((face) => ['N', 'E', 'S', 'O'].includes(face.material.part!))
      .flatMap((face) => face.poly.map((point) => point.h)));
    expect(Math.min(...slopes)).toBeCloseTo(4);
    expect(Math.max(...slopes)).toBeCloseTo(4.5);
  });

  it.each(['x', 'y'] as const)('hip %s conserve quatre pans proportionnés autour du faîtage authoré', (ridge) => {
    const foot = ridge === 'x'
      ? { x: 2, y: 2, w: 6, h: 2 }
      : { x: 2, y: 2, w: 2, h: 6 };
    const out = buildRoofs(sceneWithSections(section({ profile: 'hip', ridge, parts: [foot] })));
    expect(out).toHaveLength(4);
    expect(new Set(out.map((pan) => pan.ridge))).toEqual(new Set([ridge]));
    expect(Math.max(...out.flatMap((pan) => pan.faces.flatMap((face) => face.poly.map((point) => point.h))))).toBeCloseTo(4.5);
  });

  it.each(['x', 'y'] as const)('hip impair %s reste exactement quatre pans', (ridge) => {
    const foot = ridge === 'x'
      ? { x: 2, y: 2, w: 5, h: 3 }
      : { x: 2, y: 2, w: 3, h: 5 };
    const out = buildRoofs(sceneWithSections(section({ profile: 'hip', ridge, parts: [foot] })));
    expect(out).toHaveLength(4);
    expect(new Set(out.map((pan) => pan.faces[0].material.part))).toEqual(new Set(['N', 'E', 'S', 'O']));
  });

  it.each([
    ['x', { x: 2, y: 2, w: 3, h: 5 }],
    ['y', { x: 2, y: 2, w: 5, h: 3 }],
  ] as const)('hip ridge %s pilote quatre pans même opposé au grand côté', (ridge, foot) => {
    const scene = sceneWithSections(section({ profile: 'hip', ridge, parts: [foot] }));
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
    const out = buildRoofs(sceneWithSections(section({ profile: 'hip', ridge, parts: [foot] })));
    const area = (face: Face) => Math.abs(face.poly.reduce((sum, point, index) => {
      const next = face.poly[(index + 1) % face.poly.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0)) / 2;
    expect(out).toHaveLength(4);
    expect(out.every((pan) => area(pan.faces[0]) > 0)).toBe(true);
    expect(out.flatMap((pan) => pan.faces[0].poly).every((point) =>
      Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.h))).toBe(true);
  });

  it.each(['x', 'y'] as const)('shed %s applique pitch sur toute la portée transverse', (ridge) => {
    const foot = ridge === 'x'
      ? { x: 2, y: 2, w: 4, h: 2 }
      : { x: 2, y: 2, w: 2, h: 4 };
    const [pan] = buildRoofs(sceneWithSections(section({ profile: 'shed', ridge, parts: [foot] })));
    const heights = pan.faces
      .filter((face) => ['N', 'E', 'S', 'O'].includes(face.material.part!))
      .flatMap((face) => face.poly.map((point) => point.h));
    expect(Math.min(...heights)).toBeCloseTo(4);
    expect(Math.max(...heights)).toBeCloseTo(4 + (ridge === 'x' ? foot.h : foot.w) * 0.5);
  });

  it('roofPans consomme RoofShapeSpec au lieu de choisir le profil depuis la boîte', () => {
    const shaped = roofPans(
      rect(0, 0, 4, 2),
      99,
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
    const out = buildRoofs(sceneWithSections(section()));
    for (const pan of out) {
      expect(pan.lines.some((line) => line.kind === 'rang')).toBe(true);
      expect(pan.faces.some((face) => face.material.part === 'soffite')).toBe(true);
      expect(pan.faces.some((face) => face.material.part === 'fascia')).toBe(true);
    }
  });

  it('désactive le détail SVG coûteux d’une grande section sans supprimer sa géométrie', () => {
    const out = buildRoofs(sceneWithSections(section({
      parts: [{ x: 1, y: 1, w: 10, h: 8 }],
    })));
    expect(out).toHaveLength(2);
    expect(out.every((pan) => pan.simplifiedCourses)).toBe(true);
    expect(out.every((pan) => pan.lines.some((line) => line.kind === 'rang'))).toBe(true);
  });
});
