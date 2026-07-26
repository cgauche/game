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
import { rule } from './policy';
import { traitCapability } from './traits/dispatch';
import { bonus, effectiveChar, effectiveArmourAt } from './characteristics';
import { effectiveSkillCharKey } from './skills';
import { reverseRoll, hitLocationByShape } from './combat';
import { deviatableArmourAt } from './items';
import { resolveFormula, skillDRBonus, offTerrainTestDR } from './ops';
import type { SpellRange, SpellTarget } from './spellRange';
import type { SpellDuration } from './spellDuration';
import { type OvercastSource, effectiveRangeMetres, missileOvercastDamageBonus, overcastSourceOf } from './overcast';
import { arcaneDomainIdOf, castingKindOf, featuresOf, chaosDomainOf } from './combatFeatures/dispatch';
import { domainMissileMods, domainSeaFocalisationDR, domainSeaFocalisationDoubled, domainSeaIncantationDR, domainSeaWidensCritFumble, domainWindDR } from './domainAttributes';
import type { WindContext } from './domainAttributes';
import { environmentTestDR, environmentWidensCrit, environmentNIMods } from './magicEnvironment';
import type { MagicEnvironment } from './magicEnvironment';
import { effectiveCastingNumber } from './castingNumber';
import type { CastingNumberMod, CastingNumberSubject } from './castingNumber';
import { armourMaterialOf } from './armourBypass';
import { MINUTES_PER_DAY, minutesUntilNext, DAWN_MINUTE } from './clock';
import { Combatant, HitLocation, Difficulty, CharKey, CastPenalty } from './types';
import { traitById, findTalent, findTalentById, findDomainById, findGodById, type TestMatch } from '../data';
import { effectiveTalents } from './talentEffects';
import { effectiveEntry } from './variants';
import { slugId } from '../data/slug';
import { ritualReduction, type RitualReduced } from './grimoire';

/** Sous-ensemble des champs de sort nécessaires au moteur (cf. src/data/spells.json). */
export interface SpellLike {
  /** Id STABLE du sort (`SpellData.id`) — portée `spellIds` d'un modificateur de NI. */
  id?: string;
  /** Le Sort est un RITUEL (`VDM 02 l.363` : « Les Rituels sont des Sorts ») — porté par la DONNÉE
   *  (rubrique d'anatomie de Rituel, `l.377-393`). Discrimine les modificateurs de NI qui ne visent
   *  que l'un des deux (`VDM 12 l.646-647`, `VDM 14 l.489`) ; la RÉSOLUTION est celle d'un Sort. */
  isRitual?: boolean;
  /** Part de l'anatomie de Rituel que la résolution du NI consomme : la valeur RÉDUITE imprimée
   *  entre parenthèses (`VDM 02 l.398`), gatée sur les Domaines que PRATIQUE le lanceur. */
  ritual?: { reduced?: RitualReduced };
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
  /** Famille d'incantation STABLE (discriminant moteur, multilangue) — cf. SpellData.family. */
  family?: import('./combatFeatures/types').CastingKind;
  /** Projectile magique + Dégâts — DONNÉE (multilangue), cf. SpellData. Remplace les regex sur la desc. */
  missile?: boolean;
  damage?: number;
  ignorePA?: boolean;
  ignoreBE?: boolean;
}

/** Le personnage possède-t-il le Talent nommé (structurel OU octroyé par un Trait, `effectiveTalents`) ?
 *  (Diction instinctive, Harmonisation aethyrique, Savoir-vivre (Suivants de Khorne) via Marque de Khorne…) */
export function hasTalent(c: Combatant, name: string): boolean {
  const id = findTalent(name)?.id ?? slugId(name);
  return effectiveTalents(c).some((t) => t.talentId === id && (t.times ?? 1) >= 1);
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

/** Le sort relève-t-il d'une Prière (Bénédiction/Miracle) ? Discriminant UNIQUE : la `family`
 *  (id stable, multilangue), requise au schéma de `spells.json`. `LDB 40 l.13` */
export function castInfoIsPrayer(spell: SpellLike): boolean {
  return spell.family === 'beni' || spell.family === 'invocation';
}

/** Détermine la branche (et donc la Compétence) selon le sort : Prière vs Sort. `LDB 40 l.13` */
export function castInfo(spell: SpellLike): CastInfo {
  if (castInfoIsPrayer(spell)) {
    return { skill: 'priere', requireNI: false };
  }
  return { skill: 'langue', spec: 'magick', requireNI: true };
}

/** Vrai pour les Sorts d'Arcane/Domaine pouvant être alimentés par Focalisation. */
export function isArcaneSpell(spell: SpellLike): boolean {
  return spell.family === 'arcane' || spell.family === 'chaos';
}

/** La pénalité `p` vise-t-elle la compétence de magie `skill` (id stable) ? */
function penaltyMatches(p: { skill: string }, skill: 'priere' | 'langue' | 'focalisation'): boolean {
  return p.skill === 'all' || p.skill === skill;
}

/** `castPenalty` PASSIF (interdiction PERMANENTE, MDG 07 l.250 : « ne peut jamais utiliser les
 *  Compétences Langue (Magick) et Focalisation ») porté par le `passive: GameOp[]` d'un Trait/mutation —
 *  MÊME vocabulaire `{op:'castPenalty', skill, blocked}` que le contrecoup temporisé (`applyOps`), sans
 *  `rounds`/`minutes`/`hours`/`days` → jamais purgé (dure tant que le Trait est porté). L'exception « sauf
 *  pour dissiper » (l.250) est satisfaite STRUCTURELLEMENT : la Dissipation (`battleDispelSpell`/
 *  `oocDispelSpell`, `dispel.ts`) est une Action DISTINCTE de l'incantation qui ne consulte JAMAIS
 *  `castBlockedBy` — aucun champ d'exception à porter en donnée. */
function passiveCastPenalties(c: Combatant): CastPenalty[] {
  const sources: { label: string; ops: import('./ops').GameOp[] }[] = [
    ...(c.traits ?? []).map((t) => ({ label: traitById.get(t.id)?.label ?? t.id, ops: traitById.get(t.id)?.passive ?? [] })),
    ...(c.mutations ?? []).map((m) => ({ label: m.label, ops: m.passive ?? [] })),
  ];
  const out: CastPenalty[] = [];
  for (const { label, ops } of sources) {
    for (const op of ops) {
      if (op.op !== 'castPenalty') continue;
      out.push({ label, skill: op.skill, ...(op.mod != null ? { mod: op.mod } : {}), ...(op.blocked ? { blocked: true } : {}), ...(op.maxZeroDR ? { maxZeroDR: true } : {}) });
    }
  }
  return out;
}

/** TOUTES les pénalités d'incantation actives : temporisées (`c.castPenalties`, contrecoups `applyOps`)
 *  + PASSIVES permanentes (Traits/mutations, `passiveCastPenalties`). SOURCE UNIQUE lue par
 *  `castPenaltyMod`/`castBlockedBy`/`prayerMaxZeroDR`. */
function allCastPenalties(c: Combatant): CastPenalty[] {
  return [...(c.castPenalties ?? []), ...passiveCastPenalties(c)];
}

/** Somme des modificateurs d'incantation actifs (contrecoups : « Langue maladroite −10 »…). */
export function castPenaltyMod(c: Combatant, skill: 'priere' | 'langue' | 'focalisation'): number {
  let m = 0;
  for (const p of allCastPenalties(c)) if (penaltyMatches(p, skill) && p.mod != null) m += p.mod;
  return m;
}

/** Libellé du contrecoup/de la capacité qui INTERDIT les Tests de `skill`, ou null si rien ne bloque.
 *  (Les pénalités TEMPORISÉES expirées sont purgées par l'entretien — fin de Round / horloge ; les
 *  PASSIVES durent tant que le Trait est porté.) */
export function castBlockedBy(c: Combatant, skill: 'priere' | 'langue' | 'focalisation'): string | null {
  return allCastPenalties(c).find((p) => penaltyMatches(p, skill) && p.blocked)?.label ?? null;
}

/** « Pensez à vos actes » (Colère, LDB 40) : tout Test de Prière réussi plafonné à 0 DR. */
export function prayerMaxZeroDR(c: Combatant): boolean {
  return allCastPenalties(c).some((p) => penaltyMatches(p, 'priere') && p.maxZeroDR);
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
 * Tests de Focalisation », LDB 46 l.123-125).
 */
export function castingValue(c: Combatant, skillName: string, spec?: string): number {
  // Carac de la compétence d'incantation via le POINT UNIQUE (skills.ts) : carac d'instance (data-driven)
  // sinon défaut LDB (Prière→Soc, Focalisation→FM, Langue→Int).
  // Surcharge DATA du Domaine pour Langue (Magick) : la Magie de la Gueule (réservée aux ogres) se lance
  // sur l'Endurance (ADE II 2 l.728) — attribut `castingChar` du domaine, AUCUN sniff d'espèce.
  const domChar = skillName === 'langue' ? findDomainById(arcaneDomainIdOf(c))?.castingChar : undefined;
  const charKey = domChar ?? effectiveSkillCharKey(c, skillName, {
    spec,
    fallback: skillName === 'priere' ? 'sociabilite' : skillName === 'focalisation' ? 'force-mentale' : 'intelligence',
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
 * « Repousser les Vents » (LDB 46 l.150) : −1 DR aux Tests d'Incantation et de
 * Focalisation par PA (net) sur la Localisation la mieux protégée par une ARMURE
 * PORTÉE (les PA naturels d'une mutation ne sont pas une armure). Exemptions
 * (LDB 46 l.150-152, inconditionnelles) : Magie des Arcanes (Métal) ignore les armures
 * métalliques, (Bêtes) ignore les armures de cuir. Troisième exemption, GATÉE par
 * `magic-vdm-incantation` (VDM 02 l.5, VDM 02 l.169) : le Sorcier du Chaos (Talent
 * Magie du Chaos, `castingKindOf(...) === 'chaos'`) ignore les armures du Chaos.
 */
export function armourCastDRPenalty(c: Combatant): number {
  // Domaine d'Arcane par ID STABLE (`arcaneDomainIdOf`) + matériau de l'armure par CAPACITÉ TYPÉE du
  // Groupe (`armourMaterialOf`) — plus AUCUNE devinette par regex (ni sur le nom de l'armure, ni sur le
  // libellé du Domaine). Métal ignore le métal, Bête le cuir (LDB 46 l.150-152, inconditionnel).
  // Sorcier du Chaos ignore le Chaos (VDM 02 l.169) — GATÉ par `magic-vdm-incantation` (VDM 02 l.5) :
  // prédicat = PRÉSENCE du Talent Magie du Chaos (`castingKindOf === 'chaos'`), pas sa spécialisation
  // (`chaosDomainOf` renverrait undefined pour un porteur non spécialisé).
  const domId = arcaneDomainIdOf(c);
  const ignoreMetal = domId === 'metal';
  const ignoreLeather = domId === 'bete';
  const ignoreChaos = rule('magic-vdm-incantation') === true
    && (c.talents ?? []).some((t) => castingKindOf(t.talentId) === 'chaos');
  let maxPA = 0;
  for (const it of c.items ?? []) {
    if (!it.equipped || it.kind !== 'armor' || !it.pa) continue;
    const mat = armourMaterialOf(it);
    if (mat === 'metal' && ignoreMetal) continue;
    if (mat === 'leather' && ignoreLeather) continue;
    if (mat === 'chaos' && ignoreChaos) continue;
    maxPA = Math.max(maxPA, Math.max(0, it.pa - (it.damageTaken ?? 0)));
  }
  return maxPA;
}

/** Spécialisation de Focalisation requise par un sort : l'id de son Domaine (`domainId`, ex. « bete »),
 *  sinon aucune (Sorts d'Arcane communs — n'importe quel Vent les alimente). Focalisation ET Magie des
 *  Arcanes portent désormais des IDS de domaine (fin de l'incohérence Vent/Lore) → ils matchent. */
export function focusSpecOf(spell: SpellLike): string | undefined {
  return spell.domainId ?? undefined;
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
  if (traitCapability(c.traits, 'spellcaster')) return true;
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
 * (`talent.test.matches`, lu sur l'entrée EFFECTIVE — la variante réglée active peut republier la ligne
 * « Tests » du Talent, #563/#564) correspond au Test `{ skill|char, spec }`. Plus AUCUN match par libellé.
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
    const matches = effectiveEntry(findTalentById(inst.talentId))?.test?.matches;
    if (matches?.some((m) => matchApplies(m, inst, q, whenHolds))) n += inst.times;
  }
  return n;
}

/** +DR de Talent au LANCEMENT (LDB 10) : `talentTestSLBonus` sur la Compétence d'incantation (id + spec),
 *  PLUS les auras de +DR (Aura de Dhar via `skillDRBonus`, [[game-traits-trigger-aura-mechanisms]]). Le
 *  casting n'a pas de vue de combat → les `when` ne s'appliquent pas (aucun talent d'incantation n'en a). */
export function castTestTalentDR(c: Combatant, skill: 'langue' | 'focalisation' | 'priere', spec?: string): number {
  // + hors de son terrain : −DR à TOUS les Tests, l'incantation comprise (Créature marine, MDG 16 p.140).
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
 * Influences malfaisantes/malveillantes — LDB 46 l.89 (« Règle du 8 ») ; `VDM 02 l.157-159` sous la
 * règle optionnelle `magic-vdm-incantation`. POINT DE LECTURE UNIQUE du delta : le déclencheur passe
 * du dé des unités à 8 au Test RATÉ (`testSucceeded === false`) ; l'escalade Mineure→Majeure quand une
 * Imparfaite Mineure est déjà due au même Test est commune aux deux versions. Renvoie la sévérité de
 * la Maladresse déclenchée, ou `null` (pas de déclencheur, ou pas à proximité d'une Corruption).
 * `alreadyMinor` = une Imparfaite Mineure a DÉJÀ été obtenue au Test pour une autre raison.
 */
export function malevolentInfluenceSeverity(roll: number, testSucceeded: boolean, nearCorruption: boolean, alreadyMinor: boolean): 'mineure' | 'majeure' | null {
  if (!nearCorruption) return null;
  const triggered = rule('magic-vdm-incantation') === true ? !testSucceeded : roll % 10 === 8;
  if (!triggered) return null;
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

/** Les trois effets supplémentaires d'une Incantation Critique (LDB 46 l.52-59, `VDM 02 l.54-56`). */
export type CritChoice = 'critique' | 'puissance' | 'ineluctable';

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
  /** DISSIPÉ par un Contre-sort (LDB 46 l.156) — une « Puissance totale » ne le repêche pas. */
  dispelled?: boolean;
  log: string;
}

/**
 * NIVEAU D'INCANTATION EFFECTIF d'un Sort au moment de sa résolution — SITE UNIQUE de lecture du NI.
 * `focusedNI0` force 0 (Sort focalisé, LDB 46 l.128). Sinon le NI imprimé traverse les modificateurs
 * du LIEU (`environmentNIMods`) puis ceux que l'appelant apporte (objet porté, breuvage, support de
 * lecture, Activité) — `effectiveCastingNumber` fait toute l'arithmétique. Le NI IMPRIMÉ de départ
 * est celui de la parenthèse quand le lanceur est fourni et que le Rituel lui ouvre sa valeur
 * réduite (`VDM 02 l.398`, `ritualReduction`) : c'est une autre valeur de BASE, pas un
 * modificateur — la clause vise les Domaines du LANCEUR, là où `CastingNumberSubject.domainId`
 * porte celui du SORT.
 */
export function castingNumberOf(
  spell: SpellLike,
  focusedNI0 = false,
  env: MagicEnvironment = {},
  niMods: readonly CastingNumberMod[] = [],
  caster?: Combatant,
): number {
  if (focusedNI0) return 0;
  const subject: CastingNumberSubject = {
    id: spell.id,
    domainId: spell.domainId,
    kind: spell.isRitual ? 'rituel' : 'sort',
    chaosMagic: caster ? chaosDomainOf(caster) != null : undefined,
  };
  const printed = (caster ? ritualReduction(caster, spell)?.cn : undefined) ?? spell.cn ?? 0;
  return effectiveCastingNumber(printed, subject, [...environmentNIMods(env), ...niMods]);
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
  /** Magie des mers (MDG 02 l.178-186) : contexte navigation + vent, fourni par l'appelant. */
  sea: { atSea?: boolean; wind?: import('./domainAttributes').SeaWind | null } = {},
  /** Rubrique de VENT du Domaine (`VDM 04 l.48-56` et ses 7 homologues) : circonstances du monde
   *  courant, fournies par l'appelant (état). */
  wind: WindContext = {},
  /** Magie ENVIRONNEMENTALE (`VDM 14`, option `magic-vdm-environnementale`) : état magique du LIEU
   *  (palier de Saturation + phénomènes arcaniques présents), fourni par l'appelant (état). */
  env: MagicEnvironment = {},
  /** Modificateurs de NI apportés par le PORTEUR (objet porté, breuvage, support de lecture,
   *  Activité) — fournis par l'appelant ; ceux du LIEU sont lus dans `env`. */
  niMods: readonly CastingNumberMod[] = [],
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
      log: `${caster.label} ne maîtrise pas ${skill} et ne peut pas incanter ${spell.label}.`,
    };
  }
  const value = castingValue(caster, info.skill, info.spec) + extraMod;
  const t = rollTest(value, difficulty, rng);
  // « Repousser les Vents » (LDB 46 l.150) : −1 DR par PA de la localisation la mieux
  // protégée par une armure portée (Tests d'Incantation ET de Focalisation).
  const pen = armourCastDRPenalty(caster);
  // LDB 10 l.20 : +1 DR par acquisition d'un Talent lié au Test, sur utilisation RÉUSSIE
  // (Diction instinctive ×N → +N DR au Test d'Incantation). Appliqué au JET (pas à
  // l'évaluation : rederiveCastSL — Chance « +1 DR » — repart du DR déjà boosté).
  const tal = t.success ? castTestTalentDR(caster, info.skill, info.spec) : 0;
  // Cieux/Azyr en mer (MDG 02 l.184) : ±1 DR d'Incantation selon le vent (Violente tempête/Calme plat).
  const seaDR = t.success ? domainSeaIncantationDR(spell, !!sea.atSea, sea.wind) : 0;
  // Rubrique de VENT du Domaine (`VDM 04 l.48-56` et ses 7 homologues).
  const windDR = t.success ? domainWindDR(spell, 'incantation', wind) : 0;
  // Magie ENVIRONNEMENTALE (`VDM 14`) : Saturation + phénomènes arcaniques du lieu.
  const envDR = t.success ? environmentTestDR(spell, 'incantation', env, caster) : 0;
  const delta = -pen + tal + seaDR + windDR + envDR;
  return evaluateCasting(caster, spell, delta ? { ...t, sl: t.sl + delta } : t, focusedNI0, !!sea.atSea, env, niMods);
}

/**
 * Probabilité (0..1) déterministe qu'un Test d'Incantation ABOUTISSE (réussite ET DR≥NI).
 * Énumère les 100 jets possibles sans RNG — AUCUN effet de bord. Miroir exact de `resolveCasting` :
 * même `value`, même pénalité armure (`pen`), même bonus talent (`tal`), même DR de Vent (`windDR`)
 * et de magie environnementale (`envDR`), même condition `cast`.
 * `focusedNI0 = true` → NI forcé à 0 (Sort focalisé, identique à `resolveCasting`).
 */
export function castLandProbability(caster: Combatant, spell: SpellLike, focusedNI0 = false, wind: WindContext = {}, env: MagicEnvironment = {}, niMods: readonly CastingNumberMod[] = []): number {
  const info = castInfo(spell);
  if (!knowsCastingSkill(caster, info.skill, info.spec)) return 0;
  const policy = getTestPolicy();
  const value = castingValue(caster, info.skill, info.spec);
  const pen = armourCastDRPenalty(caster);
  const tal = castTestTalentDR(caster, info.skill, info.spec);
  const windDR = domainWindDR(spell, 'incantation', wind);
  const envDR = environmentTestDR(spell, 'incantation', env, caster);
  const ni = castingNumberOf(spell, focusedNI0, env, niMods, caster);
  let lands = 0;
  for (let r = 1; r <= 100; r++) {
    const t = evaluateTest(r, value, policy);
    if (!t.success) continue;
    const dr = t.sl - pen + tal + windDR + envDR;
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
  /** Bête/Ghur en mer (MDG 02 l.180) : Critique/Maladresse déclenchés aussi sur un résultat
   *  finissant par 0 (en plus des doubles). */
  atSea = false,
  /** Magie ENVIRONNEMENTALE (`VDM 14`, folio 198) : une Jonction saturée élargit l'Incantation
   *  Critique aux RÉUSSITES finissant par 0 — la Maladresse, elle, reste sur les seuls doubles. */
  env: MagicEnvironment = {},
  /** Modificateurs de NI apportés par le PORTEUR — cf. `resolveCasting`. */
  niMods: readonly CastingNumberMod[] = [],
): CastResult {
  const info = castInfo(spell);
  // « Pensez à vos actes » (Colère des dieux, LDB 40) : tout Test de PRIÈRE réussi
  // ne peut pas obtenir plus de 0 DR pendant la durée du contrecoup.
  if (info.skill === 'priere' && t.success && t.sl > 0 && prayerMaxZeroDR(caster)) {
    t = { ...t, sl: 0 };
  }
  const ni = castingNumberOf(spell, focusedNI0, env, niMods, caster);
  const cast = t.success && (!info.requireNI || t.sl >= ni);
  const widenSea = domainSeaWidensCritFumble(spell, atSea) && t.roll % 10 === 0;
  const widenEnv = environmentWidensCrit(env) && t.roll % 10 === 0;
  const isCritical = (t.isDouble || widenSea || widenEnv) && t.success;
  const isFumble = (t.isDouble || widenSea) && !t.success;
  let log: string;
  if (!t.success) {
    log = `${caster.label} échoue à incanter ${spell.label}.`;
  } else if (!cast) {
    log = `${caster.label} incante ${spell.label} mais sans assez de puissance (DR ${t.sl} < NI ${ni}).`;
  } else {
    log = `${caster.label} lance ${spell.label} (DR ${t.sl}).`;
  }
  return { cast, roll: t.roll, target: t.target, sl: t.sl, isCritical, isFumble, log };
}

/** Issue d'un Contre-sort (Dissipation, LDB 46 l.156). */
export interface CounterspellOutcome {
  /** Le contre-lanceur GAGNE le Test opposé : le Sort est dissipé. */
  dispelled: boolean;
  /** Jet de Langue (Magick) du contre-lanceur (affichage/journal). */
  counter: TestResult;
  /** « le Sort utilise le DR du Test opposé » : DR NET (signé) du lanceur si non dissipé. */
  casterNetSL: number;
  log: string;
}

/** Seul un SORT se dissipe (LDB 46 l.156 : « Si un Sort vous cible ») — pas une Prière
 *  (Bénédictions/Miracles relèvent de la Colère des dieux, LDB 40). */
export function isDispellableSpell(spell: SpellLike): boolean {
  return !castInfoIsPrayer(spell);
}

/**
 * Dissipation (LDB 46 l.156) : « vous pouvez opposer le Test d'Incantation avec Langue
 * (Magick), car vous chantez un Contre-sort. Effectuez un Test opposé de Langue (Magick). Sur un
 * succès, vous dissipez le Sort ; sur un échec, le Sort utilise le DR du Test opposé pour
 * déterminer si l'incantation a réussi normalement. Vous ne pouvez tenter de dissiper qu'un seul
 * Sort chaque Round. »
 * `castT` = le Test d'Incantation du lanceur, DÉJÀ jeté (DR ajustés : talents, armure). Le jet du
 * contre-lanceur subit les mêmes règles de Test de Langue (Magick) : « Repousser les Vents »
 * (l.150, −1 DR/PA) et +1 DR par Talent lié réussi (LDB 10 l.20 — Diction instinctive).
 * Égalité du Test opposé : personne ne gagne → pas de dissipation, DR net 0 appliqué au NI.
 */
/** Reconstruit le Test d'Incantation FIGÉ d'un résultat d'incantation, pour l'opposition du
 *  Contre-sort (LDB 46 l.156). Source unique. */
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
      ? `Contre-sort de ${counter.label} (${counterT.roll}/${counterT.target}, DR ${counterT.sl}) : le Sort est DISSIPÉ.`
      : `Contre-sort de ${counter.label} (${counterT.roll}/${counterT.target}, DR ${counterT.sl}) : insuffisant — l'incantation se résout à DR ${net}.`,
  };
}

export function resolveCounterspell(counter: Combatant, castT: TestResult, rng: RNG = defaultRNG): CounterspellOutcome {
  const value = castingValue(counter, 'langue', 'magick');
  const t = rollTest(value, 'intermediaire', rng);
  const adj = t.success ? castTestTalentDR(counter, 'langue', 'magick') - armourCastDRPenalty(counter) : 0;
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
  /** Magie des mers (MDG 02 l.178-186) : le Projectile magique EST un Test d'Incantation
   *  (LDB 46 l.24 : « Pour lancer un Sort, effectuez un Test de Langue (Magick) ») — même contexte que `resolveCasting`. */
  sea: { atSea?: boolean; wind?: import('./domainAttributes').SeaWind | null } = {},
  /** Rubrique de VENT du Domaine — même contexte que `resolveCasting`. */
  wind: WindContext = {},
  /** Magie ENVIRONNEMENTALE (`VDM 14`) — même contexte que `resolveCasting`. */
  env: MagicEnvironment = {},
): MissileResult {
  const cr = resolveCasting(caster, spell, rng, 'intermediaire', focusedNI0, extraMod, sea, wind, env);
  return evaluateMissile(caster, target, spell, cr);
}

/** Part du DR d'Incantation ajoutée aux Dégâts d'un Projectile magique (LDB 46 l.101) — sous
 *  `VDM 02 l.68` : « Pour calculer les Dégâts, ajoutez le Bonus de Force Mentale du lanceur aux
 *  Dégâts du Sort. » Le DR retiré peut être regagné en Dégâts par la Surincantation (`VDM 02
 *  l.198`, `missileOvercastDamageBonus`). Point de lecture UNIQUE du delta (option
 *  `magic-vdm-incantation`). */
export function missileDamageSL(sl: number, overcastDamageSteps = 0, source: OvercastSource = 'arcane'): number {
  return rule('magic-vdm-incantation') === true
    ? missileOvercastDamageBonus(source, overcastDamageSteps)
    : Math.max(0, sl);
}

/** « Puissance totale » d'une Incantation Critique (LDB 46 l.31) — sous `VDM 02 l.55` : « le Sort
 *  est lancé. Le lanceur peut ajouter le chiffre des dizaines de son lancer d'Incantation à son DR
 *  pour obtenir une Surincantation ». Point de lecture UNIQUE du delta (option
 *  `magic-vdm-incantation`) ; renvoie `res` À L'IDENTIQUE quand il n'y a rien à changer. */
export function applyFullPower(res: CastResult): CastResult {
  const tens = rule('magic-vdm-incantation') === true ? Math.floor((res.roll % 100) / 10) : 0;
  if (res.cast && tens === 0) return res;
  return { ...res, cast: true, sl: res.sl + tens };
}

/** Effet d'Incantation Critique retenu quand le lanceur n'en a choisi aucun (IA, résolution auto) :
 *  repêcher un DR insuffisant, sinon Blessure Critique pour un Projectile, sinon Force inéluctable.
 *  SOURCE UNIQUE du défaut (modale, allocation de Surincantation, `applyCast`). */
export function defaultCritChoice(res: Pick<CastResult, 'cast'>, missile: boolean): CritChoice {
  return !res.cast ? 'puissance' : missile ? 'critique' : 'ineluctable';
}

/** DR disponible pour la Surincantation : le DR du Test, augmenté par « Puissance totale » quand
 *  cet effet d'Incantation Critique est retenu (`applyFullPower`). Lu AVANT l'allocation des pas —
 *  la modale, l'allocation du store et `applyCast` voient le même DR. */
export function overcastSL(res: CastResult, critChoice: CritChoice | undefined, missile: boolean): number {
  if (!res.isCritical) return res.sl;
  return (critChoice ?? defaultCritChoice(res, missile)) === 'puissance' ? applyFullPower(res).sl : res.sl;
}

/** Le Sort est-il lancé une fois l'effet d'Incantation Critique retenu appliqué ? « Puissance
 *  totale » repêche un DR insuffisant (LDB 46 l.31, `VDM 02 l.55`) — prédicat UNIQUE partagé par
 *  la pose du gabarit de zone, la Surincantation et la confirmation du lancement. */
export function castAfterCrit(res: CastResult, critChoice: CritChoice | undefined, missile: boolean): boolean {
  return res.cast || (res.isCritical && (critChoice ?? defaultCritChoice(res, missile)) === 'puissance');
}
/** Re-dérive les Dégâts d'un Projectile magique depuis un résultat d'incantation déjà obtenu. */
export function evaluateMissile(
  caster: Combatant,
  target: Combatant,
  spell: SpellLike,
  cr: CastResult,
  locOverride?: HitLocation,
  apReduction = 0, // Déviation Critique (LDB 63) : recalcul des Dégâts à PA−1 quand le défenseur sacrifie 1 PA
  /** DR alloués à la colonne « Dégât en plus » du Tableau de Surincantation (`VDM 02 l.198`). */
  overcastDamageSteps = 0,
): MissileResult {
  if (!cr.cast) {
    return { ...cr, hit: false, defenderDefeated: false };
  }
  // Localisation : le jet d'Incantation inversé (LDB 46), SAUF Coup Critique → 1d100 frais (`locOverride`,
  // LDB 18 l.53) ; les Dégâts ci-dessous sont alors RÉ-ÉVALUÉS à cette loc (PA + mods de Domaine, l.55).
  const loc = locOverride ?? hitLocationByShape(reverseRoll(cr.roll), target.bodyShape);
  const spellDmg = missileDamage(spell);
  const bfm = bonus(effectiveChar(caster, 'force-mentale'));
  // Attribut de Domaine (LDB 48 — L14) : Métal ignore les PA métalliques ET les ajoute en Dégâts ;
  // Cieux ignore les PA métalliques ; Ombres ignore tous les PA non magiques.
  const totalAP = Math.max(0, effectiveArmourAt(target, loc) - apReduction); // PA portés + temporisés (Armure Aethyrique), moins le PA sacrifié en Déviation
  const dom = domainMissileMods(target, spell, loc, totalAP);
  const damage = (spellDmg?.damage ?? 0) + missileDamageSL(cr.sl, overcastDamageSteps, overcastSourceOf(spell)) + bfm + dom.bonusDamage;
  // Certains Projectiles ignorent le Bonus d'Endurance et/ou les PA (p.238 + sorts).
  const tb = spellDmg?.ignoreBE ? 0 : bonus(effectiveChar(target, 'endurance'));
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
      `${caster.label} lance ${spell.label} sur ${target.label} : ` +
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
  /** DR alloués à la colonne « Dégât en plus » (`VDM 02 l.198`) — DOIT être le même que celui déjà
   *  reflété dans `woundsAtFullPA` par l'appelant, sinon le recalcul à PA−1 perd ce bonus. */
  overcastDamageSteps = 0,
): { eligible: boolean; extraWounds: number } {
  if (deviatableArmourAt(target, loc) <= 0) return { eligible: false, extraWounds: 0 };
  if (missileDamage(spell)?.ignorePA) return { eligible: false, extraWounds: 0 };
  const totalAP = effectiveArmourAt(target, loc);
  const { apIgnored } = domainMissileMods(target, spell, loc, totalAP);
  if (totalAP - apIgnored <= 0) return { eligible: false, extraWounds: 0 }; // PA entièrement bypassée → no-op
  const at1 = evaluateMissile(caster, target, spell, cr, loc, 1, overcastDamageSteps).woundsLost ?? 0; // recalcul à PA−1
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
 *  Domaine du sort exige la Focalisation correspondante, LDB 46 l.128-132).
 *  `atSea` = Magie des mers (MDG 02 l.178-186, `DomainData.seaModifier`) : contexte navigation
 *  fourni par l'appelant (état — hors du moteur pur). */
export function resolveFocus(
  caster: Combatant,
  spell: SpellLike,
  rng: RNG = defaultRNG,
  difficulty: Difficulty = 'intermediaire',
  atSea = false,
  /** Vents Tourbillonnants (LDB 46 l.179-190, option `vents-tourbillonnants`) : modificateur de la
   *  force des Vents CE Round, calculé par l'ÉTAT (`windsMagicModOf`, hors du moteur pur). */
  extraMod = 0,
  /** Rubrique de VENT du Domaine (`VDM 04 l.48-56` et ses 7 homologues) : circonstances du monde
   *  courant, fournies par l'appelant (état). */
  windCtx: WindContext = {},
  /** Magie ENVIRONNEMENTALE (`VDM 14`, option `magic-vdm-environnementale`) : état magique du LIEU,
   *  fourni par l'appelant (état). */
  env: MagicEnvironment = {},
): FocusResult {
  const sk = focusSkillFor(caster, spell);
  if (!sk) {
    // AFFICHAGE : Focalisation est spécialisée par VENT → montre le Vent du Domaine (id bete → « Ghur »).
    const spec = focusSpecOf(spell);
    const wind = spec ? (findDomainById(spec)?.wind ?? findDomainById(spec)?.label ?? spec) : undefined;
    return {
      dr: 0, isCritical: false, isFumble: false, roll: 0,
      log: `${caster.label} ne maîtrise pas Focalisation${wind ? ` (${wind})` : ''}.`,
    };
  }
  const value = castingValue(caster, 'focalisation', sk.spec) + extraMod;
  const t = rollTest(value, difficulty, rng);
  // « Repousser les Vents » : −1 DR par PA de la localisation la mieux protégée (l.199).
  // LDB 10 l.20 : +1 DR par acquisition d'un Talent lié au Test réussi (Harmonisation aethyrique ×N).
  // Rubrique de VENT du Domaine (`VDM 04 l.48-56` et ses 7 homologues) : DR de Focalisation.
  // Magie ENVIRONNEMENTALE (`VDM 14`) : Saturation + phénomènes arcaniques du lieu.
  let dr = t.success ? Math.max(0, t.sl + castTestTalentDR(caster, 'focalisation') - armourCastDRPenalty(caster) + domainSeaFocalisationDR(spell, atSea) + domainWindDR(spell, 'focalisation', windCtx) + environmentTestDR(spell, 'focalisation', env, caster)) : 0;
  if (dr > 0 && domainSeaFocalisationDoubled(spell, atSea)) dr *= 2; // Vie/Ghyran en mer (MDG 02 l.186)
  // Bête/Ghur en mer (MDG 02 l.180) : Critique déclenché aussi sur un résultat finissant par 0.
  const isCritical = t.success && (t.isDouble || (domainSeaWidensCritFumble(spell, atSea) && t.roll % 10 === 0));
  // Maladresse ÉLARGIE en Focalisation (l.190-191) : tout double OU tout résultat
  // terminant par un 0 au-delà de la Compétence (00, 99, 90, 88…) → Imparfaite MAJEURE.
  const isFumble = !t.success && (t.isDouble || t.roll % 10 === 0);
  const log = t.success
    ? `${caster.label} focalise ${spell.label} (+${dr} DR).`
    : `${caster.label} échoue à focaliser ${spell.label}.`;
  return { dr, isCritical, isFumble, roll: t.roll, target: t.target, sl: t.sl, log };
}

/** DR accumulé après une Focalisation Critique — LDB 46 l.136 : le Sort devient lançable
 *  immédiatement, quel que soit le DR déjà accumulé. Sous `VDM 02 l.145` : le lanceur ajoute
 *  au Test étendu un DR bonus égal à son Bonus de Force Mentale, sans compléter d'un coup.
 *  Point de lecture UNIQUE du delta (option `magic-vdm-incantation`). */
export function focusCriticalDR(caster: Combatant, dr: number, ni: number): number {
  return rule('magic-vdm-incantation') === true
    ? dr + bonus(effectiveChar(caster, 'force-mentale'))
    : Math.max(dr, ni);
}

/** Dissiper son PROPRE Sort (`VDM 02 l.186`) : +1 DR au Test de Langue (Magick). Absent du Livre
 *  de base (`LDB 46 l.154-162`). Point de lecture UNIQUE du delta (option `magic-vdm-incantation`). */
export function dispelOwnSpellDR(ownSpell: boolean): number {
  return ownSpell && rule('magic-vdm-incantation') === true ? 1 : 0;
}
