import { describe, it, expect } from 'vitest';
import { buildRoofs, roofPans, ROOF_SLOPE_M } from './roofs';
import type { Face, GP, RoofLine } from './types';
import { WALL_H_M } from '../iso';
import { emptyScene, type Roof, type Scene } from '../../state/scene';

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

describe('buildRoofs — hauteurs MÈTRES et vérités de scène', () => {
  function sceneWith(roof: Roof, edit?: (s: Scene) => void): Scene {
    const s = emptyScene(8, 8);
    s.roofs = [roof];
    edit?.(s);
    return s;
  }
  const roof: Roof = { id: 'r1', foot: { x: 2, y: 2, w: 4, h: 2 }, style: 'maison' };

  it('avant-toit = hauteur métrique de la case la plus haute + WALL_H_M ; faîte + ROOF_SLOPE_M', () => {
    const s = sceneWith(roof, (sc) => {
      sc.layers[0].height = new Array(64).fill(0);
      sc.layers[0].height![2 * 8 + 3] = 2; // une case de l'empreinte à 2 m
    });
    const el = buildRoofs(s)[0];
    const hs = el.faces.flatMap((f) => f.poly.map((p) => p.h));
    expect(Math.min(...hs)).toBeCloseTo(2 + WALL_H_M, 9);
    expect(Math.max(...hs)).toBeCloseTo(2 + WALL_H_M + S, 9);
  });

  it('identité : key/cell/span/material (params > style)/label, 4 pans', () => {
    const el = buildRoofs(sceneWith({ ...roof, label: 'Maison du charron', params: { roofMaterial: 'ardoise' } }))[0];
    expect(el.key).toBe('roof:r1');
    expect(el.cell).toEqual({ x: 2, y: 2, z: 0 });
    expect(el.span).toEqual({ w: 4, h: 2 });
    expect(el.material).toBe('ardoise');
    expect(el.label).toBe('Maison du charron');
    expect(el.faces).toHaveLength(4);
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
    expect(partsOf(el.faces)).toEqual(['E', 'N', 'O', 'S']); // le builder ne connaît aucune Dims
  });
});
