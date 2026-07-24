import { describe, it, expect } from 'vitest';
import { emptyScene, isWalkable, type Scene, type SceneEntity } from './scene';
import type { Flow } from './flow';
import { exploreMoveDest, exploreStepDest, spawnFacing } from './exploreNav';

const emptyFlow: Flow = { kind: 'seq', steps: [] };
const cheb = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

function sceneWith(entities: SceneEntity[]): Scene {
  const sc = emptyScene(10, 10); // grille entièrement 'herbe' (marchable)
  sc.entities = entities;
  return sc;
}

describe('exploreMoveDest — case d’arrivée partagée survol/clic (exploration)', () => {
  it('case libre : renvoie la case elle-même', () => {
    expect(exploreMoveDest(sceneWith([]), { x: 1, y: 1 }, { x: 5, y: 5 })).toEqual({ x: 5, y: 5 });
  });

  it('objet interactif (case bloquée) : vise une case adjacente marchable, pas la case de l’objet', () => {
    // RÉGRESSION : « au survol d’un objet avec interaction, le chemin ne s’affiche pas ». La case de
    // l’objet est non marchable (entityBlockedAt), donc l’aperçu doit viser la case adjacente — celle
    // où le clic emmène le groupe avant la fouille — au lieu de ne rien afficher.
    const prop: SceneEntity = { id: 'coffre', kind: 'prop', pos: { x: 5, y: 5 }, interact: { flow: emptyFlow } };
    const sc = sceneWith([prop]);
    expect(isWalkable(sc, 5, 5)).toBe(false); // précondition : la case de l’objet est bloquée
    const dest = exploreMoveDest(sc, { x: 1, y: 1 }, { x: 5, y: 5 });
    expect(dest).not.toBeNull();
    expect(dest).not.toEqual({ x: 5, y: 5 });
    expect(cheb(dest!, { x: 5, y: 5 })).toBe(1);
    expect(isWalkable(sc, dest!.x, dest!.y, dest!.z ?? 0)).toBe(true);
  });

  it('objet interactif, groupe déjà adjacent : aucune marche (fouille sur place)', () => {
    const prop: SceneEntity = { id: 'coffre', kind: 'prop', pos: { x: 5, y: 5 }, interact: { flow: emptyFlow } };
    expect(exploreMoveDest(sceneWith([prop]), { x: 5, y: 6 }, { x: 5, y: 5 })).toBeNull();
  });

  it('PNJ à dialogue (case marchable) : on s’arrête à une case adjacente, pas sur le PNJ', () => {
    const npc: SceneEntity = { id: 'garde', kind: 'personnage', pos: { x: 5, y: 5 }, dialogueId: 'd1' };
    const sc = sceneWith([npc]);
    expect(isWalkable(sc, 5, 5)).toBe(true); // un personnage ne bloque pas sa case…
    const dest = exploreMoveDest(sc, { x: 1, y: 1 }, { x: 5, y: 5 });
    expect(dest).not.toEqual({ x: 5, y: 5 }); // …mais on ne marche pas dessus (cohérent avec le clic)
    expect(cheb(dest!, { x: 5, y: 5 })).toBe(1);
  });

  it('figurant (sans dialogue) à distance : on s’approche d’une case adjacente', () => {
    const fig: SceneEntity = { id: 'badaud', kind: 'personnage', pos: { x: 5, y: 5 } };
    const dest = exploreMoveDest(sceneWith([fig]), { x: 1, y: 1 }, { x: 5, y: 5 });
    expect(cheb(dest!, { x: 5, y: 5 })).toBe(1);
  });

  it('figurant déjà adjacent : aucune marche', () => {
    const fig: SceneEntity = { id: 'badaud', kind: 'personnage', pos: { x: 5, y: 5 } };
    expect(exploreMoveDest(sceneWith([fig]), { x: 4, y: 5 }, { x: 5, y: 5 })).toBeNull();
  });

  it('case d’une couche haute (tablier z1) sans entité : renvoie la case telle quelle, avec son z', () => {
    // Plus d'escaliers : le franchissement vertical s'auto-dérive du relief le long du chemin
    // (`pathTo`/`moveAlong`). exploreMoveDest se contente de renvoyer la case cliquée (z compris).
    const sc = emptyScene(10, 10);
    sc.layers.push({ z: 1, tiles: new Array(100).fill('plancher'), height: new Array(100).fill(4) });
    expect(exploreMoveDest(sc, { x: 1, y: 1 }, { x: 3, y: 2, z: 1 })).toEqual({ x: 3, y: 2, z: 1 });
    expect(exploreMoveDest(sc, { x: 1, y: 1 }, { x: 5, y: 5 })).toEqual({ x: 5, y: 5 }); // sol : sans z
  });
});

describe('exploreStepDest — pas clavier, seuil d’alignement (#792 refuse le snap latéral/zigzag)', () => {
  // Mesuré empiriquement (losange iso par défaut, camRot=0) depuis le centre d'une scène plate ouverte :
  // le voisin IDÉAL de chaque cardinal (pas DIAGONAL de grille) colle à dot=1.0 ; le repêchage hors-axe
  // (pas SIMPLE-axe de grille) tombe soit à ~0.4472 (up/down — quasi perpendiculaire, ratio TW/TH 2:1),
  // soit à ~0.8944 (left/right — encore bien aligné). ALIGN_MIN=0.6 sépare exactement ces deux paliers.
  const IDEAL: Record<'up' | 'down' | 'left' | 'right', { x: number; y: number }> = {
    up: { x: 4, y: 4 },
    down: { x: 6, y: 6 },
    left: { x: 4, y: 6 },
    right: { x: 6, y: 4 },
  };
  const dims = { w: 10, h: 10 };
  const from = { x: 5, y: 5 };

  it('champ libre : chaque cardinal renvoie son voisin idéal (diagonal de grille, dot≈1.0)', () => {
    const sc = emptyScene(10, 10);
    for (const dir of ['up', 'down', 'left', 'right'] as const) {
      expect(exploreStepDest(sc, from, dir, dims)).toEqual(IDEAL[dir]);
    }
  });

  it('8-connectivité en champ libre préservée : les 4 voisins idéaux (un par cardinal) restent tous atteignables après le seuil', () => {
    const sc = emptyScene(10, 10);
    const reached = (['up', 'down', 'left', 'right'] as const).map((dir) => exploreStepDest(sc, from, dir, dims));
    expect(reached.every((d) => d !== null)).toBe(true);
    // 4 destinations distinctes (les 4 diagonales de grille autour du départ) — aucune collision.
    const keys = new Set(reached.map((d) => `${d!.x},${d!.y}`));
    expect(keys.size).toBe(4);
  });

  it('idéal bloqué (up), seuls des voisins hors-axe (~0.45, < ALIGN_MIN) ouverts → bloqué (null), pas de rabattement latéral', () => {
    const sc = emptyScene(10, 10);
    const idx = (x: number, y: number) => y * 10 + x;
    sc.layers[0].tiles[idx(4, 4)] = 'mur'; // voisin idéal de 'up' (dot=1.0) : mur
    // Les hors-axe (0,-1)=(5,4) et (-1,0)=(4,5) restent marchables (dot≈0.4472 < 0.6) — SANS le seuil,
    // l'ancien code s'y rabattait silencieusement (le zigzag #792). Avec le seuil : bloqué.
    expect(isWalkable(sc, 5, 4)).toBe(true);
    expect(isWalkable(sc, 4, 5)).toBe(true);
    expect(exploreStepDest(sc, from, 'up', dims)).toBeNull();
  });

  it('idéal bloqué (down), même garde symétrique', () => {
    const sc = emptyScene(10, 10);
    const idx = (x: number, y: number) => y * 10 + x;
    sc.layers[0].tiles[idx(6, 6)] = 'mur'; // voisin idéal de 'down'
    expect(exploreStepDest(sc, from, 'down', dims)).toBeNull();
  });

  it('idéal bloqué (left/right) : le voisin hors-axe reste bien ALIGNÉ (~0.89 ≥ ALIGN_MIN) et est accepté — pas un zigzag, un vrai second chemin', () => {
    const sc = emptyScene(10, 10);
    const idx = (x: number, y: number) => y * 10 + x;
    sc.layers[0].tiles[idx(4, 6)] = 'mur'; // voisin idéal de 'left' (4,6)
    const dest = exploreStepDest(sc, from, 'left', dims);
    expect(dest).not.toBeNull();
    expect(dest).not.toEqual({ x: 4, y: 6 });
  });
});

describe('spawnFacing — orientation d’entrée vers le CONTENU de la carte', () => {
  it('bord sud → N (le défaut S regarderait le vide hors-carte en POV)', () => {
    expect(spawnFacing({ x: 10, y: 19 }, { w: 21, h: 20 })).toBe('N');
  });

  it('quantification par secteurs de 45° (atan2), PAS par signe : bord sud légèrement décalé → toujours N', () => {
    // dx=+2, dy=−9.5 : ~12° du plein nord → N (par signe, ce serait NE dès 1 case d'écart).
    expect(spawnFacing({ x: 8, y: 19 }, { w: 21, h: 20 })).toBe('N');
  });

  it('bord nord → S, bord ouest → E, bord est → O', () => {
    expect(spawnFacing({ x: 10, y: 0 }, { w: 21, h: 20 })).toBe('S');
    expect(spawnFacing({ x: 0, y: 5 }, { w: 11, h: 11 })).toBe('E');
    expect(spawnFacing({ x: 10, y: 5 }, { w: 11, h: 11 })).toBe('O');
  });

  it('coins → diagonale vers le centre (NO→SE, SE→NO)', () => {
    expect(spawnFacing({ x: 0, y: 0 }, { w: 7, h: 7 })).toBe('SE');
    expect(spawnFacing({ x: 6, y: 6 }, { w: 7, h: 7 })).toBe('NO');
  });

  it("entrée déjà au centre → 'S' (aucune direction vers le contenu ne domine)", () => {
    expect(spawnFacing({ x: 3, y: 3 }, { w: 7, h: 7 })).toBe('S');
  });
});
