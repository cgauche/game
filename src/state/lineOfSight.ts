/**
 * Ligne de Vue & Couvert (LDB `13 - Combat.md` l.123 ; `14 - _GoBack.md` l.103/114/120, l.75).
 * Lit la Scène (terrain, bâtiments, décors, occupants) — vit en `state` car l'engine pur ne dépend
 * jamais de `Scene`. Le `coverModifier` numérique est injecté dans `attackModifiers` via `env: ModLine[]`
 * (cf. combatFlow). La table de couvert n'est pas exhaustive (LDB l.75 : « servez-vous de ces exemples
 * comme guide ») — la classification des décors/créatures est une extrapolation des exemplaires canon.
 */
import { Scene, SceneEntity, tileAt } from './scene';
import { buildingBlockedAt } from './buildings';
import { Pt } from './path';

export type CoverClass = 'none' | 'imparfaite' | 'moyenne' | 'totale';

const COVER_MOD: Record<CoverClass, number> = { none: 0, imparfaite: -10, moyenne: -20, totale: -30 };
export const coverModifier = (c: CoverClass): number => COVER_MOD[c];
const worst = (a: CoverClass, b: CoverClass): CoverClass => (COVER_MOD[b] < COVER_MOD[a] ? b : a);

/** Terrains bloquant la vue (mur de pierre / porte fermée). `bois` (sous-bois) ne bloque pas → couvert léger. */
const SIGHT_BLOCK_TERRAIN = new Set(['mur', 'porte']);
/** Couvert d'un terrain partiel. */
const TERRAIN_COVER: Record<string, CoverClass> = { bois: 'imparfaite' };
/** Couvert d'un décor (par id de catalogue), exemplaires canon `14` l.103/114/120 + extrapolation l.75. */
const DECOR_COVER: Record<string, CoverClass> = {
  statue: 'totale',
  cloture: 'moyenne',
  charrette: 'moyenne',
  tonneau: 'moyenne',
  caisse: 'moyenne',
  'etal-marche': 'moyenne',
  'epave-carrosse': 'moyenne',
  puits: 'moyenne',
  fontaine: 'moyenne',
  arbre: 'imparfaite',
  'tas-foin': 'imparfaite',
  'cheval-mort': 'imparfaite',
};
/** Décors opaques (couverture totale = bloquent la vue). */
const SIGHT_BLOCK_DECOR = new Set(['statue']);

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
    (e) => (e.kind === 'prop' || e.kind === 'objet') && entityTiles(e).some((p) => p.x === x && p.y === y),
  );

/**
 * Couvert + Ligne de Vue du tireur `from` vers la cible `to`. `occupants` = cases occupées par
 * d'autres combattants (couvert imparfait, extrapolation `14` l.75). `blocked:true` = pas de tir
 * (cible entièrement masquée, `13` l.123) ; un bloqueur de vue ADJACENT à la cible = couverture
 * totale −30 (« derrière un mur de pierre », `14` l.120) sans empêcher le tir.
 */
export function lineOfSightCover(
  scene: Scene,
  from: Pt,
  to: Pt,
  occupants: Pt[],
): { blocked: boolean; cover: CoverClass } {
  let cover: CoverClass = 'none';
  for (const t of tilesBetween(from, to)) {
    const terr = tileAt(scene, t.x, t.y);
    const decor = decorAt(scene, t.x, t.y);
    const blocks = SIGHT_BLOCK_TERRAIN.has(terr) || buildingBlockedAt(scene, t.x, t.y) || (!!decor && SIGHT_BLOCK_DECOR.has(decor.ref ?? ''));
    if (blocks) {
      if (adjacent(t, to)) {
        cover = worst(cover, 'totale'); // cible collée au couvert → −30, tir possible
        continue;
      }
      return { blocked: true, cover: 'totale' }; // bloqueur à distance → pas de Ligne de Vue
    }
    if (TERRAIN_COVER[terr]) cover = worst(cover, TERRAIN_COVER[terr]);
    if (decor && DECOR_COVER[decor.ref ?? '']) cover = worst(cover, DECOR_COVER[decor.ref ?? '']);
    if (occupants.some((o) => o.x === t.x && o.y === t.y)) cover = worst(cover, 'imparfaite');
  }
  return { blocked: false, cover };
}
