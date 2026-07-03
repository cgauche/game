/**
 * Brouillard de guerre — voile PAR CASE injecté DANS le flux trié par profondeur (≠ ancien overlay
 * unique « sandwich »). Chaque case NON visible porte son voile à SA profondeur (juste au-dessus de son
 * décor) : quasi-opaque sur l'INCONNU (rien ne transparaît, « même le décor »), semi-transparent sur
 * l'EXPLORÉ-hors-vue (décor mémorisé, grisé). Les cases EN VUE ne reçoivent aucun voile.
 *
 * POURQUOI par case et non un overlay unique : un overlay unique doit choisir « tout le caché SOUS le
 * visible » (split vis/!vis) — ce qui INVERSE la profondeur (un mur VISIBLE derrière se peignait par-
 * dessus une rampe CACHÉE devant). Un voile porté par chaque case, à sa vraie profondeur, respecte le
 * tri per-case : un décor caché DEVANT masque bien un décor visible DERRIÈRE, et vice-versa.
 *
 * Bords FRANCS (le flou de groupe de l'ancien overlay est incompatible avec l'entrelacement en
 * profondeur : il fusionnait tout le voile à un seul z). Screen-culling assuré par `CulledScene`
 * (`onScreen`) — le coût reste borné par la FENÊTRE, jamais par la scène.
 */
import React from 'react';
import { Dims, diamondPath, depth } from './iso';
import type { StageObj } from './stage/objs';

/** Voile mémorisé (exploré, hors-vue) : semi-transparent → décor grisé mais lisible. */
const REMEMBERED = { fill: '#06050d', op: 0.52 };
/** Voile inconnu (jamais vu) : quasi-opaque → rien ne transparaît. */
const UNKNOWN = { fill: '#04030a', op: 0.985 };
/** Décalage de couche du voile : AU-DESSUS du décor de sa propre case (mur +0.45, jeton +0.5). */
const VEIL_LAYER = 0.55;
const MARGIN = 5; // cases autour du cadre : couvre le pan sous-tuile

export interface FogParams {
  w: number;
  h: number;
  visible: Set<string>;
  explored: Set<string>;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  /** Étage de SOL effectif sous (x,y) à l'étage actif (retombe sur le sol du dessous à un trou `vide`). */
  floorZAt: (x: number, y: number) => number;
}

/** StageObj de voile pour chaque case cachée du cadre (+ marge). À fusionner par profondeur dans le
 *  flux de scène (`mergeByDepth`) puis rendu par `CulledScene` avec le reste. */
export function fogVeilObjs(fog: FogParams, dims: Dims): StageObj[] {
  const { w, h, visible, explored, bounds, floorZAt } = fog;
  const x0 = Math.max(0, bounds.minX - MARGIN), x1 = Math.min(w - 1, bounds.maxX + MARGIN);
  const y0 = Math.max(0, bounds.minY - MARGIN), y1 = Math.min(h - 1, bounds.maxY + MARGIN);
  const objs: StageObj[] = [];
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const z = floorZAt(x, y);
      const k = `${x},${y},${z}`;
      if (visible.has(k)) continue; // en vue → pas de voile
      const v = explored.has(k) ? REMEMBERED : UNKNOWN;
      objs.push({
        d: depth(x, y, dims, z) + VEIL_LAYER,
        x, y, z, vis: false,
        el: <path key={`fog:${k}`} d={diamondPath(x, y, dims)} fill={v.fill} opacity={v.op} pointerEvents="none" />,
      });
    }
  return objs;
}
