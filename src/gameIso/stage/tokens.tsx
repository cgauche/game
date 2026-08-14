/**
 * Couche DÉCOR (props) en SVG : transforme les éléments de `builders/props` (identité + position
 * LOGIQUE + décisions de scène) en corps React (`BodyToken`).
 *
 * Ce qui reste ici sert l'APERÇU WYSIWYG de l'éditeur (`ui/editor/EditorCanvas`) : l'écran de jeu ne
 * peint plus aucun corps en SVG depuis la mort de la voie affine (#1176 P3-4, commit C5a) — jetons de
 * combat, figurants, jeton de groupe, halos et marques dynamiques y sont posés par le monde volumique
 * (`backends/webgl/*`), à partir des MÊMES dérivations pures (`builders/dynamicMarks`,
 * `builders/interactHalos`, `builders/tokenChrome`), qui n'ont, elles, jamais été affines.
 */
import { Dims } from '../../geometry/iso';
import { metricToLift } from '../../state/relief';
import { BodyToken } from '../BodyToken';
import { propSprite } from '../sprites';
import { propDepth } from '../backends/affineProps';
import type { PropEl } from '../builders/types';
import type { StageObj } from './objs';

/** Position VISUELLE d'un token pendant la marche (interpolée par-frame, cf. IsoStage.walkPosOf). */
export type WalkPos = (id: string, x: number, y: number, z?: number) => { x: number; y: number; walking: boolean; sortPt: { x: number; y: number } };

export interface TokenCtx {
  dims: Dims;
  view: 'iso' | 'top';
  liftAt: (x: number, y: number, z?: number) => number;
}

// token() : adaptateur mince vers la coquille partagée BodyToken (positionnement unique) — corps SVG
// string (props/décor).
function token(ctx: TokenCtx, id: string, x: number, y: number, inner: string, scale: number, fx?: string, z = 0) {
  return (
    <BodyToken key={id} x={x} y={y} z={ctx.liftAt(x, y, z)} dims={ctx.dims} scale={scale} fx={fx}>
      <g dangerouslySetInnerHTML={{ __html: inner }} />
    </BodyToken>
  );
}

/** Décors (props : épave, cadavres, sang… ET overlays de terrain bois→arbre) — STATIQUES, via le MÊME
 *  billboard. L'anim d'ambiance CSS (fx) passe par le calque fx. Empreinte multi-cases (tente 2×2,
 *  tribune 3×1…) : token centré sur le bloc, agrandi au côté MAX (`foot.scale` — l'échelle « largeur
 *  projetée » l'écrasait en 1×1 quand l'empreinte pointait vers la profondeur), profondeur au coin le
 *  plus PROCHE (comme les bâtiments). `vis` : en vue → au-dessus du voile ; mémorisé → sous. Un overlay
 *  de terrain n'a pas d'`entId` → clé = son identité monde `el.key`. */
export function propLayerObjs(propEls: PropEl[], ctx: TokenCtx): StageObj[] {
  const out: StageObj[] = [];
  for (const el of propEls) {
    const px = el.cell.x + el.foot.offX, py = el.cell.y + el.foot.offY;
    // Un ornement (clocheton/cheminée/enseigne) porte un lift MÉTRIQUE additionnel (posé sur le toit / en
    // haut du mur) : on l'ajoute au lift de surface de la case — le token le place en hauteur (POV : footAnchor).
    const lctx = el.liftM ? { ...ctx, liftAt: (x: number, y: number, z = 0) => ctx.liftAt(x, y, z) + metricToLift(el.liftM!) } : ctx;
    out.push({
      d: propDepth(el, ctx.dims),
      x: el.cell.x,
      y: el.cell.y,
      z: el.cell.z,
      kind: 'prop',
      vis: el.states.visible,
      el: token(lctx, el.entId ? `e-${el.entId}` : el.key, px, py, propSprite(el.ref, el.facing, ctx.dims.rot ?? 0), 0.55 * el.foot.scale, el.fx, el.cell.z),
    });
  }
  return out;
}
