/**
 * AUDIT du FORMAT DE PART du rig (#551) — définition UNIQUE, partagée par :
 *   - la garde  `src/gameIso/rig/parts/tenues/part-view-format.test.ts` (cliquet) ;
 *   - le régénérateur `scripts/rig/regen-part-view-stock.mts` (solde du stock).
 *
 * Les deux DOIVENT mesurer la même chose : un régénérateur qui aurait sa propre lecture du pipeline
 * écrirait un stock que la garde ne reconnaît pas. D'où l'audit ici, et non dans le test.
 *
 * L'audit exerce le CHEMIN RÉEL (`resolveParts` pour le rendu servi + le discriminant de FORMAT
 * `hasProfileView`/`hasBackView` sur le def brut, `parts/types.ts`) : il ne réplique jamais
 * l'empilage. Périmètre et mécanismes : `rig/PART-CONTRACT.md`.
 */
import { TENUE_DEFS } from '../../../src/gameIso/rig/parts/tenues/_registry.generated';
import { ARMOUR_DEFS } from '../../../src/gameIso/rig/parts/armour/_registry.generated';
import { resolveParts } from '../../../src/gameIso/rig/parts/resolve';
import { hasProfileView, hasBackView, type PartArt } from '../../../src/gameIso/rig/parts/types';
import type { EquipCtx } from '../../../src/gameIso/rig/parts/equipment';
import type { ItemInstance, HitLocation } from '../../../src/engine/types';
import { slugId } from '../../../src/data/slug';

export const SLOTS = ['tete', 'bras', 'torse', 'jambes', 'pied', 'main', 'cou'] as const;
export type BodySlot = (typeof SLOTS)[number];
/** Porteur d'art de corps : une tenue ou une armure (même `set`, même passage par `resolveParts`). */
export interface Bearer { set: Partial<Record<BodySlot, PartArt>> }

const NO_EQUIP: EquipCtx = { weapons: [], armour: [] };

/**
 * Signature GÉOMÉTRIQUE d'un fragment SVG : la suite des éléments et de leurs attributs de forme.
 * Ce que le format vise est un DESSIN identique — pas une chaîne identique. Comparer les chaînes
 * laisse passer toute mutation cosmétique inerte (espace, commentaire, `<g>` enveloppant) et le
 * front simplement RECOLORÉ, qui rendent au pixel près ce que l'anti-alias veut tuer.
 *
 * Une signature `d=`-seule serait aveugle : le pipeline émet des `<ellipse>`/`<rect>` sans `d`
 * (HAND, genericPart) — d'où le relevé de TOUS les attributs porteurs de forme, `transform` compris
 * (un `<g transform>` déplace son contenu : il est géométrique, contrairement au `<g>` de style).
 *
 * L'art du dépôt mélange les deux quotages (`d="…"` ET `d='…'`, cf. `tenues/defs/Marchand.ts`) :
 * un relevé mono-quote rend `''` sur une partie du corpus, et deux `''` se comparent ÉGAUX — l'audit
 * crierait à l'alias sur des dessins distincts. `geometryOrThrow` verrouille cette classe.
 */
const GEOM_ATTRS = [
  'd', 'points', 'cx', 'cy', 'r', 'rx', 'ry',
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'transform',
] as const;
export function geometry(svg: string): string {
  const out: string[] = [];
  for (const m of svg.matchAll(/<([a-zA-Z][\w-]*)\b([^>]*?)\/?>/g)) {
    const [, tag, attrs] = m;
    const geom = GEOM_ATTRS.flatMap((a) => {
      const v = new RegExp(`\\b${a}=("([^"]*)"|'([^']*)')`).exec(attrs);
      const raw = v ? (v[2] ?? v[3]) : undefined;
      return raw != null ? [`${a}=${raw.replace(/\s+/g, ' ').trim()}`] : [];
    });
    if (geom.length === 0) continue; // conteneur de style (`<g stroke=…>`), balise sans forme
    out.push(`${tag}[${geom.join(',')}]`);
  }
  return out.join('|');
}
/** Un fragment SERVI non vide qui ne rend AUCUNE géométrie = le relevé est aveugle sur cet art,
 *  et l'audit comparerait deux `''`. On échoue au lieu de verdir à tort. */
function geometryOrThrow(svg: string, where: string): string {
  const g = geometry(svg);
  if (svg.trim() !== '' && g === '')
    throw new Error(`geometry() n'a relevé aucune forme sur un fragment SERVI non vide (${where}) — ` +
      `le relevé est aveugle sur cet art, la comparaison d'alias serait ''==='' . Fragment :\n${svg.slice(0, 300)}`);
  return g;
}

export interface Audit {
  /** `<porteur>:<slot>` fournis en `string` front-only. */
  format: Set<string>;
  /** `<porteur>:<slot>:<vue>` dont le DESSIN servi est celui du front. */
  alias: Set<string>;
  /** Libellé humain par clé de porteur (`<tenueId>` / `armure:<materiau>`) — commentaires du stock. */
  labels: Map<string, string>;
}

function auditBearer(
  key: string,
  bearer: Bearer,
  serve: (view: 'front' | 'profile' | 'back') => Record<string, { svg: string } | null>,
  acc: Audit,
) {
  const front = serve('front');
  const views = { profile: serve('profile'), back: serve('back') } as const;
  for (const slot of SLOTS) {
    const art = bearer.set[slot];
    if (art == null) continue;
    if (!hasProfileView(art) || !hasBackView(art)) { acc.format.add(`${key}:${slot}`); continue; }
    // Vues DÉCLARÉES : le pipeline sert l'art du def — vérifier que le DESSIN diffère du front.
    const ref = geometryOrThrow(front[slot]?.svg ?? '', `${key}:${slot}:front`);
    for (const view of ['profile', 'back'] as const)
      if (geometryOrThrow(views[view][slot]?.svg ?? '', `${key}:${slot}:${view}`) === ref)
        acc.alias.add(`${key}:${slot}:${view}`);
  }
}

/** Item d'armure de test couvrant les 4 slots de corps — `armourMaterial` infère le matériau du nom,
 *  et `name` du def EST le matériau (cf. `parts/armour/types.ts`). */
const ALL_LOCS: HitLocation[] = ['tete', 'corps', 'brasG', 'brasD', 'jambeG', 'jambeD'];
const armourItem = (mat: string): ItemInstance =>
  ({ uid: `audit_${mat}`, label: mat, kind: 'armor', qualities: [], enc: 0, equipped: true, locs: ALL_LOCS });

/** Mesure les violations de format sur les DEUX registres de slots de corps (tenues + armures). */
export function auditPartViews(): Audit {
  const acc: Audit = { format: new Set(), alias: new Set(), labels: new Map() };
  for (const def of TENUE_DEFS) {
    const id = slugId(def.label);
    acc.labels.set(id, def.label);
    auditBearer(id, def, (view) => resolveParts('Humain', 'M', id, NO_EQUIP, {}, 1, view), acc);
  }
  for (const def of ARMOUR_DEFS) {
    const key = `armure:${def.id}`;
    acc.labels.set(key, def.id.charAt(0).toUpperCase() + def.id.slice(1));
    const equip: EquipCtx = { weapons: [], armour: [armourItem(def.id)] };
    // Sans tenue : l'armure couvre les 4 slots et PRIME de toute façon (`armed ?? tenuePart`).
    auditBearer(key, def, (view) => resolveParts('Humain', 'M', undefined, equip, {}, 1, view), acc);
  }
  return acc;
}
