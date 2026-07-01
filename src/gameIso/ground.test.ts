import { describe, it, expect } from 'vitest';
import { edgeBlends, isOverhang, reliefFaces, groundTile } from './ground';
import { emptyScene, type Scene } from '../state/scene';
import { gradeBetween, STEP_MAX_M } from '../state/relief';
import type { Dims } from './iso';

/**
 * Relief unifié : le franchissement vertical S'AUTO-DÉRIVE du delta de hauteur MÉTRIQUE entre cases
 * voisines (`heightAt`/`gradeBetween`) — plus d'`elevSkirt`/`elev` ni de machinerie escalier. On teste ici
 * les HELPERS PURS de `ground.ts` : le raccord d'arêtes de terrain (`edgeBlends`), la détection de SURPLOMB
 * (`isOverhang`) et la classification d'arête (rampe vs falaise) portée par `reliefFaces`/`gradeBetween`.
 */

const dims: Dims = { w: 4, h: 4 };

/** Scène 4×4 « plancher » avec un tableau de hauteurs métriques à 0 partout (édité par test). */
function withHeight(): Scene {
  const s = emptyScene(4, 4);
  s.layers[0].tiles = new Array(16).fill('plancher');
  s.layers[0].height = new Array(16).fill(0);
  return s;
}
const setH = (s: Scene, x: number, y: number, h: number) => { s.layers[0].height![y * 4 + x] = h; };

describe('edgeBlends (raccord d’arêtes de terrain)', () => {
  it('un voisin de priorité plus haute déborde ; même priorité ne déborde pas', () => {
    const s = emptyScene(3, 3); // tout herbe (priorité 1)
    s.layers[0].tiles[1 * 3 + 2] = 'pave'; // E (x=2,y=1) = pavé (priorité 5)
    const blends = edgeBlends(s, 1, 1);
    expect(blends).toContainEqual({ dir: 'E', terrain: 'pave' });
    expect(blends.find((b) => b.terrain === 'herbe')).toBeUndefined();
  });
  it('aucun débordement si tous les voisins ≤ priorité du centre', () => {
    const s = emptyScene(3, 3);
    s.layers[0].tiles[1 * 3 + 1] = 'pave'; // centre = pavé (haute priorité)
    expect(edgeBlends(s, 1, 1)).toEqual([]); // voisins herbe (basse)
  });
  it('opère sur le NIVEAU demandé (z) — chaque couche a ses propres raccords', () => {
    const s = emptyScene(3, 3);
    s.layers.push({ z: 1, tiles: new Array(9).fill('herbe') });
    s.layers[1].tiles[1 * 3 + 2] = 'pave'; // voisin E au niveau 1
    expect(edgeBlends(s, 1, 1, 1)).toContainEqual({ dir: 'E', terrain: 'pave' });
    expect(edgeBlends(s, 1, 1, 0)).toEqual([]); // niveau 0 inchangé (tout herbe)
  });
});

describe('gradeBetween — rampe (≤ STEP_MAX) vs falaise (>STEP_MAX)', () => {
  it('classe le lien vertical par |Δhauteur| (mètres)', () => {
    expect(gradeBetween(2, 2)).toBe('flat');
    expect(gradeBetween(0, STEP_MAX_M)).toBe('ramp');       // exactement le pas max → franchissable
    expect(gradeBetween(0, STEP_MAX_M + 0.5)).toBe('cliff'); // au-delà → falaise
  });
});

describe('reliefFaces — parois auto-dérivées du dénivelé métrique', () => {
  it('un plateau surélevé de +4 m dessine 4 FALAISES (cliff) sur ses arêtes (terre en z0)', () => {
    const s = withHeight();
    setH(s, 1, 1, 4);
    const faces = reliefFaces(s, 1, 1, dims);
    expect(faces).toHaveLength(4);
    expect(faces.every((f) => f.grade === 'cliff')).toBe(true);
    expect(faces.every((f) => f.tone === 'earth')).toBe(true); // talus de terrain (couche de base)
  });

  it('un ressaut de +0.5 m (≤ STEP_MAX) dessine des RAMPES, pas des falaises', () => {
    const s = withHeight();
    setH(s, 1, 1, 0.5);
    const faces = reliefFaces(s, 1, 1, dims);
    expect(faces.length).toBeGreaterThan(0);
    expect(faces.every((f) => f.grade === 'ramp')).toBe(true);
  });

  it('de niveau avec tous ses voisins → aucune paroi', () => {
    expect(reliefFaces(withHeight(), 1, 1, dims)).toEqual([]);
  });

  it('plateau (2 cases à même hauteur) → pas de paroi sur l’arête PARTAGÉE, mais bien sur les bords', () => {
    const s = withHeight();
    setH(s, 1, 1, 4);
    setH(s, 2, 1, 4); // voisin E à la même hauteur
    const dirs = reliefFaces(s, 1, 1, dims).map((f) => f.dir);
    expect(dirs).not.toContain('E'); // arête partagée : de niveau
    expect(dirs).toContain('S');     // bord du plateau : chute
  });

  it('la case BASSE ne porte pas la paroi : c’est le RIM (haut) qui descend vers la fosse', () => {
    const s = withHeight();
    setH(s, 1, 2, -2); // fosse en (1,2), Δ2 m = falaise
    expect(reliefFaces(s, 1, 2, dims)).toEqual([]);               // la fosse (plus basse) ne dessine rien
    expect(reliefFaces(s, 1, 1, dims).some((f) => f.dir === 'S')).toBe(true); // le rim (1,1) descend au sud
  });
});

describe('isOverhang — tablier surplombant une surface inférieure', () => {
  it('une tuile d’étage AU-DESSUS d’une surface marchable est un surplomb', () => {
    const s = emptyScene(4, 4);
    s.layers[0].tiles = new Array(16).fill('plancher'); // z0 marchable
    s.layers.push({ z: 1, tiles: new Array(16).fill('vide') });
    s.layers[1].tiles[1 * 4 + 1] = 'plancher'; // tablier au-dessus de (1,1)
    expect(isOverhang(s, 1, 1, 1)).toBe(true);
    expect(isOverhang(s, 1, 1, 0)).toBe(false); // la couche de base n'est jamais un surplomb
  });
  it('pas de surplomb si rien de marchable en dessous (vide sous la tuile d’étage)', () => {
    const s = emptyScene(4, 4);
    s.layers[0].tiles = new Array(16).fill('vide'); // z0 non marchable
    s.layers.push({ z: 1, tiles: new Array(16).fill('plancher') });
    expect(isOverhang(s, 1, 1, 1)).toBe(false);
  });
});

describe('groundTile — intègre les parois dans le SVG de la tuile', () => {
  it('une case en falaise porte la classe `elev-cliff` et grossit le SVG', () => {
    const s = withHeight();
    setH(s, 1, 1, 4);
    const flat = groundTile(withHeight(), 1, 1, dims); // voisine plate = aucune paroi
    const raised = groundTile(s, 1, 1, dims);
    expect(raised.length).toBeGreaterThan(flat.length);
    expect(raised).toContain('elev-cliff');
  });
});
