/**
 * Ids de sort FUSIONNÉS (#1897) : une entrée du livre fan `frenchy-bzh` qui doublait un sort déjà au
 * catalogue n'existe plus, son id désigne désormais l'entrée qui l'a absorbée (doctrine « une entité,
 * N livres » : `.claude/memory/game-doctrine-une-entite-n-livres-n-variantes.md`). SOURCE UNIQUE de la
 * correspondance, lue par la migration de donnée
 * (`scripts/migrations/2026-09-23-1897-sorts-fan-par-le-pont.mjs`) et par les migrations de chargement
 * des documents PORTABLES (`ROSTER_MIGRATIONS`, `src/state/roster.ts` ; `PROJECT_MIGRATIONS`,
 * `src/state/worldMap.ts`). Module PUR, sans import : chargé tel quel par Node nu.
 */
export const SORTS_FUSIONNES: Readonly<Record<string, string>> = Object.freeze({
  'alarme': 'alerte',
  'ame-devoilee': 'percevoir-l-echeveau',
  'apaisement': 'baume-pour-un-esprit-blesse',
  'appel-de-vanhel': 'l-appel-de-vanhel',
  'arriere-sorciere': 'n-ecoutez-point-la-sorciere',
  'belier': 'poussee',
  'bienveillance': 'bonne-volonte',
  'bouclier': 'bouclier-anti-fleches',
  'bruit': 'bruits',
  'chaleur-de-la-fourrure': 'peau-de-loup-d-hiver',
  'chuchotis': 'murmures',
  'conserve': 'conservation',
  'courant-d-air': 'coup-de-vent',
  'eau-pure': 'purification-de-l-eau',
  'entrave': 'enchevetrement',
  'espionnage': 'tendre-l-oreille',
  'esprit-enfievre': 'feu-spirituel',
  'explosion-de-dhar': 'explosion-de-corruption',
  'fatigue': 'drain',
  'fers-de': 'entraves-a-la-verite',
  'feu-follet': 'feux-follets',
  'flamme': 'flamme-magique',
  'flammes-bleues-de-tzeentch': 'feu-bleu-de-tzeentch',
  'flammes-roses-de-tzeentch': 'feu-rose-de-tzeentch',
  'instinct-animal': 'instincts-animaux',
  'introspection': 'consentement',
  'justice': 'benediction-de-droiture',
  'la-verite-finit-toujours-par-sortir': 'la-verite-eclatera',
  'langue-des-pestigors': 'langue-des-gors',
  'langue-des-slaangors': 'langue-des-gors',
  'langue-des-tzaangors': 'langue-des-gors',
  'main-de-rhya': 'caresse-de-rhya',
  'marteau-de-justice': 'marteau-ardent-de-sigmar',
  'modele-de-vertu': 'flambeau-de-vertu',
  'morsure-d-hiver': 'morsure-de-l-hiver',
  'nuee': 'menace-rampante',
  'oeil-de-lynx': 'yeux-de-chat',
  'pied-leger': 'pas-leger',
  'position': 'reperes',
  'pourriture': 'putrefaction',
  'projectile': 'carreau',
  'projectile-de-dhar': 'decharge-de-corruption',
  'projectile-mineur': 'flechette',
  'rapidite': 'benediction-de-vivacite',
  'resistance-du-penitent': 'endurance-de-l-anachorete',
  'robustesse': 'benediction-de-vigueur',
  'ruine': 'degradation',
  'saccade': 'secousse',
  'sagesse-du-hibou': 'sagesse-de-la-chouette',
  'saut-de-cabri': 'bondissant-comme-un-cerf',
  'soins': 'benediction-de-guerison',
  'sus-a-l-ennemi': 'vaincre-les-impies',
  'telekinesie': 'deplacement-d-objet',
  'verena-m-est-temoin': 'verena-est-mon-temoin',
});

/** L'id qui désigne aujourd'hui le sort `id` : l'entrée absorbante d'un id fusionné, sinon `id`. */
export const idDeSortVivant = (id: string): string => SORTS_FUSIONNES[id] ?? id;

/** Clés dont la valeur est une LISTE d'ids de sort (`refs('spell')`) : `spells` (profil de créature,
 *  statbloc, combat de scène, héros) et `spellIds` (portée d'un modificateur de NI). */
const LISTES_DE_SORTS = new Set(['spells', 'spellIds']);
/** Effets d'auteur dont UN champ est un id de sort (`idDe('spell')`, `defs-scenes/effets.ts`). */
const CHAMP_DE_SORT_DE_L_EFFET: Readonly<Record<string, string>> = { learnSpell: 'spell', castSpell: 'spellId' };

const estListeDeChaines = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/**
 * Réécrit récursivement tout id FUSIONNÉ d'un document persisté vers l'id qui l'a absorbé, aux seules
 * places de référence de sort, reconnues par leur FORME : une liste de chaînes sous `spells`/`spellIds`
 * (dédoublonnée, ordre gardé : deux fusionnés vers le même sort n'en font qu'un), le champ de sort d'un
 * effet `learnSpell`/`castSpell`. Toute autre chaîne traverse INTACTE (`belier` reste une qualité).
 * IDEMPOTENT : un id vivant n'est jamais une clé de `SORTS_FUSIONNES`.
 */
export function remapSortsFusionnesDeep(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(remapSortsFusionnesDeep);
  if (!node || typeof node !== 'object') return node;
  const o = node as Record<string, unknown>;
  const champ = typeof o.type === 'string' ? CHAMP_DE_SORT_DE_L_EFFET[o.type] : undefined;
  return Object.fromEntries(Object.entries(o).map(([k, v]) => {
    if (LISTES_DE_SORTS.has(k) && estListeDeChaines(v)) return [k, [...new Set(v.map(idDeSortVivant))]];
    if (k === champ && typeof v === 'string') return [k, idDeSortVivant(v)];
    return [k, remapSortsFusionnesDeep(v)];
  }));
}
