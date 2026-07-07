/**
 * Curseur de combat unifié (clavier + manette) — logique PURE (lit l'état, ne mute rien). Le store
 * (`combatSlice`) porte l'état `combatCursor` et appelle ces fonctions ; clavier ET manette alimentent
 * le MÊME curseur, qui pilote le réticule existant (`hoverTargeting`/`movePreviewAt`) et commet via les
 * actions existantes `battleClickEntity`/`battleClickTile`. Zéro chemin parallèle.
 */
import type { Pt } from './path';
import type { Get } from './flowTypes';
import { tileCenter, type Dims } from '../geometry/iso';
import { heightAt, isWalkable, tileAt, type Scene } from './scene';
import { metricToLift } from './relief';
import { combatantAtTile } from './combatGeometry';
import { combatantClickActs } from './combatOrParty';

export interface CombatCursor {
  tile: Pt;
  /** Cible aimantée (Tab / gâchettes) — sert au rendu fiable du réticule, pas au commit (qui dérive de la case). */
  snappedId?: string;
}

export type ScreenDir = 'up' | 'down' | 'left' | 'right';

export type CursorIntent =
  | { kind: 'entity'; id: string }
  | { kind: 'tile'; pt: Pt }
  | { kind: 'inspect'; id: string };

/** Construit une case en omettant `z` quand il vaut 0 (byte-identique à `{x,y}`, comme `path.ts`). */
const mk = (x: number, y: number, z = 0): Pt => (z ? { x, y, z } : { x, y });

/** Vecteur ÉCRAN (y vers le bas) de la direction poussée. */
const DIR_VEC: Record<ScreenDir, [number, number]> = {
  right: [1, 0],
  left: [-1, 0],
  up: [0, -1],
  down: [0, 1],
};

/**
 * Alignement ÉCRAN du pas `from`→`to` avec la direction poussée : produit scalaire NORMALISÉ du vecteur
 * écran (origine→candidat, via `tileCenter`) avec le vecteur écran de `dir`. C'est la projection « le
 * curseur suit les yeux », SOURCE UNIQUE partagée par `nextCursorTile` (curseur de combat) ET
 * `exploreStepDest` (pas clavier d'exploration) — rien n'est codé en dur (rotation/vue comprises).
 * Le LIFT vertical d'une case est sa HAUTEUR MÉTRIQUE rendue (`metricToLift(heightAt)`), PAS l'index de
 * couche `z` : une case d'une couche haute mais de même hauteur réelle (tablier rejoint par une rampe)
 * se projette au MÊME écran que sa voisine — sinon le candidat cross-couche serait scoré à une hauteur
 * fantôme et perdrait l'alignement (le pas clavier ne montait alors pas sur le chemin de ronde).
 * >0 ⇒ `to` part bien dans le sens poussé à l'écran. PUR.
 */
export function screenStepDot(scene: Scene, from: Pt, to: Pt, dir: ScreenDir, dims: Dims): number {
  const liftOf = (p: Pt) => metricToLift(heightAt(scene, p.x, p.y, p.z ?? 0));
  const o = tileCenter(from.x, from.y, dims, liftOf(from));
  const c = tileCenter(to.x, to.y, dims, liftOf(to));
  const sx = c.cx - o.cx;
  const sy = c.cy - o.cy;
  const mag = Math.hypot(sx, sy) || 1;
  const [vx, vy] = DIR_VEC[dir];
  return (sx / mag) * vx + (sy / mag) * vy;
}

/**
 * Couche RÉSOLUE de la case (x,y) : la plus HAUTE couche y portant une SURFACE RÉELLE, SANS borne d'étage
 * `≤ activeZ` — SOURCE UNIQUE partagée par le curseur de combat (clavier/manette, `nextCursorTile`) ET le
 * picking SOURIS (`IsoStage.tsx::tileFromEvent`) : les deux doivent pouvoir VISER le chemin de ronde z1
 * depuis la cour z0 (là où se tiennent défenseurs et pièces). On prend d'abord la couche MARCHABLE la plus
 * haute (chemin de ronde > sol), sinon la couche RÉELLE la plus haute (terrain ≠ 'vide' : eau/mur visables) ;
 * à défaut, la base z0. Mono-couche ⇒ toujours z0 (byte-identique au sol plat). PUR.
 */
export function resolveCursorZ(scene: Scene, x: number, y: number): number {
  const zsDesc = scene.layers.map((l) => l.z).sort((a, b) => b - a);
  for (const z of zsDesc) if (isWalkable(scene, x, y, z)) return z; // surface marchable réelle
  for (const z of zsDesc) { const t = tileAt(scene, x, y, z); if (t && t !== 'vide') return z; } // case réelle non marchable
  return 0;
}

/**
 * Voisin de grille (8-connexe) dont le CENTRE projeté à l'écran colle le mieux à la direction poussée
 * (« le curseur suit les yeux ») : chaque voisin (x,y) est résolu à SA couche (`resolveCursorZ` — chemin
 * de ronde z1 / sol z0, comme le picking souris), projeté via `screenStepDot` (au LIFT métrique de cette
 * couche), et on prend le produit scalaire maximal. CROSS-COUCHE : survoler le dessus du rempart donne
 * z1 (le réticule monte sur le chemin de ronde, là où le BFS grimpe la rampe). En iso une « droite » est
 * un pas DIAGONAL de grille, en vue du dessus un pas cardinal — la projection arbitre, rien n'est codé en
 * dur (rotation comprise). Curseur null = 1er appui : le curseur APPARAÎT sur le combattant actif. PUR.
 */
export function nextCursorTile(scene: Scene, cur: CombatCursor | null, dir: ScreenDir, dims: Dims, activePos: Pt): Pt {
  const start = cur?.tile ?? activePos;
  if (!cur) return mk(start.x, start.y, start.z ?? 0); // le curseur se pose sur l'actif au 1er appui
  let best: Pt | null = null;
  let bestDot = 0; // strictement positif requis → sinon on reste sur place (bord/coin)
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = start.x + dx;
      const ny = start.y + dy;
      if (nx < 0 || nx >= dims.w || ny < 0 || ny >= dims.h) continue;
      const cand = mk(nx, ny, resolveCursorZ(scene, nx, ny)); // couche résolue (z1 chemin de ronde / z0 sol)
      const dot = screenStepDot(scene, start, cand, dir, dims);
      if (dot > bestDot) {
        bestDot = dot;
        best = cand;
      }
    }
  return best ?? mk(start.x, start.y, start.z ?? 0);
}

/**
 * Décision de commit du curseur — RÉPLIQUE EXACTE de la branche `battle` de `performClick` (IsoStage) :
 * occupant d'une tuile de l'empreinte, `combatantClickActs` (mode courant) → attaque/cible, sinon allié/soi
 * → inspection (uniquement si activée, jamais de clic-case), case libre → déplacement. PUR (lit `get`).
 */
export function cursorCommitIntent(get: Get, cur: CombatCursor): CursorIntent | null {
  const b = get().battle;
  if (!b || b.over) return null;
  const { x, y } = cur.tile;
  const z = cur.tile.z ?? 0;
  const occ = combatantAtTile(b.combatants, x, y, z);
  if (occ && combatantClickActs(get, occ)) return { kind: 'entity', id: occ.id };
  if (occ) return get().inspectEnabled ? { kind: 'inspect', id: occ.id } : null;
  return { kind: 'tile', pt: mk(x, y, z) };
}
