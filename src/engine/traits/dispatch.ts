/**
 * Dispatcher PUR des Traits de créature (LDB 85) : normalise chaque chaîne de trait (« Démoniaque 8+ »,
 * « Toile 40 », « Immunité (Poison) ») en { clé canonique, Indice, argument }, puis expose des
 * helpers typés que spawn/combat/IA appellent au lieu de tester des chaînes en dur. Aucune mutation.
 * Même patron que `engine/qualities/dispatch.ts`.
 */
import type { CharKey, Combatant } from '../types';
import { TRAITS, TraitDef } from './registry';
import { parseStatEntry, type TraitInstance, type TraitList } from '../statEntry';

const KEY_BY_LOWER = new Map(Object.keys(TRAITS).map((k) => [k.toLowerCase(), k]));

/**
 * Libellés canoniques des traits HORS registre `defs/` : attaques naturelles (lues par
 * `creatureAttacks` / `spawn.weaponsFromTraits`) et marqueurs spéciaux (Venin, Lanceur de Sorts,
 * Mort-vivant, Frénésie…). On les canonicalise ICI pour que `t.key === 'X'` soit FIABLE en aval
 * malgré la casse hétérogène des livres (« Lanceur de sorts » → « Lanceur de Sorts »), au lieu de
 * regex dispersées chez chaque consommateur. Ajouter une attaque naturelle = ajouter son libellé ici
 * (et sa règle dans `creatureAttacks.RULES`). Doit rester aligné avec la liste de parité (parity.test).
 */
export const EXTRA_TRAIT_LABELS = [
  // Attaques naturelles (creatureAttacks.RULES + spawn.weaponsFromTraits)
  'Arme', 'À distance', 'Morsure', 'Attaque caudale', 'Cornes', 'Souffle', 'Vomissement',
  'Langue préhensile', 'Hurlement fantomatique', 'Regard pétrifiant', 'Tentacules', 'Étreinte glaciale',
  // Marqueurs spéciaux consommés ailleurs (psychologie / magie / domaines / groupes)
  'Venin', 'Lanceur de Sorts', 'Mort-vivant', 'Frénésie', 'Constricteur', 'Vampirique',
];

/** Canonicalisation UNIQUE des clés de trait : registre `defs/` + libellés hors registre, casse ignorée. */
const CANON_BY_LOWER = new Map<string, string>([
  ...Object.keys(TRAITS).map((k) => [k.toLowerCase(), k] as const),
  ...EXTRA_TRAIT_LABELS.map((k) => [k.toLowerCase(), k] as const),
]);

/** IMPORT (saisie éditeur / migration JSON) : chaîne de statbloc → trait STRUCTURÉ. La clé est
 *  canonicalisée sur le registre (« morsure » → « Morsure ») ; sinon le nom brut est conservé
 *  (« Arme », « À distance », « Griffes »). C'est le SEUL endroit qui parse — le runtime lit les champs. */
export function parseTraitInstance(raw: string): TraitInstance {
  const p = parseStatEntry(raw);
  const t: TraitInstance = { key: CANON_BY_LOWER.get(p.name.toLowerCase()) ?? p.name };
  const value = p.bonus ?? p.indice;
  if (value != null) t.value = value;
  if (p.arg != null) t.arg = p.arg;
  if (p.count != null) t.count = p.count;
  if (p.range != null) t.range = p.range;
  return t;
}

/** Rendu lisible d'un trait structuré (inverse de l'import) — inspecteur / Codex / éditeur. */
export function formatTrait(t: TraitInstance): string {
  let s = t.count != null ? `${t.count} ${t.key}` : t.key;
  if (t.arg) s += ` (${t.arg})`;
  if (t.value != null) s += ` ${t.value}`;
  if (t.range != null) s += ` (${t.range})`;
  return s;
}

/** Normalise un élément de `TraitList` en `TraitInstance` : chaîne (test/legacy) → parse UNE fois ;
 *  déjà structuré → renvoyé tel quel (aucun parsing au runtime). SEUL point d'entrée des consommateurs. */
export function asTrait(x: string | TraitInstance): TraitInstance {
  return typeof x === 'string' ? parseTraitInstance(x) : x;
}

export interface ParsedTrait {
  /** Clé canonique du registre (« Démoniaque »). */
  key: string;
  /** Indice numérique (« Démoniaque 8+ » → 8, « Vol 100 » → 100, « Toile 40 » → 40). */
  indice?: number;
  /** Argument entre parenthèses (« Immunité (Poison) » → « Poison »). */
  arg?: string;
}

/** Normalise une chaîne de trait via le parseur PARTAGÉ `parseStatEntry`, puis matche la clé du
 *  registre (casse ignorée). L'Indice = valeur non signée de fin (« Démoniaque 8+ », « Vol 100 »),
 *  sinon le bonus signé (« Arme +7 ») pour les traits d'attaque. */
export function parseTrait(raw: string): ParsedTrait | null {
  const p = parseStatEntry(raw);
  const key = KEY_BY_LOWER.get(p.name.toLowerCase());
  return key ? { key, indice: p.indice ?? p.bonus, arg: p.arg } : null;
}

export interface ResolvedTrait {
  def: TraitDef;
  indice?: number;
  arg?: string;
}

/** Traits du registre présents sur la créature (normalisés). Chaînes inconnues ignorées. */
export function resolveTraits(traits: string[] | undefined): ResolvedTrait[] {
  const out: ResolvedTrait[] = [];
  for (const raw of traits ?? []) {
    const p = parseTrait(raw);
    if (p) out.push({ def: TRAITS[p.key], indice: p.indice, arg: p.arg });
  }
  return out;
}

/** La créature possède-t-elle le trait canonique `key` ? (registre `defs/` UNIQUEMENT). */
export function hasTrait(traits: string[] | undefined, key: string): boolean {
  return resolveTraits(traits).some((r) => r.def.key === key);
}

/** La créature porte-t-elle un trait/attaque de clé canonique `key` (registre OU libellé hors registre :
 *  Venin, Lanceur de Sorts, Cornes, Tentacules…) ? Remplace les regex `/^x\b/i` dispersées : la
 *  canonicalisation a déjà eu lieu (`asTrait`), donc comparaison de clé STRICTE — plus de parsing ad hoc. */
export function hasTraitKey(traits: TraitList | undefined, key: string): boolean {
  return (traits ?? []).some((x) => asTrait(x).key === key);
}

const first = (traits: string[] | undefined, pred: (d: TraitDef) => boolean): ResolvedTrait | undefined =>
  resolveTraits(traits).find((r) => pred(r.def));

// ── Profil dérivé au spawn (statblocks d'éditeur — LDB 77 « ajoutez les Traits ») ─────────────────
/** Somme des modificateurs de Caractéristiques des traits (Élite, Coriace, Brutal…). */
export function traitCharMods(traits: string[] | undefined): Partial<Record<CharKey, number>> {
  const out: Partial<Record<CharKey, number>> = {};
  for (const { def } of resolveTraits(traits))
    for (const [k, v] of Object.entries(def.charMods ?? {})) out[k as CharKey] = (out[k as CharKey] ?? 0) + (v ?? 0);
  return out;
}

/** Somme des modificateurs de Mouvement (Brutal −1, Rapide +1). */
export function traitMovementMod(traits: string[] | undefined): number {
  return resolveTraits(traits).reduce((s, r) => s + (r.def.movement ?? 0), 0);
}

/** Endurant (LDB 85 p.339) : +Bonus d'Endurance Blessures. */
export function traitBonusWoundsBE(traits: string[] | undefined): boolean {
  return resolveTraits(traits).some((r) => r.def.bonusWoundsBE);
}

/** Mutation / Corruption mentale (LDB 85) : mutations à appliquer au spawn. `label` (argument du
 *  trait, « Mutation (Cornes asymétriques) ») = mutation EXPLICITE figée ; absent = tirage sur le
 *  Tableau `kind`. */
export function mutationsAtSpawn(traits: string[] | undefined): { kind: 'physique' | 'mentale'; label?: string }[] {
  return resolveTraits(traits)
    .filter((r) => r.def.mutationAtSpawn)
    .map((r) => ({ kind: r.def.mutationAtSpawn!, label: r.arg }));
}

// ── Mathématique de combat ────────────────────────────────────────────────────────────────────────
/** Sauvegardes « 1d10 ≥ Indice → coup ignoré » (Démoniaque 8+, Protection N). Liste des seuils. */
export function wardSaves(traits: string[] | undefined): number[] {
  return resolveTraits(traits)
    .filter((r) => r.def.wardSave && r.indice != null)
    .map((r) => r.indice!);
}

/** Les attaques de la créature sont-elles MAGIQUES (Démoniaque/Magique/Fabriqué) ? */
export function attacksAreMagical(c: Pick<Combatant, 'traits'>): boolean {
  return resolveTraits(c.traits).some((r) => r.def.magicalAttacks);
}

/** Éthéré (LDB 85 p.339) : blessée uniquement par les Attaques magiques. */
export function isEtherial(c: Pick<Combatant, 'traits'>): boolean {
  return resolveTraits(c.traits).some((r) => r.def.etherial);
}

/** Démoniaque : à 0 PB, retirée du jeu (bannie vers les Royaumes du Chaos). */
export function banishedAtZero(traits: string[] | undefined): boolean {
  return resolveTraits(traits).some((r) => r.def.banishedAtZero);
}

/** Champion (LDB 85 p.338) : Dégâts en gagnant un Test opposé en défense de mêlée. */
export function hasChampionDefense(traits: string[] | undefined): boolean {
  return resolveTraits(traits).some((r) => r.def.championDefense);
}

/** Parasité (LDB 85 p.340) : pénalité pour toucher la créature en Corps à corps (−10), sinon 0. */
export function meleeHitPenalty(traits: string[] | undefined): number {
  return resolveTraits(traits).reduce((s, r) => s + (r.def.meleeHitPenalty ?? 0), 0);
}

/** Perturbant (LDB 85 p.341) : aura de −20 aux Tests à Bonus d'Endurance mètres. */
export function hasPerturbingAura(traits: string[] | undefined): boolean {
  return resolveTraits(traits).some((r) => r.def.perturbingAura);
}

/** Sang corrosif (LDB 85 p.341). */
export function hasCorrosiveBlood(traits: string[] | undefined): boolean {
  return resolveTraits(traits).some((r) => r.def.corrosiveBlood);
}

/** Toile (Indice) : Force de l'Empêtré infligé sur toute touche, ou null. */
export function webForce(traits: string[] | undefined): number | null {
  const r = first(traits, (d) => !!d.webOnHit);
  return r ? r.indice ?? 0 : null;
}

/** Résistance à la Magie (Indice) : réduction du DR des Sorts (défaut 1 si l'Indice manque). */
export function magicResistanceOf(traits: string[] | undefined): number {
  const r = first(traits, (d) => !!d.magicResistance);
  return r ? r.indice ?? 1 : 0;
}

/** Immunité (Type) : types de Dégâts totalement ignorés (en minuscules). */
export function immunityTypes(traits: string[] | undefined): string[] {
  return resolveTraits(traits)
    .filter((r) => r.def.damageImmunity && r.arg)
    .map((r) => r.arg!.toLowerCase());
}

/** Instable (LDB 85 p.340). */
export function isUnstable(traits: string[] | undefined): boolean {
  return resolveTraits(traits).some((r) => r.def.unstable);
}

/** Insensible à la douleur (LDB 85 p.340) : pénalités de Critiques (hors amputations) ignorées. */
export function isPainless(traits: string[] | undefined): boolean {
  return resolveTraits(traits).some((r) => r.def.painless);
}

/** Régénération (LDB 85 p.341). */
export function regenerates(traits: string[] | undefined): boolean {
  return resolveTraits(traits).some((r) => r.def.regenerates);
}

// ── Psychologie / IA ──────────────────────────────────────────────────────────────────────────────
/** Belliqueux (LDB 85 p.338) : immunité psy si plus d'Avantages que `foesMaxAdvantage`. */
export function bellicosePsychImmune(c: Pick<Combatant, 'traits' | 'advantage'>, foesMaxAdvantage: number): boolean {
  return resolveTraits(c.traits).some((r) => r.def.psychImmuneIfAhead) && (c.advantage ?? 0) > foesMaxAdvantage;
}

/** Fabriqué (LDB 85 p.339) : pas d'Int/FM/Soc → Tests psychologiques auto-réussis. */
export function isMindless(traits: string[] | undefined): boolean {
  return resolveTraits(traits).some((r) => r.def.mindless);
}

/** Bestial (LDB 85 p.338). */
export function isBestial(traits: string[] | undefined): boolean {
  return resolveTraits(traits).some((r) => r.def.bestial);
}

/** À sang-froid (LDB 85 p.338) : peut inverser ses Tests de FM échoués. */
export function isColdBlooded(traits: string[] | undefined): boolean {
  return resolveTraits(traits).some((r) => r.def.coldBlooded);
}

/** Affamé (LDB 85 p.338). */
export function gorgesOnKill(traits: string[] | undefined): boolean {
  return resolveTraits(traits).some((r) => r.def.gorgesOnKill);
}

/** Stupide (LDB 85 p.341). */
export function isStupid(traits: string[] | undefined): boolean {
  return resolveTraits(traits).some((r) => r.def.stupid);
}

/** Rage (LDB 85 p.341). */
export function hasRage(traits: string[] | undefined): boolean {
  return resolveTraits(traits).some((r) => r.def.rage);
}

/** Nerveux (LDB 85 p.340) : magie/bruits forts → +3 Brisé. */
export function isNervous(traits: string[] | undefined): boolean {
  return resolveTraits(traits).some((r) => r.def.nervous);
}

/** Territorial (LDB 85 p.343) : annule la fuite de Bestial (combat jusqu'à la mort). */
export function isTerritorial(traits: string[] | undefined): boolean {
  return resolveTraits(traits).some((r) => r.def.territorial);
}

// ── Mouvement & vision ────────────────────────────────────────────────────────────────────────────
/** Vol (Indice) : distance de vol en MÈTRES, ou null. */
export function flyMeters(traits: string[] | undefined): number | null {
  const r = first(traits, (d) => !!d.fly);
  return r ? r.indice ?? 0 : null;
}

/** Bond (LDB 85 p.338) : Charge/Course ×2 (et ignore les obstacles traversés). */
export function hasLeap(traits: string[] | undefined): boolean {
  return resolveTraits(traits).some((r) => r.def.leap);
}

/** Nuée / Essaim (LDB 85) : SOURCE UNIQUE de la détection d'amas — pilote le gabarit « swarm » et le
 *  build ×5 PB. Remplace les regex `/^Nu[eé]e\b/i` éparpillées (rendu/classification/spawn). */
export function isSwarm(traits: string[] | undefined): boolean {
  return resolveTraits(traits).some((r) => r.def.swarm);
}

/** Foulée (LDB 85 p.339) : Course ×1,5. */
export function hasStride(traits: string[] | undefined): boolean {
  return resolveTraits(traits).some((r) => r.def.stride);
}

/** Multiplicateur de Mouvement de COURSE/CHARGE dû aux traits : Bond ×2 (prioritaire), Foulée ×1,5. */
export function runMultiplier(traits: string[] | undefined): number {
  if (hasLeap(traits)) return 2;
  if (hasStride(traits)) return 1.5;
  return 1;
}

/** Vision nocturne / Infravision : voit dans l'obscurité (annule la pénalité d'obscurité). */
export function traitSeesInDark(traits: string[] | undefined): boolean {
  return resolveTraits(traits).some((r) => r.def.seesInDark);
}

/** Furtif (LDB 85 p.339) : +Bonus d'Agilité au DR des Tests de Discrétion. */
export function hasStealthAgBonus(traits: string[] | undefined): boolean {
  return resolveTraits(traits).some((r) => r.def.stealthAgBonus);
}
