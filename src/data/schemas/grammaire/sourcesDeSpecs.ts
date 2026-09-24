/**
 * SOURCES DE SPÉCIALISATIONS (#1897) — la DÉCLARATION UNIQUE de chaque `specsSource` : le dataset
 * d'où elle tire ses ids, l'UNIVERS qu'elle admet (validité d'une `spec`) et le POOL qu'elle propose
 * (choix joueur, ⊆ univers). Deux lecteurs, une déclaration :
 *  - l'application (`SPEC_SOURCES`, `src/data/index.ts`) : `pool()` et `resolves()` ;
 *  - l'outillage (`npm run gen`, `scripts/gen-registry.mjs`) : `SPECS_PAR_DATASET` porte l'univers.
 *
 * FEUILLE : aucun import d'exécution — `scripts/gen-registry.mjs` l'importe tel quel sous Node
 * (effacement des types), et `grammaire/idsVivants.ts` en recalcule l'univers en mémoire.
 */
import type { SpecsSource } from '../../index.ts';

/** Filtre d'entrées : `vaut` posé = le champ vaut cette chaîne ; sinon le champ est non vide. */
export interface FiltreDeSource {
  readonly champ: string;
  readonly vaut?: string;
}

export interface SourceDeSpecs {
  /** Dataset de `src/data` qui porte les ids de la source. */
  readonly dataset: string;
  /** Racine-objet : les ids sont les CLÉS de ce champ (`sizes.json › rangedMod`). */
  readonly cles?: string;
  /** Entrées ADMISES comme spécialisation (absent = toutes). */
  readonly univers?: FiltreDeSource;
  /** Entrées de l'univers PROPOSÉES à un choix joueur (absent = tout l'univers). */
  readonly pool?: FiltreDeSource;
}

const combat = (vaut: string): FiltreDeSource => ({ champ: 'combat', vaut });
const categorie = (vaut: string): FiltreDeSource => ({ champ: 'categorie', vaut });

/** Corps à corps : `LDB 09 l.160` ; Projectiles : `LDB 09 l.428` ; Focalisation : `LDB 09 l.252`. */
export const SOURCES_DE_SPECS = {
  weaponGroupsMelee: { dataset: 'weaponGroups.json', univers: combat('melee') },
  weaponGroupsRanged: { dataset: 'weaponGroups.json', univers: combat('ranged') },
  winds: { dataset: 'domains.json', pool: { champ: 'wind' } },
  arcaneDomains: { dataset: 'domains.json', pool: { champ: 'arcane' } },
  cultBlessings: { dataset: 'gods.json', pool: { champ: 'blessings' } },
  cultMiracles: { dataset: 'gods.json', pool: { champ: 'miracles' } },
  cultChaos: { dataset: 'gods.json', pool: { champ: 'chaosSpells' } },
  seaShanties: { dataset: 'sea-shanties.json' },
  groups: { dataset: 'groups.json' },
  diseases: { dataset: 'maladies.json' },
  sizes: { dataset: 'sizes.json', cles: 'rangedMod' },
  mutations: { dataset: 'mutations.json' },
  breathTypes: { dataset: 'breath-types.json' },
  damageTypes: { dataset: 'damage-types.json' },
  weaponsMelee: { dataset: 'trappings.json', univers: categorie('melee') },
  weaponsRanged: { dataset: 'trappings.json', univers: categorie('ranged') },
} as const satisfies Record<SpecsSource, SourceDeSpecs>;

/** Datasets lus par les sources — la clé par laquelle un lecteur fournit leur racine. */
export type DatasetDeSource = (typeof SOURCES_DE_SPECS)[SpecsSource]['dataset'];

type Entree = Readonly<Record<string, unknown>>;

function retient(filtre: FiltreDeSource | undefined, e: Entree): boolean {
  if (!filtre) return true;
  const v = e[filtre.champ];
  if (filtre.vaut !== undefined) return v === filtre.vaut;
  return Array.isArray(v) ? v.length > 0 : !!v;
}

function entrees(source: SourceDeSpecs, racine: unknown): readonly Entree[] {
  if (source.cles !== undefined) {
    const table = (racine as Record<string, unknown> | undefined)?.[source.cles];
    return table && typeof table === 'object' ? Object.keys(table).map((id) => ({ id })) : [];
  }
  return Array.isArray(racine) ? (racine as Entree[]).filter((e) => e && typeof e.id === 'string') : [];
}

/** Ids ADMIS par la source, dans l'ordre du dataset. */
export function universDeSource(source: SourceDeSpecs, racine: unknown): string[] {
  return entrees(source, racine).filter((e) => retient(source.univers, e)).map((e) => String(e.id));
}

/** Ids PROPOSÉS par la source (⊆ univers), dans l'ordre du dataset. */
export function poolDeSource(source: SourceDeSpecs, racine: unknown): string[] {
  return entrees(source, racine)
    .filter((e) => retient(source.univers, e) && retient(source.pool, e))
    .map((e) => String(e.id));
}

/** `id` appartient-il à l'univers de la source ? */
export function sourceAdmet(source: SourceDeSpecs, racine: unknown, id: string): boolean {
  const e = entrees(source, racine).find((x) => x.id === id);
  return e !== undefined && retient(source.univers, e);
}
