/**
 * Ligne de Vue & Couvert (LDB `13 - Combat.md` l.123 ; `14 - _GoBack.md` l.103/114/120, l.75).
 * Lit la Scène (terrain, bâtiments, décors, occupants) — vit en `state` car l'engine pur ne dépend
 * jamais de `Scene`. Le `coverModifier` numérique est injecté dans `attackModifiers` via `env: ModLine[]`
 * (cf. combatFlow). La table de couvert n'est pas exhaustive (LDB l.75 : « servez-vous de ces exemples
 * comme guide ») — la classification des décors/créatures est une extrapolation des exemplaires canon.
 */
import { Scene, SceneEntity, tileAt, wallBetween } from './scene';
import { buildingBlockedAt } from './buildings';
import { TERRAINS } from './terrain';
import { findPropById } from '../data';
import { Pt } from './path';

export type CoverClass = 'none' | 'imparfaite' | 'moyenne' | 'totale';

const COVER_MOD: Record<CoverClass, number> = { none: 0, imparfaite: -10, moyenne: -20, totale: -30 };
export const coverModifier = (c: CoverClass): number => COVER_MOD[c];
const worst = (a: CoverClass, b: CoverClass): CoverClass => (COVER_MOD[b] < COVER_MOD[a] ? b : a);

/** Couvert d'un terrain partiel. */
const TERRAIN_COVER: Record<string, CoverClass> = { bois: 'imparfaite' };
/** Couvert/opacité d'un décor : lus sur le dataset `props.json` (`cover`/`opaque`), exemplaires canon
 *  `14` l.103/114/120 + extrapolation l.75. Édité au Codex. */
const decorCover = (ref: string | undefined): CoverClass | undefined => (ref ? findPropById(ref)?.cover : undefined);

/** Cases STRICTEMENT entre `a` et `b` (supercover simple sur grille carrée). */
export function tilesBetween(a: Pt, b: Pt): Pt[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  const out: Pt[] = [];
  for (let i = 1; i < steps; i++) {
    out.push({ x: Math.round(a.x + (dx * i) / steps), y: Math.round(a.y + (dy * i) / steps) });
  }
  return out;
}

const adjacent = (p: Pt, q: Pt): boolean => Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y)) <= 1;

/** Suite COMPLÈTE des cases de `a` à `b`, extrémités INCLUSES (supercover, pour tester les arêtes
 *  franchies entre cases consécutives — ce que `tilesBetween` (strictement entre) ne donne pas). */
function cellPath(a: Pt, b: Pt): Pt[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  if (steps === 0) return [{ x: a.x, y: a.y }];
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    out.push({ x: Math.round(a.x + (dx * i) / steps), y: Math.round(a.y + (dy * i) / steps) });
  }
  return out;
}

/** Un mur d'arête (`Scene.walls`) est-il franchi par la ligne `from`→`to` ? Bloque la vue
 *  (« pas à travers les murs »). Le test PAR ARÊTE est injectable (`edgeBlocks`) : défaut = `wallBetween`
 *  (O(murs), combat) ; la vision passe un prédicat O(1) (Set d'arêtes précalculé) pour les scènes très
 *  murées. Les diagonales ne croisent pas d'arête cardinale. */
export function wallOnSight(scene: Scene, from: Pt, to: Pt, z = 0, edgeBlocks?: (ax: number, ay: number, bx: number, by: number) => boolean): boolean {
  if (!scene.walls?.length) return false;
  const blk = edgeBlocks ?? ((ax, ay, bx, by) => wallBetween(scene, ax, ay, bx, by, z));
  const path = cellPath(from, to);
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i], b = path[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    if (dx !== 0 && dy !== 0) {
      // Pas DIAGONAL : le rayon franchit le coin partagé. Bloqué si les DEUX contournements
      // orthogonaux du coin (via (b.x,a.y) et via (a.x,b.y)) sont murés — un mur droit bloque, mais
      // on peut « jeter un œil » au-delà de l'EXTRÉMITÉ d'un mur (un seul côté muré).
      const blocked1 = blk(a.x, a.y, b.x, a.y) || blk(b.x, a.y, b.x, b.y);
      const blocked2 = blk(a.x, a.y, a.x, b.y) || blk(a.x, b.y, b.x, b.y);
      if (blocked1 && blocked2) return true;
    } else if (blk(a.x, a.y, b.x, b.y)) {
      return true;
    }
  }
  return false;
}

/**
 * Cases d'un nuage de fumée (Souffle (Fumée)) : disque de Chebyshev `radius` autour de `center`
 * (la zone soufflée) ∪ le trajet `from`→`center` (le souffle traverse). PUR. La case source (`from`)
 * n'est PAS enfumée (la créature souffle DEPUIS sa case vers la cible).
 */
export function smokeZone(from: Pt, center: Pt, radius: number): Pt[] {
  const seen = new Map<string, Pt>();
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++) {
      const t = { x: center.x + dx, y: center.y + dy };
      seen.set(`${t.x},${t.y}`, t);
    }
  for (const t of tilesBetween(from, center)) seen.set(`${t.x},${t.y}`, t);
  seen.delete(`${from.x},${from.y}`); // immunisée à son propre Souffle : la créature ne s'aveugle pas (même si elle est dans le disque)
  return [...seen.values()];
}

/** Empreinte d'un décor : ses cases (1×1 par défaut, ou `foot {w,h}` ancré en `pos`). */
function entityTiles(e: SceneEntity): Pt[] {
  const w = e.foot?.w ?? 1;
  const h = e.foot?.h ?? 1;
  const out: Pt[] = [];
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) out.push({ x: e.pos.x + xx, y: e.pos.y + yy });
  return out;
}

const decorAt = (scene: Scene, x: number, y: number): SceneEntity | undefined =>
  scene.entities.find(
    (e) => e.kind === 'prop' && entityTiles(e).some((p) => p.x === x && p.y === y),
  );

/** Une CASE bloque-t-elle la vue ? (terrain opaque `mur/porte`, empreinte de bâtiment, décor opaque
 *  `statue`). Prédicat UNIQUE d'opacité de tuile — utilisé par le couvert (`lineOfSightCover`) ET la
 *  vision (échantillonnage anti-fuite). N'inclut PAS les murs d'arête (cf. `wallBetween`). */
export function tileBlocksSight(scene: Scene, x: number, y: number): boolean {
  if (TERRAINS[tileAt(scene, x, y)]?.opaque) return true;
  if (buildingBlockedAt(scene, x, y)) return true;
  const dc = decorAt(scene, x, y);
  return !!dc && !!findPropById(dc.ref ?? '')?.opaque;
}

/**
 * Couvert + Ligne de Vue du tireur `from` vers la cible `to`. `occupants` = cases occupées par
 * d'autres combattants (couvert imparfait, extrapolation `14` l.75). `smoke` = cases enfumées
 * (Souffle (Fumée)) qui BLOQUENT entièrement la vue (RAW « bloquant les Lignes de vue ») —
 * y compris si le tireur ou la cible est DANS la fumée. `blocked:true` = pas de tir (cible
 * entièrement masquée, `13` l.123) ; un bloqueur de vue ADJACENT à la cible = couverture totale
 * −30 (« derrière un mur de pierre », `14` l.120) sans empêcher le tir.
 */
export function lineOfSightCover(
  scene: Scene,
  from: Pt,
  to: Pt,
  occupants: Pt[],
  smoke: Pt[] = [],
): { blocked: boolean; cover: CoverClass } {
  // Fumée : bloque la vue sur tout le segment, extrémités INCLUSES (être DANS la fumée aveugle aussi).
  if (smoke.length) {
    const smoky = (p: Pt) => smoke.some((s) => s.x === p.x && s.y === p.y);
    if (smoky(from) || smoky(to) || tilesBetween(from, to).some(smoky)) return { blocked: true, cover: 'totale' };
  }
  // Murs d'arête (Scene.walls) : barrière pleine entre deux cases → vue entièrement bloquée.
  if (wallOnSight(scene, from, to)) return { blocked: true, cover: 'totale' };
  let cover: CoverClass = 'none';
  for (const t of tilesBetween(from, to)) {
    const terr = tileAt(scene, t.x, t.y);
    const decor = decorAt(scene, t.x, t.y);
    if (tileBlocksSight(scene, t.x, t.y)) {
      if (adjacent(t, to)) {
        cover = worst(cover, 'totale'); // cible collée au couvert → −30, tir possible
        continue;
      }
      return { blocked: true, cover: 'totale' }; // bloqueur à distance → pas de Ligne de Vue
    }
    if (TERRAIN_COVER[terr]) cover = worst(cover, TERRAIN_COVER[terr]);
    const dcov = decor && decorCover(decor.ref);
    if (dcov) cover = worst(cover, dcov);
    if (occupants.some((o) => o.x === t.x && o.y === t.y)) cover = worst(cover, 'imparfaite');
  }
  return { blocked: false, cover };
}
