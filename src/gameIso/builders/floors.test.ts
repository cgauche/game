import { describe, it, expect } from 'vitest';
import { buildFloors, edgeBlends, isOverhang, fogFloorZ } from './floors';
import type { FloorEl } from './types';
import { emptyScene, type Scene } from '../../state/scene';
import { gradeBetween, STEP_MAX_M } from '../../state/relief';

/**
 * Builder de sols du PIVOT : le franchissement vertical S'AUTO-DÉRIVE du delta de hauteur MÉTRIQUE
 * entre cases voisines (`heightAt`/`gradeBetween`). On teste ici la sortie MONDE (camera-free) :
 * faces de relief (falaise/rampe/tablier/piliers), raccords d'arêtes (`edgeBlends` → wedges),
 * surplombs (`isOverhang`, fantôme vs surplomb PLEIN) et clés stables.
 */

/** Scène 4×4 « plancher » avec un tableau de hauteurs métriques à 0 partout (édité par test). */
function withHeight(): Scene {
  const s = emptyScene(4, 4);
  s.layers[0].tiles = new Array(16).fill('plancher');
  s.layers[0].height = new Array(16).fill(0);
  return s;
}
const setH = (s: Scene, x: number, y: number, h: number) => { s.layers[0].height![y * 4 + x] = h; };

const elAt = (els: FloorEl[], x: number, y: number, z = 0) => els.find((e) => e.key === `floor:${x},${y},${z}`);
/** Faces de RELIEF (parois) d'un élément — exclut base, wedges et piliers. */
const reliefParts = (el: FloorEl | undefined) => (el?.faces ?? []).filter((f) => f.material.domain === 'relief' && f.material.part !== 'pillar');

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

describe('buildFloors — parois de relief auto-dérivées du dénivelé métrique', () => {
  it('un plateau surélevé de +4 m porte 4 FALAISES verticales (terre en z0), en unités de grille+mètres', () => {
    const s = withHeight();
    setH(s, 1, 1, 4);
    const faces = reliefParts(elAt(buildFloors(s), 1, 1));
    expect(faces).toHaveLength(4);
    expect(faces.every((f) => f.material.part === 'cliff' && f.plane === 'vertical')).toBe(true);
    expect(faces.every((f) => f.material.id === 'terre')).toBe(true); // talus de terrain (couche de base)
    // Quad d'arête [haut-A, haut-B, bas-B, bas-A] : haut à la hauteur de la case, bas à celle du voisin.
    const n = faces.find((f) => f.side === 'N')!;
    expect(n.poly.map((p) => p.h)).toEqual([4, 4, 0, 0]);
    expect(n.poly[0]).toEqual({ x: 0.5, y: 0.5, h: 4 }); // coin NO de (1,1) en coordonnées de grille
  });

  it('un ressaut de +0.5 m (≤ STEP_MAX) porte des RAMPES (plan incliné), pas des falaises', () => {
    const s = withHeight();
    setH(s, 1, 1, 0.5);
    const faces = reliefParts(elAt(buildFloors(s), 1, 1));
    expect(faces.length).toBeGreaterThan(0);
    expect(faces.every((f) => f.material.part === 'ramp' && f.plane === 'slope')).toBe(true);
  });

  it('de niveau avec tous ses voisins → seule la face de BASE (plane ground, matériau = id du terrain)', () => {
    const el = elAt(buildFloors(withHeight()), 1, 1)!;
    expect(el.faces).toHaveLength(1);
    expect(el.faces[0].plane).toBe('ground');
    expect(el.faces[0].material).toEqual({ domain: 'terrain', id: 'plancher' });
    expect(el.faces[0].poly.map((p) => ({ x: p.x, y: p.y }))).toEqual([
      { x: 0.5, y: 0.5 }, { x: 1.5, y: 0.5 }, { x: 1.5, y: 1.5 }, { x: 0.5, y: 1.5 }, // NO→NE→SE→SO
    ]);
  });

  it('plateau (2 cases à même hauteur) → pas de paroi sur l’arête PARTAGÉE, mais bien sur les bords', () => {
    const s = withHeight();
    setH(s, 1, 1, 4);
    setH(s, 2, 1, 4); // voisin E à la même hauteur
    const dirs = reliefParts(elAt(buildFloors(s), 1, 1)).map((f) => f.side);
    expect(dirs).not.toContain('E'); // arête partagée : de niveau
    expect(dirs).toContain('S');     // bord du plateau : chute
  });

  it('la case BASSE ne porte pas la paroi : c’est le RIM (haut) qui descend vers la fosse', () => {
    const s = withHeight();
    setH(s, 1, 2, -2); // fosse en (1,2), Δ2 m = falaise
    const els = buildFloors(s);
    expect(reliefParts(elAt(els, 1, 2))).toEqual([]);                       // la fosse (plus basse) ne dessine rien
    expect(reliefParts(elAt(els, 1, 1)).some((f) => f.side === 'S')).toBe(true); // le rim (1,1) descend au sud
  });

  it('les tuiles « vide » d’un étage ne produisent AUCUN élément (on voit le dessous)', () => {
    const s = emptyScene(3, 3);
    s.layers.push({ z: 1, tiles: new Array(9).fill('vide') });
    s.layers[1].tiles[1 * 3 + 1] = 'plancher';
    const els = buildFloors(s, undefined, { activeZ: 1 });
    expect(els.filter((e) => e.cell.z === 1)).toHaveLength(1); // seule la tuile construite
    expect(els.filter((e) => e.cell.z === 0)).toHaveLength(9);
  });
});

describe('buildFloors — wedges de raccord de terrain', () => {
  it('un voisin de plus haute précédence pose un wedge sur l’arête qui lui fait face (inset 0.4)', () => {
    const s = emptyScene(3, 3); // tout herbe
    s.layers[0].tiles[1 * 3 + 2] = 'pave'; // voisin E
    const el = elAt(buildFloors(s), 1, 1)!;
    const wedges = el.faces.filter((f) => f.material.part === 'wedge');
    expect(wedges).toHaveLength(1);
    expect(wedges[0].side).toBe('E');
    expect(wedges[0].material).toEqual({ domain: 'terrain', id: 'pave', part: 'wedge' });
    // Trapèze : arête E pleine (x=1.5) + points inset de 0.4 vers le centre (1,1) → x = 1.3.
    expect(wedges[0].poly.map((p) => p.x)).toEqual([1.5, 1.5, 1.3, 1.3]);
    // Le wedge se peint APRÈS la base (ordre de peinture du builder).
    expect(el.faces.indexOf(wedges[0])).toBeGreaterThan(el.faces.findIndex((f) => f.plane === 'ground' && !f.material.part));
  });
});

describe('buildFloors — surplomb (tablier au-dessus d’une surface marchable)', () => {
  /** z0 praticable partout ; tablier 1×1 en (1,1) à z1, 4 m, cerné de vide. */
  function deckScene(): Scene {
    const s = emptyScene(4, 4);
    s.layers[0].tiles = new Array(16).fill('plancher');
    s.layers[0].height = new Array(16).fill(0);
    s.layers.push({ z: 1, tiles: new Array(16).fill('vide'), height: new Array(16).fill(0) });
    s.layers[1].tiles[1 * 4 + 1] = 'planches';
    s.layers[1].height![1 * 4 + 1] = 4;
    return s;
  }

  it('isOverhang : marchable dessous → surplomb ; rien dessous → pas de surplomb ; z0 jamais', () => {
    const s = deckScene();
    expect(isOverhang(s, 1, 1, 1)).toBe(true);
    expect(isOverhang(s, 1, 1, 0)).toBe(false);
    const noFloor = deckScene();
    noFloor.layers[0].tiles = new Array(16).fill('vide');
    expect(isOverhang(noFloor, 1, 1, 1)).toBe(false);
  });

  it('bords sur le vide = DALLE FINE (deck, pierre) + PILIERS aux coins (dédupliqués), pas des falaises', () => {
    const el = elAt(buildFloors(deckScene(), undefined, { activeZ: 1 }), 1, 1, 1)!;
    expect(el.states.overhang).toBe(true);
    const decks = el.faces.filter((f) => f.material.part === 'deck');
    expect(decks).toHaveLength(4); // 4 arêtes sur le vide
    expect(decks.every((f) => f.material.id === 'pierre' && f.plane === 'vertical')).toBe(true);
    // Dalle fine : descend de l'épaisseur du tablier (0.3 m), pas jusqu'au sol.
    expect(decks[0].poly.map((p) => p.h)).toEqual([4, 4, 4 - 0.3, 4 - 0.3]);
    const pillars = el.faces.filter((f) => f.material.part === 'pillar');
    expect(pillars).toHaveLength(4); // 4 coins uniques (coins d'arêtes adjacentes dédupliqués)
    expect(pillars.every((f) => f.poly.length === 2 && f.poly[1].h === 0)).toBe(true); // jusqu'à la surface inférieure
    // Ordre de peinture : piliers (les plus en arrière) AVANT les parois, base ensuite, wedges à la fin.
    expect(el.faces.findIndex((f) => f.material.part === 'pillar')).toBe(0);
  });

  it('fantôme au-dessus de la zone active : SEULS les surplombs sont émis', () => {
    const s = deckScene();
    const els = buildFloors(s, undefined, { activeZ: 0 });
    const z1 = els.filter((e) => e.cell.z === 1);
    expect(z1).toHaveLength(1); // le tablier seulement (les vides ne rendent rien de toute façon)
    expect(z1[0].states.ghost).toBe(true);
  });

  it('surplomb FANTÔME si la surface du dessous est VISIBLE ; PLEIN (et au-dessus du voile) sinon', () => {
    const s = deckScene();
    const seen = new Set(['1,1,0']); // le sol sous le tablier est en vue
    const ghost = elAt(buildFloors(s, seen, { activeZ: 0 }), 1, 1, 1)!;
    expect(ghost.states).toMatchObject({ ghost: true, solidOverhang: false, visible: false });
    const solid = elAt(buildFloors(s, new Set<string>(), { activeZ: 0 }), 1, 1, 1)!;
    expect(solid.states).toMatchObject({ ghost: true, solidOverhang: true, visible: true });
  });

  it('à SON étage (activeZ = 1), le tablier n’est pas un fantôme', () => {
    const el = elAt(buildFloors(deckScene(), new Set<string>(), { activeZ: 1 }), 1, 1, 1)!;
    expect(el.states.ghost).toBe(false);
    expect(el.states.solidOverhang).toBe(false);
  });
});

describe('buildFloors — sélection des couches et clés', () => {
  it('viewZ isole une seule couche (debug viewLevel)', () => {
    const s = emptyScene(2, 2);
    s.layers.push({ z: 1, tiles: new Array(4).fill('plancher') });
    const els = buildFloors(s, undefined, { activeZ: 1, viewZ: 1 });
    expect(els.every((e) => e.cell.z === 1)).toBe(true);
    expect(els).toHaveLength(4);
  });

  it('clés STABLES d’identité monde (floor:x,y,z), identiques d’un appel à l’autre', () => {
    const s = emptyScene(2, 2);
    const a = buildFloors(s).map((e) => e.key);
    const b = buildFloors(s).map((e) => e.key);
    expect(a).toEqual(b);
    expect(a).toContain('floor:1,0,0');
    expect(new Set(a).size).toBe(a.length); // aucune collision
  });
});

describe('fogFloorZ — étage de sol effectif sous un trou', () => {
  it('retombe sur le premier sol construit sous l’étage actif ; sans trou, rend activeZ', () => {
    const s = emptyScene(2, 2);
    s.layers.push({ z: 1, tiles: new Array(4).fill('vide') });
    s.layers[1].tiles[0] = 'plancher'; // (0,0) construit à z1
    expect(fogFloorZ(s, 0, 0, 1)).toBe(1); // construit à l'étage actif
    expect(fogFloorZ(s, 1, 1, 1)).toBe(0); // trou à z1 → sol de z0
    expect(fogFloorZ(s, 1, 1, 0)).toBe(0); // mono-niveau : activeZ
  });
});
