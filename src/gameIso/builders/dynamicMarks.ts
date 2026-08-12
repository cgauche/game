/**
 * BUILDER des marques DYNAMIQUES de combat (#1176, P3-0d/P3-0e) — celles qui SUIVENT le jeton qui
 * glisse : lien d'ENGAGEMENT entre deux combattants en mêlée, contour de l'unité ACTIVE, repère de
 * position du GROUPE hors combat, et l'ANNEAU D'ÉQUIPE aux pieds de chaque jeton posté. Pendant de
 * `builders/highlights`, et même frontière : PUR et camera-free.
 *
 * Ce que cette dérivation rend, ce sont des cases LOGIQUES et des IDENTITÉS — jamais une position à
 * l'écran ni dans le monde. La position de l'INSTANT appartient à chaque voie de rendu, et les deux la
 * prennent au même canal de glissement : la voie affine à son rendu React (`stage/tokens`,
 * `WalkPos`), la voie volumique à sa boucle de frame (`stage/dynamicMarkPose`, `walkGlideM`).
 *
 * Pourquoi ces trois-là ne sont PAS dans `builders/highlights` : une marque de case s'y mesure à
 * l'ÉTAT (une portée, une zone, un anneau ne bougent pas entre deux états) ; celles-ci se posent à la
 * FRAME, entre deux états.
 */
import { isOutOfAction } from '../../engine/conditions';
import type { Combatant } from '../../engine/types';
import { CELL, projectStep, stepOf, type ProjKind } from '../../geometry/iso';
import { inBattleId } from '../../state/combatants';
import { footprintN } from '../../state/footprint';
import { mountOf } from '../../state/mount';
import type { Pt } from '../../state/path';
import type { BattleState } from '../../state/store';
import { combatantTokenScale } from '../sizeScale';
import { ENEMY_RING, HERO_RING, teamShape } from '../teamColors';
import type { TokenEl } from './types';

/** GABARIT du lien d'engagement tel que la voie AFFINE le trace : épaisseur de trait et pointillés, en
 *  PIXELS de la projection SVG (`strokeWidth`, `strokeDasharray`). */
export const TETHER_STROKE_PX = 2;
export const TETHER_DASH_PX = 4;
export const TETHER_GAP_PX = 3;

/** Longueur ÉCRAN d'un PAS DE CASE dans la cadence LOSANGE : la projection du pas de grille `(1, 0)`,
 *  soit `hypot(TW/2, TH/2)` ≈ 35,78 px (`geometry/iso.projectStep`, branche losange). C'est l'échelle
 *  que la voie volumique reproduit — un pas de case y vaut `mpt` mètres et retombe sur les mêmes 35,78
 *  px à l'écran (`backends/webgl/cameras.affineScales`, vue `iso`). */
const PAS_DE_CASE_PX = Math.hypot(projectStep(null, { x: 1, y: 0 }).dx, projectStep(null, { x: 1, y: 0 }).dy);

/** Le MÊME gabarit en fractions de CASE : un pas de case vaut `PAS_DE_CASE_PX` pixels à l'écran et
 *  `mpt` mètres dans le monde volumique, donc `K · mpt` mètres se peignent aux pixels du gabarit affine
 *  LE LONG DES AXES DE LA GRILLE. Hors de ces axes les deux voies divergent par nature : l'affine mètre
 *  son pointillé à l'ÉCRAN, le volumique le sien dans le MONDE, et la projection isométrique n'a pas la
 *  même échelle dans toutes les directions. Un lien de mêlée relie des cases au CONTACT (#1176) :
 *  l'écart y reste sous le tiret. */
export function strokeWidthK(px: number): number {
  return px / PAS_DE_CASE_PX;
}
export const TETHER_WIDTH_K = strokeWidthK(TETHER_STROKE_PX);
export const TETHER_DASH_K = strokeWidthK(TETHER_DASH_PX);
export const TETHER_GAP_K = strokeWidthK(TETHER_GAP_PX);

/** Case LOGIQUE d'une marque dynamique (l'étage compris). */
export interface MarkCell {
  x: number;
  y: number;
  z: number;
}

/** Lien de mêlée entre DEUX combattants Engagés — une seule entrée par paire. */
export interface EngageTether {
  a: { id: string; cell: MarkCell };
  b: { id: string; cell: MarkCell };
}

/** L'unité ACTIVE et son EMPREINTE : un cavalier est représenté par sa MONTURE (`mountOf`). */
export interface ActiveFootprint {
  id: string;
  cell: MarkCell;
  /** Côté de l'empreinte, en cases. */
  n: number;
}

/** Anneau d'ÉQUIPE aux pieds d'un jeton — la décoration de sol qui dit à quelle équipe il appartient. */
export interface TeamRing {
  id: string;
  /** Centre du bloc d'EMPREINTE (offset `(n−1)/2` appliqué) : l'anneau est aux PIEDS du jeton. */
  cell: MarkCell;
  /** Rayon en fraction de case sous la projection LOSANGE — l'ellipse aux pieds du jeton. */
  rK: number;
  /** Rayon en fraction de case sous la vue du DESSUS. La voie affine n'y trace pas le même anneau :
   *  le jeton y devient un disque-portrait et son anneau ceint CE disque (`BodyToken`, branche
   *  `flat` — même rayon que le disque, cf. `topRingRadiusK`). */
  rTopK: number;
  color: string;
  /** Pointillé de la voie affine (`teamShape`) — absent = trait plein. */
  dash?: string;
}

/** Les marques dynamiques d'une frame, dans l'ordre d'ÉMISSION historique de la voie affine. En LECTURE
 *  SEULE : une frame se dérive, elle ne se retouche pas — les deux voies lisent le MÊME relevé. */
export interface DynamicMarks {
  readonly tethers: readonly EngageTether[];
  readonly active: ActiveFootprint | null;
  /** Repère de position du GROUPE hors combat — sa case, sans glissement (cf. `dynamicHighlightObjs`). */
  readonly party: MarkCell | null;
  /** Anneaux d'équipe, un par jeton posté (cf. `teamRings`). */
  readonly rings: readonly TeamRing[];
}

/** Aucune marque dynamique — la valeur d'une voie qui n'en reçoit pas. GELÉE : elle est partagée par
 *  toutes les voies et toutes les frames, un appelant qui pousserait dedans la salirait pour tous. */
export const NO_DYNAMIC_MARKS: DynamicMarks = Object.freeze({ tethers: Object.freeze([]), active: null, party: null, rings: Object.freeze([]) });

/**
 * Les marques dynamiques de l'instant. `battle` = le combat en cours (ou `null` hors combat), `party` =
 * la case du groupe quand le contexte l'affiche (le contexte — mode, dialogue ouvert — est tranché par
 * l'appelant, une seule fois, et les DEUX voies consomment le même verdict). `tokens` = les jetons du
 * builder et `partyToken` le meneur hors combat : c'est d'eux que se dérivent les ANNEAUX d'équipe, la
 * décoration de sol dont la population est celle des jetons RÉELLEMENT postés. Ces deux-là sont EXIGÉS
 * (une frame sans jeton passe `[]`, une frame en combat passe `null` pour le meneur) : un défaut y
 * rendrait des anneaux silencieusement absents d'une voie.
 */
export function dynamicMarks(battle: BattleState | null, party: Pt | null, tokens: readonly TokenEl[], partyToken: { leader: Combatant; pos: Pt } | null): DynamicMarks {
  const tethers: EngageTether[] = [];
  let active: ActiveFootprint | null = null;
  if (battle) {
    for (const c of battle.combatants) {
      if (!c.pos || isOutOfAction(c)) continue;
      for (const oid of c.engagedWith ?? []) {
        if (c.id >= oid) continue; // une seule ligne par paire
        const o = inBattleId(battle, oid);
        if (!o?.pos || isOutOfAction(o)) continue;
        tethers.push({
          a: { id: c.id, cell: { x: c.pos.x, y: c.pos.y, z: c.pos.z ?? 0 } },
          b: { id: o.id, cell: { x: o.pos.x, y: o.pos.y, z: o.pos.z ?? 0 } },
        });
      }
    }
    const actif = inBattleId(battle, battle.order[battle.turn]);
    const unité = actif ? mountOf(battle, actif) ?? actif : undefined;
    // C'est l'UNITÉ REPRÉSENTÉE qui doit être posée, pas le combattant actif : une monture posée porte
    // le contour même si son cavalier n'a pas de `pos` (il en est le passager, cf. `state/mount`).
    if (unité?.pos)
      active = {
        id: unité.id,
        cell: { x: unité.pos.x, y: unité.pos.y, z: unité.pos.z ?? 0 },
        n: footprintN(unité),
      };
  }
  return { tethers, active, party: party ? { x: party.x, y: party.y, z: party.z ?? 0 } : null, rings: teamRings(tokens, partyToken) };
}

/** GABARIT de l'anneau d'ÉQUIPE aux pieds du jeton, tel que la voie AFFINE le trace (`BodyToken` :
 *  `<ellipse rx={18·s} ry={9·s} strokeWidth={2.5} strokeDasharray={ringDash} />`), en PIXELS de la
 *  projection SVG. */
export const TEAM_RING_RX_PX = 18;
export const TEAM_RING_STROKE_PX = 2.5;

/** Demi-axes ÉCRAN (px) de la projection iso d'un cercle MONDE de rayon UNE case. Un cercle est
 *  invariant par rotation du monde : sa projection ne dépend donc pas du lacet de la caméra, et vaut
 *  l'ellipse obtenue en projetant le point de grille diagonal de norme 1 (`projectStep`, branche
 *  losange). `RING_A_PX / RING_B_PX` vaut `TW / TH` : c'est CE rapport qui compresse d'un facteur deux,
 *  sur l'axe de profondeur, un pointillé dont le pas serait uniforme en ARC MONDE. */
export const RING_A_PX = projectStep(null, { x: Math.SQRT1_2, y: -Math.SQRT1_2 }).dx;
export const RING_B_PX = projectStep(null, { x: Math.SQRT1_2, y: Math.SQRT1_2 }).dy;

/** Rayon MONDE (fraction de case) de l'anneau d'un jeton d'échelle `s` : l'ellipse affine
 *  `rx = 18·s, ry = 9·s` EST la projection du cercle de ce rayon — mêmes demi-axes, même rapport. */
export function teamRingRadiusK(s: number): number {
  return (TEAM_RING_RX_PX * s) / RING_A_PX;
}

/** GABARIT du disque-portrait de la VUE DU DESSUS, en fraction de case par case d'empreinte : la voie
 *  affine y remplace le corps par un disque centré sur la case, et son anneau d'équipe ceint CE
 *  disque (`BodyToken`, branche `flat` : `<circle r={discR}>` puis `<circle r={discR} stroke={ring}>`). */
export const TOP_DISC_K = 0.85 / 2;

/** Rayon ÉCRAN (px) du disque-portrait d'une empreinte de `n` cases. */
export function discR(n: number): number {
  return n * CELL * TOP_DISC_K;
}

/** Rayon MONDE (fraction de case) de l'anneau d'un jeton d'empreinte `n` en vue du DESSUS : le rayon
 *  du disque qu'il ceint (`discR(n)` px, à `CELL` px par case). */
export function topRingRadiusK(n: number): number {
  return discR(n) / CELL;
}

/** Demi-axes ÉCRAN (px) de la projection d'un cercle MONDE de rayon UNE case, en vue du DESSUS : la
 *  cadence y est unique et axis-alignée (`stepOf('top')`), donc la projection est 1:1 — un cercle monde
 *  y reste un CERCLE, et un pointillé uniforme en arc monde l'est déjà à l'écran. */
export const TOP_A_PX = projectStep(stepOf('top'), { x: 1, y: 0 }).dx;
export const TOP_B_PX = projectStep(stepOf('top'), { x: 0, y: 1 }).dy;

/** Demi-axes écran du cercle monde de rayon UNE case, PAR VUE — ce que le pointillé de l'anneau doit
 *  pré-compenser (rien en vue du dessus, un facteur deux en losange). */
export function ringAxesPx(kind: ProjKind): { a: number; b: number } {
  return kind === 'top' ? { a: TOP_A_PX, b: TOP_B_PX } : { a: RING_A_PX, b: RING_B_PX };
}

/** DÉCALAGE du paramètre `u` de l'ellipse écran à l'angle MONDE (`φ = u + phase + lacet`) : en losange
 *  le grand axe écran est la DIAGONALE de grille (`RING_A_PX`, d'où le quart de quart de tour) ; en vue
 *  du dessus les axes écran SONT ceux de la grille. */
export function ringPhaseRad(kind: ProjKind): number {
  return kind === 'top' ? 0 : -Math.PI / 4;
}

/** Épaisseur du trait, en fraction de case — même convention que le lien de mêlée (`TETHER_WIDTH_K`),
 *  et même écart assumé : l'affine mesure son trait à l'écran, le volumique le sien dans le monde. */
export const TEAM_RING_WIDTH_K = strokeWidthK(TEAM_RING_STROKE_PX);

/** BASES d'échelle des jetons dans le repère SVG (`stage/tokens`) : le combattant, et le meneur du
 *  groupe hors combat. L'anneau se mesure sur la MÊME échelle que le corps qu'il entoure — la base
 *  voyage donc avec lui au lieu d'être recopiée d'un site de rendu à l'autre. */
export const COMBAT_TOKEN_BASE = 0.62;
export const PARTY_TOKEN_BASE = 0.6;

/** Décoration d'ÉQUIPE d'un jeton : couleur d'anneau (identité de héros cyclique, rouge ennemi) et
 *  canal d'appartenance daltonien (`teamShape`, R9 : ennemi = anneau POINTILLÉ). Dérivation UNIQUE des
 *  deux voies — l'affine la peint en `<ellipse>`, la volumique en anneau plat au sol. */
export function teamRingDecor(c: Combatant, heroIndex?: number): { color: string; dash?: string } {
  const isHero = c.kind === 'hero';
  return {
    color: isHero ? HERO_RING[(heroIndex ?? 0) % HERO_RING.length] : ENEMY_RING,
    dash: teamShape(isHero),
  };
}

/** Le `strokeDasharray` de la voie affine, lu en pixels de projection (`'5 3'` → tiret 5, blanc 3).
 *  Absent ou illisible = trait PLEIN. */
export function dashPattern(dash: string | undefined): { dashPx: number; gapPx: number } | null {
  if (!dash) return null;
  const [d, g] = dash.split(/[\s,]+/).map(Number);
  return Number.isFinite(d) && Number.isFinite(g) && d > 0 ? { dashPx: d, gapPx: g } : null;
}

/** Les anneaux d'équipe de la frame : UN par jeton de COMBATTANT posté, plus celui du meneur du groupe
 *  hors combat. La population est celle des ÉLÉMENTS DU BUILDER (`builders/tokens`) — donc exactement
 *  celle que les deux voies dessinent, filtres compris ; un couple MONTÉ n'en porte pas, la voie affine
 *  n'en traçant aucun sur son corps composite (`stage/tokens.combatantObjs`). */
export function teamRings(tokens: readonly TokenEl[], partyToken: { leader: Combatant; pos: Pt } | null): TeamRing[] {
  const out: TeamRing[] = [];
  for (const tk of tokens) {
    const s = tk.subject;
    if (s.kind !== 'combatant') continue;
    const n = footprintN(s.c);
    const off = (n - 1) / 2; // ancre (coin NO) → centre du bloc : l'anneau est aux PIEDS
    out.push({
      id: s.c.id,
      cell: { x: tk.cell.x + off, y: tk.cell.y + off, z: tk.cell.z },
      rK: teamRingRadiusK(COMBAT_TOKEN_BASE * combatantTokenScale(s.c)),
      rTopK: topRingRadiusK(n),
      ...teamRingDecor(s.c, s.heroIndex),
    });
  }
  // Le jeton de GROUPE n'est pas un combattant posté : il porte l'anneau du MENEUR, plein et à la
  // première couleur d'identité, quelle que soit la nature de ce meneur (`stage/tokens.partyLeaderObj`).
  if (partyToken)
    out.push({
      id: partyToken.leader.id,
      cell: { x: partyToken.pos.x, y: partyToken.pos.y, z: partyToken.pos.z ?? 0 },
      rK: teamRingRadiusK(PARTY_TOKEN_BASE),
      rTopK: topRingRadiusK(1),
      color: HERO_RING[0],
    });
  return out;
}
