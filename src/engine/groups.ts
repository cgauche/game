/**
 * Groupes d'appartenance d'un combattant (WFRP4, support des Traits psy ciblés — LDB 21).
 * Un combattant possède plusieurs mots-clés de Groupe, auto-dérivés de ses données (folder bestiaire,
 * espèce, carrière) + extras manuels (éditeur : « Sigmarite »…). Les Cibles des traits psy
 * (Animosité (Elfes), Haine (Skavens)…) sont mises en correspondance avec ces groupes. Pur.
 * Cf. spec : docs/superpowers/specs/2026-06-07-psychologie-design.md (§3).
 */
import { norm } from '../lib/normalize';
import { findCareerById } from '../data';

/** Folder bestiaire (`creatures.json`) → catégorie de Groupe. Règles ORDONNÉES (la plus spécifique
 *  d'abord : « hommes-bêtes » avant « bêtes »). Mot-clé normalisé cherché dans le folder normalisé. */
const FOLDER_RULES: { kw: string; group: string }[] = [
  { kw: 'peaux-vertes', group: 'Peau-Verte' },
  { kw: 'morts sans repos', group: 'Mort-vivant' },
  { kw: 'hommes-betes', group: 'Homme-bête' },
  { kw: 'hommes-rats', group: 'Skaven' },
  { kw: 'demon', group: 'Démon' }, // « Démons » et « Princes démons »
  { kw: 'cultistes', group: 'Cultiste' },
  { kw: 'betes', group: 'Bête' }, // après hommes-bêtes
];

/** Espèce (label data) → racial. La sous-espèce entre parenthèses est ignorée ; pluriel→singulier connu. */
const SPECIES_RACIAL: { kw: string; group: string }[] = [
  { kw: 'humain', group: 'Humain' },
  { kw: 'halfling', group: 'Halfling' },
  { kw: 'nain', group: 'Nain' },
  { kw: 'elfe', group: 'Elfe' },
  { kw: 'gnome', group: 'Gnome' },
  { kw: 'ogre', group: 'Ogre' },
];

/** Catégorie de Groupe d'un folder bestiaire : le `group` ÉDITABLE de la créature l'emporte sur la
 *  dérivation par table (overridable en donnée, cf. `CreatureData.group`). */
function categoryFromFolder(folder: string, override?: string | null): string | null {
  if (override) return override;
  const n = norm(folder);
  for (const r of FOLDER_RULES) if (n.includes(r.kw)) return r.group;
  return null;
}
/** Racial d'une espèce : le `group` ÉDITABLE de l'espèce l'emporte sur la dérivation par table
 *  (overridable en donnée, cf. `SpeciesData.group`). */
function racialFromSpecies(species: string, override?: string | null): string | null {
  if (override) return override;
  const n = norm(species);
  for (const r of SPECIES_RACIAL) if (n.includes(r.kw)) return r.group;
  return null;
}

/** Groupes d'appartenance d'un combattant (mots-clés multiples) : catégorie(folder) ∪ racial(espèce)
 *  ∪ carrière ∪ extras manuels. Dédupliqué (clé normalisée), ordre stable. `group` = surcharge
 *  ÉDITABLE en donnée (créature/espèce) ; les tables ci-dessus restent le DÉFAUT/fallback. */
export function groupsFor(src: { folder?: string | null; species?: string; careerId?: string; extras?: string[]; group?: string | null }): string[] {
  const out: string[] = [];
  const push = (g?: string | null) => {
    if (g && !out.some((x) => norm(x) === norm(g))) out.push(g);
  };
  if (src.folder) push(categoryFromFolder(src.folder, src.group));
  if (src.species) push(racialFromSpecies(src.species, src.group));
  if (src.careerId) {
    const career = findCareerById(src.careerId);
    push(career?.label ?? src.careerId); // jeton de Groupe = libellé de carrière (matché par `groupMatch`, tolérant)
    // Classe « Roublards » (la classe criminelle de la LDB — Hors-la-loi, Voleur, Receleur,
    // Pilleur de tombes, Charlatan, Sorcier dissident…) → Groupe « Criminel » (auto-dérivé,
    // consommé par Épée de justice / Traits psy ciblés). L'éditeur peut surcharger via les extras.
    if (career?.class === 'roublards') push('Criminel');
  }
  (src.extras ?? []).forEach(push);
  return out;
}

/** Radical en jetons normalisés : minuscules/sans accent, découpé sur espaces/tirets/apostrophes,
 *  chaque jeton dé-pluralisé (« s » final ôté). « Hommes-bêtes » → ['homme','bete']. */
function radicalTokens(s: string): string[] {
  return norm(s)
    .split(/[\s'-]+/)
    .filter(Boolean)
    .map((t) => t.replace(/[sx]$/, '')); // pluriel français : « s » ou « x » (peau→peaux, verte→vertes)
}

/** La Cible d'un trait psy (« Elfes », « Hommes-bêtes »…) correspond-elle à l'un des `groups` ?
 *  Match par **jetons** tolérant au pluriel : vrai si TOUS les jetons de la Cible sont présents dans
 *  ceux du groupe (donc « Elfes »→Elfe et « Hommes-bêtes »→Homme-bête matchent, et un radical court
 *  « Rat »/« Or » ne matche PLUS un mot non lié « Pirate »/« Sorcier »). Le raffinement de sous-type
 *  reste permis (« Elfe » ⊆ « Haut Elfe »). Comparaison purement normalisée. */
export function groupMatch(cible: string, groups: string[]): boolean {
  const c = radicalTokens(cible);
  if (!c.length) return false;
  return groups.some((g) => {
    const gt = radicalTokens(g);
    return c.every((ct) => gt.includes(ct));
  });
}
