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
import { addCondition, addTimedCondition, removeCondition, loseWounds } from './conditions';
import { groupMatch } from './groups';
import { grantTrait } from './grantedTraits';
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

/** Échelle « par +N DR » d'un sort (LDB 41/42/47 — « +1 par +2 DR », « +DR Dégâts ») :
 *  appliquée au DR du jet d'incantation (`OpsCtx.sl`), jamais négative. */
export interface PerSL {
  /** Palier de DR (« par +2 DR » → 2). */
  every: number;
  /** Quantité ajoutée par palier (peut être négative — retrait de Corruption). */
  amount: number;
}
export function slBonus(sl: number | undefined, p?: PerSL): number {
  if (!p || sl == null) return 0;
  return Math.floor(Math.max(0, sl) / Math.max(1, p.every)) * p.amount;
}

// ---------------------------------------------------------------------------
// Ops
// ---------------------------------------------------------------------------

export type GameOp =
  /** Blessures subies DIRECTEMENT (déjà mitigées par la source : les tables de
   *  contrecoup ignorent BE et PA — LDB 46/40 ; les dégâts d'arme/Projectile
   *  passent par le chemin d'attaque, pas par cette op). `perSL` : « +DR Dégâts »
   *  (Comète à Deux Queues) ; `onlyGroups` : ne touche que les cibles d'un Groupe
   *  (engine/groups — « les Morts-vivants… », Feu de l'âme). */
  | { op: 'wounds'; amount: Formula; perSL?: PerSL; onlyGroups?: string[] }
  /** Blessures rendues (plafonnées au max). */
  | { op: 'heal'; amount: Formula; perSL?: PerSL }
  /** Blessures rendues AU LANCEUR (« Puis vous Guérissez 1 Point de Blessure » — Drain).
   *  Sans `ctx.caster`, s'applique à la cible (auto-sort). */
  | { op: 'healCaster'; amount: Formula }
  /** Ajout d'un État nommé (LDB 16). `durationRounds` : État À DURÉE (« qui dure 1d10
   *  Rounds ») ; `perRound` : État RÉCURRENT — ré-appliqué chaque fin de Round pendant la
   *  durée du sort (ctx.defaultDurationRounds), via un effet actif porteur. */
  | { op: 'condition'; name: string; value?: Formula; durationRounds?: Formula; perRound?: boolean; valuePerSL?: PerSL; onlyGroups?: string[] }
  /** Retrait d'États : `name` absent = au choix de la cible (1er État porté). */
  | { op: 'removeCondition'; name?: string; value?: Formula }
  /** Modificateur de caractéristique temporisé (ActiveEffect — meilleur bonus +
   *  pire pénalité sans cumul, LDB l.168). `durationRounds` absent = durée du
   *  contexte (sort) ou persistance hors-échelle (COMBAT_PERSIST). */
  | { op: 'charMod'; char: CharKey; mod: number; durationRounds?: Formula }
  /** PA TEMPORISÉS à toutes les localisations (Armure Aethyrique « +1 PA à toutes les
   *  Localisations ») — ActiveEffect.apAll, lu par effectiveArmourAt à la mitigation. */
  | { op: 'apAll'; amount: Formula }
  /** Test imbriqué (« Test de Résistance Accessible (+20) ou … ») : résolu
   *  immédiatement contre la CIBLE, puis applique `onFail` / `onSuccess`.
   *  `onFailHard` : palier d'échec aggravé (« si vous échouez avec −4 DR ou
   *  moins… », Purifier la chair LDB 40) — appliqué EN PLUS d'`onFail`. */
  | { op: 'test'; skill: string; difficulty: Difficulty; onFail: GameOp[]; onSuccess?: GameOp[]; onFailHard?: { dr: number; ops: GameOp[] } }
  /** Points de Corruption (LDB 19). Le store branche `ctx.onCorruption` (seuil →
   *  mutation → damnation) ; sans contexte, simple incrément du compteur. */
  | { op: 'corruption'; amount: number; perSL?: PerSL }
  /** Pénalité/blocage d'incantation temporisé (contrecoups, LDB 46/40) : −N à une
   *  Compétence de magie, Tests interdits, ou DR de Prière plafonné à 0. Durée en
   *  Rounds (combat + entretien hors combat) OU en minutes/jours d'horloge. */
  | { op: 'castPenalty'; skill: 'Prière' | 'Langue' | 'Focalisation' | 'all'; mod?: number; blocked?: boolean; maxZeroDR?: boolean; rounds?: Formula; minutes?: Formula; hours?: Formula; days?: Formula }
  /** Trait de créature TEMPORISÉ (Jalon 2.6 — « vous gagnez le Trait X tant que le Sort est
   *  actif ») : posé dans `c.traits` (vu par TOUS les consommateurs — dispatch, psy, IA,
   *  déplacement), retiré à l'expiration de l'ActiveEffect porteur. `indice` : Indice du trait
   *  (« Peur 1 », « Vol (Agilité) » → valeur du lanceur), `indicePerSL` : « +1 par +3 DR ». */
  | { op: 'grantTrait'; trait: string; indice?: Formula; indicePerSL?: PerSL }
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
  /** Échéance d'HORLOGE (minutes `gameTime`) des effets actifs d'un sort à durée en
   *  minutes/heures/jours (LDB 47) : posée sur l'ActiveEffect (`untilTime`), purgée par la
   *  cascade #T3. À fournir AVEC `defaultDurationRounds = COMBAT_PERSIST`. */
  defaultUntilTime?: number;
  /** Horloge de jeu (minutes) — base des `castPenalty` à durée en minutes/jours. */
  now?: number;
  /** DR du jet d'incantation — alimente les échelles « par +N DR » (`PerSL`) des ops. */
  sl?: number;
  /** Gain de Corruption AVEC seuil → mutation (corruptionFlow) ; sans contexte
   *  store, l'op `corruption` incrémente simplement le compteur. */
  onCorruption?: (n: number) => string[];
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
  // Filtre par Groupe de la CIBLE (engine/groups — « les Morts-vivants gagnent aussi… »).
  const groupGate = (only?: string[]): boolean =>
    !only || only.some((g) => groupMatch(g, target.groups ?? []));
  for (const o of ops) {
    if (o.op !== 'charMod') flushCharMods();
    switch (o.op) {
      case 'wounds': {
        if (!groupGate(o.onlyGroups)) break;
        const n = Math.max(0, resolveFormula(o.amount, ref, rng) + slBonus(ctx.sl, o.perSL));
        loseWounds(target, n); // perte centralisée (−Avantage + À Terre à 0)
        lines.push(`${target.name} subit ${n} Blessure(s) (ignorant BE et PA).`);
        break;
      }
      case 'heal': {
        const n = Math.max(0, resolveFormula(o.amount, ref, rng) + slBonus(ctx.sl, o.perSL));
        target.wounds.current = Math.min(target.wounds.max, target.wounds.current + n);
        lines.push(`${target.name} regagne ${n} Blessure(s).`);
        break;
      }
      case 'healCaster': {
        const who = ctx.caster ?? target;
        const n = Math.max(0, resolveFormula(o.amount, ref, rng));
        who.wounds.current = Math.min(who.wounds.max, who.wounds.current + n);
        lines.push(`${who.name} regagne ${n} Blessure(s).`);
        break;
      }
      case 'condition': {
        if (!groupGate(o.onlyGroups)) break;
        const v = Math.max(1, resolveFormula(o.value ?? 1, ref, rng) + slBonus(ctx.sl, o.valuePerSL));
        if (o.perRound) {
          // État récurrent : porté par un effet actif, ré-appliqué chaque fin de Round.
          target.activeEffects = target.activeEffects ?? [];
          target.activeEffects.push({
            label: ctx.label ?? 'Effet', bonus: 0,
            roundsLeft: ctx.defaultDurationRounds ?? COMBAT_PERSIST,
            ...(ctx.defaultUntilTime != null ? { untilTime: ctx.defaultUntilTime } : {}),
            condPerRound: { name: o.name, value: v },
          });
          lines.push(`${target.name} subira ${v} État ${o.name} par Round (${ctx.label ?? 'sort'}).`);
        } else if (o.durationRounds != null) {
          const rounds = Math.max(1, resolveFormula(o.durationRounds, ref, rng));
          addTimedCondition(target, o.name, v, rounds);
          lines.push(`${target.name} reçoit ${v} État ${o.name} (${rounds} Round${rounds > 1 ? 's' : ''}).`);
        } else {
          addCondition(target, o.name, v);
          lines.push(`${target.name} reçoit ${v} État ${o.name}.`);
        }
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
        applyActiveEffect(target, {
          label: ctx.label ?? 'Effet', char: o.char, bonus: o.mod, roundsLeft: rounds,
          ...(o.durationRounds == null && ctx.defaultUntilTime != null ? { untilTime: ctx.defaultUntilTime } : {}),
        });
        charParts.push(`${o.mod >= 0 ? '+' : ''}${o.mod} ${CHAR_LABELS[o.char]}`);
        charRounds = rounds;
        break;
      }
      case 'apAll': {
        const n = Math.max(0, resolveFormula(o.amount, ref, rng));
        const rounds = ctx.defaultDurationRounds ?? COMBAT_PERSIST;
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0, roundsLeft: rounds, apAll: n,
          ...(ctx.defaultUntilTime != null ? { untilTime: ctx.defaultUntilTime } : {}),
        });
        lines.push(`${target.name} : +${n} PA à toutes les Localisations (${ctx.label ?? 'sort'}${rounds !== COMBAT_PERSIST ? `, ${rounds} rounds` : ''}).`);
        break;
      }
      case 'test': {
        const t = rollTest(testValue(target, o.skill), o.difficulty, rng);
        lines.push(
          `${target.name} — Test de ${o.skill} ${DIFFICULTY_LABELS[o.difficulty]} : 🎲 ${t.roll} / ${t.target} → ${t.success ? 'réussite' : 'échec'}.`,
        );
        lines.push(...applyOps(target, t.success ? o.onSuccess ?? [] : o.onFail, ctx));
        // Palier d'échec aggravé (« si vous échouez avec −N DR ou moins ») — EN PLUS d'onFail.
        if (!t.success && o.onFailHard && t.sl <= o.onFailHard.dr) lines.push(...applyOps(target, o.onFailHard.ops, ctx));
        break;
      }
      case 'corruption': {
        const amount = o.amount + slBonus(ctx.sl, o.perSL);
        if (amount === 0) break;
        if (amount < 0) {
          // RETRAIT de Corruption (Innocence immaculée, LDB 42 — −1 de plus par +2 DR) :
          // décrément direct, jamais sous 0.
          const before = target.corruption ?? 0;
          target.corruption = Math.max(0, before + amount);
          lines.push(`${target.name} : ${target.corruption - before} Point(s) de Corruption (total ${target.corruption}).`);
        } else if (ctx.onCorruption) {
          lines.push(...ctx.onCorruption(amount));
        } else {
          target.corruption = (target.corruption ?? 0) + amount;
          lines.push(`${target.name} : +${amount} Point${amount > 1 ? 's' : ''} de Corruption (total ${target.corruption}).`);
        }
        break;
      }
      case 'castPenalty': {
        const cp: NonNullable<Combatant['castPenalties']>[number] = {
          label: ctx.label ?? 'Contrecoup',
          skill: o.skill,
          ...(o.mod != null ? { mod: o.mod } : {}),
          ...(o.blocked ? { blocked: true } : {}),
          ...(o.maxZeroDR ? { maxZeroDR: true } : {}),
        };
        let dureeTxt = '';
        if (o.rounds != null) {
          cp.roundsLeft = Math.max(1, resolveFormula(o.rounds, ref, rng));
          dureeTxt = `${cp.roundsLeft} Round${cp.roundsLeft > 1 ? 's' : ''}`;
        } else if (o.minutes != null) {
          const min = Math.max(1, resolveFormula(o.minutes, ref, rng));
          cp.untilTime = (ctx.now ?? 0) + min;
          dureeTxt = `${min} min`;
        } else if (o.hours != null) {
          const h = Math.max(1, resolveFormula(o.hours, ref, rng));
          cp.untilTime = (ctx.now ?? 0) + h * 60;
          dureeTxt = `${h} heure${h > 1 ? 's' : ''}`;
        } else if (o.days != null) {
          const d = Math.max(1, resolveFormula(o.days, ref, rng));
          cp.untilTime = (ctx.now ?? 0) + d * 24 * 60;
          dureeTxt = `${d} jour${d > 1 ? 's' : ''}`;
        }
        target.castPenalties = [...(target.castPenalties ?? []), cp];
        const what = cp.blocked
          ? `Tests de ${cp.skill === 'all' ? 'magie' : cp.skill} interdits`
          : cp.maxZeroDR
            ? 'Tests de Prière plafonnés à 0 DR'
            : `${cp.mod} aux Tests de ${cp.skill === 'all' ? 'magie' : cp.skill}`;
        lines.push(`${target.name} : ${what}${dureeTxt ? ` pendant ${dureeTxt}` : ''} (${cp.label}).`);
        break;
      }
      case 'grantTrait': {
        const ind = o.indice != null ? resolveFormula(o.indice, ref, rng) + slBonus(ctx.sl, o.indicePerSL) : null;
        const traitStr = ind != null ? `${o.trait} ${ind}` : o.trait;
        grantTrait(target, traitStr);
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          roundsLeft: ctx.defaultDurationRounds ?? COMBAT_PERSIST,
          ...(ctx.defaultUntilTime != null ? { untilTime: ctx.defaultUntilTime } : {}),
          grantedTrait: traitStr,
        });
        lines.push(`${target.name} gagne le Trait ${traitStr} (${ctx.label ?? 'sort'}).`);
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
