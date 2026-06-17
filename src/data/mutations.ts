/**
 * Mutations & Tableaux de Corruption — Livre de base, chapitre 19 (p.184-185), VERBATIM.
 *
 * DÉCOUPLÉ : la MUTATION (identité + effets) vit dans `mutations.json` (entité éditable, SANS plage de
 * tirage) ; les TABLES de Corruption vivent dans `mutationTables.json` — des plages d100 qui RÉFÉRENCENT
 * des mutations par label. Plusieurs tables peuvent pointer la même mutation SANS collision (LDB :
 * physique/mentale ; Compagnon T1 : une table par dieu du Chaos rejoue les mêmes mutations à d'autres
 * plages). Ce module = TYPES + chargement + tirage ; ajouter/régler = éditer le JSON (mutation OU table),
 * jamais ce fichier. Effets modélisés sur la mutation : `passive` (GameOp[]), `apAll`/`apLocations`
 * (armure naturelle), `derivedWeapon`, `traits`, `psychTraits` ; descriptif non modélisable en `note`.
 */
import { RNG, d100 } from '../engine/dice';
import { findTableEntry } from '../engine/tables';
import type { Mutation } from '../engine/corruption';
import mutationsJson from './mutations.json';
import mutationTablesJson from './mutationTables.json';

/** Une MUTATION (entité, `mutations.json`) : identité + effets, INDÉPENDANTE de toute table de tirage. */
export type MutationData = Omit<Mutation, 'roll'>;

/** Une TABLE de Corruption (`mutationTables.json`) : plages d100 → référence de mutation par label. */
export interface MutationTable {
  label: string;
  ranges: { min: number; max: number; mutation: string }[];
}

const MUTATIONS = mutationsJson as MutationData[];
const TABLES = mutationTablesJson as MutationTable[];
const BY_ID = new Map(MUTATIONS.map((m) => [m.id, m]));

/** `id`s par nature de mutation — pour le registre visuel du rig et son test d'exhaustivité. */
export const IDS_PHYSIQUES: readonly string[] = MUTATIONS.filter((m) => m.kind === 'physique').map((m) => m.id);
export const IDS_MENTALES: readonly string[] = MUTATIONS.filter((m) => m.kind === 'mentale').map((m) => m.id);

/** Tire une mutation sur la TABLE `table` (LDB : 'physique'/'mentale' ; Compagnon T1 : 'Khorne'…), d100 seedable.
 *  Les plages référencent les mutations par **id** (plus de label). */
export function rollMutation(table: string, rng: RNG): Mutation {
  const t = TABLES.find((x) => x.label === table);
  if (!t) throw new Error(`rollMutation : table « ${table} » introuvable (mutationTables.json)`);
  const roll = d100(rng);
  const range = findTableEntry(t.ranges, roll);
  const m = range ? BY_ID.get(range.mutation) : undefined;
  if (!m) throw new Error(`rollMutation : plage d100=${roll} sans mutation valide dans « ${table} »`);
  return { ...m, roll };
}

/** Mutation EXPLICITE par **id** (sans tirage — ex. trait « Mutation (Cornes asymétriques) » résolu en id
 *  au spawn). null si inconnue. */
export function mutationById(id: string): Mutation | null {
  const m = BY_ID.get(id);
  return m ? { ...m, roll: 0 } : null;
}
