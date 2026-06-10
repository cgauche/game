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
import { rollTest, TestResult } from './tests';
import { bonus, effectiveChar } from './characteristics';
import { reverseRoll, hitLocationByShape } from './combat';
import { Formula, resolveFormula } from './ops';
import { Combatant, HitLocation, Difficulty, CharKey, CHAR_LABELS, CHAR_BY_LABEL } from './types';

/** Sous-ensemble des champs de sort nécessaires au moteur (cf. src/data/spells.json). */
export interface SpellLike {
  label: string;
  type: string;
  cn: number | null;
  duration?: string;
  desc: string;
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

/**
 * Valeur d'un test d'incantation : Caractéristique de la compétence + avances de
 * celle-ci (si le personnage la possède), sinon la Caractéristique seule.
 */
export function castingValue(c: Combatant, skillName: string, spec?: string): number {
  const charKey = skillName === 'Prière' ? 'Soc' : skillName === 'Focalisation' ? 'FM' : 'Int';
  const base = effectiveChar(c, charKey);
  const sk = c.skills.find(
    (s) => s.name === skillName && (spec == null || s.spec === spec),
  );
  return base + (sk?.advances ?? 0);
}

/**
 * Prière, Langue (Magick) et Focalisation sont des Compétences AVANCÉES : on ne
 * peut tenter le Test que si l'on y possède au moins une Augmentation (Livre de
 * base, 09 - Compétences : « Si ce n'est pas le cas, vous ne pouvez pas tenter le
 * Test »). Sinon, aucune incantation possible — pas de repli sur la Caractéristique.
 */
export function knowsCastingSkill(c: Combatant, skillName: string, spec?: string): boolean {
  return c.skills.some(
    (s) => s.name === skillName && (spec == null || s.spec === spec) && s.advances >= 1,
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

/**
 * Soin apporté par un sort/prière, au niveau FORMULE : « N Points de Blessure »
 * (littéral) ou « Guérir (Bonus de X) Blessures » (paramétré, ex. Caresse de
 * Rhya = Bonus de Sociabilité — résolu contre le lanceur à l'application).
 */
export function parseHealFormula(desc: string): Formula | null {
  const lit = desc.match(/(\d+)\s*Points?\s+de\s+Blessure/i);
  if (lit) return parseInt(lit[1], 10);
  const bon = desc.match(/Gu[ée]ri(?:r|ssez)?[^.]*?\(Bonus d[e'’]\s*([^)]+)\)\s*Blessure/i);
  if (bon) {
    const key = CHAR_BY_LABEL[bon[1].trim()];
    if (key) return { bonusOf: key };
  }
  return null;
}

/**
 * Soin apporté par un sort/prière : formule résolue contre le lanceur.
 * Retourne le nombre de Blessures rendues, ou null si aucun soin.
 */
export function parseHeal(desc: string, caster: Combatant): number | null {
  const f = parseHealFormula(desc);
  return f == null ? null : resolveFormula(f, caster);
}

/**
 * Effet d'État d'un sort : ajout (« reçoit/gagne N État X ») ou retrait
 * (« retirer/perd N État [X] » — le nom peut être absent, choix de la cible).
 * Retourne null si la description ne mentionne aucun État.
 */
export function parseConditionEffect(
  desc: string,
): { op: 'add' | 'remove'; name?: string; value: number } | null {
  const rem = desc.match(/(?:retire[rz]|perd(?:ent)?)\s+(\d+)?\s*[ÉE]tats?(?:\s+([A-Za-zÀ-ÿ'’-]+))?/i);
  if (rem) return { op: 'remove', name: rem[2], value: rem[1] ? parseInt(rem[1], 10) : 1 };
  const add = desc.match(/(\d+)?\s*[ÉE]tats?\s+([A-Za-zÀ-ÿ'’-]+)/i);
  if (add) return { op: 'add', name: add[2], value: add[1] ? parseInt(add[1], 10) : 1 };
  return null;
}

/**
 * Modificateurs de caractéristique d'un sort : « +N en X » (bonus) ou « -N en X »
 * (pénalité, bonus négatif), y compris la forme « -N en X et Y » qui touche deux
 * caractéristiques (ex. Écorce : -10 en Agilité et Dextérité). Bonus et pénalités
 * ne se cumulent pas — voir effectiveChar (Livre de base l.168 : meilleur bonus +
 * pire pénalité). Retourne la liste des modificateurs trouvés.
 */
export function parseCharBuffs(desc: string): { char: CharKey; bonus: number }[] {
  const out: { char: CharKey; bonus: number }[] = [];
  for (const [key, label] of Object.entries(CHAR_LABELS) as [CharKey, string][]) {
    // « Force » ne doit pas capturer le préfixe de « Force Mentale ».
    const lab = label === 'Force' ? 'Force(?!\\s+Mentale)' : label;
    let m = desc.match(new RegExp(`([+-])\\s*(\\d+)\\s+en\\s+${lab}`, 'i'));
    // Forme « ... en Y et X » (seconde caractéristique d'un même modificateur).
    if (!m) m = desc.match(new RegExp(`([+-])\\s*(\\d+)\\s+en\\s+[A-Za-zÀ-ÿ'’ ]*?\\bet\\s+${lab}`, 'i'));
    if (m) out.push({ char: key, bonus: (m[1] === '-' ? -1 : 1) * parseInt(m[2], 10) });
  }
  return out;
}

/** Vrai si le sort est un Projectile magique (Dégâts résolus comme une attaque). */
export function isMagicMissile(spell: SpellLike): boolean {
  return /projectile magique/i.test(spell.desc);
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
  const value = castingValue(caster, info.skill, info.spec);
  const t = rollTest(value, difficulty, rng);
  return evaluateCasting(caster, spell, t, focusedNI0);
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
): MissileResult {
  const cr = resolveCasting(caster, spell, rng, 'intermediaire', focusedNI0);
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
  const damage = (spellDmg?.damage ?? 0) + Math.max(0, cr.sl) + bfm;
  // Certains Projectiles ignorent le Bonus d'Endurance et/ou les PA (p.238 + sorts).
  const tb = spellDmg?.ignoreBE ? 0 : bonus(effectiveChar(target, 'E'));
  const ap = spellDmg?.ignorePA ? 0 : target.armour[loc] ?? 0;
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
    isDouble: current.roll === 100 || current.roll % 11 === 0,
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
  log: string;
}

/** Un Round de Test étendu de Focalisation (FM + spécialisation). */
export function resolveFocus(
  caster: Combatant,
  spell: SpellLike,
  rng: RNG = defaultRNG,
  difficulty: Difficulty = 'intermediaire',
): FocusResult {
  if (!knowsCastingSkill(caster, 'Focalisation')) {
    return { dr: 0, isCritical: false, isFumble: false, roll: 0, log: `${caster.name} ne maîtrise pas Focalisation.` };
  }
  const value = castingValue(caster, 'Focalisation');
  const t = rollTest(value, difficulty, rng);
  const dr = t.success ? Math.max(0, t.sl) : 0;
  const isCritical = t.isDouble && t.success;
  const isFumble = t.isDouble && !t.success;
  const log = t.success
    ? `${caster.name} focalise ${spell.label} (+${dr} DR).`
    : `${caster.name} échoue à focaliser ${spell.label}.`;
  return { dr, isCritical, isFumble, roll: t.roll, log };
}
