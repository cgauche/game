/**
 * Dispatcher PUR des Traits de créature (LDB 85) : normalise chaque chaîne de trait (« Démoniaque 8+ »,
 * « Toile 40 », « Immunité (Poison) ») en { clé canonique, Indice, argument }, puis expose des
 * helpers typés que spawn/combat/IA appellent au lieu de tester des chaînes en dur. Aucune mutation.
 * Même patron que `engine/qualities/dispatch.ts`.
 */
import type { CharKey, Combatant } from '../types';
import { TRAITS, TraitDef } from './registry';
import { parseStatEntry, type TraitInstance, type TraitList } from '../statEntry';
import { traitByLabel, traitById, type TraitCapabilities } from '../../data';
import { slugId } from '../../data/slug';
import type { PassiveMod } from '../ops';

/**
 * Libellés canoniques des traits HORS registre (donnée `traits.json`) : attaques naturelles (lues par
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
  // Marqueurs spéciaux consommés ailleurs (psychologie / magie / domaines / groupes / maladies)
  'Venin', 'Lanceur de Sorts', 'Mort-vivant', 'Frénésie', 'Constricteur', 'Vampirique',
  'Infecté', 'Maladie', 'Corruption', 'Rongeur',
];

/** Résolution UNIQUE libellé (casse ignorée) → `id` STABLE (slug) : dataset `traits.json` (qui est
 *  AUSSI la source de `TRAITS`) + libellés hors registre. Source unique de l'import label→id. */
const CANON_BY_LOWER = new Map<string, string>([
  ...[...traitByLabel.keys()].map((label) => [label.toLowerCase(), slugId(label)] as const),
  ...EXTRA_TRAIT_LABELS.map((label) => [label.toLowerCase(), slugId(label)] as const),
]);

/** Inverse : `id` → libellé FR canonique (affichage : inspecteur/Codex/éditeur). Même couverture. */
const LABEL_BY_ID = new Map<string, string>([
  ...[...traitByLabel.keys()].map((label) => [slugId(label), label] as const),
  ...EXTRA_TRAIT_LABELS.map((label) => [slugId(label), label] as const),
]);

/** Libellé FR d'un trait par son `id` (repli sur l'id si inconnu). */
export const traitLabelById = (id: string): string => LABEL_BY_ID.get(id) ?? id;

/** IMPORT (saisie éditeur / migration JSON) : chaîne de statbloc → trait STRUCTURÉ. La clé est
 *  canonicalisée sur le registre (« morsure » → « Morsure ») ; sinon le nom brut est conservé
 *  (« Arme », « À distance », « Griffes »). C'est le SEUL endroit qui parse — le runtime lit les champs. */
export function parseTraitInstance(raw: string): TraitInstance {
  const p = parseStatEntry(raw);
  const t: TraitInstance = { id: CANON_BY_LOWER.get(p.name.toLowerCase()) ?? slugId(p.name) };
  const value = p.bonus ?? p.indice;
  if (value != null) t.value = value;
  if (p.arg != null) t.arg = p.arg;
  if (p.count != null) t.count = p.count;
  if (p.range != null) t.range = p.range;
  return t;
}

/** Traits dont la valeur est un BONUS de Dégâts signé (« Morsure +9 », « À distance +8 ») — affichés
 *  « +N » et, pour les attaques typées, « Nom +N (Type) » (l'ordre du livre). Les autres traits à
 *  Indice gardent « Nom (Spec) N » (« Immunité (Poison) »), les sauvegardes « Nom N+ » (« Démoniaque 8+ »). */
const PLUS_DISPLAY = new Set([
  'Arme', 'À distance', 'Morsure', 'Attaque caudale', 'Cornes', 'Souffle', 'Vomissement',
  'Langue préhensile', 'Hurlement fantomatique', 'Regard pétrifiant', 'Tentacules', 'Étreinte glaciale',
].map(slugId));

/** Rendu lisible et FIDÈLE d'un trait structuré (inverse exact de `parseTraitInstance` pour l'affichage)
 *  — inspecteur / Codex / éditeur / libellé d'attaque. Restitue le signe « + » des Dégâts et le « + »
 *  de seuil des sauvegardes, sinon l'Indice nu. */
export function formatTrait(t: TraitInstance): string {
  const label = traitLabelById(t.id);
  const head = t.count != null ? `${t.count} ${label}` : label;
  const isAttack = PLUS_DISPLAY.has(t.id);
  const ward = !isAttack && !!traitById.get(t.id)?.capabilities?.wardSave;
  const val = t.value == null ? '' : isAttack ? ` +${t.value}` : ward ? ` ${t.value}+` : ` ${t.value}`;
  const arg = t.arg ? ` (${t.arg})` : '';
  const range = t.range != null ? ` (${t.range})` : '';
  // Attaques : « Nom +Dégâts (Type) [(portée)] » ; autres : « Nom (Spec) Indice ».
  return isAttack ? `${head}${val}${arg}${range}` : `${head}${arg}${val}${range}`;
}

/** `TraitList` → libellés affichables (UI/Codex/éditeur) : chaque `TraitInstance` formatée par
 *  `formatTrait` (inverse fidèle de `parseTraitInstance`). */
export const traitLabels = (traits: TraitList | undefined): string[] =>
  (traits ?? []).map(formatTrait);

export interface ParsedTrait {
  /** `id` STABLE du trait de registre (slug, « demoniaque »). */
  id: string;
  /** Indice numérique (« Démoniaque 8+ » → 8, « Vol 100 » → 100, « Toile 40 » → 40). */
  indice?: number;
  /** Argument entre parenthèses (« Immunité (Poison) » → « Poison »). */
  arg?: string;
}

/** Normalise une chaîne de trait via le parseur PARTAGÉ `parseStatEntry`, puis matche le trait du
 *  registre par `id` (casse ignorée). L'Indice = valeur non signée de fin (« Démoniaque 8+ », « Vol 100 »),
 *  sinon le bonus signé (« Arme +7 ») pour les traits d'attaque. */
export function parseTrait(raw: string): ParsedTrait | null {
  const p = parseStatEntry(raw);
  const id = CANON_BY_LOWER.get(p.name.toLowerCase());
  return id && TRAITS[id] ? { id, indice: p.indice ?? p.bonus, arg: p.arg } : null;
}

export interface ResolvedTrait {
  def: TraitDef;
  indice?: number;
  arg?: string;
}

/** Traits du registre présents sur la créature (`TraitInstance` structurés, zéro parsing). Traits hors
 *  registre (attaques naturelles, marqueurs) ignorés ici — ils ont leurs propres consommateurs. */
export function resolveTraits(traits: TraitList | undefined): ResolvedTrait[] {
  const out: ResolvedTrait[] = [];
  for (const t of traits ?? []) {
    const def = TRAITS[t.id];
    if (def) out.push({ def, indice: t.value, arg: t.arg });
  }
  return out;
}

/** La créature possède-t-elle le trait d'`id` donné ? (registre `defs/` UNIQUEMENT). */
export function hasTrait(traits: TraitList | undefined, id: string): boolean {
  return (traits ?? []).some((t) => t.id === id && !!TRAITS[id]);
}

/** La créature porte-t-elle un trait/attaque d'`id` donné (registre OU hors registre : Venin, Lanceur
 *  de Sorts, Cornes, Tentacules…) ? Comparaison d'`id` STRICTE — les `TraitInstance` sont déjà structurés. */
export function hasTraitKey(traits: TraitList | undefined, id: string): boolean {
  return (traits ?? []).some((t) => t.id === id);
}

// ── Profil dérivé au spawn (statblocks d'éditeur — LDB 77 « ajoutez les Traits ») ─────────────────
/** PassiveMod[] de PROFIL des traits — la DONNÉE éditable `TraitData.passive` (vocab GameOp unifié, éditée
 *  par GameOpEditor comme un sort). SOURCE UNIQUE des modificateurs de profil de trait, lue DIRECT par le
 *  collecteur passif (liveTraits). Éditer/créer un trait à modificateur de profil = de la donnée. */
export function traitPassiveMods(traits: TraitList | undefined): PassiveMod[] {
  const out: PassiveMod[] = [];
  for (const t of traits ?? []) {
    const ops = traitById.get(t.id)?.passive; // lecture PAR ID stable (≠ jointure par libellé)
    if (ops) for (const op of ops) out.push({ op, kind: 'intrinsèque' }); // le collecteur affecte le kind (≠ donnée)
  }
  return out;
}

/** Somme des `charMod` du passif (Élite/Coriace/Brutal…) — pour la base de `effectiveChar` (`baseWithTraits`)
 *  et les Blessures (`withTraitChars`). Extrait du vocab d'ops unifié. */
export function traitCharMods(traits: TraitList | undefined): Partial<Record<CharKey, number>> {
  const out: Partial<Record<CharKey, number>> = {};
  for (const m of traitPassiveMods(traits)) if (m.op.op === 'charMod') out[m.op.char] = (out[m.op.char] ?? 0) + m.op.mod;
  return out;
}

/** Somme des `moveMod` du passif (Brutal −1, Rapide +1). */
export function traitMovementMod(traits: TraitList | undefined): number {
  return traitPassiveMods(traits).reduce((s, m) => s + (m.op.op === 'moveMod' ? m.op.mod : 0), 0);
}

/** La créature a-t-elle la CAPACITÉ booléenne `cap` (drapeau de `TraitData.capabilities`, lu PAR ID) ?
 *  SOURCE UNIQUE des helpers de capacité (bestial/stupide/rage/…). Le seuil/type éventuel (Démoniaque 8+,
 *  Immunité (Poison)) vient de l'INDICE/arg de l'INSTANCE, lu par les helpers dédiés (wardSaves, etc.). */
export function traitCapability(traits: TraitList | undefined, cap: keyof TraitCapabilities): boolean {
  const list = traits ?? [];
  // Suppression GÉNÉRIQUE (Dressé (Dompté) « ignore son Trait Bestial », LDB 85 l.85) : un trait porté
  // peut annuler la capacité d'un AUTRE trait du même porteur — aucun code par-nom de discipline.
  if (list.some((t) => traitById.get(t.id)?.suppressesCapabilities?.includes(cap))) return false;
  return list.some((t) => !!traitById.get(t.id)?.capabilities?.[cap]);
}

/** Endurant (LDB 85 p.339) : +Bonus d'Endurance Blessures. */
export function traitBonusWoundsBE(traits: TraitList | undefined): boolean {
  return traitCapability(traits, 'bonusWoundsBE');
}

/** Mutation / Corruption mentale (LDB 85) : mutations à appliquer au spawn. `mutationId` = mutation
 *  EXPLICITE figée (l'argument d'auteur « Mutation (Cornes asymétriques) » est résolu en id stable via
 *  `slugId` — runtime 100% id) ; absent = tirage sur le Tableau `kind`. */
export function mutationsAtSpawn(traits: TraitList | undefined): { kind: 'physique' | 'mentale'; mutationId?: string }[] {
  return (traits ?? [])
    .filter((t) => traitById.get(t.id)?.capabilities?.mutationAtSpawn)
    .map((t) => ({ kind: traitById.get(t.id)!.capabilities!.mutationAtSpawn!, mutationId: t.arg ? slugId(t.arg) : undefined }));
}

// ── Mathématique de combat ────────────────────────────────────────────────────────────────────────
/** Sauvegardes « 1d10 ≥ Indice → coup ignoré » (Démoniaque 8+, Protection N). Liste des seuils. */
export function wardSaves(traits: TraitList | undefined): number[] {
  return (traits ?? []).filter((t) => traitById.get(t.id)?.capabilities?.wardSave && t.value != null).map((t) => t.value!);
}

// Défense du champion (LDB 85) : capacité GÉNÉRIQUE `counterOnDefenseWin` (traits ET talents), lue par
// `canCounterOnDefenseWin` (combatFeatures/dispatch) — plus de prédicat par-nom `hasChampionDefense`.


/** Perturbant (LDB 85 p.341) : aura de −20 aux Tests à Bonus d'Endurance mètres. */
export function hasPerturbingAura(traits: TraitList | undefined): boolean {
  return traitCapability(traits, 'perturbingAura');
}

/** Résistance à la Magie (Indice) : réduction du DR des Sorts (défaut 1 si l'Indice manque). */
export function magicResistanceOf(traits: TraitList | undefined): number {
  const t = (traits ?? []).find((t) => traitById.get(t.id)?.capabilities?.magicResistance);
  return t ? t.value ?? 1 : 0;
}

/** Immunité (Type) : types de Dégâts totalement ignorés (en minuscules). */
export function immunityTypes(traits: TraitList | undefined): string[] {
  return (traits ?? []).filter((t) => traitById.get(t.id)?.capabilities?.damageImmunity && t.arg).map((t) => t.arg!.toLowerCase());
}

/** Instable (LDB 85 p.340). */
export function isUnstable(traits: TraitList | undefined): boolean {
  return traitCapability(traits, 'unstable');
}

/** Insensible à la douleur (LDB 85 p.340) : pénalités de Critiques (hors amputations) ignorées. */
export function isPainless(traits: TraitList | undefined): boolean {
  return traitCapability(traits, 'painless');
}


// ── Psychologie / IA ──────────────────────────────────────────────────────────────────────────────
/** Belliqueux (LDB 85 p.338) : immunité psy si plus d'Avantages que `foesMaxAdvantage`. */
export function bellicosePsychImmune(c: Pick<Combatant, 'traits' | 'advantage'>, foesMaxAdvantage: number): boolean {
  return traitCapability(c.traits, 'psychImmuneIfAhead') && (c.advantage ?? 0) > foesMaxAdvantage;
}

/** Fabriqué (LDB 85 p.339) : pas d'Int/FM/Soc → Tests psychologiques auto-réussis. */
export function isMindless(traits: TraitList | undefined): boolean {
  return traitCapability(traits, 'mindless');
}

/** Bestial (LDB 85 p.338). */
export function isBestial(traits: TraitList | undefined): boolean {
  return traitCapability(traits, 'bestial');
}

/** À sang-froid (LDB 85 p.338) : peut inverser ses Tests de FM échoués. */
export function isColdBlooded(traits: TraitList | undefined): boolean {
  return traitCapability(traits, 'coldBlooded');
}

/** Stupide (LDB 85 p.341). */
export function isStupid(traits: TraitList | undefined): boolean {
  return traitCapability(traits, 'stupid');
}

/** Rage (LDB 85 p.341). */
export function hasRage(traits: TraitList | undefined): boolean {
  return traitCapability(traits, 'rage');
}

/** Territorial (LDB 85 p.343) : annule la fuite de Bestial (combat jusqu'à la mort). */
export function isTerritorial(traits: TraitList | undefined): boolean {
  return traitCapability(traits, 'territorial');
}

/** Monture ombrageuse (Nerveux, LDB 14 l.221) : MONTÉE, ne prend pas sa propre Action d'attaque. */
export function isSkittishMount(traits: TraitList | undefined): boolean {
  return traitCapability(traits, 'skittishMount');
}

// ── Mouvement & vision ────────────────────────────────────────────────────────────────────────────
/** Vol (Indice) : distance de vol en MÈTRES, ou null. */
export function flyMeters(traits: TraitList | undefined): number | null {
  const t = (traits ?? []).find((t) => traitById.get(t.id)?.capabilities?.fly);
  return t ? t.value ?? 0 : null;
}

/** Bond (LDB 85 p.338) : Charge/Course ×2 (et ignore les obstacles traversés). */
export function hasLeap(traits: TraitList | undefined): boolean {
  return (traits ?? []).some((t) => !!traitById.get(t.id)?.capabilities?.leap);
}

/** Nuée / Essaim (LDB 85) : SOURCE UNIQUE de la détection d'amas — pilote le gabarit « swarm » et le
 *  build ×5 PB. Remplace les regex `/^Nu[eé]e\b/i` éparpillées (rendu/classification/spawn). */
export function isSwarm(traits: TraitList | undefined): boolean {
  return traitCapability(traits, 'swarm');
}

/** Foulée (LDB 85 p.339) : Course ×1,5. */
export function hasStride(traits: TraitList | undefined): boolean {
  return (traits ?? []).some((t) => !!traitById.get(t.id)?.capabilities?.stride);
}

/** Multiplicateur de Mouvement de COURSE/CHARGE dû aux traits : Bond ×2 (prioritaire), Foulée ×1,5. */
export function runMultiplier(traits: TraitList | undefined): number {
  if (hasLeap(traits)) return 2;
  if (hasStride(traits)) return 1.5;
  return 1;
}

/** Vision nocturne / Infravision : voit dans l'obscurité (annule la pénalité d'obscurité). */
export function traitSeesInDark(traits: TraitList | undefined): boolean {
  return (traits ?? []).some((t) => !!traitById.get(t.id)?.capabilities?.seesInDark);
}
