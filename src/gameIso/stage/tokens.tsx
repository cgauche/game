/**
 * Couche TOKENS du stage iso : transforme les éléments des builders (`builders/props`, `builders/tokens`
 * — identité + position LOGIQUE + décisions de scène) en corps React (tokenBodyKind → BodyToken). Les
 * tokens RESTENT des éléments React individuels (picking `data-cid` + `elementFromPoint`, jamais fusionnés
 * en innerHTML). Les couches STATIQUES (props, figurants) sont memoïsées par IsoStage (réfs stables →
 * React saute les sous-arbres pendant la marche) ; les combattants (position INTERPOLÉE par-frame) et
 * les affordances (halos, dépendants du survol/flags) se recalculent à la frame.
 */
import type { ReactNode } from 'react';
import { HALO_CY_PX, HALO_FILL_OPACITY, HALO_RX_PX, HALO_STROKE_OPACITY, HALO_STROKE_PX, NPC_FILL_OPACITY, NPC_HALO_RX_PX, NPC_HALO_STROKE_PX, NPC_STROKE_OPACITY, PING_STROKE_PX, SPARK_DX_PX, SPARK_DY_PX, sparkPathD, type InteractHalo, type NpcHalo } from '../builders/interactHalos';
import { Combatant } from '../../engine/types';
import { tokenChrome, mountChrome } from '../builders/tokenChrome';
import { COMBAT_TOKEN_BASE, PARTY_TOKEN_BASE, TETHER_DASH_PX, TETHER_GAP_PX, TETHER_STROKE_PX, discR, teamRingDecor, type DynamicMarks } from '../builders/dynamicMarks';
import { Dims, tileCenter, depth, diamondPath, footprintDepth } from '../../geometry/iso';
import { metricToLift } from '../../state/relief';
import { BodyToken } from '../BodyToken';
import { MountedToken } from '../MountedToken';
import { tokenBodyKind } from '../tokenBodyKind';
import { entitySprite, propSprite } from '../sprites';
import { propDepth } from '../backends/affineProps';
import { combatantBodyTopFrac, combatantTokenScale, entityTokenScale } from '../sizeScale';
import { sizeFootprint, footprintN, footprintTiles } from '../../state/footprint';
import { entitySize } from '../../state/spawn';
import { HERO_RING, veilTint } from '../teamColors';
import { GOLD_TINT, GOLD_DARK_TINT, HALO_TINT, ENGAGE_TINT, ACTIVE_HALO_TINT } from '../highlightTints';
import type { IconId } from '../../ui/icons';
import type { Pt } from '../../state/path';
import type { PropEl, TokenEl } from '../builders/types';
import type { StageObj } from './objs';

/** Position VISUELLE d'un token pendant la marche (interpolée par-frame, cf. IsoStage.walkPosOf). */
export type WalkPos = (id: string, x: number, y: number, z?: number) => { x: number; y: number; walking: boolean; sortPt: { x: number; y: number } };

export interface TokenCtx {
  dims: Dims;
  view: 'iso' | 'top';
  liftAt: (x: number, y: number, z?: number) => number;
}

// token()/tokenNode() : adaptateurs minces vers la coquille partagée BodyToken (positionnement
// unique). token() = corps SVG string (props/décor) ; tokenNode() = enfant React (rig) dont la mort
// est déjà bakée (CORPSE_POSE / pose effondrée) → pas de bascule externe (bakedDeath).
function token(ctx: TokenCtx, id: string, x: number, y: number, inner: string, scale: number, ringColor?: string, dim?: boolean, fx?: string, walking?: boolean, bakedDeath?: boolean, z = 0) {
  return (
    <BodyToken key={id} x={x} y={y} z={ctx.liftAt(x, y, z)} dims={ctx.dims} scale={scale} ring={ringColor} dim={dim} walking={walking} fx={fx} bakedDeath={bakedDeath}>
      <g dangerouslySetInnerHTML={{ __html: inner }} />
    </BodyToken>
  );
}

type TokenExtras = { hp?: { current: number; max: number }; icons?: IconId[]; iconsMore?: number; veil?: string; active?: boolean; ringDash?: string; flat?: boolean; portraitBox?: string; discR?: number; ghost?: boolean; cid?: string; highlight?: string; endState?: import('../../engine/conditions').EndState | null; bump?: number; bodyTopFrac?: number };
function tokenNode(ctx: TokenCtx, id: string, x: number, y: number, child: ReactNode, scale: number, ringColor?: string, dim?: boolean, walking?: boolean, extras?: TokenExtras, z = 0) {
  return (
    <BodyToken key={id} x={x} y={y} z={ctx.liftAt(x, y, z)} dims={ctx.dims} scale={scale} ring={ringColor} ringDash={extras?.ringDash} dim={dim} ghost={extras?.ghost} walking={walking} bakedDeath
      hp={extras?.hp} icons={extras?.icons} iconsMore={extras?.iconsMore} veil={extras?.veil} active={extras?.active}
      flat={extras?.flat} portraitBox={extras?.portraitBox} discR={extras?.discR} cid={extras?.cid} highlight={extras?.highlight} endState={extras?.endState} bump={extras?.bump} bodyTopFrac={extras?.bodyTopFrac}>
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
      el: token(lctx, el.entId ? `e-${el.entId}` : el.key, px, py, propSprite(el.ref, el.facing, ctx.dims.rot ?? 0), 0.55 * el.foot.scale, undefined, false, el.fx, false, false, el.cell.z),
    });
  }
  return out;
}

/** Affordance « fouille » d'un décor interactif : halo pulsé + onde « sonar » au sol, et étincelle
 *  dorée flottant AU-DESSUS du décor — l'objet cliquable se repère de loin, sans texte. La DÉRIVATION
 *  (qui porte un halo, lequel est survolé) est partagée avec la voie volumique
 *  (`builders/interactHalos`) ; cette fonction n'en est plus que la PROJECTION affine, dont les
 *  pulsations restent des animations CSS (`anim.css`). DYNAMIQUE (survol/flags). */
export function interactHaloObjs(halos: readonly InteractHalo[], ctx: TokenCtx): StageObj[] {
  const out: StageObj[] = [];
  for (const h of halos) {
    const ez = h.cell.z;
    const pd = footprintDepth(h.cell.x, h.cell.y, h.span.w, h.span.h, ctx.dims, ez);
    const c = tileCenter(h.centre.x, h.centre.y, ctx.dims, ctx.liftAt(h.centre.x, h.centre.y, ez));
    out.push({
      d: pd - 0.02, // juste sous le sprite
      z: ez,
      vis: h.visible,
      el: (
        <g key={`halo-${h.id}`} pointerEvents="none">
          <g className={h.hovered ? 'interact-halo hovered' : 'interact-halo'}>
            <ellipse cx={c.cx} cy={c.cy + HALO_CY_PX} rx={HALO_RX_PX * h.scale} ry={(HALO_RX_PX / 2) * h.scale} fill={HALO_TINT} opacity={HALO_FILL_OPACITY} />
            <ellipse cx={c.cx} cy={c.cy + HALO_CY_PX} rx={HALO_RX_PX * h.scale} ry={(HALO_RX_PX / 2) * h.scale} fill="none" stroke={GOLD_TINT} strokeWidth={HALO_STROKE_PX} opacity={HALO_STROKE_OPACITY} />
          </g>
          <ellipse className="halo-ping" cx={c.cx} cy={c.cy + HALO_CY_PX} rx={HALO_RX_PX * h.scale} ry={(HALO_RX_PX / 2) * h.scale} fill="none" stroke={GOLD_TINT} strokeWidth={PING_STROKE_PX} />
        </g>
      ),
    });
    out.push({
      d: pd + 0.02, // au-dessus du sprite : l'étincelle « il y a quelque chose ici »
      z: ez,
      vis: h.visible,
      el: (
        <g key={`spark-${h.id}`} className="halo-spark" pointerEvents="none" transform={`translate(${c.cx + SPARK_DX_PX * h.scale}, ${c.cy - SPARK_DY_PX * h.scale})`}>
          <path d={sparkPathD()} fill={GOLD_TINT} stroke={GOLD_DARK_TINT} strokeWidth={0.7} />
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
/** Décalage de couche d'un FIGURANT : > offset de MUR (0.45), comme le combattant (+0.5) → une unité
 *  posée sur une case n'est JAMAIS masquée par une cloison/crête de SES arêtes (invariant « jeton > mur »).
 *  Un mur DEVANT (arête sud/est → base voisine plus grande) la couvre toujours correctement. */
export const FIGURANT_LIFT = 0.5;

export function figurantLayerObjs(tokenEls: TokenEl[], ctx: TokenCtx): StageObj[] {
  const isTop = ctx.view === 'top';
  const discRfn = (sz: Combatant['size']) => discR(sizeFootprint(sz));
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
    const r = tokenBodyKind({ kind: 'sceneEntity', ent, enrolled }, ctx.view);
    if (r.bodyKind === 'sprite') {
      out.push({
        d: depth(ent.pos.x, ent.pos.y, ctx.dims, ez) + FIGURANT_LIFT,
        z: ez,
        vis: true,
        el: wrap(
          r.id,
          <BodyToken key={r.id} x={ent.pos.x} y={ent.pos.y} z={ctx.liftAt(ent.pos.x, ent.pos.y, ez)} dims={ctx.dims} scale={0.55} fx={ent.anim} cid={ent.id}>
            <g dangerouslySetInnerHTML={{ __html: entitySprite(ent, ctx.dims.rot) }} />
          </BodyToken>,
          inBattle,
        ),
      });
    } else {
      const base = r.bodyKind === 'rig' ? 0.58 : 0.55;
      const off = (sizeFootprint(entitySize(ent)) - 1) / 2;
      const ex = ent.pos.x + off, ey = ent.pos.y + off;
      out.push({
        d: depth(ex, ey, ctx.dims, ez) + FIGURANT_LIFT,
        z: ez,
        vis: true,
        el: wrap(
          r.id,
          <BodyToken key={r.id} x={ex} y={ey} z={ctx.liftAt(ent.pos.x, ent.pos.y, ez)} dims={ctx.dims} scale={base * entityTokenScale(ent)} bakedDeath flat={isTop} portraitBox={r.portraitBox} discR={discRfn(entitySize(ent))} cid={ent.id}>
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
      const decor = teamRingDecor(c, heroIndex); // anneau d'équipe : la MÊME dérivation que la voie volumique
      const wp = ctx.walkPosOf(c.id, c.pos!.x, c.pos!.y);
      const r = tokenBodyKind({ kind: 'combatant', combatant: c }, ctx.view);
      const fp = footprintN(c);
      const off = (fp - 1) / 2; // ancre (coin NO) → centre du bloc
      const cx = wp.x + off, cy = wp.y + off;
      // CHROME du jeton (PV, États, état de fin, allure) : la MÊME dérivation pure que la voie
      // volumique (`builders/tokenChrome`) — cette voie-ci ne fait que la peindre dans son corps.
      const chrome = tokenChrome(c, { ghostIds: ctx.ghostIds, hoveredId: ctx.hoveredId });
      const el = tokenNode(ctx, r.id, cx, cy, r.body, COMBAT_TOKEN_BASE * combatantTokenScale(c), decor.color, chrome.dim, wp.walking, {
        hp: chrome.hp ?? undefined,
        icons: chrome.icons,
        iconsMore: chrome.iconsMore,
        veil: veilTint(isHero),
        active: c.id === ctx.activeId,
        ringDash: decor.dash, // R9 : ennemi = anneau pointillé (indice d'équipe non-coloré)
        flat: top,
        portraitBox: r.portraitBox,
        discR: discR(fp),
        ghost: chrome.ghost,
        cid: c.id, // ciblage DOM (recettes Playwright : survol/clic par data-cid)
        highlight: chrome.highlight ?? undefined,
        endState: chrome.endState,
        bodyTopFrac: combatantBodyTopFrac(c), // toise du gabarit : la barre se pose à la tête DESSINÉE (nain ≠ elfe)
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
      const mountScale = COMBAT_TOKEN_BASE * combatantTokenScale(mount);
      const chrome = mountChrome(mount); // même dérivation partagée : le couple ne montre que son état de fin
      const el = tokenNode(ctx, `${mount.id}-mtd`, cx, cy, <MountedToken mount={mount} rider={rider} />, mountScale, undefined, chrome.dim, wp.walking, { endState: chrome.endState, bodyTopFrac: combatantBodyTopFrac(mount) });
      out.push({ d: depth(wp.sortPt.x + off, wp.sortPt.y + off, ctx.dims, mz) + 0.5, z: mz, vis: true, el });
    }
  }
  return out;
}

/** Token du GROUPE (exploration) : le leader VISIBLE glisse le long du chemin (ANIM_MOVE). `bump` :
 *  nonce de micro-secousse (#792, MOVE_BLOCKED — pas clavier refusé) transmis tel quel à `BodyToken`. */
export function partyLeaderObj(ctx: TokenCtx, partyPos: Pt, partyLeader: Combatant | undefined, walkPosOf: WalkPos, bump?: number): StageObj {
  const wp = partyLeader ? walkPosOf(partyLeader.id, partyPos.x, partyPos.y, partyPos.z ?? 0) : { x: partyPos.x, y: partyPos.y, walking: false, sortPt: { x: partyPos.x, y: partyPos.y } };
  const pZ = partyPos.z ?? 0; // le groupe se rend à son étage (loge) — token soulevé + trié au bon niveau
  // Le jeton de groupe rend TOUJOURS le rig (AnimatedRigToken du meneur, ou jeton vide si groupe vide) :
  // tokenBodyKind('partyLeader') renvoie toujours un rig, jamais 'sprite'.
  const r = tokenBodyKind({ kind: 'partyLeader', leader: partyLeader }, ctx.view);
  // Anneau du jeton de GROUPE : la première couleur d'identité, PLEINE, quelle que soit la nature du
  // meneur — c'est le groupe qu'il désigne, pas une équipe (même verdict que `teamRings`).
  const el = tokenNode(ctx, r.id, wp.x, wp.y, r.body, PARTY_TOKEN_BASE, HERO_RING[0], false, wp.walking, { flat: ctx.view === 'top', portraitBox: r.portraitBox, discR: discR(1), cid: partyLeader?.id, bump }, pZ);
  return { d: depth(wp.sortPt.x, wp.sortPt.y, ctx.dims, pZ) + 0.5, z: pZ, vis: true, el }; // le groupe est toujours en vue → au-dessus du voile
}

/** Halo de SURVOL d'un PNJ interlocuteur (dialogue/marchand) : PAS de halo permanent (ils ne
 *  « réclament » pas comme une fouille) — révélé au survol seul, cohérent avec le curseur main.
 *  1 seule tuile à la fois, peu coûteux (hors du memo figurants, qui ignore `hover`). Même partage que
 *  le halo de fouille : la DÉRIVATION vit dans `builders/interactHalos`, ceci en est la projection. */
export function npcHoverHaloObjs(halos: readonly NpcHalo[], ctx: TokenCtx): StageObj[] {
  const out: StageObj[] = [];
  for (const h of halos) {
    const ez = h.cell.z;
    const cc = tileCenter(h.cell.x, h.cell.y, ctx.dims, ctx.liftAt(h.cell.x, h.cell.y, ez));
    out.push({
      d: depth(h.cell.x, h.cell.y, ctx.dims, ez) + 0.55,
      z: ez,
      vis: true, // survol d'un PNJ interlocuteur (en vue) → halo au-dessus du voile
      el: (
        <g key={`npc-halo-${h.id}`} className="interact-halo hovered" pointerEvents="none">
          <ellipse cx={cc.cx} cy={cc.cy + HALO_CY_PX} rx={NPC_HALO_RX_PX} ry={NPC_HALO_RX_PX / 2} fill={HALO_TINT} opacity={NPC_FILL_OPACITY} />
          <ellipse cx={cc.cx} cy={cc.cy + HALO_CY_PX} rx={NPC_HALO_RX_PX} ry={NPC_HALO_RX_PX / 2} fill="none" stroke={GOLD_TINT} strokeWidth={NPC_HALO_STROKE_PX} opacity={NPC_STROKE_OPACITY} />
        </g>
      ),
    });
  }
  return out;
}

/** Tether d'ENGAGEMENT (R7) + halo de l'ACTIF + repère du groupe : éléments DYNAMIQUES qui SUIVENT le
 *  token qui glisse — projetés à la frame (peu coûteux). La DÉRIVATION est partagée avec la voie
 *  volumique (`builders/dynamicMarks`) ; cette fonction n'est plus que sa PROJECTION affine. */
export function dynamicHighlightObjs(ctx: TokenCtx, marks: DynamicMarks, walkPosOf: WalkPos): StageObj[] {
  const { dims, liftAt } = ctx;
  const out: StageObj[] = [];
  for (const { a, b } of marks.tethers) {
    const za = a.cell.z, zb = b.cell.z; // chaque extrémité posée à l'étage de SON combattant
    const pa = walkPosOf(a.id, a.cell.x, a.cell.y);
    const pb = walkPosOf(b.id, b.cell.x, b.cell.y);
    const ca = tileCenter(pa.x, pa.y, dims, za ? liftAt(pa.x, pa.y, za) : 0);
    const cb = tileCenter(pb.x, pb.y, dims, zb ? liftAt(pb.x, pb.y, zb) : 0);
    // tether posé à la profondeur de l'extrémité la plus PROCHE caméra (+0.25 ⇒ sous les jetons)
    out.push({ d: Math.max(depth(pa.x, pa.y, dims, za), depth(pb.x, pb.y, dims, zb)) + 0.25, el: <line key={`eng-${a.id}-${b.id}`} x1={ca.cx} y1={ca.cy} x2={cb.cx} y2={cb.cy} stroke={ENGAGE_TINT} strokeWidth={TETHER_STROKE_PX} strokeDasharray={`${TETHER_DASH_PX} ${TETHER_GAP_PX}`} opacity={0.6} pointerEvents="none" /> });
  }
  if (marks.active) {
    const { id, cell, n } = marks.active;
    const ap = walkPosOf(id, cell.x, cell.y); // le halo SUIT le token qui glisse
    for (const t of footprintTiles(ap, n))
      out.push({ d: depth(t.x, t.y, dims, cell.z) + 0.25, el: <path key={`active-${t.x}-${t.y}`} d={diamondPath(t.x, t.y, dims, liftAt(t.x, t.y, cell.z))} fill="none" stroke={ACTIVE_HALO_TINT} strokeWidth={3} /> });
  }
  if (marks.party) {
    const p = marks.party;
    out.push({ d: depth(p.x, p.y, dims, p.z) + 0.25, el: <path key="party-pos" d={diamondPath(p.x, p.y, dims, liftAt(p.x, p.y, p.z))} fill="none" stroke={ACTIVE_HALO_TINT} strokeWidth={1.5} opacity={0.5} /> });
  }
  return out;
}
