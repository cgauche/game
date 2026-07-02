/**
 * Magie — Livre de base, chapitres « Les règles magiques » (p.235-239) et
 * « Les prières » (p.219-221).
 *
 * Trois branches, chacune testée avec sa propre Compétence :
 *  - Prières (Béni, Invocation)        → Test de Prière (Soc). Succès simple,
 *    pas de Niveau d'Incantation. Maladresse → Colère des dieux.
 *  - Sorts (Magie mineure, des Arcanes,
 *    des Domaines, du Chaos)            → Test de Langue (Magick) (Int). Réussite
 *    SI succès ET DR ≥ NI. Maladresse → Incantation Imparfaite.
 *  - Focalisation (FM, spécialisée)     → Test étendu pour alimenter les Sorts
 *    d'Arcane/Domaine à NI élevé ; quand le DR cumulé atteint le NI, le Sort se
 *    lance ensuite avec NI = 0.
 *
 * Projectile magique : la Localisation atteinte est le jet d'Incantation inversé,
 * et les Dégâts = Dégâts du Sort + DR + Bonus de Force Mentale, réduits
 * normalement par le Bonus d'Endurance et les PA (p.238).
 */
import { RNG, defaultRNG } from './dice';
import { rollTest, resolveOpposed, isDoubleRoll, evaluateTest, TestResult } from './tests';
import { getTestPolicy } from './testPolicy';
import { hasTraitKey } from './traits/dispatch';
import { bonus, effectiveChar, effectiveArmourAt } from './characteristics';
import { effectiveSkillCharKey } from './skills';
import { reverseRoll, hitLocationByShape } from './combat';
import { deviatableArmourAt } from './items';
import { Formula, resolveFormula, skillDRBonus, offTerrainTestDR } from './ops';
import type { SpellRange, SpellTarget } from './spellRange';
import type { SpellDuration } from './spellDuration';
import { type OvercastSource, effectiveRangeMetres } from './overcast';
import { arcaneDomainIdOf, featuresOf } from './combatFeatures/dispatch';
import { domainMissileMods } from './domainAttributes';
import { armourMaterialOf } from './armourBypass';
import { MINUTES_PER_DAY, minutesUntilNext, DAWN_MINUTE } from './clock';
import { Combatant, HitLocation, Difficulty, CharKey } from './types';
import { findTalent, findTalentById, findDomainById, findGodById, type TestMatch } from '../data';
import { slugId } from '../data/slug';

/** Sous-ensemble des champs de sort nécessaires au moteur (cf. src/data/spells.json). */
export interface SpellLike {
  label: string;
  type: string;
  /** Domaine/Vent (« Feu », « Ombres »…) ou culte — null pour les sorts génériques. */
  subType?: string | null;
  /** id STABLE du Domaine de magie (`DomainData.id`, ex. « feu ») — source RUNTIME des attributs de
   *  Domaine (LDB 48), indépendante de la langue. Dérivé du `subType` à l'authoring. */
  domainId?: string | null;
  cn: number | null;
  duration?: SpellDuration | null;
  desc: string;
  /** Prière (Béni/Invocation) plutôt qu'un Sort arcanique — porté par la DONNÉE (spells.json). */
  isPrayer?: boolean;
  /** Famille d'incantation STABLE (discriminant moteur, multilangue) — cf. SpellData.family. */
  family?: import('./combatFeatures/types').CastingKind;
  /** Projectile magique + Dégâts — DONNÉE (multilangue), cf. SpellData. Remplace les regex sur la desc. */
  missile?: boolean;
  damage?: number;
  ignorePA?: boolean;
  ignoreBE?: boolean;
}

/** Le personnage possède-t-il le Talent nommé ? (Diction instinctive, Harmonisation aethyrique…) */
export function hasTalent(c: Combatant, name: string): boolean {
  const id = findTalent(name)?.id ?? slugId(name);
  return c.talents.some((t) => t.talentId === id && (t.times ?? 1) >= 1);
}

/** Branche d'incantation déduite du type de sort. */
export interface CastInfo {
  /** id STABLE de la Compétence de test (skills.json — `'priere'` / `'langue'`), multilangue. */
  skill: 'priere' | 'langue';
  /** Spécialisation requise pour la compétence, le cas échéant. */
  spec?: string;
  /** Faut-il comparer le DR au Niveau d'Incantation ? (faux pour les Prières.) */
  requireNI: boolean;
}

/** Détermine la branche (et donc la Compétence) selon le sort : Prière (`isPrayer`, donnée) vs Sort. */
export function castInfo(spell: SpellLike): CastInfo {
  if (spell.isPrayer) {
    return { skill: 'priere', requireNI: false };
  }
  return { skill: 'langue', spec: 'Magick', requireNI: true };
}

/** Vrai pour les Sorts d'Arcane/Domaine pouvant être alimentés par Focalisation. */
export function isArcaneSpell(spell: SpellLike): boolean {
  return spell.family === 'arcane' || spell.family === 'chaos';
}

/** La pénalité `p` vise-t-elle la compétence de magie `skill` (id stable) ? */
function penaltyMatches(p: { skill: string }, skill: 'priere' | 'langue' | 'focalisation'): boolean {
  return p.skill === 'all' || p.skill === skill;
}

/** Somme des modificateurs d'incantation actifs (contrecoups : « Langue maladroite −10 »…). */
export function castPenaltyMod(c: Combatant, skill: 'priere' | 'langue' | 'focalisation'): number {
  let m = 0;
  for (const p of c.castPenalties ?? []) if (penaltyMatches(p, skill) && p.mod != null) m += p.mod;
  return m;
}

/** Libellé du contrecoup qui INTERDIT les Tests de `skill`, ou null si rien ne bloque.
 *  (Les pénalités expirées sont purgées par l'entretien — fin de Round / horloge.) */
export function castBlockedBy(c: Combatant, skill: 'priere' | 'langue' | 'focalisation'): string | null {
  return (c.castPenalties ?? []).find((p) => penaltyMatches(p, skill) && p.blocked)?.label ?? null;
}

/** « Pensez à vos actes » (Colère, LDB 40) : tout Test de Prière réussi plafonné à 0 DR. */
export function prayerMaxZeroDR(c: Combatant): boolean {
  return (c.castPenalties ?? []).some((p) => penaltyMatches(p, 'priere') && p.maxZeroDR);
}

/** CULTE du prêtre : la spécialisation de son Talent de Prière (Béni (Sigmar) / Invocation (Sigmar)),
 *  lue en DONNÉE via `castingKind` (aucun name-match). `undefined` si non spécialisé / pas prêtre. */
export function priestCult(c: Combatant): string | undefined {
  for (const { def, ctx } of featuresOf(c)) {
    if ((def.castingKind === 'beni' || def.castingKind === 'invocation') && ctx.spec) return ctx.spec;
  }
  return undefined;
}

/** VERROU de Péché du culte (MDG 11 l.142 : « Stromfels retire à un suivant la capacité d'utiliser le
 *  Talent *Invocation* s'il possède au moins deux Points de Péché et celle d'utiliser le Talent *Béni*
 *  s'il possède au moins cinq Points de Péché ») — GÉNÉRIQUE : lit `GodData.sinLocks` du culte du
 *  prêtre (par famille de la Prière tentée). Renvoie le seuil franchi (message de refus), sinon null. */
export function prayerSinLock(c: Combatant, spell: SpellLike): { family: 'beni' | 'invocation'; threshold: number; cult: string } | null {
  const fam = spell.family;
  if (fam !== 'beni' && fam !== 'invocation') return null;
  const cult = priestCult(c);
  const threshold = cult ? findGodById(cult)?.sinLocks?.[fam] : undefined;
  return cult && threshold != null && (c.sinPoints ?? 0) >= threshold ? { family: fam, threshold, cult } : null;
}

/**
 * Valeur d'un test d'incantation : Caractéristique de la compétence + avances de
 * celle-ci (si le personnage la possède), sinon la Caractéristique seule —
 * modulée par les contrecoups actifs (castPenalties) et, EN COMBAT, par
 * l'Avantage (« Les Avantages s'appliquent aux Tests d'Incantation, pas aux
 * Tests de Focalisation », LDB 46 l.176).
 */
export function castingValue(c: Combatant, skillName: string, spec?: string): number {
  // Carac de la compétence d'incantation via le POINT UNIQUE (skills.ts) : carac d'instance (data-driven)
  // sinon défaut LDB (Prière→Soc, Focalisation→FM, Langue→Int).
  // Surcharge DATA du Domaine pour Langue (Magick) : la Magie de la Gueule (réservée aux ogres) se lance
  // sur l'Endurance (ADE II l.653) — attribut `castingChar` du domaine, AUCUN sniff d'espèce.
  const domChar = skillName === 'langue' ? findDomainById(arcaneDomainIdOf(c))?.castingChar : undefined;
  const charKey = domChar ?? effectiveSkillCharKey(c, skillName, {
    spec,
    fallback: skillName === 'priere' ? 'Soc' : skillName === 'focalisation' ? 'FM' : 'Int',
  });
  const base = effectiveChar(c, charKey);
  // `skillName` EST déjà l'id stable de la Compétence (skills.json) — lookup direct.
  const sk = c.skills.find(
    (s) => s.skillId === skillName && (spec == null || s.spec === spec),
  );
  const penalty = skillName === 'priere' || skillName === 'langue' || skillName === 'focalisation'
    ? castPenaltyMod(c, skillName)
    : 0;
  const advantage = skillName === 'focalisation' ? 0 : 10 * (c.advantage ?? 0);
  return base + (sk?.advances ?? 0) + penalty + advantage;
}

/**
 * « Repousser les Vents » (LDB 46 l.199) : −1 DR aux Tests d'Incantation et de
 * Focalisation par PA (net) sur la Localisation la mieux protégée par une ARMURE
 * PORTÉE (les PA naturels d'une mutation ne sont pas une armure). Exemptions
 * (l.188) : Magie des Arcanes (Métal) ignore les armures métalliques, (Bêtes)
 * ignore les armures de cuir.
 */
export function armourCastDRPenalty(c: Combatant): number {
  // Domaine d'Arcane par ID STABLE (`arcaneDomainIdOf`) + matériau de l'armure par CAPACITÉ TYPÉE du
  // Groupe (`armourMaterialOf`) — plus AUCUNE devinette par regex (ni sur le nom de l'armure, ni sur le
  // libellé du Domaine). Métal ignore le métal, Bête le cuir (LDB 46 l.188).
  const domId = arcaneDomainIdOf(c);
  const ignoreMetal = domId === 'metal';
  const ignoreLeather = domId === 'bete';
  let maxPA = 0;
  for (const it of c.items ?? []) {
    if (!it.equipped || it.kind !== 'armor' || !it.pa) continue;
    const mat = armourMaterialOf(it);
    if (mat === 'metal' && ignoreMetal) continue;
    if (mat === 'leather' && ignoreLeather) continue;
    maxPA = Math.max(maxPA, Math.max(0, it.pa - (it.damageTaken ?? 0)));
  }
  return maxPA;
}

/** Spécialisation de Focalisation requise par un sort : son Domaine (`subType`),
 *  sinon aucune (Sorts d'Arcane communs — n'importe quel Vent les alimente). */
export function focusSpecOf(spell: SpellLike): string | undefined {
  return spell.subType ?? undefined;
}

/** Compétence Focalisation utilisable pour CE sort : spécialisation du Vent
 *  correspondante (LDB 46 — Focalisation est spécialisée par Domaine). Une
 *  compétence SANS spécialisation (données historiques) reste acceptée. */
export function focusSkillFor(c: Combatant, spell: SpellLike) {
  const spec = focusSpecOf(spell);
  return c.skills.find(
    (s) => s.skillId === 'focalisation' && s.advances >= 1 && (s.spec == null || spec == null || s.spec === spec),
  );
}

/**
 * Prière, Langue (Magick) et Focalisation sont des Compétences AVANCÉES : on ne
 * peut tenter le Test que si l'on y possède au moins une Augmentation (Livre de
 * base, 09 - Compétences : « Si ce n'est pas le cas, vous ne pouvez pas tenter le
 * Test »). Sinon, aucune incantation possible — pas de repli sur la Caractéristique.
 *
 * Exception : le Trait de créature « Lanceur de Sorts (Divers) » (LDB 85 l.182-183 :
 * « La créature peut lancer des Sorts ») autorise l'incantation SANS la Compétence —
 * les statblocs du bestiaire ne portent pas de Compétences ; le Test se fait alors
 * sur la Caractéristique seule (castingValue, avances 0).
 */
export function knowsCastingSkill(c: Combatant, skillName: string, spec?: string): boolean {
  if (hasTraitKey(c.traits, 'lanceur-de-sorts')) return true;
  // `skillName` EST déjà l'id stable de la Compétence (skills.json) — lookup direct.
  return c.skills.some(
    (s) => s.skillId === skillName && (spec == null || s.spec === spec) && s.advances >= 1,
  );
}

/**
 * Dégâts d'un Projectile magique, LUS DANS LA DONNÉE (`SpellData.missile`/`damage`/`ignorePA`/
 * `ignoreBE`) — plus de regex sur la desc FR (data-driven + multilangue). `null` si non-missile.
 * Les Dégâts sont ADDITIFS (+ DR + BFM) — cf. `evaluateMissile`.
 */
export function missileDamage(
  spell: SpellLike,
): { damage: number; ignorePA: boolean; ignoreBE: boolean } | null {
  if (!spell.missile) return null;
  return { damage: spell.damage ?? 0, ignorePA: !!spell.ignorePA, ignoreBE: !!spell.ignoreBE };
}


/** Vrai si le sort est un Projectile magique (Dégâts résolus comme une attaque) — DONNÉE `missile`. */
export function isMagicMissile(spell: SpellLike): boolean {
  return spell.missile === true;
}

/** Un `TestMatch` (donnée `talent.test.matches`) s'applique-t-il au Test interrogé ? PUR : le matching
 *  id/spec/char vit dans le moteur ; l'évaluation du contexte `when` (Condition, couche state) est
 *  INJECTÉE par `whenHolds` (le moteur reste pur — règle 3). `manual` (contexte narratif) = jamais auto.
 *  Spec : `specFromInstance` → la spec CHOISIE du talent (Métier (Au choix)) ; sinon `spec` fixe ; aucune
 *  → toute spec. */
function matchApplies(
  m: TestMatch, inst: { spec?: string },
  q: { skill?: string; char?: CharKey; spec?: string },
  whenHolds: (cond: import('./flowCore').Condition) => boolean,
): boolean {
  if (m.manual) return false;
  if (m.skill != null) {
    if (m.skill !== q.skill) return false;
    const wantSpec = m.specFromInstance ? inst.spec : m.spec;
    if (wantSpec != null && wantSpec !== q.spec) return false;
    if (m.exceptSpec != null && m.exceptSpec === q.spec) return false; // Linguistique : toute Langue SAUF Magick
  } else if (m.char != null) {
    if (m.char !== q.char) return false;
  } else return false;
  return m.when ? whenHolds(m.when) : true;
}

/**
 * LDB 10 l.20 (Schéma des Talents, « Tests ») : « pour chaque acquisition de ce Talent, vous gagnez +1 DR
 * pour toute utilisation RÉUSSIE de la Compétence liée au Talent. » SOURCE UNIQUE du bonus de DR de Talent
 * (incantation ET Tests de compétence) : Σ des acquisitions des Talents dont un `TestMatch` structuré
 * (`talent.test.matches`) correspond au Test `{ skill|char, spec }`. Plus AUCUN match par libellé.
 * `whenHolds` évalue les contextes `when` (injecté par la couche state ; défaut conservateur = un `when`
 * non vérifiable ne s'applique pas — p.ex. au casting, sans vue de combat).
 */
export function talentTestSLBonus(
  c: Combatant,
  q: { skill?: string; char?: CharKey; spec?: string },
  whenHolds: (cond: import('./flowCore').Condition) => boolean = () => false,
): number {
  let n = 0;
  for (const inst of c.talents ?? []) {
    const matches = findTalentById(inst.talentId)?.test?.matches;
    if (matches?.some((m) => matchApplies(m, inst, q, whenHolds))) n += inst.times;
  }
  return n;
}

/** +DR de Talent au LANCEMENT (LDB 10) : `talentTestSLBonus` sur la Compétence d'incantation (id + spec),
 *  PLUS les auras de +DR (Aura de Dhar via `skillDRBonus`, [[game-traits-trigger-aura-mechanisms]]). Le
 *  casting n'a pas de vue de combat → les `when` ne s'appliquent pas (aucun talent d'incantation n'en a). */
export function castTestTalentDR(c: Combatant, skill: 'langue' | 'focalisation' | 'priere', spec?: string): number {
  // + hors de son terrain : −DR à TOUS les Tests, l'incantation comprise (Créature marine, MDG p.140).
  return talentTestSLBonus(c, { skill, spec }) + skillDRBonus(c, skill, spec) + offTerrainTestDR(c);
}

/**
 * Zone d'Effet (LDB 47 l.44) : « les Sorts marqués ZdE affectent tous les individus à l'intérieur de
 * ce DIAMÈTRE ». Diamètre en mètres depuis la cible STRUCTURÉE (`{kind:'area'}`), résolu contre le
 * lanceur. Null si la cible n'est pas une aire chiffrable. Zéro parsing de chaîne (cf. `spellRange.ts`).
 */
export function zdeDiameterMeters(target: SpellTarget | null | undefined, caster: Combatant): number | null {
  if (!target || target.kind !== 'area') return null;
  const m = resolveFormula(target.meters, caster);
  return target.span === 'radius' ? m * 2 : m;
}

/** Rayon de la ZdE en CASES (grille 2 m/case) : diamètre/2 mètres → ÷2 m/case,
 *  arrondi à l'entier inférieur (min 0 = la seule case du centre). */
export function zdeRadiusTiles(target: SpellTarget | null | undefined, caster: Combatant): number | null {
  const diam = zdeDiameterMeters(target, caster);
  return diam == null ? null : Math.max(0, Math.floor(diam / 2 / 2));
}

/**
 * Portée d'un sort en CASES (2 m/case) depuis la portée STRUCTURÉE : `self` → 0, `touch` → 1,
 * `distance` → ⌊mètres/2⌋ (km ×1000). Null = non chiffrable (`special`/absente). Zéro parsing.
 */
export function spellRangeTiles(range: SpellRange | null | undefined, caster: Combatant): number | null {
  if (!range) return null;
  switch (range.kind) {
    case 'self': return 0;
    case 'touch': return 1;
    case 'distance': return Math.max(1, Math.floor((resolveFormula(range.value, caster) * (range.unit === 'km' ? 1000 : 1)) / 2));
    case 'special': return null;
  }
}

/** Portée EFFECTIVE en cases après `steps` pas de Surincantation de Portée. Étend une portée chiffrée
 *  (×initial arcane/miracle, +6 m fixe bénédiction) et — RAW Bénédiction (LDB 41 l.27 : Guérison touchée
 *  → 6 m / 12 m) — une portée Contact (0 m → +6 m/pas). « Vous »/« Spécial », et le Contact d'un Sort/
 *  Miracle, ne s'étendent pas (LDB 47 « Contact ne peut pas être étendu » ; LDB 42 « Vous » non augmentable). */
export function effectiveSpellRangeTiles(range: SpellRange | null | undefined, caster: Combatant, source: OvercastSource, steps: number): number | null {
  if (!range || steps <= 0 || range.kind === 'self' || range.kind === 'special') return spellRangeTiles(range, caster);
  if (range.kind === 'touch')
    return source === 'blessing' ? Math.max(1, Math.floor(effectiveRangeMetres('blessing', 0, steps) / 2)) : 1;
  const baseM = resolveFormula(range.value, caster) * (range.unit === 'km' ? 1000 : 1);
  return Math.max(1, Math.floor(effectiveRangeMetres(source, baseM, steps) / 2));
}

/** Nombre de cibles INITIAL d'un sort (la valeur « Cible » résolue), 1 par défaut. Base de la capacité
 *  de cibles supplémentaires en Surincantation (cf. `extraTargetCapacity`). */
export function spellTargetCount(spell: { target?: SpellTarget | null }, caster: Combatant): number {
  return spell.target?.kind === 'count' ? Math.max(1, resolveFormula(spell.target.n, caster)) : 1;
}

/**
 * Péché et Colère Divine (LDB 40 l.44-45) : « Chaque fois que vous effectuez un
 * Test de Prière, si le dé des unités est inférieur ou égal à votre total actuel
 * de Points de Péché, vous subirez la Colère des dieux, même si le Test de Prière
 * est réussi. » La règle ne mord que si l'on A péché (section « Il est risqué de
 * faire appel à votre divinité quand vous avez agi de façon contraire à sa
 * volonté ») : à 0 Péché, aucun déclenchement. Le dé des unités d'un 100 (00) est 0.
 */
export function prayerWrathTriggered(roll: number, sinPoints: number): boolean {
  if (sinPoints <= 0) return false;
  return roll % 10 <= sinPoints;
}

/** Durée d'un sort exprimée en Rounds (« 6 rounds »), sinon null. */
/**
 * Durée d'un sort à l'échelle de l'HORLOGE (LDB 47), en minutes à partir de `now`, depuis la durée
 * STRUCTURÉE : `{clock}` (« 1 heure », « (Bonus de FM) jours »…) résolu contre le lanceur, `{untilDawn}`
 * (« Jusqu'au lever du soleil » = prochaine aube ; à l'aube pile, un cycle entier). Null pour les autres
 * échelles (Rounds / Instantané / Spécial) — l'appelant n'invente RIEN. Zéro parsing de chaîne.
 */
export function durationClockMinutes(duration: SpellDuration | null | undefined, caster: Combatant, now: number): number | null {
  if (!duration) return null;
  if (duration.kind === 'untilDawn') {
    const toDawn = minutesUntilNext(now, DAWN_MINUTE);
    return toDawn === 0 ? MINUTES_PER_DAY : toDawn;
  }
  if (duration.kind !== 'clock') return null;
  const UNIT = { minutes: 1, hours: 60, days: MINUTES_PER_DAY };
  return Math.max(1, resolveFormula(duration.value, caster)) * UNIT[duration.unit];
}

/**
 * Influences malfaisantes — « Règle du 8 » (LDB 46 l.89) : « Quand vous effectuez un Test de Langue
 * (Magick) ou de Focalisation à proximité d'une Influence corruptrice, tout lancer obtenant un 8
 * (représentant le symbole du Chaos à huit pointes) sur le dé des unités entraîne une Incantation
 * Imparfaite Mineure […]. Si vous avez déjà obtenu une Incantation Imparfaite Mineure au Test pour une
 * autre raison, [elle] devient Majeure. » Renvoie la sévérité de la Maladresse déclenchée, ou `null`
 * (dé des unités ≠ 8, ou pas à proximité d'une Corruption). `alreadyMinor` = une Imparfaite Mineure a
 * DÉJÀ été obtenue au Test pour une autre raison (double-échec « 88 ») → escalade en Majeure.
 */
export function ruleOfEightSeverity(roll: number, nearCorruption: boolean, alreadyMinor: boolean): 'mineure' | 'majeure' | null {
  if (!nearCorruption || roll % 10 !== 8) return null;
  return alreadyMinor ? 'majeure' : 'mineure';
}

/**
 * Sorcellerie (LDB 49) : « le fait de focaliser ou lancer des Sorts de ce Domaine nécessite
 * systématiquement un lancer sur le Tableau des Incantations Imparfaites Mineures à moins d'être lancé
 * avec un ingrédient ». Vrai = une Incantation Imparfaite Mineure SYSTÉMATIQUE est due (Sort de
 * Sorcellerie lancé sans composant). Le composant, lui, « ne servira à rien » si une Imparfaite doit de
 * toute façon être lancée pour une autre raison (fumble) — donc il n'y a PAS de dégradation en mode
 * Sorcellerie : `componentUsed` prévient seulement le lancer systématique ci-dessus.
 */
export function sorceryMandatoryMiscast(sorcery: boolean, componentUsed: boolean): boolean {
  return sorcery && !componentUsed;
}

export interface CastResult {
  /** Le sort est-il effectivement lancé ? */
  cast: boolean;
  roll: number;
  /** Valeur cible effective du test (utile au journal/tests). */
  target: number;
  sl: number;
  /** Incantation Critique (double réussi). */
  isCritical: boolean;
  /** Maladresse (double raté) → Incantation Imparfaite / Colère des dieux. */
  isFumble: boolean;
  /** DISSIPÉ par un Contre-sort (LDB 46 l.201-202) — une « Puissance totale » ne le repêche pas. */
  dispelled?: boolean;
  log: string;
}

/**
 * Test d'Incantation / de Prière. `focusedNI0` force le NI à 0 (Sort focalisé).
 */
export function resolveCasting(
  caster: Combatant,
  spell: SpellLike,
  rng: RNG = defaultRNG,
  difficulty: Difficulty = 'intermediaire',
  focusedNI0 = false,
  /** Modificateur ponctuel au Test, calculé par l'ÉTAT qui connaît la géométrie (ex.
   *  « N'écoutez point la Sorcière », LDB 42 : −20 si le Sort cible la zone du prêtre). */
  extraMod = 0,
): CastResult {
  const info = castInfo(spell);
  if (!knowsCastingSkill(caster, info.skill, info.spec)) {
    const skill = info.spec ? `${info.skill} (${info.spec})` : info.skill;
    return {
      cast: false,
      roll: 0,
      target: 0,
      sl: 0,
      isCritical: false,
      isFumble: false,
      log: `${caster.name} ne maîtrise pas ${skill} et ne peut pas incanter ${spell.label}.`,
    };
  }
  const value = castingValue(caster, info.skill, info.spec) + extraMod;
  const t = rollTest(value, difficulty, rng);
  // « Repousser les Vents » (LDB 46 l.199) : −1 DR par PA de la localisation la mieux
  // protégée par une armure portée (Tests d'Incantation ET de Focalisation).
  const pen = armourCastDRPenalty(caster);
  // LDB 10 l.20 : +1 DR par acquisition d'un Talent lié au Test, sur utilisation RÉUSSIE
  // (Diction instinctive ×N → +N DR au Test d'Incantation). Appliqué au JET (pas à
  // l'évaluation : rederiveCastSL — Chance « +1 DR » — repart du DR déjà boosté).
  const tal = t.success ? castTestTalentDR(caster, info.skill, info.spec) : 0;
  return evaluateCasting(caster, spell, pen || tal ? { ...t, sl: t.sl - pen + tal } : t, focusedNI0);
}

/**
 * Probabilité (0..1) déterministe qu'un Test d'Incantation ABOUTISSE (réussite ET DR≥NI).
 * Énumère les 100 jets possibles sans RNG — AUCUN effet de bord. Miroir exact de `resolveCasting` :
 * même `value`, même pénalité armure (`pen`), même bonus talent (`tal`), même condition `cast`.
 * `focusedNI0 = true` → NI forcé à 0 (Sort focalisé, identique à `resolveCasting`).
 */
export function castLandProbability(caster: Combatant, spell: SpellLike, focusedNI0 = false): number {
  const info = castInfo(spell);
  if (!knowsCastingSkill(caster, info.skill, info.spec)) return 0;
  const policy = getTestPolicy();
  const value = castingValue(caster, info.skill, info.spec);
  const pen = armourCastDRPenalty(caster);
  const tal = castTestTalentDR(caster, info.skill, info.spec);
  const ni = focusedNI0 ? 0 : (spell.cn ?? 0);
  let lands = 0;
  for (let r = 1; r <= 100; r++) {
    const t = evaluateTest(r, value, policy);
    if (!t.success) continue;
    const dr = t.sl - pen + tal;
    if (!info.requireNI || dr >= ni) lands++;
  }
  return lands / 100;
}

/**
 * Évalue un résultat d'incantation à partir d'un jet DÉJÀ obtenu (rejouable pour la Chance « +1 DR »).
 * Ne tire pas de dé : `t` porte le jet et le DR (déjà ajusté le cas échéant).
 */
export function evaluateCasting(
  caster: Combatant,
  spell: SpellLike,
  t: TestResult,
  focusedNI0 = false,
): CastResult {
  const info = castInfo(spell);
  // « Pensez à vos actes » (Colère des dieux, LDB 40) : tout Test de PRIÈRE réussi
  // ne peut pas obtenir plus de 0 DR pendant la durée du contrecoup.
  if (info.skill === 'priere' && t.success && t.sl > 0 && prayerMaxZeroDR(caster)) {
    t = { ...t, sl: 0 };
  }
  const ni = focusedNI0 ? 0 : spell.cn ?? 0;
  const cast = t.success && (!info.requireNI || t.sl >= ni);
  const isCritical = t.isDouble && t.success;
  const isFumble = t.isDouble && !t.success;
  let log: string;
  if (!t.success) {
    log = `${caster.name} échoue à incanter ${spell.label}.`;
  } else if (!cast) {
    log = `${caster.name} incante ${spell.label} mais sans assez de puissance (DR ${t.sl} < NI ${ni}).`;
  } else {
    log = `${caster.name} lance ${spell.label} (DR ${t.sl}).`;
  }
  return { cast, roll: t.roll, target: t.target, sl: t.sl, isCritical, isFumble, log };
}

/** Issue d'un Contre-sort (Dissipation, LDB 46 l.201-202). */
export interface CounterspellOutcome {
  /** Le contre-lanceur GAGNE le Test opposé : le Sort est dissipé. */
  dispelled: boolean;
  /** Jet de Langue (Magick) du contre-lanceur (affichage/journal). */
  counter: TestResult;
  /** « le Sort utilise le DR du Test opposé » : DR NET (signé) du lanceur si non dissipé. */
  casterNetSL: number;
  log: string;
}

/** Seul un SORT se dissipe (LDB 46 l.201 : « Si un Sort vous cible ») — pas une Prière
 *  (Bénédictions/Miracles relèvent de la Colère des dieux, LDB 40). */
export function isDispellableSpell(spell: SpellLike): boolean {
  return !spell.isPrayer;
}

/**
 * Dissipation (LDB 46 l.201-202) : « vous pouvez opposer le Test d'Incantation avec Langue
 * (Magick), car vous chantez un Contre-sort. Effectuez un Test opposé de Langue (Magick). Sur un
 * succès, vous dissipez le Sort ; sur un échec, le Sort utilise le DR du Test opposé pour
 * déterminer si l'incantation a réussi normalement. Vous ne pouvez tenter de dissiper qu'un seul
 * Sort chaque Round. »
 * `castT` = le Test d'Incantation du lanceur, DÉJÀ jeté (DR ajustés : talents, armure). Le jet du
 * contre-lanceur subit les mêmes règles de Test de Langue (Magick) : « Repousser les Vents »
 * (l.199, −1 DR/PA) et +1 DR par Talent lié réussi (LDB 10 l.20 — Diction instinctive).
 * Égalité du Test opposé : personne ne gagne → pas de dissipation, DR net 0 appliqué au NI.
 */
/** Reconstruit le Test d'Incantation FIGÉ d'un résultat d'incantation, pour l'opposition du
 *  Contre-sort (LDB 46 l.202 : « le lanceur tient le rôle attaquant »). Source unique. */
export function castTestOf(res: Pick<CastResult, 'roll' | 'target' | 'sl'>): TestResult {
  return { roll: res.roll, target: res.target, success: res.roll <= res.target, sl: res.sl, isDouble: res.roll === 100 || res.roll % 11 === 0 };
}

/** Issue d'un Contre-sort à partir d'un jet de contre-lanceur DÉJÀ obtenu (`counterT`, DR déjà
 *  ajusté) opposé au Test d'Incantation figé. Source UNIQUE de l'opposition + du journal — partagée
 *  par le jet RNG (`resolveCounterspell`), la Chance « +1 DR », et la Résilience (dé forcé). */
export function counterspellOutcomeFrom(counter: Combatant, counterT: TestResult, castT: TestResult): CounterspellOutcome {
  const opp = resolveOpposed(castT, counterT); // le lanceur tient le rôle « attaquant »
  const dispelled = opp.winner === 'defender';
  const net = castT.sl - counterT.sl;
  return {
    dispelled,
    counter: counterT,
    casterNetSL: net,
    log: dispelled
      ? `Contre-sort de ${counter.name} (🎲 ${counterT.roll}/${counterT.target}, DR ${counterT.sl}) : le Sort est DISSIPÉ.`
      : `Contre-sort de ${counter.name} (🎲 ${counterT.roll}/${counterT.target}, DR ${counterT.sl}) : insuffisant — l'incantation se résout à DR ${net}.`,
  };
}

export function resolveCounterspell(counter: Combatant, castT: TestResult, rng: RNG = defaultRNG): CounterspellOutcome {
  const value = castingValue(counter, 'langue', 'Magick');
  const t = rollTest(value, 'intermediaire', rng);
  const adj = t.success ? castTestTalentDR(counter, 'langue', 'Magick') - armourCastDRPenalty(counter) : 0;
  const counterT = adj ? { ...t, sl: t.sl + adj } : t;
  return counterspellOutcomeFrom(counter, counterT, castT);
}

export interface MissileResult extends CastResult {
  hit: boolean;
  location?: HitLocation;
  damage?: number; // dégâts bruts (avant mitigation)
  woundsLost?: number; // Blessures réellement perdues
  defenderDefeated: boolean;
}

/** Résout un Projectile magique (Incantation puis Dégâts façon attaque). */
export function resolveMagicMissile(
  caster: Combatant,
  target: Combatant,
  spell: SpellLike,
  rng: RNG = defaultRNG,
  focusedNI0 = false,
  extraMod = 0,
): MissileResult {
  const cr = resolveCasting(caster, spell, rng, 'intermediaire', focusedNI0, extraMod);
  return evaluateMissile(caster, target, spell, cr);
}

/** Re-dérive les Dégâts d'un Projectile magique depuis un résultat d'incantation déjà obtenu. */
export function evaluateMissile(
  caster: Combatant,
  target: Combatant,
  spell: SpellLike,
  cr: CastResult,
  locOverride?: HitLocation,
  apReduction = 0, // Déviation Critique (LDB 63) : recalcul des Dégâts à PA−1 quand le défenseur sacrifie 1 PA
): MissileResult {
  if (!cr.cast) {
    return { ...cr, hit: false, defenderDefeated: false };
  }
  // Localisation : le jet d'Incantation inversé (LDB 46), SAUF Coup Critique → 1d100 frais (`locOverride`,
  // LDB 18 l.53) ; les Dégâts ci-dessous sont alors RÉ-ÉVALUÉS à cette loc (PA + mods de Domaine, l.55).
  const loc = locOverride ?? hitLocationByShape(reverseRoll(cr.roll), target.bodyShape);
  const spellDmg = missileDamage(spell);
  const bfm = bonus(effectiveChar(caster, 'FM'));
  // Attribut de Domaine (LDB 48 — L14) : Métal ignore les PA métalliques ET les ajoute en Dégâts ;
  // Cieux ignore les PA métalliques ; Ombres ignore tous les PA non magiques.
  const totalAP = Math.max(0, effectiveArmourAt(target, loc) - apReduction); // PA portés + temporisés (Armure Aethyrique), moins le PA sacrifié en Déviation
  const dom = domainMissileMods(target, spell, loc, totalAP);
  const damage = (spellDmg?.damage ?? 0) + Math.max(0, cr.sl) + bfm + dom.bonusDamage;
  // Certains Projectiles ignorent le Bonus d'Endurance et/ou les PA (p.238 + sorts).
  const tb = spellDmg?.ignoreBE ? 0 : bonus(effectiveChar(target, 'E'));
  const ap = spellDmg?.ignorePA ? 0 : Math.max(0, totalAP - dom.apIgnored);
  const woundsLost = Math.max(1, damage - (tb + ap));
  const defeated = target.wounds.current - woundsLost <= 0;
  const mitLabel =
    [spellDmg?.ignoreBE ? null : 'BE', spellDmg?.ignorePA ? null : 'PA'].filter(Boolean).join('+') || 'rien';
  return {
    ...cr,
    hit: true,
    location: loc,
    damage,
    woundsLost,
    defenderDefeated: defeated,
    log:
      `${caster.name} lance ${spell.label} sur ${target.name} : ` +
      `${damage} dégâts − ${tb + ap} (${mitLabel}) = ${woundsLost} Blessures` +
      (cr.isCritical ? ' — CRITIQUE !' : '') +
      '.',
  };
}

/** Déviation Critique d'un Projectile magique (LDB 63) : éligible SEULEMENT si l'armure ABSORBE
 *  réellement le coup à la loc du Critique — une vraie pièce sacrifiable (`deviatableArmourAt`) ET une PA
 *  mitigante après bypass de Domaine (Ombres/Métal/Cieux) ET un sort qui n'ignore pas les PA. Sinon
 *  « le coup absorbé par votre armure » n'a pas de sens → pas d'offre. `extraWounds` = Blessures
 *  supplémentaires au Dévier (Dégâts recalculés à PA−1, Résistance à la Magie `mr` réappliquée). */
export function magicDeviationEligible(
  caster: Combatant,
  target: Combatant,
  loc: HitLocation,
  spell: SpellLike,
  cr: CastResult,
  woundsAtFullPA: number,
  mr: number,
): { eligible: boolean; extraWounds: number } {
  if (deviatableArmourAt(target, loc) <= 0) return { eligible: false, extraWounds: 0 };
  if (missileDamage(spell)?.ignorePA) return { eligible: false, extraWounds: 0 };
  const totalAP = effectiveArmourAt(target, loc);
  const { apIgnored } = domainMissileMods(target, spell, loc, totalAP);
  if (totalAP - apIgnored <= 0) return { eligible: false, extraWounds: 0 }; // PA entièrement bypassée → no-op
  const at1 = evaluateMissile(caster, target, spell, cr, loc, 1).woundsLost ?? 0; // recalcul à PA−1
  return { eligible: true, extraWounds: Math.max(0, Math.max(0, at1 - mr) - woundsAtFullPA) };
}

/**
 * Re-dérive une incantation figée avec un bonus de DR (Chance « +1 DR », ch.17 l.26) : on ne
 * relance pas le d100 — le succès reste celui du jet propre ; on recalcule cast/NI et, pour un
 * Projectile magique, les Dégâts. Cumulable (on ajoute `bonusSL` au DR courant).
 */
export function rederiveCastSL(
  caster: Combatant,
  target: Combatant,
  spell: SpellLike,
  current: CastResult & Partial<MissileResult>,
  missile: boolean,
  focusedNI0 = false,
  bonusSL = 1,
): CastResult & Partial<MissileResult> {
  const t: TestResult = {
    roll: current.roll,
    target: current.target,
    success: current.roll <= current.target,
    sl: current.sl + bonusSL,
    isDouble: isDoubleRoll(current.roll),
  };
  const cr = evaluateCasting(caster, spell, t, focusedNI0);
  return missile ? evaluateMissile(caster, target, spell, cr) : cr;
}

export interface FocusResult {
  /** DR gagné lors de ce Round (0 si échec). */
  dr: number;
  isCritical: boolean;
  isFumble: boolean;
  roll: number;
  /** Cible effective du Test (affichage RollLine) — absente sur un résultat synthétique (Résilience pré-jet). */
  target?: number;
  /** DR brut du jet (peut être négatif, contrairement à `dr` clampé ≥ 0). */
  sl?: number;
  log: string;
}

/** Un Round de Test étendu de Focalisation (FM + spécialisation PAR VENT — le
 *  Domaine du sort exige la Focalisation correspondante, LDB 46 l.180-199). */
export function resolveFocus(
  caster: Combatant,
  spell: SpellLike,
  rng: RNG = defaultRNG,
  difficulty: Difficulty = 'intermediaire',
): FocusResult {
  const sk = focusSkillFor(caster, spell);
  if (!sk) {
    const spec = focusSpecOf(spell);
    return {
      dr: 0, isCritical: false, isFumble: false, roll: 0,
      log: `${caster.name} ne maîtrise pas Focalisation${spec ? ` (${spec})` : ''}.`,
    };
  }
  const value = castingValue(caster, 'focalisation', sk.spec);
  const t = rollTest(value, difficulty, rng);
  // « Repousser les Vents » : −1 DR par PA de la localisation la mieux protégée (l.199).
  // LDB 10 l.20 : +1 DR par acquisition d'un Talent lié au Test réussi (Harmonisation aethyrique ×N).
  const dr = t.success ? Math.max(0, t.sl + castTestTalentDR(caster, 'focalisation') - armourCastDRPenalty(caster)) : 0;
  const isCritical = t.isDouble && t.success;
  // Maladresse ÉLARGIE en Focalisation (l.190-191) : tout double OU tout résultat
  // terminant par un 0 au-delà de la Compétence (00, 99, 90, 88…) → Imparfaite MAJEURE.
  const isFumble = !t.success && (t.isDouble || t.roll % 10 === 0);
  const log = t.success
    ? `${caster.name} focalise ${spell.label} (+${dr} DR).`
    : `${caster.name} échoue à focaliser ${spell.label}.`;
  return { dr, isCritical, isFumble, roll: t.roll, target: t.target, sl: t.sl, log };
}
