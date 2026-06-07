/**
 * Groupes d'appartenance d'un combattant (WFRP4, support des Traits psy ciblés — LDB 21).
 * Un combattant possède plusieurs mots-clés de Groupe, auto-dérivés de ses données (folder bestiaire,
 * espèce, carrière) + extras manuels (éditeur : « Sigmarite »…). Les Cibles des traits psy
 * (Animosité (Elfes), Haine (Skavens)…) sont mises en correspondance avec ces groupes. Pur.
 * Cf. spec : docs/superpowers/specs/2026-06-07-psychologie-design.md (§3).
 */
import { norm } from '../lib/normalize';

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

function categoryFromFolder(folder: string): string | null {
  const n = norm(folder);
  for (const r of FOLDER_RULES) if (n.includes(r.kw)) return r.group;
  return null;
}
function racialFromSpecies(species: string): string | null {
  const n = norm(species);
  for (const r of SPECIES_RACIAL) if (n.includes(r.kw)) return r.group;
  return null;
}

/** Groupes d'appartenance d'un combattant (mots-clés multiples) : catégorie(folder) ∪ racial(espèce)
 *  ∪ carrière ∪ extras manuels. Dédupliqué (clé normalisée), ordre stable. */
export function groupsFor(src: { folder?: string | null; species?: string; career?: string; extras?: string[] }): string[] {
  const out: string[] = [];
  const push = (g?: string | null) => {
    if (g && !out.some((x) => norm(x) === norm(g))) out.push(g);
  };
  if (src.folder) push(categoryFromFolder(src.folder));
  if (src.species) push(racialFromSpecies(src.species));
  if (src.career) push(src.career);
  (src.extras ?? []).forEach(push);
  return out;
}

/** La Cible d'un trait psy (« Elfes », « Mort-vivant »…) correspond-elle à l'un des `groups` ? Comparaison
 *  normalisée + tolérance pluriel (« Elfes » ⟺ « Elfe ») : radical (pluriel ôté) comparé dans les deux sens. */
export function groupMatch(cible: string, groups: string[]): boolean {
  const c = norm(cible).replace(/s$/, '');
  if (!c) return false;
  return groups.some((g) => {
    const n = norm(g).replace(/s$/, '');
    return n === c || n.includes(c) || c.includes(n);
  });
}
