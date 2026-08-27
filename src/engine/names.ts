/**
 * Génération de noms de personnage (Jalon 3) — pur, RNG injecté.
 *
 * Pools : `src/data/names.json` — banque de noms par race et par sexe (prénoms M/F + noms de
 * famille), reprise du projet WarhammerV2 de l'utilisateur. Gnomes et Ogres y retombent sur les
 * pools humains ; les elfes ont des épithètes en guise de nom (« Aiglenoir », « Lande de braises »).
 *
 * Cas NAIN : la banque n'a pas de noms de famille — le canon les GÉNÈRE depuis le parent
 * (LDB 05 l.620-624) : « Les noms de famille nains sont basés sur ceux des personnes qui les ont
 * élevés » avec suffixe sexué — « –sson » fils de…, « –snev » neveu de…, « –sdottir » fille de…,
 * « –sniz » nièce de… (ex. Ariksson, Grunnasdottir, Skagsnev, Sovrissniz).
 */
import { names as POOLS, type NamePool } from '../data';
import type { RaceKey } from '../data/schemas/grammaire/valeurs';
import type { RNG } from './dice';

/**
 * Pool de la banque ← `species.refChar` (`RaceKey`, #313) : `names.json` est keyé par CE même id
 * (#1467 L1b), l'indexation est directe — aucune conversion (cf. `names-species-keyspaces.test.ts`).
 */
function poolOf(refChar: RaceKey): NamePool | null {
  return POOLS[refChar] ?? null;
}

const pick = <T>(arr: T[], rng: RNG): T => arr[rng.int(0, arr.length - 1)];

/**
 * « Prénom Nom » aléatoire pour l'espèce et le sexe — null si l'espèce n'a pas de pool.
 * `refChar` = `RaceKey` porté par `species.refChar` (l'appelant a l'objet species).
 */
export function generateName(refChar: RaceKey, sex: 'M' | 'F', rng: RNG): string | null {
  const pool = poolOf(refChar);
  if (!pool) return null;
  const first = pick(sex === 'F' ? pool.femaleFirstNames : pool.maleFirstNames, rng);
  const suffixes = pool.lastNameSuffixes?.[sex];
  if (!pool.lastNames.length && suffixes?.length) {
    // Nain : patronyme « parent + suffixe sexué » (LDB 05 l.627-633, donnée). Parent mono-mot (lisibilité).
    const parents = [...pool.maleFirstNames, ...pool.femaleFirstNames].filter((p) => !p.includes(' '));
    return `${first} ${pick(parents, rng)}${pick(suffixes, rng)}`;
  }
  return `${first} ${pick(pool.lastNames, rng)}`;
}
