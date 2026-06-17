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
import { rollTest, resolveOpposed, isDoubleRoll, TestResult } from './tests';
import { hasTraitKey } from './traits/dispatch';
import { bonus, effectiveChar, effectiveArmourAt } from './characteristics';
import { reverseRoll, hitLocationByShape } from './combat';
import { Formula, resolveFormula } from './ops';
import { arcaneDomainOf } from './combatFeatures/dispatch';
import { domainMissileMods } from './domainAttributes';
import { MINUTES_PER_DAY, minutesUntilNext, DAWN_MINUTE } from './clock';
import { Combatant, HitLocation, Difficulty, CharKey, CHAR_LABELS, CHAR_BY_LABEL } from './types';
import { findTalent, findTalentById, findSkill } from '../data';
import { slugId } from '../data/slug';

/** Sous-ensemble des champs de sort nécessaires au moteur (cf. src/data/spells.json). */
export interface SpellLike {
  label: string;
  type: string;
  /** Domaine/Vent (« Feu », « Ombres »…) ou culte — null pour les sorts génériques. */
  subType?: string | null;
  cn: number | null;
  duration?: string;
  desc: string;
}

/** Le personnage possède-t-il le Talent nommé ? (Diction instinctive, Harmonisation aethyrique…) */
export function hasTalent(c: Combatant, name: string): boolean {
  const id = findTalent(name)?.id ?? slugId(name);
  return c.talents.some((t) => t.talentId === id && (t.times ?? 1) >= 1);
}

/** Branche d'incantation déduite du type de sort. */
export interface CastInfo {
  /** Compétence de test (nom tel que stocké sur le Combatant). */
  skill: 'Prière' | 'Langue';
  /** Spécialisation requise pour la compétence, le cas échéant. */
  spec?: string;
  /** Faut-il comparer le DR au Niveau d'Incantation ? (faux pour les Prières.) */
  requireNI: boolean;
}

const PRAYER_TYPES = ['Béni', 'Invocation'];

/** Détermine la branche (et donc la Compétence) selon le type du sort. */
export function castInfo(spell: SpellLike): CastInfo {
  if (PRAYER_TYPES.includes(spell.type)) {
    return { skill: 'Prière', requireNI: false };
  }
  return { skill: 'Langue', spec: 'Magick', requireNI: true };
}

/** Vrai pour les Sorts d'Arcane/Domaine pouvant être alimentés par Focalisation. */
export function isArcaneSpell(spell: SpellLike): boolean {
  return !PRAYER_TYPES.includes(spell.type) && spell.type !== 'Magie mineure';
}

/** La pénalité `p` vise-t-elle la compétence de magie `skill` ? */
function penaltyMatches(p: { skill: string }, skill: 'Prière' | 'Langue' | 'Focalisation'): boolean {
  return p.skill === 'all' || p.skill === skill;
}

/** Somme des modificateurs d'incantation actifs (contrecoups : « Langue maladroite −10 »…). */
export function castPenaltyMod(c: Combatant, skill: 'Prière' | 'Langue' | 'Focalisation'): number {
  let m = 0;
  for (const p of c.castPenalties ?? []) if (penaltyMatches(p, skill) && p.mod != null) m += p.mod;
  return m;
}

/** Libellé du contrecoup qui INTERDIT les Tests de `skill`, ou null si rien ne bloque.
 *  (Les pénalités expirées sont purgées par l'entretien — fin de Round / horloge.) */
export function castBlockedBy(c: Combatant, skill: 'Prière' | 'Langue' | 'Focalisation'): string | null {
  return (c.castPenalties ?? []).find((p) => penaltyMatches(p, skill) && p.blocked)?.label ?? null;
}

/** « Pensez à vos actes » (Colère, LDB 40) : tout Test de Prière réussi plafonné à 0 DR. */
export function prayerMaxZeroDR(c: Combatant): boolean {
  return (c.castPenalties ?? []).some((p) => penaltyMatches(p, 'Prière') && p.maxZeroDR);
}

/**
 * Valeur d'un test d'incantation : Caractéristique de la compétence + avances de
 * celle-ci (si le personnage la possède), sinon la Caractéristique seule —
 * modulée par les contrecoups actifs (castPenalties) et, EN COMBAT, par
 * l'Avantage (« Les Avantages s'appliquent aux Tests d'Incantation, pas aux
 * Tests de Focalisation », LDB 46 l.176).
 */
export function castingValue(c: Combatant, skillName: string, spec?: string): number {
  const charKey = skillName === 'Prière' ? 'Soc' : skillName === 'Focalisation' ? 'FM' : 'Int';
  const base = effectiveChar(c, charKey);
  const sid = findSkill(skillName)?.id ?? slugId(skillName);
  const sk = c.skills.find(
    (s) => s.skillId === sid && (spec == null || s.spec === spec),
  );
  const penalty = skillName === 'Prière' || skillName === 'Langue' || skillName === 'Focalisation'
    ? castPenaltyMod(c, skillName)
    : 0;
  const advantage = skillName === 'Focalisation' ? 0 : 10 * (c.advantage ?? 0);
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
  // Domaine d'Arcane (spec du talent à castingKind:'arcane') — Métal ignore le métal, Bête le cuir.
  const arc = arcaneDomainOf(c) ?? '';
  const ignoreMetal = /^M[ée]tal$/.test(arc);
  const ignoreLeather = /^Bêtes?$/.test(arc);
  let maxPA = 0;
  for (const it of c.items ?? []) {
    if (!it.equipped || it.kind !== 'armor' || !it.pa) continue;
    const name = `${it.name} ${it.subType ?? ''}`.toLowerCase();
    const metal = /maille|plate|métal|metal|gambison.*métal/.test(name);
    const leather = /cuir/.test(name);
    if (metal && ignoreMetal) continue;
    if (leather && ignoreLeather) continue;
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
  const sid = findSkill(skillName)?.id ?? slugId(skillName);
  return c.skills.some(
    (s) => s.skillId === sid && (spec == null || s.spec === spec) && s.advances >= 1,
  );
}

/**
 * Dégâts d'un Projectile magique : « Dégât(s) +N ». Détecte les sorts qui
 * ignorent les PA et/ou le Bonus d'Endurance (ex. drain de Shyish, Vortex d'âmes,
 * sorts de Chamon — Livre de base, Magie des Couleurs).
 */
export function parseSpellDamage(
  desc: string,
): { damage: number; ignorePA: boolean; ignoreBE: boolean } | null {
  const m = desc.match(/D[ée]g[âa]ts?\s*\+(\d+)/i);
  if (!m) return null;
  return {
    damage: parseInt(m[1], 10),
    ignorePA: /ignore[^.]*\bPA\b/i.test(desc),
    ignoreBE: /ignore[^.]*Bonus d['’]Endurance/i.test(desc),
  };
}


/** Vrai si le sort est un Projectile magique (Dégâts résolus comme une attaque). */
export function isMagicMissile(spell: SpellLike): boolean {
  return /projectile magique/i.test(spell.desc);
}

/**
 * LDB 10 l.20 (Schéma des Talents, « Tests ») : « pour chaque acquisition de ce Talent, vous
 * gagnez +1 DR pour toute utilisation RÉUSSIE de la Compétence liée au Talent. » Somme des
 * acquisitions des Talents du porteur dont le champ « Tests » (talents.json, verbatim)
 * référence la Compétence d'incantation visée — piloté par la DONNÉE, pas de liste en dur :
 * Diction instinctive → « Langue (Magick) quand vous faites une Incantation » ;
 * Harmonisation aethyrique → « Focalisation (Au choix) ».
 * `needle` : « Langue (Magick) » (pas « Langue » nu — un Talent lié à Langue (Bretonnien)
 * ne booste pas l'incantation), « Focalisation », « Prière ».
 */
export function castTestTalentDR(c: Combatant, needle: 'Langue (Magick)' | 'Focalisation' | 'Prière'): number {
  let n = 0;
  for (const t of c.talents ?? []) {
    const data = findTalentById(t.talentId);
    if (data?.test?.toLowerCase().includes(needle.toLowerCase())) n += t.times;
  }
  return n;
}

/**
 * Zone d'Effet (LDB 47 l.44) : « les Sorts marqués ZdE affectent tous les individus
 * à l'intérieur de ce DIAMÈTRE ». Diamètre en mètres depuis le champ Cible
 * (« ZdE (Bonus de Force Mentale) mètres », « ZdE (4) mètres »…), résolu contre le
 * lanceur. Null si pas de ZdE chiffrable (« ZdE (Spécial) », « un lieu unique »…).
 */
export function zdeDiameterMeters(target: number | string | null | undefined, caster: Combatant): number | null {
  if (typeof target !== 'string') return null;
  // « ZdE (…) mètres » OU diamètre nu « (Bonus de X) mètres » (Explosion, Dôme… — l'extraction
  // a parfois perdu le marqueur ZdE) ; jamais les cibles dénombrées (« (BInt) alliés »், « Vous »…).
  if (!/ZdE/i.test(target) && !/mètres?\s*$/i.test(target.trim())) return null;
  if (/alli[ée]s|voilier|lieu unique|sp[ée]cial/i.test(target)) return null;
  const bon = target.match(/\(Bonus d[e'’]\s*([^)]+?)\)/i);
  if (bon) {
    const key = CHAR_BY_LABEL[bon[1].trim()];
    if (key) return bonus(effectiveChar(caster, key));
  }
  const lit = target.match(/\((\d+)\)|(\d+)\s*mètres?/i);
  if (lit) return parseInt(lit[1] ?? lit[2], 10);
  return null;
}

/** Rayon de la ZdE en CASES (grille 2 m/case) : diamètre/2 mètres → ÷2 m/case,
 *  arrondi à l'entier inférieur (min 0 = la seule case du centre). */
export function zdeRadiusTiles(target: number | string | null | undefined, caster: Combatant): number | null {
  const diam = zdeDiameterMeters(target, caster);
  return diam == null ? null : Math.max(0, Math.floor(diam / 2 / 2));
}

/**
 * Portée d'un sort en CASES (2 m/case) : « 6 mètres », « (Force Mentale) mètres »
 * (caractéristique pleine), « (Bonus de X) mètres », « Vous » → 0, « Contact »/
 * « Toucher » → 1. Null = non chiffrable (pas de garde-fou, comportement historique).
 */
export function spellRangeTiles(range: string | null | undefined, caster: Combatant): number | null {
  if (!range) return null;
  if (/^vous$/i.test(range.trim())) return 0;
  if (/contact|toucher/i.test(range)) return 1;
  const bon = range.match(/\(Bonus d[e'’]\s*([^)]+?)\)/i);
  if (bon) {
    const key = CHAR_BY_LABEL[bon[1].trim()];
    if (key) return Math.max(1, Math.floor(bonus(effectiveChar(caster, key)) / 2));
  }
  const full = range.match(/\(([^)]+)\)\s*mètres?/i);
  if (full) {
    const key = CHAR_BY_LABEL[full[1].trim()];
    if (key) return Math.max(1, Math.floor(effectiveChar(caster, key) / 2));
  }
  const lit = range.match(/(\d+)\s*mètres?/i);
  if (lit) return Math.max(1, Math.floor(parseInt(lit[1], 10) / 2));
  return null;
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
export function parseDurationRounds(duration?: string): number | null {
  if (!duration) return null;
  const m = duration.match(/(\d+)\s*rounds?/i);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Durée d'un sort en Rounds, au niveau FORMULE : « N rounds » (littéral) ou
 * « (Bonus de X) Rounds » (résolu contre le lanceur à l'application). Retourne
 * null pour les durées hors-rounds (minutes/heures/jours/Instantanée) : l'appelant
 * NE DOIT PAS inventer un nombre de rounds dans ce cas (Livre de base : la durée est
 * celle indiquée par le sort, aucun défaut d'1 round).
 */
export function durationRoundsFormula(duration: string | undefined): Formula | null {
  const lit = parseDurationRounds(duration);
  if (lit != null) return lit;
  if (!duration) return null;
  const f = duration.match(/\(Bonus d[e'’]\s*([^)]+)\)\s*Rounds?/i);
  if (f) {
    const key = CHAR_BY_LABEL[f[1].trim()];
    if (key) return { bonusOf: key };
  }
  return null;
}

/** Durée d'un buff en Rounds, résolue contre le lanceur (cf. durationRoundsFormula). */
export function buffDurationRounds(duration: string | undefined, caster: Combatant): number | null {
  const f = durationRoundsFormula(duration);
  return f == null ? null : resolveFormula(f, caster);
}

/**
 * Durée d'un sort à l'échelle de l'HORLOGE (LDB 47), en minutes à partir de `now` — pour les
 * durées hors-rounds : « 1 heure », « (Bonus de Force Mentale) jours », « (Intelligence)
 * minutes », « Jusqu'au (prochain) lever du soleil » (= prochaine aube ; à l'aube pile, un
 * cycle entier — même convention que le repos). Renvoie null si la durée n'est pas une durée
 * d'horloge (Rounds / Instantanée / Spécial) — l'appelant n'invente RIEN.
 */
export function durationClockMinutes(duration: string | undefined, caster: Combatant, now: number): number | null {
  if (!duration) return null;
  if (durationRoundsFormula(duration) != null) return null; // échelle tactique : gérée en Rounds
  const UNIT: Record<string, number> = { minute: 1, heure: 60, jour: MINUTES_PER_DAY };
  const unitOf = (s: string) => UNIT[s.toLowerCase().replace(/s$/, '')];
  // « Jusqu'au (prochain) lever du soleil » (Tour de guet, LDB 47).
  if (/jusqu.au\s+(prochain\s+)?lever\s+d[eu]\s*soleil/i.test(duration)) {
    const toDawn = minutesUntilNext(now, DAWN_MINUTE);
    return toDawn === 0 ? MINUTES_PER_DAY : toDawn;
  }
  // Littéral : « 1 heure », « 3 jours ».
  const lit = duration.match(/^(\d+)\s*(minutes?|heures?|jours?)/i);
  if (lit) return parseInt(lit[1], 10) * unitOf(lit[2]);
  // « (Bonus de X) unités » ou « (X) unités » — valeur du lanceur.
  const f = duration.match(/^\((Bonus d[e'’]\s*)?([^)]+)\)\s*(minutes?|heures?|jours?)/i);
  if (f) {
    const key = CHAR_BY_LABEL[f[2].trim()];
    if (!key) return null;
    const val = f[1] ? bonus(effectiveChar(caster, key)) : effectiveChar(caster, key);
    return Math.max(1, val) * unitOf(f[3]);
  }
  return null;
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
  const tal = t.success ? castTestTalentDR(caster, info.skill === 'Prière' ? 'Prière' : 'Langue (Magick)') : 0;
  return evaluateCasting(caster, spell, pen || tal ? { ...t, sl: t.sl - pen + tal } : t, focusedNI0);
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
  if (info.skill === 'Prière' && t.success && t.sl > 0 && prayerMaxZeroDR(caster)) {
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
  return !PRAYER_TYPES.includes(spell.type);
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
  const value = castingValue(counter, 'Langue', 'Magick');
  const t = rollTest(value, 'intermediaire', rng);
  const adj = t.success ? castTestTalentDR(counter, 'Langue (Magick)') - armourCastDRPenalty(counter) : 0;
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
): MissileResult {
  if (!cr.cast) {
    return { ...cr, hit: false, defenderDefeated: false };
  }
  const loc = hitLocationByShape(reverseRoll(cr.roll), target.bodyShape);
  const spellDmg = parseSpellDamage(spell.desc);
  const bfm = bonus(effectiveChar(caster, 'FM'));
  // Attribut de Domaine (LDB 48 — L14) : Métal ignore les PA métalliques ET les ajoute en Dégâts ;
  // Cieux ignore les PA métalliques ; Ombres ignore tous les PA non magiques.
  const totalAP = effectiveArmourAt(target, loc); // PA portés + temporisés (Armure Aethyrique)
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
  const value = castingValue(caster, 'Focalisation', sk.spec);
  const t = rollTest(value, difficulty, rng);
  // « Repousser les Vents » : −1 DR par PA de la localisation la mieux protégée (l.199).
  // LDB 10 l.20 : +1 DR par acquisition d'un Talent lié au Test réussi (Harmonisation aethyrique ×N).
  const dr = t.success ? Math.max(0, t.sl + castTestTalentDR(caster, 'Focalisation') - armourCastDRPenalty(caster)) : 0;
  const isCritical = t.isDouble && t.success;
  // Maladresse ÉLARGIE en Focalisation (l.190-191) : tout double OU tout résultat
  // terminant par un 0 au-delà de la Compétence (00, 99, 90, 88…) → Imparfaite MAJEURE.
  const isFumble = !t.success && (t.isDouble || t.roll % 10 === 0);
  const log = t.success
    ? `${caster.name} focalise ${spell.label} (+${dr} DR).`
    : `${caster.name} échoue à focaliser ${spell.label}.`;
  return { dr, isCritical, isFumble, roll: t.roll, target: t.target, sl: t.sl, log };
}
