/**
 * Ops — vocabulaire d'effets mécaniques PARTAGÉ par les sorts (specs structurées,
 * cf. engine/spellspec + data/spellspecs), les tables d'Incantations Imparfaites /
 * Colère des dieux (engine/miscast) et les mutations de Corruption (à venir).
 *
 * Chaque `GameOp` décrit UNE opération sur un Combatant ; `applyOps` les exécute
 * (mutation directe, comme le reste du moteur) et renvoie les lignes de journal.
 * Les quantités sont des `Formula` résolues à l'application — littéral, « (Bonus
 * de X) », « (X) », jet de dés — contre un RÉFÉRENT (le lanceur pour un sort,
 * la victime pour une table de contrecoup).
 *
 * Fidélité (règle 1) : une op n'existe que si la règle source la décrit — la
 * citation est portée par la spec/table qui l'emploie ; ce qui n'est pas
 * modélisable reste une op `narrative` (journalisée, arbitrage MJ, rien d'inventé).
 */
import { RNG, defaultRNG, roll as rollDice } from './dice';
import { rollTest } from './tests';
import { testValue } from './skills';
import { bonus, effectiveChar, refreshWounds } from './characteristics';
import { addCondition, removeCondition, loseWounds } from './conditions';
import {
  ActiveEffect,
  CHAR_LABELS,
  CharKey,
  Combatant,
  Difficulty,
  DIFFICULTY_LABELS,
} from './types';

// ---------------------------------------------------------------------------
// Formules
// ---------------------------------------------------------------------------

/** Quantité résolue à l'application : littéral, « (Bonus de X) », « (X) », ou dés. */
export type Formula =
  | number
  | { bonusOf: CharKey }
  | { charOf: CharKey }
  | { dice: { n: number; sides: number; plus?: number } };

/** Résout une formule contre son référent (`ref`) — RNG seedable pour les dés. */
export function resolveFormula(f: Formula, ref: Combatant, rng: RNG = defaultRNG): number {
  if (typeof f === 'number') return f;
  if ('bonusOf' in f) return bonus(effectiveChar(ref, f.bonusOf));
  if ('charOf' in f) return effectiveChar(ref, f.charOf);
  return rollDice(f.dice.n, f.dice.sides, rng) + (f.dice.plus ?? 0);
}

// ---------------------------------------------------------------------------
// Ops
// ---------------------------------------------------------------------------

export type GameOp =
  /** Blessures subies DIRECTEMENT (déjà mitigées par la source : les tables de
   *  contrecoup ignorent BE et PA — LDB 46/40 ; les dégâts d'arme/Projectile
   *  passent par le chemin d'attaque, pas par cette op). */
  | { op: 'wounds'; amount: Formula }
  /** Blessures rendues (plafonnées au max). */
  | { op: 'heal'; amount: Formula }
  /** Ajout d'un État nommé (LDB 16). */
  | { op: 'condition'; name: string; value?: Formula }
  /** Retrait d'États : `name` absent = au choix de la cible (1er État porté). */
  | { op: 'removeCondition'; name?: string; value?: Formula }
  /** Modificateur de caractéristique temporisé (ActiveEffect — meilleur bonus +
   *  pire pénalité sans cumul, LDB l.168). `durationRounds` absent = durée du
   *  contexte (sort) ou persistance hors-échelle (COMBAT_PERSIST). */
  | { op: 'charMod'; char: CharKey; mod: number; durationRounds?: Formula }
  /** Test imbriqué (« Test de Résistance Accessible (+20) ou … ») : résolu
   *  immédiatement contre la CIBLE, puis applique `onFail` / `onSuccess`. */
  | { op: 'test'; skill: string; difficulty: Difficulty; onFail: GameOp[]; onSuccess?: GameOp[] }
  /** PB réduits à 0 + Inconscient (Châtiment, Tonnerre et foudre — LDB 40). */
  | { op: 'reduceToZero' }
  /** Effet non modélisé : journalisé verbatim, arbitrage MJ (rien d'inventé). */
  | { op: 'narrative'; text: string };

export interface OpsCtx {
  rng?: RNG;
  /** Référent des formules « (Bonus de X) » (le lanceur d'un sort) ; défaut : la cible. */
  caster?: Combatant;
  /** Libellé de la source (sort/table) — ActiveEffect.label + journal. */
  label?: string;
  /** Durée (en Rounds) des `charMod` sans durée propre — celle du sort. */
  defaultDurationRounds?: number;
}

/** Rounds attribués à un effet dont la durée (minutes/heures/jours) dépasse le combat. */
export const COMBAT_PERSIST = 9999;

/** Applique un effet actif sans cumul : un seul bonus (le meilleur) ET une seule
 *  pénalité (la pire) coexistent par caractéristique (Livre de base l.168). */
export function applyActiveEffect(target: Combatant, effect: ActiveEffect) {
  target.activeEffects = target.activeEffects ?? [];
  // On ne dédoublonne qu'entre effets de MÊME signe (bonus vs pénalité séparés) :
  // un bonus et une pénalité sur la même caractéristique s'additionnent (effectiveChar).
  const sameSign = (b: number) => b >= 0 === effect.bonus >= 0;
  const idx = target.activeEffects.findIndex((e) => e.char === effect.char && effect.char != null && sameSign(e.bonus));
  if (idx >= 0) {
    const cur = target.activeEffects[idx].bonus;
    const better = effect.bonus >= 0 ? effect.bonus >= cur : effect.bonus <= cur;
    if (better) target.activeEffects[idx] = effect;
  } else {
    target.activeEffects.push(effect);
  }
  // Les Blessures dérivent de F/E/FM (LDB 85) → un buff de ces caractéristiques recale les PB max + courants.
  if (effect.char === 'F' || effect.char === 'E' || effect.char === 'FM') refreshWounds(target);
}

/**
 * Exécute une liste d'ops sur `target`. Les `charMod` consécutifs d'une même
 * source sont appliqués individuellement mais journalisés en UNE ligne (format
 * historique de l'incantation). Renvoie les lignes de journal.
 */
export function applyOps(target: Combatant, ops: GameOp[], ctx: OpsCtx = {}): string[] {
  const rng = ctx.rng ?? defaultRNG;
  const ref = ctx.caster ?? target;
  const lines: string[] = [];
  // Agrégation des charMod (une ligne par source, façon « Écorce (-10 Ag, -10 Dex, 6 rounds) »).
  const charParts: string[] = [];
  let charRounds: number | null = null;
  const flushCharMods = () => {
    if (!charParts.length) return;
    const dur = charRounds != null && charRounds !== COMBAT_PERSIST ? `${charRounds} rounds` : 'durée hors combat';
    lines.push(`${target.name} : ${ctx.label ?? 'Effet'} (${charParts.join(', ')}, ${dur}).`);
    charParts.length = 0;
  };
  for (const o of ops) {
    if (o.op !== 'charMod') flushCharMods();
    switch (o.op) {
      case 'wounds': {
        const n = Math.max(0, resolveFormula(o.amount, ref, rng));
        loseWounds(target, n); // perte centralisée (−Avantage + À Terre à 0)
        lines.push(`${target.name} subit ${n} Blessure(s) (ignorant BE et PA).`);
        break;
      }
      case 'heal': {
        const n = Math.max(0, resolveFormula(o.amount, ref, rng));
        target.wounds.current = Math.min(target.wounds.max, target.wounds.current + n);
        lines.push(`${target.name} regagne ${n} Blessure(s).`);
        break;
      }
      case 'condition': {
        const v = Math.max(1, resolveFormula(o.value ?? 1, ref, rng));
        addCondition(target, o.name, v);
        lines.push(`${target.name} reçoit ${v} État ${o.name}.`);
        break;
      }
      case 'removeCondition': {
        const v = Math.max(1, resolveFormula(o.value ?? 1, ref, rng));
        const name = o.name ?? target.conditions[0]?.name;
        if (name) {
          removeCondition(target, name, v);
          lines.push(`${target.name} retire ${v} État ${name}.`);
        } else {
          lines.push(`${target.name} n'a aucun État à retirer.`);
        }
        break;
      }
      case 'charMod': {
        const rounds = o.durationRounds != null
          ? resolveFormula(o.durationRounds, ref, rng)
          : ctx.defaultDurationRounds ?? COMBAT_PERSIST;
        applyActiveEffect(target, { label: ctx.label ?? 'Effet', char: o.char, bonus: o.mod, roundsLeft: rounds });
        charParts.push(`${o.mod >= 0 ? '+' : ''}${o.mod} ${CHAR_LABELS[o.char]}`);
        charRounds = rounds;
        break;
      }
      case 'test': {
        const t = rollTest(testValue(target, o.skill), o.difficulty, rng);
        lines.push(
          `${target.name} — Test de ${o.skill} ${DIFFICULTY_LABELS[o.difficulty]} : 🎲 ${t.roll} / ${t.target} → ${t.success ? 'réussite' : 'échec'}.`,
        );
        lines.push(...applyOps(target, t.success ? o.onSuccess ?? [] : o.onFail, ctx));
        break;
      }
      case 'reduceToZero': {
        target.wounds.current = 0;
        addCondition(target, 'Inconscient');
        lines.push(`${target.name} : Blessures réduites à 0 (Inconscient).`);
        break;
      }
      case 'narrative':
        lines.push(o.text);
        break;
    }
  }
  flushCharMods();
  return lines;
}
