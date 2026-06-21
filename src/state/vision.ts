/**
 * Vision — moteur PUR de visibilité & champ de lumière (brouillard de guerre). Vit en `state`
 * (couplé à `Scene`, comme `lineOfSight.ts`) ; aucune dépendance au store/RNG → testable.
 *
 * Un viewer voit une case si la Ligne de Vue n'est pas bloquée (murs/décor/fumée via
 * `lineOfSightCover`) ET (elle est dans sa portée de vision nocturne, OU elle est dans son rayon
 * de vue ET éclairée au-dessus du seuil). L'ensemble visible = UNION de tous les viewers.
 *
 * RÈGLE 1 : la portée de vue de base et le seuil d'éclairement n'ont pas de valeur canon (le LDB ne
 * stat pas la vue) → réglages MAISON injectés en paramètres ; les rayons de lumière (Bougie 10 m,
 * Lanterne 20 m — `LDB 74 l.72`, `LDB 75 l.15`) et la Vision nocturne (20 m/niv — `LDB 11 l.143-147`)
 * sont canon, convertis à l'échelle 1 case = 2 m (`LDB Déplacement l.55`).
 */
import { Scene, tileAt } from './scene';
import { wallOnSight } from './lineOfSight';
import { buildingBlockedAt } from './buildings';
import { TERRAINS } from './terrain';
import { sceneIsDark } from './sceneRules';
import { Pt } from './path';
import { LIGHT_LEVEL_BY_ID, findTraitById, findPropById, findTrappingById } from '../data';

/** Un observateur : sa case, son rayon de vue (cases éclairées qu'il distingue) et sa portée de
 *  vision nocturne (cases qu'il distingue même dans le noir). */
export interface Viewer {
  pos: Pt;
  z?: number;
  radiusTiles: number;
  darkTiles: number;
}

/** Une source de lumière ponctuelle (torche portée, brasero posé…). */
export interface LightSource {
  pos: Pt;
  z?: number;
  radiusTiles: number;
}

/** Champ de lumière : niveau d'éclairement 0..1 d'une case. `sourceLit` = cases éclairées par une
 *  SOURCE ponctuelle (hors plancher ambiant) — visibles si on y a la Ligne de Vue, même au-delà du
 *  rayon ambiant (on voit un feu dans le noir). */
export interface LightField {
  at(x: number, y: number, z?: number): number;
  sourceLit?: Set<string>;
}

/** Seuil d'éclairement (MAISON) au-dessus duquel une case est « éclairée » pour la vue. */
export const LIT_THRESHOLD = 0.18;

const chebyshev = (a: Pt, b: Pt): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Grille d'opacité de la scène (1 = bloque la vue), précalculée UNE FOIS par recompute → lookups O(1)
 *  dans le rayon, au lieu d'un `.find` O(entités) par échantillon (la cause des 64 ms/recompute).
 *  Terrain opaque + empreintes de bâtiment + décor opaque (`props.json`). PUR. */
interface Occ { g: Uint8Array; w: number; h: number }
function buildOpaque(scene: Scene): Occ {
  const { w, h } = scene.dimensions;
  const g = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (TERRAINS[tileAt(scene, x, y)]?.opaque || buildingBlockedAt(scene, x, y)) g[y * w + x] = 1;
  for (const e of scene.entities) {
    if (e.kind !== 'prop' || !e.ref || !findPropById(e.ref)?.opaque) continue;
    const fw = e.foot?.w ?? 1, fh = e.foot?.h ?? 1;
    for (let yy = 0; yy < fh; yy++)
      for (let xx = 0; xx < fw; xx++) {
        const x = e.pos.x + xx, y = e.pos.y + yy;
        if (x >= 0 && y >= 0 && x < w && y < h) g[y * w + x] = 1;
      }
  }
  return { g, w, h };
}

/** Échantillons par case du segment (anti-fuite au COIN d'un mur : un supercover entier rate une tuile
 *  que le rayon ne fait qu'EFFLEURER). */
const SAMPLES_PER_TILE = 4;

/** La vue `from`→`to` est-elle OCCULTÉE (vision) ? RAPIDE : grille d'opacité O(1) + murs d'arête + fumée.
 *  Plus strict que le combat : TOUTE case opaque sur la ligne (même collée à la cible) cache — on ne
 *  voit pas à travers un mur. Les couverts PARTIELS (haie, tonneau…) ne sont pas opaques → laissent voir. */
function rayBlocked(scene: Scene, occ: Occ, smoke: Set<string>, from: Pt, to: Pt): boolean {
  if (smoke.size && (smoke.has(`${from.x},${from.y}`) || smoke.has(`${to.x},${to.y}`))) return true;
  if (scene.walls?.length && wallOnSight(scene, from, to)) return true;
  const dx = to.x - from.x, dy = to.y - from.y;
  const n = Math.ceil(Math.hypot(dx, dy) * SAMPLES_PER_TILE);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const cx = Math.round(from.x + dx * t), cy = Math.round(from.y + dy * t);
    if ((cx === from.x && cy === from.y) || (cx === to.x && cy === to.y)) continue;
    if (cx < 0 || cy < 0 || cx >= occ.w || cy >= occ.h) continue;
    if (occ.g[cy * occ.w + cx] || smoke.has(`${cx},${cy}`)) return true;
  }
  return false;
}

/** Niveau de lumière effectif d'une scène : `Scene.ambientLight` explicite, sinon `auto`/absent →
 *  dérivé de l'horloge (`sceneIsDark` : extérieur de nuit = sombre). */
function levelOf(scene: Scene, gameTime: number) {
  const id = scene.ambientLight && scene.ambientLight !== 'auto' ? scene.ambientLight : sceneIsDark(scene, gameTime) ? 'nuit' : 'jour';
  return LIGHT_LEVEL_BY_ID.get(id) ?? LIGHT_LEVEL_BY_ID.get('jour')!;
}

/** Scalaire d'éclairement 0..1 de la scène (assombrissement du rendu + plancher du champ de lumière).
 *  `override` = `setLight` runtime (prime sur le niveau authored). */
export function ambientScalar(scene: Scene, gameTime: number, override: number | null = null): number {
  if (override != null) return Math.max(0, Math.min(1, override));
  return levelOf(scene, gameTime).scalar;
}

/** Rayon de vue de base (cases) du niveau de lumière — réglage MAISON (data, éditable au Codex). */
export function baseSightTiles(scene: Scene, gameTime: number): number {
  return levelOf(scene, gameTime).baseSightTiles;
}

/** Sources de lumière POSÉES sur la carte : props dont le TYPE (`props.json` `light`) émet, ou
 *  override d'instance `SceneEntity.light`. PUR. */
export function mapLights(scene: Scene): LightSource[] {
  const out: LightSource[] = [];
  for (const e of scene.entities) {
    if (e.kind !== 'prop') continue;
    const r = e.light?.radiusTiles ?? (e.ref ? findPropById(e.ref)?.light?.radiusTiles : undefined);
    if (r && r > 0) out.push({ pos: e.pos, z: e.z, radiusTiles: r });
  }
  return out;
}

/** Source de lumière PORTÉE par un combattant/groupe : le plus grand rayon parmi ses objets émetteurs
 *  (`TrappingData.light`), émis depuis `pos`. PUR. (Un interrupteur « allumé » est un raffinement futur.) */
export function combatantLights(c: { pos?: Pt; items?: { trappingId?: string }[] }): LightSource[] {
  if (!c.pos) return [];
  let r = 0;
  for (const it of c.items ?? []) {
    const lr = it.trappingId ? findTrappingById(it.trappingId)?.light?.radiusTiles : undefined;
    if (lr && lr > r) r = lr;
  }
  return r > 0 ? [{ pos: c.pos, radiusTiles: r }] : [];
}

/** Portée de vision dans le noir (cases) d'un combattant : max des `darkSightTiles` de ses traits
 *  (Infravision illimité, Vision nocturne 10) ; le talent Vision nocturne réutilise la valeur du trait
 *  homonyme (donnée, pas de littéral). 0 = aveugle dans le noir. */
export function darkSightTiles(c: { traits?: { id: string }[]; talents?: { talentId: string }[] }): number {
  let m = 0;
  for (const t of c.traits ?? []) m = Math.max(m, findTraitById(t.id)?.capabilities?.darkSightTiles ?? 0);
  if ((c.talents ?? []).some((t) => t.talentId === 'vision-nocturne')) {
    m = Math.max(m, findTraitById('vision-nocturne')?.capabilities?.darkSightTiles ?? 0);
  }
  return m;
}

/** Contribution d'une source à une case à distance `d` (dégradé linéaire, 1 au centre → 0 au bord). */
function falloff(d: number, radius: number): number {
  if (radius <= 0) return d === 0 ? 1 : 0;
  return Math.max(0, 1 - d / radius);
}

/**
 * Champ de lumière de la scène : plancher `ambient` (0..1) partout, rehaussé par chaque source
 * (dégradé `falloff`, combinaison par max) — une source n'éclaire une case que si la Ligne de Vue
 * source→case est dégagée (la lumière ne traverse pas les murs). PUR.
 */
export function computeLightField(scene: Scene, ambient: number, sources: LightSource[], smoke: Pt[] = []): LightField {
  const { w, h } = scene.dimensions;
  const occ = buildOpaque(scene);
  const smokeSet = new Set(smoke.map((s) => `${s.x},${s.y}`));
  const grid = new Map<string, number>(); // "x,y,z" → contribution des sources (> ambient seulement)
  for (const s of sources) {
    const z = s.z ?? 0;
    const R = s.radiusTiles;
    const x0 = Math.max(0, s.pos.x - R), x1 = Math.min(w - 1, s.pos.x + R);
    const y0 = Math.max(0, s.pos.y - R), y1 = Math.min(h - 1, s.pos.y + R);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const d = chebyshev(s.pos, { x, y });
        const c = falloff(d, R);
        if (c <= 0) continue;
        if (d > 0 && rayBlocked(scene, occ, smokeSet, s.pos, { x, y })) continue;
        const k = `${x},${y},${z}`;
        const prev = grid.get(k) ?? 0;
        if (c > prev) grid.set(k, c);
      }
  }
  const sourceLit = new Set<string>();
  for (const [k, v] of grid) if (v >= LIT_THRESHOLD) sourceLit.add(k);
  return { at: (x, y, z = 0) => Math.max(ambient, grid.get(`${x},${y},${z}`) ?? 0), sourceLit };
}

/**
 * Ensemble des cases (`"x,y,z"`) visibles par AU MOINS UN viewer. Une case est visible si la Ligne
 * de Vue est dégagée ET (dans la portée de vision nocturne du viewer, OU dans son rayon de vue ET
 * éclairée ≥ `LIT_THRESHOLD`). PUR.
 */
export function computeVisible(scene: Scene, viewers: Viewer[], light: LightField, smoke: Pt[] = []): Set<string> {
  const { w, h } = scene.dimensions;
  const occ = buildOpaque(scene);
  const smokeSet = new Set(smoke.map((s) => `${s.x},${s.y}`));
  const vis = new Set<string>();
  for (const v of viewers) {
    const z = v.z ?? 0;
    const R = Math.max(v.radiusTiles, v.darkTiles);
    const x0 = Math.max(0, v.pos.x - R), x1 = Math.min(w - 1, v.pos.x + R);
    const y0 = Math.max(0, v.pos.y - R), y1 = Math.min(h - 1, v.pos.y + R);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const k = `${x},${y},${z}`;
        if (vis.has(k)) continue;
        const d = chebyshev(v.pos, { x, y });
        if (d > R) continue;
        const inDark = d <= v.darkTiles;
        const lit = d <= v.radiusTiles && light.at(x, y, z) >= LIT_THRESHOLD;
        if (!inDark && !lit) continue;
        if (d > 0 && rayBlocked(scene, occ, smokeSet, v.pos, { x, y })) continue;
        vis.add(k);
      }
  }
  // Cases éclairées par une SOURCE (torche/brasero) : visibles dès qu'un viewer y a la Ligne de Vue,
  // même hors du rayon ambiant (on voit un feu dans le noir, ou la bulle de sa propre lanterne).
  if (light.sourceLit)
    for (const k of light.sourceLit) {
      if (vis.has(k)) continue;
      const c = k.split(',');
      const x = +c[0], y = +c[1], z = +c[2];
      for (const v of viewers) {
        if ((v.z ?? 0) !== z) continue;
        if (chebyshev(v.pos, { x, y }) === 0 || !rayBlocked(scene, occ, smokeSet, v.pos, { x, y })) {
          vis.add(k);
          break;
        }
      }
    }
  return vis;
}
