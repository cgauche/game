/**
 * Groupes d'appartenance d'un combattant (WFRP4, support des Traits psy ciblés — LDB 21).
 * Un combattant possède plusieurs IDS de Groupe STABLES (jamais traduits, cf. `src/data/groups.json`),
 * auto-dérivés de ses données (folder bestiaire, espèce, carrière, traits) + extras manuels (éditeur :
 * déjà des ids). Les Cibles des traits psy (Animosité (Elfes), Haine (Skavens)…) sont normalisées en id
 * de Groupe (cf. `psych/registry.ts`) et mises en correspondance avec ces ids. Pur.
 * Cf. spec : docs/superpowers/specs/2026-06-07-psychologie-design.md (§3).
 */
import { norm } from '../lib/normalize';
import { findCareerById } from '../data';

/** Folder bestiaire (`creatures.json`) → id de Groupe. Règles ORDONNÉES (la plus spécifique
 *  d'abord : « hommes-bêtes » avant « bêtes »). Mot-clé normalisé (AUTHORING) cherché dans le folder
 *  normalisé — c'est la RÉSOLUTION, pas la valeur émise (l'id, lui, est stable). */
const FOLDER_RULES: { kw: string; group: string }[] = [
  { kw: 'peaux-vertes', group: 'peau-verte' },
  { kw: 'morts sans repos', group: 'mort-vivant' },
  { kw: 'hommes-betes', group: 'homme-bete' },
  { kw: 'hommes-rats', group: 'skaven' },
  { kw: 'demon', group: 'demon' }, // « Démons » et « Princes démons »
  { kw: 'cultistes', group: 'cultiste' },
  { kw: 'betes', group: 'bete' }, // après hommes-bêtes
];

/** Espèce (label data) → id racial. La sous-espèce entre parenthèses est ignorée. */
const SPECIES_RACIAL: { kw: string; group: string }[] = [
  { kw: 'humain', group: 'humain' },
  { kw: 'halfling', group: 'halfling' },
  { kw: 'nain', group: 'nain' },
  { kw: 'elfe', group: 'elfe' },
  { kw: 'gnome', group: 'gnome' },
  { kw: 'ogre', group: 'ogre' },
];

/** Sous-espèce (label data) → id de Groupe ADDITIONNEL, ÉMIS EN PLUS du racial déjà poussé par
 *  `SPECIES_RACIAL` (aplatit la hiérarchie : un Tiléen est à la fois « humain » ET « tileen »).
 *  Elfe noir/Teutogen n'ont pas de `species` correspondante dans la donnée (pas de règle ici) —
 *  leur id de Groupe existe dans `groups.json` pour l'éditeur (surcharge manuelle `group`/`extras`). */
const SUBSPECIES_RULES: { kw: string; group: string }[] = [{ kw: 'tileen', group: 'tileen' }];

/** Culte (spec du Talent « Béni », LDB 40 — `TalentInstance.spec` = clé `GodData.key`) → id de Groupe
 *  religieux (Traits psy ciblés « Ulricains », et comble le trou Phase 2 : « sigmarite » n'était dérivé
 *  d'AUCUNE donnée). Seuls les 2 cultes consommés par une Cible de Trait psy existante ont un Groupe —
 *  un autre culte Béni (Manann, Morr…) ne pousse rien (YAGNI : aucune Cible ne les référence). */
const CULT_GROUP_RULES: Record<string, string> = {
  sigmar: 'sigmarite',
  ulric: 'ulricain',
};

/** Trait (`TraitInstance.id`) → id de Groupe. Unifie la dérivation avec `domainAttributes` (isUndead/
 *  isDaemon) : une créature SANS folder mais porteuse du Trait est quand même du Groupe (ex. statbloc
 *  d'éditeur « Mort-vivant » sans catégorie bestiaire). */
const TRAIT_RULES: { traitId: string; group: string }[] = [
  { traitId: 'mort-vivant', group: 'mort-vivant' },
  { traitId: 'demoniaque', group: 'demon' },
];

/** Classe de carrière (`CareerData.class`) → id de Groupe. Roublards (Hors-la-loi, Voleur, Receleur,
 *  Pilleur de tombes, Charlatan, Sorcier dissident, Entremetteur, Rançonneur) = la classe criminelle
 *  de la LDB → Groupe « Criminel » (consommé par Épée de justice / Traits psy ciblés). */
const CLASS_RULES: Record<string, string> = {
  roublards: 'criminel',
};

/** Carrière (`CareerData.id`) → id de Groupe précis (Traits psy ciblés / doctrine IA). Soldat/Garde/
 *  Chevalier sont les 3 carrières martiales organisées (PAS toute la classe « guerriers », trop large :
 *  Cavalier/Gladiateur/Archer/Tueur… n'en font pas partie) ; Bailli/Juriste/Noble sont les cibles de
 *  Préjugé/Animosité recensées dans le bestiaire (« Baillis, Juristes », « Les riches »). */
const CAREER_RULES: Record<string, string> = {
  soldat: 'soldat',
  garde: 'garde',
  chevalier: 'chevalier',
  bailli: 'bailli',
  juriste: 'juriste',
  noble: 'noble',
};

/** Id de Groupe d'un folder bestiaire : le `group` ÉDITABLE de la créature (déjà un id) l'emporte sur
 *  la dérivation par table (overridable en donnée, cf. `CreatureData.group`). */
function categoryFromFolder(folder: string, override?: string | null): string | null {
  if (override) return override;
  const n = norm(folder);
  for (const r of FOLDER_RULES) if (n.includes(r.kw)) return r.group;
  return null;
}
/** Id racial d'une espèce : le `group` ÉDITABLE de l'espèce (déjà un id) l'emporte sur la dérivation
 *  par table (overridable en donnée, cf. `SpeciesData.group`). */
function racialFromSpecies(species: string, override?: string | null): string | null {
  if (override) return override;
  const n = norm(species);
  for (const r of SPECIES_RACIAL) if (n.includes(r.kw)) return r.group;
  return null;
}

/** Ids de Groupe d'appartenance d'un combattant : catégorie(folder) ∪ racial(espèce) ∪ sous-espèce ∪
 *  trait(s) ∪ classe/carrière ∪ religieux(Talent Béni) ∪ `group` (surcharge éditable, déjà un id) ∪
 *  extras manuels (déjà des ids). Dédupliqué par id EXACT, ordre stable. */
export function groupsFor(src: {
  folder?: string | null;
  species?: string;
  careerId?: string;
  traits?: { id: string }[];
  talents?: { talentId: string; spec?: string }[];
  extras?: string[];
  group?: string | null;
}): string[] {
  const out: string[] = [];
  const push = (g?: string | null) => {
    if (g && !out.includes(g)) out.push(g);
  };
  if (src.folder) push(categoryFromFolder(src.folder, src.group));
  if (src.species) {
    push(racialFromSpecies(src.species, src.group));
    const n = norm(src.species);
    for (const r of SUBSPECIES_RULES) if (n.includes(r.kw)) push(r.group);
  }
  for (const t of src.traits ?? []) {
    const rule = TRAIT_RULES.find((r) => r.traitId === t.id);
    if (rule) push(rule.group);
  }
  if (src.careerId) {
    push(CAREER_RULES[src.careerId]);
    const career = findCareerById(src.careerId);
    if (career?.class) push(CLASS_RULES[career.class]);
  }
  for (const t of src.talents ?? []) {
    if (t.talentId === 'beni' && t.spec) push(CULT_GROUP_RULES[norm(t.spec)]);
  }
  (src.extras ?? []).forEach(push);
  return out;
}

/** La Cible d'un Trait psy (déjà un id de Groupe, cf. `psych/registry.ts`) correspond-elle à l'un des
 *  `groups` (ids) du combattant ? Appartenance STRICTE par id — plus de tolérance de pluriel/casse. Un
 *  sous-type sans Groupe dédié dans `groups.json` (ex. « Menteurs, trompeurs, sophistes ») reste INERTE
 *  plutôt que de dériver un sous-groupe inventé (YAGNI). Deux cibles SPÉCIALES (`groups.json` : `tout`/
 *  `vivant`) sont des wildcards résolus ICI plutôt que dans les `groups` d'un combattant particulier :
 *  `tout` = n'importe qui (Animosité « toutes les créatures !!! ») ; `vivant` = tout sauf Mort-vivant/
 *  Démon (Haine des vampires envers « les Êtres Vivants »). */
export function groupMatch(cibleId: string, groupIds: string[]): boolean {
  if (cibleId === 'tout') return true;
  if (cibleId === 'vivant') return !groupIds.includes('mort-vivant') && !groupIds.includes('demon');
  return groupIds.includes(cibleId);
}
