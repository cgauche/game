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
import NAMES from '../data/names.json';
import type { RNG } from './dice';

interface NamePool {
  maleFirstNames: string[];
  femaleFirstNames: string[];
  lastNames: string[];
}
const POOLS = NAMES as Record<string, NamePool>;

/** Suffixes de patronyme nain (LDB 05 l.622) — par sexe du PERSONNAGE. */
export const NAIN_SUFFIXES = { M: ['sson', 'snev'], F: ['sdottir', 'sniz'] } as const;

/** Pool de la banque ← libellé d'espèce du jeu (species.json, variantes régionales incluses). */
function poolOf(speciesLabel: string): NamePool | null {
  const s = speciesLabel.toLowerCase();
  if (s.startsWith('humains')) return POOLS['Humain'];
  if (s.startsWith('nains')) return POOLS['Nain'];
  if (s.startsWith('hauts elfes')) return POOLS['Haut Elfe'];
  if (s.startsWith('elfes sylvains')) return POOLS['Elfe Sylvain'];
  if (s.startsWith('halflings')) return POOLS['Halfling'];
  if (s.startsWith('gnomes')) return POOLS['Gnome'];
  if (s.startsWith('ogres')) return POOLS['Ogre'];
  return null;
}

const pick = <T>(arr: T[], rng: RNG): T => arr[rng.int(0, arr.length - 1)];

/** « Prénom Nom » aléatoire pour l'espèce et le sexe — null si l'espèce n'a pas de pool. */
export function generateName(speciesLabel: string, sex: 'M' | 'F', rng: RNG): string | null {
  const pool = poolOf(speciesLabel);
  if (!pool) return null;
  const first = pick(sex === 'F' ? pool.femaleFirstNames : pool.maleFirstNames, rng);
  if (!pool.lastNames.length) {
    // Nain : patronyme « parent + suffixe sexué » (LDB 05 l.622). Parent mono-mot (lisibilité).
    const parents = [...pool.maleFirstNames, ...pool.femaleFirstNames].filter((p) => !p.includes(' '));
    return `${first} ${pick(parents, rng)}${pick([...NAIN_SUFFIXES[sex]], rng)}`;
  }
  return `${first} ${pick(pool.lastNames, rng)}`;
}
