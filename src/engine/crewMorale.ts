/**
 * MORAL d'un équipage de navire — MDG ch.14 « Navigation à bord de grands vaisseaux ». CODE GÉNÉRIQUE
 * lisant la DONNÉE verbatim (`crew-morale.json`). Système PROPRE à la Mer des Griffes : ni le LDB ni
 * Aux Armes ne définissent de score de Moral numérique (AA n'a qu'une « Loyauté »/« Désertion »
 * narrative) — aucune mécanique parallèle à réutiliser ici.
 *
 * Le Moral débute à 75 (nouveau capitaine / nouvel équipage) et est RECALCULÉ une fois par semaine :
 * chaque facteur ACTIF fait monter ou descendre le score. Sa bande détermine les bonus/malus de DR aux
 * Tests d'équipage et de Commandement, et le seuil de désertion en cas de relâche à terre.
 *
 * Le **Test d'équipage** (MDG ch.14) est un mécanisme PROPRE : « le total cumulé de ces Tests individuels »
 * (somme des DR de chaque contributeur, le DR du rôle ESSENTIEL étant DOUBLÉ) — ce n'est PAS le Test Soutenu
 * du LDB (+10 par soutien à UN seul jet) : on le résout donc avec son propre additionneur, en réutilisant
 * `rollTest` (un jet par contributeur) et la bande de Moral (`crewTestDR`). `rollExpr` évalue les
 * modificateurs de Moral (dés signés « +2d10 »/« -3d10 ») ; `findTableEntry` classe le score dans sa bande.
 */
import crewMoraleJson from '../data/crew-morale.json';
import { findTableEntry } from './tables';
import { rollExpr, type RNG, defaultRNG } from './dice';
import { rollTest, easeDifficulty } from './tests';
import { testValue } from './skills';
import { crewRoles, findCrewRoleById, findCrewTestTypeById, type CrewRoleData } from '../data';
import type { Combatant, Difficulty } from './types';

/** Facteur de Moral (MODIFICATEURS DE MORAL, MDG ch.14) — `effect` = dés signés (« +2d10 », « -3d10 »). */
export interface MoraleFactor {
  /** id STABLE (slug) — toute réf passe par lui, jamais le `label`. */
  id: string;
  label: string;
  effect: string;
}

/** Bande d'effet du Moral (EFFETS DU MORAL, MDG ch.14). */
export interface MoraleBand {
  min: number;
  max: number;
  id: string;
  /** ±DR aux Tests de Commandement du capitaine. */
  captainCmdDR: number;
  /** ±DR à TOUS les Tests d'équipage. */
  crewTestDR: number;
  /** Relâche à terre : 1d100 par membre ; ≤ ce seuil → il ne revient pas (absent si aucune désertion). */
  desertionRoll?: number;
  /** Texte d'effet verbatim. */
  desc: string;
}

/** Moral de départ d'un nouvel équipage / nouveau capitaine (MDG ch.14). */
export const MORALE_BASE: number = crewMoraleJson.base;
export const MORALE_FACTORS: MoraleFactor[] = crewMoraleJson.factors;
export const MORALE_BANDS: MoraleBand[] = crewMoraleJson.bands as MoraleBand[];

const FACTOR_BY_ID = new Map(MORALE_FACTORS.map((f) => [f.id, f]));

/** Bande d'effet du Moral courant (DR aux Tests, seuil de désertion). PUR. */
export function moraleBand(score: number): MoraleBand {
  return findTableEntry(MORALE_BANDS, score);
}

export interface MoraleRecalc {
  /** Variation totale appliquée ce recalcul (somme des dés signés des facteurs actifs). */
  delta: number;
  /** Nouveau score (`current + delta`). */
  score: number;
  /** Une ligne par facteur appliqué (journal du recalcul). */
  lines: string[];
}

/**
 * Recalcul HEBDOMADAIRE du Moral (MDG ch.14) : chaque facteur ACTIF (référencé par `id`) roule son
 * effet en dés signés et fait MONTER ou DESCENDRE le Moral courant. PUR (RNG injecté pour le déterminisme).
 */
export function recalcMorale(current: number, activeFactorIds: string[], rng: RNG = defaultRNG): MoraleRecalc {
  let delta = 0;
  const lines: string[] = [];
  for (const id of activeFactorIds) {
    const f = FACTOR_BY_ID.get(id);
    if (!f) continue;
    const rolled = rollExpr(f.effect, rng);
    delta += rolled;
    lines.push(`${f.label} : ${rolled >= 0 ? '+' : ''}${rolled} Moral.`);
  }
  return { delta, score: current + delta, lines };
}

/** Un contributeur à un Test d'équipage (un rôle tenu par un Personnage). `essential` → son DR compte DOUBLE. */
export interface CrewContributor {
  /** Valeur de Compétence effective du contributeur pour ce Test. */
  value: number;
  /** Rôle ESSENTIEL (MDG ch.14) : « Tout DR, ou DR négatif, qu'il génère est alors doublé. » */
  essential?: boolean;
  /** Étiquette d'affichage (journal). */
  label?: string;
  /** Difficulté PROPRE à ce contributeur (sinon celle du Test) — sert au double-rôle « Manque de bras » (+2 crans). */
  difficulty?: Difficulty;
}

export interface CrewTestResult {
  /** Détail par contributeur (DR brut puis doublé si essentiel). */
  contributions: { label?: string; sl: number; essential: boolean; counted: number }[];
  /** Somme des DR (rôles essentiels doublés). */
  baseTotal: number;
  /** ±DR de la bande de Moral courante (MDG ch.14, EFFETS DU MORAL). */
  moraleDR: number;
  /** DR final = somme des contributions + DR de Moral + `extraDR` (ex. Manque de bras). */
  total: number;
  lines: string[];
}

/**
 * Résout un TEST D'ÉQUIPAGE (MDG ch.14) : chaque contributeur lance son Test à `difficulty` et son DR
 * s'ajoute au total (DR du rôle ESSENTIEL doublé). Le DR de la bande de Moral courante s'applique au total,
 * ainsi qu'un `extraDR` optionnel (Manque de bras, sabotage…). PUR (RNG injecté). Ce n'est PAS le Test
 * Soutenu du LDB : on additionne des DR de jets distincts, on n'ajoute pas +10 à un jet unique.
 */
export function resolveCrewTest(
  contributors: CrewContributor[],
  difficulty: Difficulty,
  moraleScore: number,
  rng: RNG = defaultRNG,
  extraDR = 0,
): CrewTestResult {
  const contributions = contributors.map((c) => {
    const t = rollTest(c.value, c.difficulty ?? difficulty, rng);
    const counted = c.essential ? t.sl * 2 : t.sl;
    return { label: c.label, sl: t.sl, essential: !!c.essential, counted };
  });
  const baseTotal = contributions.reduce((s, c) => s + c.counted, 0);
  const moraleDR = moraleBand(moraleScore).crewTestDR;
  const total = baseTotal + moraleDR + extraDR;
  const lines = contributions.map((c) =>
    `${c.label ?? 'Rôle'} : ${c.sl >= 0 ? '+' : ''}${c.sl} DR${c.essential ? ` (essentiel ×2 → ${c.counted})` : ''}.`);
  if (moraleDR) lines.push(`Moral : ${moraleDR >= 0 ? '+' : ''}${moraleDR} DR.`);
  if (extraDR) lines.push(`Modificateur : ${extraDR >= 0 ? '+' : ''}${extraDR} DR.`);
  return { contributions, baseTotal, moraleDR, total, lines };
}

/** État de Moral PERSISTANT d'un navire (porté par l'instance de navire en campagne ; recalc hebdomadaire). */
export interface ShipMoraleState {
  score: number;
  /** Dernière semaine (jour ÷ 7) où le Moral a été recalculé — garde anti-double-comptage (cf. lastUpkeepDay). */
  lastMoraleWeek: number;
  /** Facteurs de Moral ACTIFS cette semaine (ids), édités par le MJ / l'éditeur. */
  factors: string[];
}

/**
 * RECALCUL HEBDOMADAIRE gardé (MDG ch.14) : recalcule le Moral une seule fois par semaine calendaire
 * (jour ÷ 7), sur le modèle de `lastUpkeepDay`. PUR — prêt à être appelé par l'entretien quotidien quand
 * un navire vit dans l'état de campagne. Renvoie un nouvel état (jamais muté en place).
 */
export function tickShipMorale(state: ShipMoraleState, currentDay: number, rng: RNG = defaultRNG): { state: ShipMoraleState; recalced: boolean; lines: string[] } {
  const week = Math.floor(currentDay / 7);
  if (week <= state.lastMoraleWeek) return { state, recalced: false, lines: [] };
  const r = recalcMorale(state.score, state.factors, rng);
  return { state: { ...state, score: r.score, lastMoraleWeek: week }, recalced: true, lines: r.lines };
}

/** Assignation d'un membre d'équipage à un rôle, pour un Test d'équipage piloté par les rôles (MDG ch.14). */
export interface CrewAssignment {
  /** Le Combattant d'équipage qui tient le rôle. */
  crew: Combatant;
  /** id du rôle tenu (crew-roles.json). */
  roleId: string;
  /** Le membre cumule DEUX rôles (Manque de bras, MDG ch.14 l.53) : CE jet subit +2 crans de difficulté. */
  doubleRole?: boolean;
}

/** Valeur de Compétence d'un membre pour un rôle : la MEILLEURE de ses compétences (Mousse = Voile/Ramer). PUR. */
export function crewRoleValue(crew: Combatant, role: CrewRoleData): { value: number; used?: { skillId: string; spec?: string } } {
  let best = -Infinity;
  let used: { skillId: string; spec?: string } | undefined;
  for (const s of role.skills) {
    const v = testValue(crew, s.skillId, undefined, s.spec);
    if (v > best) { best = v; used = s; }
  }
  return { value: Number.isFinite(best) ? best : 0, used };
}

/** Rôle d'équipage INFÉRÉ d'un membre (MDG ch.14) : parmi les 9 rôles navals, celui où SA meilleure compétence
 *  pertinente est la plus haute. Défaut quand le joueur n'a pas épinglé de `shipRole` (miroir `defaultTravelRole`).
 *  `null` si aucun rôle ne donne de valeur. PUR. */
export function defaultCrewRole(crew: Combatant): string | null {
  let best: { id: string; value: number } | null = null;
  for (const role of crewRoles) {
    const v = crewRoleValue(crew, role).value;
    if (!best || v > best.value) best = { id: role.id, value: v };
  }
  return best?.id ?? null;
}

/**
 * Test d'équipage PILOTÉ PAR LES RÔLES (MDG ch.14) — système PROPRE à la Mer des Griffes (vérifié ABSENT du
 * Compagnon de Mort sur le Reik, qui s'en tient au Personnage à la barre + Soutien LDB, déjà au moteur via
 * `partyAssisted`, et d'Aux Armes qui n'apporte que l'Atout « Arme d'équipe »). Pour chaque membre assigné à
 * un rôle, on lit sa VRAIE valeur de Compétence (la meilleure du rôle) ; le rôle désigné ESSENTIEL par le type
 * de Test voit son DR doublé ; on additionne via `resolveCrewTest`. Manque de bras : double rôle → +2 crans
 * sur SON jet (l.53) ; sous-effectif (`understaffed`) → −2 DR et jamais mieux qu'un Succès Minime (DR total
 * plafonné à 0, l.55). PUR (RNG injecté). NB : le bonus de chant du Chansonnier (l.32) n'est PAS chiffré par
 * le RAW (« des bonus ») → NON modélisé (règle 1 : aucune invention de valeur).
 */
export function resolveCrewTestByRoles(
  assignments: CrewAssignment[],
  testTypeId: string,
  difficulty: Difficulty,
  moraleScore: number,
  rng: RNG = defaultRNG,
  opts: { understaffed?: boolean } = {},
): CrewTestResult {
  const essentialRole = findCrewTestTypeById(testTypeId)?.essential;
  const contributors: CrewContributor[] = assignments.map((a) => {
    const role = findCrewRoleById(a.roleId);
    return {
      value: role ? crewRoleValue(a.crew, role).value : 0,
      essential: a.roleId === essentialRole,
      label: role?.label ?? a.roleId,
      difficulty: a.doubleRole ? easeDifficulty(difficulty, -2) : undefined,
    };
  });
  const res = resolveCrewTest(contributors, difficulty, moraleScore, rng, opts.understaffed ? -2 : 0);
  if (opts.understaffed && res.total > 0) {
    // MDG ch.14 l.55 : « ne peuvent jamais être meilleurs qu'un Succès Minime » → DR total plafonné à 0.
    return { ...res, total: 0, lines: [...res.lines, 'Manque de bras : jamais mieux qu’un Succès Minime (DR total plafonné à 0).'] };
  }
  return res;
}
