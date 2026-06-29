/**
 * Curseur de combat unifié (clavier + manette) — logique PURE (lit l'état, ne mute rien). Le store
 * (`combatSlice`) porte l'état `combatCursor` et appelle ces fonctions ; clavier ET manette alimentent
 * le MÊME curseur, qui pilote le réticule existant (`hoverTargeting`/`movePreviewAt`) et commet via les
 * actions existantes `battleClickEntity`/`battleClickTile`. Zéro chemin parallèle.
 */
import type { Pt } from './path';
import type { Get } from './flowTypes';
import { tileCenter, type Dims } from '../gameIso/iso';
import { footprintN, occupiesTile } from './footprint';
import { combatantClickActs } from './combatOrParty';
import { isOutOfAction } from '../engine/conditions';

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
 * Voisin de grille (8-connexe) dont le CENTRE projeté à l'écran colle le mieux à la direction poussée
 * (« le curseur suit les yeux ») : on projette chaque voisin via `tileCenter` et on prend le produit
 * scalaire maximal avec le vecteur écran. En iso une « droite » est donc un pas DIAGONAL de grille, en
 * vue du dessus un pas cardinal — la projection arbitre, rien n'est codé en dur (rotation comprise).
 * Curseur null = 1er appui : le curseur APPARAÎT sur le combattant actif (sans pas). PUR.
 */
export function nextCursorTile(cur: CombatCursor | null, dir: ScreenDir, dims: Dims, activePos: Pt): Pt {
  const start = cur?.tile ?? activePos;
  const z = start.z ?? 0;
  if (!cur) return mk(start.x, start.y, z); // le curseur se pose sur l'actif au 1er appui
  const [vx, vy] = DIR_VEC[dir];
  const o = tileCenter(start.x, start.y, dims, z);
  let best: Pt | null = null;
  let bestDot = 0; // strictement positif requis → sinon on reste sur place (bord/coin)
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = start.x + dx;
      const ny = start.y + dy;
      if (nx < 0 || nx >= dims.w || ny < 0 || ny >= dims.h) continue;
      const c = tileCenter(nx, ny, dims, z);
      const sx = c.cx - o.cx;
      const sy = c.cy - o.cy;
      const mag = Math.hypot(sx, sy) || 1;
      const dot = (sx / mag) * vx + (sy / mag) * vy;
      if (dot > bestDot) {
        bestDot = dot;
        best = mk(nx, ny, z);
      }
    }
  return best ?? mk(start.x, start.y, z);
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
  const occ = b.combatants.find((c) => c.pos && occupiesTile(c.pos, footprintN(c), x, y) && !isOutOfAction(c));
  if (occ && combatantClickActs(get, occ)) return { kind: 'entity', id: occ.id };
  if (occ) return get().inspectEnabled ? { kind: 'inspect', id: occ.id } : null;
  return { kind: 'tile', pt: { x, y } };
}
