/**
 * BUILDER des HALOS D'INTERACTION (#1176, P3-0g) — les deux affordances qui disent « il y a quelque
 * chose ici » hors du combat : le halo permanent d'un décor FOUILLABLE non épuisé, et le halo de
 * SURVOL d'un PNJ interlocuteur. Frère de `builders/dynamicMarks` et de `builders/tokenChrome`, et
 * même frontière : PUR et camera-free.
 *
 * Ce que cette dérivation rend, ce sont des IDENTITÉS, des cases et des gabarits en fraction de case —
 * jamais une position à l'écran ni une classe CSS. Le rendu en tire ses anneaux plats et son étincelle
 * (`stage/interactHaloPose`). Le CONTEXTE qui autorise ces halos (mode d'exploration, combat ouvert)
 * se tranche UNE fois chez l'appelant, comme le repère de groupe des marques dynamiques.
 */
import type { Pt } from '../../state/path';
import type { Scene } from '../../state/scene';
import { RING_A_PX, type MarkCell } from './dynamicMarks';
import type { PropEl } from './types';

/** GABARIT des halos en PIXELS de la projection SVG (`<ellipse rx ry strokeWidth>`) — l'échelle de
 *  référence que le monde volumique reproduit. Le demi-axe ry vaut la moitié de rx : c'est la
 *  projection LOSANGE d'un cercle monde
 *  (`RING_A_PX / RING_B_PX`, cf. `builders/dynamicMarks`). */
export const HALO_RX_PX = 17;
export const HALO_STROKE_PX = 2;
/** Trait de l'onde « sonar » — plus fin que le contour du halo. */
export const PING_STROKE_PX = 1.6;
export const NPC_HALO_RX_PX = 15;
/** Trait du halo de PNJ tel qu'il est ÉCRIT dans le SVG — la feuille l'écrase à `HALO_HOVER_STROKE_PX`
 *  (`anim.css:186`), ce halo portant toujours la classe `hovered` : c'est cette dernière valeur que le
 *  monde volumique reproduit. */
export const NPC_HALO_STROKE_PX = 1.8;
/** Descente du halo sous le centre de la case, en pixels d'écran (`cy + 4`). */
export const HALO_CY_PX = 4;
/** Opacités des deux ellipses du halo de fouille (disque translucide, contour doré). */
export const HALO_FILL_OPACITY = 0.26;
export const HALO_STROKE_OPACITY = 0.9;
/** Les mêmes pour le halo de PNJ, plus discrètes. */
export const NPC_FILL_OPACITY = 0.2;
export const NPC_STROKE_OPACITY = 0.85;
/** ÉTINCELLE : décalage écran depuis le centre de case (droite, hauteur) et demi-taille du glyphe. */
export const SPARK_DX_PX = 9;
export const SPARK_DY_PX = 26;
export const SPARK_R_PX = 6;
/** GLYPHE de l'étincelle : une étoile à QUATRE branches — pointes sur les axes de l'écran (rayon
 *  `SPARK_R_PX`), creux sur les diagonales. Le rayon des creux est la demi-diagonale du carré `1,7`
 *  qu'inscrit le tracé. Le rendu le dessine par le gabarit `unitStarGeometry`
 *  (`backends/webgl/interactHaloMeshes`) — un glyphe décrit deux fois divergerait au premier retouchage. */
export const SPARK_BRANCHES = 4;
export const SPARK_INNER_R_PX = 1.7 * Math.SQRT2;

/** Sommets du glyphe, en PIXELS d'écran et dans l'ordre du tracé : pointe, creux, pointe… La première
 *  pointe est vers le HAUT de l'écran (`y` négatif en SVG). */
export function sparkPoints(rPx = SPARK_R_PX, innerPx = SPARK_INNER_R_PX, branches = SPARK_BRANCHES): { x: number; y: number }[] {
  const pas = Math.PI / branches;
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < 2 * branches; i++) {
    const r = i % 2 === 0 ? rPx : innerPx;
    const a = -Math.PI / 2 + i * pas;
    out.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
  }
  return out;
}

/** Tracé SVG du glyphe — la projection affine de `sparkPoints`, au centième de pixel. */
export function sparkPathD(rPx = SPARK_R_PX, innerPx = SPARK_INNER_R_PX, branches = SPARK_BRANCHES): string {
  const n2 = (v: number) => Number(v.toFixed(2));
  return `M${sparkPoints(rPx, innerPx, branches).map((p) => `${n2(p.x)},${n2(p.y)}`).join(' L')} Z`;
}
/** Épaisseur du contour sous la variante SURVOL : la règle CSS `.interact-halo.hovered ellipse[stroke]`
 *  (`anim.css:186`) l'emporte sur l'attribut `stroke-width` de l'élément, PNJ compris (leur halo porte
 *  toujours la classe `hovered`). */
export const HALO_HOVER_STROKE_PX = 3.4;
/** Agrandissement de la variante SURVOL (`anim.css:183`, `transform: scale(1.32)`) : il porte sur le
 *  GROUPE, donc sur le rayon ET sur l'épaisseur du trait. */
export const HALO_HOVER_SCALE = 1.32;

/** Rayon MONDE (fraction de case) d'un halo de demi-axe écran `rxPx` : l'ellipse affine EST la
 *  projection du cercle de ce rayon — mêmes demi-axes, même rapport (`teamRingRadiusK`, même loi). */
export function haloRadiusK(rxPx: number): number {
  return rxPx / RING_A_PX;
}

/** Halo de FOUILLE d'un décor interactif non épuisé. */
export interface InteractHalo {
  /** Id de l'ENTITÉ de scène (`PropEl.entId`) — la clé du flag d'épuisement `__fouille_<id>`. */
  id: string;
  /** Case d'ANCRAGE du décor (coin NO) et son étage : la profondeur de tri s'y mesure. */
  cell: MarkCell;
  /** Empreinte du décor, en cases (profondeur au coin le plus proche caméra). */
  span: { w: number; h: number };
  /** Centre de l'empreinte (décalages de `foot` appliqués) : le halo est aux PIEDS du décor. */
  centre: { x: number; y: number };
  /** Échelle du décor (`PropEl.foot.scale`) — le halo grandit avec lui. */
  scale: number;
  /** La tuile sous le curseur EST celle du décor → variante renforcée. */
  hovered: boolean;
  /** Le décor est EN VUE (au-dessus du voile de brouillard, `ElStates.visible`). */
  visible: boolean;
}

/** Halo de SURVOL d'un PNJ interlocuteur (dialogue/marchand) — révélé au survol seul. */
export interface NpcHalo {
  id: string;
  cell: MarkCell;
}

/** Les halos d'interaction d'une frame. En LECTURE SEULE : les deux voies lisent le MÊME relevé. */
export interface InteractionHalos {
  readonly fouilles: readonly InteractHalo[];
  readonly pnjs: readonly NpcHalo[];
}

/** Aucun halo — la valeur d'une voie qui n'en reçoit pas. GELÉE (partagée par toutes les voies). */
export const NO_INTERACTION_HALOS: InteractionHalos = Object.freeze({
  fouilles: Object.freeze([]),
  pnjs: Object.freeze([]),
});

/** Ce que la frame sait du CONTEXTE, et rien de plus. */
export interface HaloCtx {
  /** Mode d'exploration : hors de lui, le survol ne renforce pas le halo de fouille. */
  exploring: boolean;
  /** Combat ouvert : aucun halo de PNJ interlocuteur (le survol y sert au ciblage). */
  combat: boolean;
}

/**
 * Les halos d'interaction de l'instant. `flags` = les drapeaux de jeu (un décor fouillé porte
 * `__fouille_<entId>` et n'appelle plus), `hover` = la tuile sous le curseur.
 */
export function interactionHalos(
  propEls: readonly PropEl[],
  scene: Scene,
  flags: Record<string, boolean | undefined>,
  hover: Pt | null,
  ctx: HaloCtx,
): InteractionHalos {
  const fouilles: InteractHalo[] = [];
  for (const el of propEls) {
    if (el.source !== 'entity' || !el.interact || !el.entId || flags[`__fouille_${el.entId}`]) continue;
    const ez = el.cell.z;
    fouilles.push({
      id: el.entId,
      cell: { x: el.cell.x, y: el.cell.y, z: ez },
      span: { w: el.span?.w ?? 1, h: el.span?.h ?? 1 },
      centre: { x: el.cell.x + el.foot.offX, y: el.cell.y + el.foot.offY },
      scale: el.foot.scale,
      hovered: ctx.exploring && !!hover && hover.x === el.cell.x && hover.y === el.cell.y && (hover.z ?? 0) === ez,
      visible: el.states.visible,
    });
  }
  const pnjs: NpcHalo[] = [];
  if (hover && !ctx.combat)
    for (const ent of scene.entities) {
      if (ent.kind === 'prop' || ent.interact) continue; // fouille = halo permanent, déjà relevé ci-dessus
      if (!ent.dialogueId && !ent.merchant) continue;
      const ez = ent.z ?? 0;
      if (ent.pos.x !== hover.x || ent.pos.y !== hover.y || ez !== (hover.z ?? 0)) continue;
      pnjs.push({ id: ent.id, cell: { x: ent.pos.x, y: ent.pos.y, z: ez } });
    }
  return { fouilles, pnjs };
}
