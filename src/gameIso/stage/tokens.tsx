/**
 * Couche TOKENS du stage iso : transforme les éléments des builders (`builders/props`, `builders/tokens`
 * — identité + position LOGIQUE + décisions de scène) en corps React (pickBackend → BodyToken). Les
 * tokens RESTENT des éléments React individuels (picking `data-cid` + `elementFromPoint`, jamais fusionnés
 * en innerHTML). Les couches STATIQUES (props, figurants) sont memoïsées par IsoStage (réfs stables →
 * React saute les sous-arbres pendant la marche) ; les combattants (position INTERPOLÉE par-frame) et
 * les affordances (halos, dépendants du survol/flags) se recalculent à la frame.
 */
import type { ReactNode } from 'react';
import { Scene } from '../../state/scene';
import { Combatant } from '../../engine/types';
import { isOutOfAction } from '../../engine/conditions';
import type { BattleState } from '../../state/store';
import { CELL, Dims, tileCenter, depth, diamondPath } from '../iso';
import { BodyToken } from '../BodyToken';
import { MountedToken } from '../MountedToken';
import { pickBackend } from '../pickBackend';
import { entitySprite, propSprite, pnjSprite } from '../sprites';
import { propDepth } from '../backends/affineProps';
import { sizeTokenScale, footprintTokenScale } from '../sizeScale';
import { sizeFootprint, footprintN, footprintTiles } from '../../state/footprint';
import { entitySize } from '../../state/spawn';
import { HERO_RING, ENEMY_RING, veilTint, teamShape, relationColor } from '../teamColors';
import { summarizeEffects, combatantFlags } from '../effectIcons';
import { mountOf } from '../../state/mount';
import type { Pt } from '../../state/path';
import type { PropEl, TokenEl } from '../builders/types';
import type { StageObj } from './objs';

/** Position VISUELLE d'un token pendant la marche (interpolée par-frame, cf. IsoStage.walkPosOf). */
export type WalkPos = (id: string, x: number, y: number, z?: number) => { x: number; y: number; walking: boolean; sortPt: { x: number; y: number } };

/** Vue du dessus : rayon du disque-portrait — empreinte × ½ case. */
export const discR = (n: number) => (n * CELL) / 2 * 0.85;

export interface TokenCtx {
  dims: Dims;
  view: 'iso' | 'top';
  liftAt: (x: number, y: number, z?: number) => number;
}

// token()/tokenNode() : adaptateurs minces vers la coquille partagée BodyToken (positionnement
// unique). token() = corps SVG string ; tokenNode() = enfant React (rig) dont la mort est déjà
// bakée (CORPSE_POSE / pose effondrée) → pas de bascule externe (bakedDeath).
function token(ctx: TokenCtx, id: string, x: number, y: number, inner: string, scale: number, ringColor?: string, dim?: boolean, fx?: string, walking?: boolean, bakedDeath?: boolean, z = 0) {
  return (
    <BodyToken key={id} x={x} y={y} z={ctx.liftAt(x, y, z)} dims={ctx.dims} scale={scale} ring={ringColor} dim={dim} walking={walking} fx={fx} bakedDeath={bakedDeath}>
      <g dangerouslySetInnerHTML={{ __html: inner }} />
    </BodyToken>
  );
}

type TokenExtras = { hp?: { current: number; max: number }; icons?: import('../../ui/icons').IconId[]; iconsMore?: number; veil?: string; active?: boolean; ringDash?: string; flat?: boolean; portraitBox?: string; discR?: number; ghost?: boolean; cid?: string; highlight?: string };
function tokenNode(ctx: TokenCtx, id: string, x: number, y: number, child: ReactNode, scale: number, ringColor?: string, dim?: boolean, walking?: boolean, extras?: TokenExtras, z = 0) {
  return (
    <BodyToken key={id} x={x} y={y} z={ctx.liftAt(x, y, z)} dims={ctx.dims} scale={scale} ring={ringColor} ringDash={extras?.ringDash} dim={dim} ghost={extras?.ghost} walking={walking} bakedDeath
      hp={extras?.hp} icons={extras?.icons} iconsMore={extras?.iconsMore} veil={extras?.veil} active={extras?.active}
      flat={extras?.flat} portraitBox={extras?.portraitBox} discR={extras?.discR} cid={extras?.cid} highlight={extras?.highlight}>
      {child}
    </BodyToken>
  );
}

/** Décors (props : épave, cadavres, sang… ET overlays de terrain bois→arbre) — STATIQUES, rendus dans LES
 *  DEUX modes (restent visibles pendant le combat) via le MÊME billboard. L'anim d'ambiance CSS (fx) passe
 *  par le calque fx. Empreinte multi-cases (tente 2×2, tribune 3×1…) : token centré sur le bloc, agrandi
 *  au côté MAX (`foot.scale` — l'échelle « largeur projetée » l'écrasait en 1×1 quand l'empreinte pointait
 *  vers la profondeur), profondeur au coin le plus PROCHE (comme les bâtiments). `vis` : en vue → au-dessus
 *  du voile ; mémorisé → sous. Un overlay de terrain n'a pas d'`entId` → clé = son identité monde `el.key`. */
export function propLayerObjs(propEls: PropEl[], ctx: TokenCtx): StageObj[] {
  const out: StageObj[] = [];
  for (const el of propEls) {
    const px = el.cell.x + el.foot.offX, py = el.cell.y + el.foot.offY;
    out.push({
      d: propDepth(el, ctx.dims),
      z: el.cell.z,
      vis: el.states.visible,
      el: token(ctx, el.entId ? `e-${el.entId}` : el.key, px, py, propSprite(el.ref, el.facing, ctx.dims.rot ?? 0), 0.55 * el.foot.scale, undefined, false, el.fx, false, false, el.cell.z),
    });
  }
  return out;
}

/** Affordance « fouille » d'un prop interactif (masquée dès l'objet épuisé, flag `__fouille_<id>`) :
 *  halo pulsé + onde « sonar » au sol, et étincelle dorée flottant AU-DESSUS du décor — l'objet
 *  cliquable se repère de loin, sans texte (cf. anim.css). DYNAMIQUE (survol/flags). */
export function interactHaloObjs(propEls: PropEl[], ctx: TokenCtx, flags: Record<string, boolean | undefined>, hover: Pt | null, exploring: boolean): StageObj[] {
  const out: StageObj[] = [];
  for (const el of propEls) {
    if (el.source !== 'entity' || !el.interact || flags[`__fouille_${el.entId}`]) continue;
    const ez = el.cell.z;
    const px = el.cell.x + el.foot.offX, py = el.cell.y + el.foot.offY;
    const pd = propDepth(el, ctx.dims);
    const c = tileCenter(px, py, ctx.dims, ctx.liftAt(px, py, ez));
    // SURVOL direct du décor (hors combat) : la tuile sous le curseur == la tuile du prop → halo renforcé.
    const haloHovered = exploring && !!hover && hover.x === el.cell.x && hover.y === el.cell.y && (hover.z ?? 0) === ez;
    out.push({
      d: pd - 0.02, // juste sous le sprite
      z: ez,
      vis: el.states.visible,
      el: (
        <g key={`halo-${el.entId}`} pointerEvents="none">
          <g className={haloHovered ? 'interact-halo hovered' : 'interact-halo'}>
            <ellipse cx={c.cx} cy={c.cy + 4} rx={17 * el.foot.scale} ry={8.5 * el.foot.scale} fill="var(--combat-halo)" opacity={0.26} />
            <ellipse cx={c.cx} cy={c.cy + 4} rx={17 * el.foot.scale} ry={8.5 * el.foot.scale} fill="none" stroke="var(--combat-gold)" strokeWidth={2} opacity={0.9} />
          </g>
          <ellipse className="halo-ping" cx={c.cx} cy={c.cy + 4} rx={17 * el.foot.scale} ry={8.5 * el.foot.scale} fill="none" stroke="var(--combat-gold)" strokeWidth={1.6} />
        </g>
      ),
    });
    out.push({
      d: pd + 0.02, // au-dessus du sprite : l'étincelle « il y a quelque chose ici »
      z: ez,
      vis: el.states.visible,
      el: (
        <g key={`spark-${el.entId}`} className="halo-spark" pointerEvents="none" transform={`translate(${c.cx + 9 * el.foot.scale}, ${c.cy - 26 * el.foot.scale})`}>
          <path d="M0,-6 L1.7,-1.7 L6,0 L1.7,1.7 L0,6 L-1.7,1.7 L-6,0 L-1.7,-1.7 Z" fill="var(--combat-gold)" stroke="var(--combat-gold-dk)" strokeWidth={0.7} />
        </g>
      ),
    });
  }
  return out;
}

/** FIGURANTS (PNJ/créatures d'ambiance) — STATIQUES : ils ne bougent pas pendant que le groupe marche.
 *  Memoïsés par IsoStage : réfs d'éléments stables → React saute ces sous-arbres ; chaque créature
 *  continue de s'auto-animer via SON rAF (usePlanAnim/useRigClip), indépendamment du re-rendu du stage.
 *  En combat : estompés + non interactifs (wrap), plus de spectateurs qui « dépop » à l'Initiative. */
export function figurantLayerObjs(tokenEls: TokenEl[], ctx: TokenCtx): StageObj[] {
  const isTop = ctx.view === 'top';
  const discRfn = (sz: Combatant['size']) => (sizeFootprint(sz) * CELL) / 2 * 0.85;
  const wrap = (key: string, el: JSX.Element, inBattle: boolean) =>
    inBattle ? (
      <g key={`fig-${key}`} opacity={0.7} pointerEvents="none">
        {el}
      </g>
    ) : (
      el
    );
  const out: StageObj[] = [];
  for (const tk of tokenEls) {
    if (tk.subject.kind !== 'figurant') continue;
    const { ent, enrolled, inBattle } = tk.subject;
    const ez = tk.cell.z;
    const r = pickBackend({ kind: 'sceneEntity', ent, enrolled }, ctx.view);
    if (r.backend === 'sprite') {
      out.push({
        d: depth(ent.pos.x, ent.pos.y, ctx.dims, ez),
        z: ez,
        vis: true,
        el: wrap(
          r.id,
          <BodyToken key={r.id} x={ent.pos.x} y={ent.pos.y} z={ctx.liftAt(ent.pos.x, ent.pos.y, ez)} dims={ctx.dims} scale={0.55} fx={ent.anim}>
            <g dangerouslySetInnerHTML={{ __html: entitySprite(ent, ctx.dims.rot) }} />
          </BodyToken>,
          inBattle,
        ),
      });
    } else {
      const base = r.backend === 'rig' ? 0.58 : 0.55;
      const dBoost = r.backend === 'rig' ? 0.1 : 0;
      const off = (sizeFootprint(entitySize(ent)) - 1) / 2;
      const ex = ent.pos.x + off, ey = ent.pos.y + off;
      out.push({
        d: depth(ex, ey, ctx.dims, ez) + dBoost,
        z: ez,
        vis: true,
        el: wrap(
          r.id,
          <BodyToken key={r.id} x={ex} y={ey} z={ctx.liftAt(ent.pos.x, ent.pos.y, ez)} dims={ctx.dims} scale={base * r.speciesScale * sizeTokenScale(entitySize(ent))} bakedDeath flat={isTop} portraitBox={r.portraitBox} discR={discRfn(entitySize(ent))}>
            {r.body}
          </BodyToken>,
          inBattle,
        ),
      });
    }
  }
  return out;
}

/** Contexte PAR-FRAME des tokens de combat (position interpolée, focus, visée). */
export interface CombatTokenCtx extends TokenCtx {
  walkPosOf: WalkPos;
  ghostIds: ReadonlySet<string>;
  hoveredId: string | null;
  activeId: string | null;
}

/** COMBATTANTS (branche combat) — DYNAMIQUES : le token GLISSE le long du chemin (walkPosOf), le tri
 *  reste constant sur le pas (sortPt). Backend choisi par le classifieur unique (rig humanoïde / plan
 *  non-bipède) ; empreinte multi-cases (LDB 15 l.55) : token CENTRÉ sur le bloc N×N. Un navire remplit
 *  ses cases SANS être une créature (`footprintTokenScale`). Les jetons de SURPLOMB (muraille vue d'en
 *  bas) sont nets, triés z-correctement (depth + lift) — cf. builder. */
export function combatantObjs(tokenEls: TokenEl[], ctx: CombatTokenCtx): StageObj[] {
  const top = ctx.view === 'top';
  const out: StageObj[] = [];
  for (const tk of tokenEls) {
    if (tk.subject.kind === 'combatant') {
      const { c, heroIndex } = tk.subject;
      const cz = tk.cell.z;
      const isHero = c.kind === 'hero';
      const ring = isHero ? HERO_RING[(heroIndex ?? 0) % HERO_RING.length] : ENEMY_RING;
      const wp = ctx.walkPosOf(c.id, c.pos!.x, c.pos!.y);
      const r = pickBackend({ kind: 'combatant', combatant: c }, ctx.view);
      const fp = footprintN(c);
      const off = (fp - 1) / 2; // ancre (coin NO) → centre du bloc
      const cx = wp.x + off, cy = wp.y + off;
      const fxSum = summarizeEffects(c.conditions, c.activeEffects, 3, combatantFlags(c));
      const el = tokenNode(ctx, r.id, cx, cy, r.body, 0.62 * r.speciesScale * (c.footprint ? footprintTokenScale(c.footprint) : sizeTokenScale(c.size)), ring, isOutOfAction(c), wp.walking, {
        hp: c.inert ? undefined : c.wounds, // engin INERTE (immune) = pas de jauge de PV (un objet n'a pas de santé)
        icons: fxSum.visible.map((v) => v.icon),
        iconsMore: fxSum.moreCount,
        veil: veilTint(isHero),
        active: c.id === ctx.activeId,
        ringDash: teamShape(isHero), // R9 : ennemi = anneau pointillé (indice d'équipe non-coloré)
        flat: top,
        portraitBox: r.portraitBox,
        discR: discR(fp),
        ghost: ctx.ghostIds.has(c.id), // hors-LdV du tireur actif → fantomatique
        cid: c.id, // ciblage DOM (recettes Playwright : survol/clic par data-cid)
        highlight: c.id === ctx.hoveredId ? relationColor(c.kind) : undefined, // FOCUS (survol token/frise) → halo couleur de relation
      }, cz);
      out.push({ d: depth(wp.sortPt.x + off, wp.sortPt.y + off, ctx.dims, cz) + 0.5, z: cz, vis: true, el }); // en vue → au-dessus du voile ; tri constant sur le pas (sortPt)
    } else if (tk.subject.kind === 'mounted') {
      // Combat monté (LDB 14) : le couple CAVALIER+MONTURE est UN corps composite (MountedToken) trié au
      // niveau de l'os → vraie profondeur. Un seul BodyToken à la tuile/échelle de la monture.
      const { mount, rider } = tk.subject;
      const off = (footprintN(mount) - 1) / 2;
      const mz = tk.cell.z;
      const wp = ctx.walkPosOf(mount.id, mount.pos!.x, mount.pos!.y, mz); // suit l'animation de marche de la monture
      const cx = wp.x + off, cy = wp.y + off;
      const mountScale = 0.62 * pickBackend({ kind: 'combatant', combatant: mount }).speciesScale * sizeTokenScale(mount.size);
      const el = tokenNode(ctx, `${mount.id}-mtd`, cx, cy, <MountedToken mount={mount} rider={rider} />, mountScale, undefined, isOutOfAction(mount), wp.walking);
      out.push({ d: depth(wp.sortPt.x + off, wp.sortPt.y + off, ctx.dims, mz) + 0.5, z: mz, vis: true, el });
    }
  }
  return out;
}

/** Token du GROUPE (exploration) : le leader VISIBLE glisse le long du chemin (ANIM_MOVE). */
export function partyLeaderObj(ctx: TokenCtx, partyPos: Pt, partyLeader: Combatant | undefined, walkPosOf: WalkPos): StageObj {
  const wp = partyLeader ? walkPosOf(partyLeader.id, partyPos.x, partyPos.y, partyPos.z ?? 0) : { x: partyPos.x, y: partyPos.y, walking: false, sortPt: { x: partyPos.x, y: partyPos.y } };
  const pZ = partyPos.z ?? 0; // le groupe se rend à son étage (loge) — token soulevé + trié au bon niveau
  const r = pickBackend({ kind: 'partyLeader', leader: partyLeader }, ctx.view);
  const el =
    r.backend === 'sprite'
      ? token(ctx, r.id, partyPos.x, partyPos.y, pnjSprite(), 0.6, HERO_RING[0], false, undefined, false, false, pZ)
      : tokenNode(ctx, r.id, wp.x, wp.y, r.body, 0.6, HERO_RING[0], false, wp.walking, { flat: ctx.view === 'top', portraitBox: r.portraitBox, discR: discR(1) }, pZ);
  return { d: depth(wp.sortPt.x, wp.sortPt.y, ctx.dims, pZ) + 0.5, z: pZ, vis: true, el }; // le groupe est toujours en vue → au-dessus du voile
}

/** Halo de SURVOL d'un PNJ interlocuteur (dialogue/marchand) : PAS de halo permanent (ils ne
 *  « réclament » pas comme une fouille) — révélé au survol seul, cohérent avec le curseur main.
 *  1 seule tuile à la fois, peu coûteux (hors du memo figurants, qui ignore `hover`). */
export function npcHoverHaloObjs(scene: Scene, hover: Pt | null, ctx: TokenCtx): StageObj[] {
  if (!hover) return [];
  const out: StageObj[] = [];
  for (const ent of scene.entities) {
    if (ent.kind === 'prop' || ent.interact) continue; // fouille = halo permanent (interactHaloObjs)
    if (!ent.dialogueId && !ent.merchant) continue;
    if (ent.pos.x !== hover.x || ent.pos.y !== hover.y || (ent.z ?? 0) !== (hover.z ?? 0)) continue;
    const cc = tileCenter(ent.pos.x, ent.pos.y, ctx.dims, ctx.liftAt(ent.pos.x, ent.pos.y, ent.z ?? 0));
    out.push({
      d: depth(ent.pos.x, ent.pos.y, ctx.dims, ent.z ?? 0) + 0.55,
      z: ent.z ?? 0,
      vis: true, // survol d'un PNJ interlocuteur (en vue) → halo au-dessus du voile
      el: (
        <g key={`npc-halo-${ent.id}`} className="interact-halo hovered" pointerEvents="none">
          <ellipse cx={cc.cx} cy={cc.cy + 4} rx={15} ry={7.5} fill="var(--combat-halo)" opacity={0.2} />
          <ellipse cx={cc.cx} cy={cc.cy + 4} rx={15} ry={7.5} fill="none" stroke="var(--combat-gold)" strokeWidth={1.8} opacity={0.85} />
        </g>
      ),
    });
  }
  return out;
}

/** Tether d'ENGAGEMENT (R7) + halo de l'ACTIF + repère du groupe : éléments DYNAMIQUES qui SUIVENT le
 *  token qui glisse — recalculés à la frame (peu coûteux), hors du builder. */
export function dynamicHighlightObjs(
  ctx: TokenCtx,
  battle: BattleState | null,
  mode: string,
  dialogue: unknown,
  partyPos: Pt,
  walkPosOf: WalkPos,
): StageObj[] {
  const { dims, liftAt } = ctx;
  const out: StageObj[] = [];
  if (mode === 'battle' && battle) {
    // État ENGAGÉ (R7) : tether de mêlée entre paires Engagées (zone de contrôle). Dédupliqué (id < otherId).
    for (const c of battle.combatants) {
      if (!c.pos || isOutOfAction(c)) continue;
      for (const oid of c.engagedWith ?? []) {
        if (c.id >= oid) continue; // une seule ligne par paire
        const o = battle.combatants.find((x) => x.id === oid);
        if (!o?.pos || isOutOfAction(o)) continue;
        const za = c.pos.z ?? 0, zb = o.pos.z ?? 0; // chaque extrémité posée à l'étage de SON combattant
        const pa = walkPosOf(c.id, c.pos.x, c.pos.y);
        const pb = walkPosOf(o.id, o.pos.x, o.pos.y);
        const ca = tileCenter(pa.x, pa.y, dims, za ? liftAt(pa.x, pa.y, za) : 0);
        const cb = tileCenter(pb.x, pb.y, dims, zb ? liftAt(pb.x, pb.y, zb) : 0);
        // tether posé à la profondeur de l'extrémité la plus PROCHE caméra (+0.25 ⇒ sous les jetons)
        out.push({ d: Math.max(depth(pa.x, pa.y, dims, za), depth(pb.x, pb.y, dims, zb)) + 0.25, el: <line key={`eng-${c.id}-${oid}`} x1={ca.cx} y1={ca.cy} x2={cb.cx} y2={cb.cy} stroke="var(--iso-engage)" strokeWidth={2} strokeDasharray="4 3" opacity={0.6} pointerEvents="none" /> });
      }
    }
    const activeC = battle.combatants.find((c) => c.id === battle.order[battle.turn]);
    if (activeC?.pos) {
      const haloUnit = mountOf(battle, activeC) ?? activeC; // cavalier → halo sur l'empreinte de la MONTURE (2×2)
      const hz = (haloUnit.pos as { z?: number }).z ?? 0;
      const ap = walkPosOf(haloUnit.id, haloUnit.pos!.x, haloUnit.pos!.y); // le halo SUIT le token qui glisse
      for (const t of footprintTiles(ap, footprintN(haloUnit)))
        out.push({ d: depth(t.x, t.y, dims, hz) + 0.25, el: <path key={`active-${t.x}-${t.y}`} d={diamondPath(t.x, t.y, dims, liftAt(t.x, t.y, hz))} fill="none" stroke="var(--iso-active-halo)" strokeWidth={3} /> });
    }
  }
  if (mode === 'exploration' && !dialogue)
    out.push({ d: depth(partyPos.x, partyPos.y, dims, partyPos.z ?? 0) + 0.25, el: <path key="party-pos" d={diamondPath(partyPos.x, partyPos.y, dims, liftAt(partyPos.x, partyPos.y, partyPos.z ?? 0))} fill="none" stroke="var(--iso-active-halo)" strokeWidth={1.5} opacity={0.5} /> });
  return out;
}
