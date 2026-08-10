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
import { RNG, defaultRNG, roll, type DiceSpec, rollDice } from './dice';
import { bonus, effectiveChar, refreshWounds } from './characteristics';
import { addCondition, addTimedCondition, addClockCondition, removeCondition, loseWounds, hasCondition, releaseConditionLocks } from './conditions';
import { conditionLabel, psychologyLabel, talentConcrete, qualityRefLabel, traitById, refLabel, findTrappingById } from '../data';
import { contractDiseaseOnce } from './disease';
import { groupMatch } from './groups';
import { findTableEntry } from './tables';
import { bypassedAP } from './armourBypass';
import { grantTrait, grantPsychTrait, dropExpiredGrantedTraits } from './grantedTraits';
import { rollObsession } from '../data/obsessions';
import { rollMutation } from '../data/mutations';
import { attachMutation, easeExposure, corruptionEaseSteps } from './corruption';
import { findEffectTableById } from '../data/effectTables';
import { setGrapple } from './grapple'; // op `condition {grapple:true}` → relation d'Empoignade (côté grapple : import type GameOp erased → pas de cycle runtime)
import type { CodexTarget } from './ruleRefs'; // module FEUILLE (aucun import) : type de l'identité de source portée par PassiveMod
import { cureDiseases, blessDiseaseDuration } from './rest';
import { applyAlcoholTest } from './drunkenness';
import { cureCriticalWounds, receiveMedicalAid, traumaPassiveMods } from './trauma';
import { applyHealWounds } from './healing';
import { fateSaveOrDie } from './fortune';
import { talentMaxReached } from './careerSlots';
import { damageLeatherArmour, itemFromTrappingById, itemFromGive, giveTrappingLabel, recomputeLoadout, buildWeapon, weaponItem, newUid, activeLoadout, damageString, autoStowNewItem } from './items';
import { weaponMatchesFamily } from './weaponDamage';
import { itemCapability } from './capabilities';
import { suppressPsychTraits, type PsychType } from './psychology';
import { norm } from '../lib/normalize';
import { ConjureForm, conjureFormOptions, equipConjuredWeapon } from './conjuredWeapons';
import { polymorphOps } from './polymorph';
import type { SizeCategory } from './size';
import type { Duration } from './duration';
// Type-only (effacé à la compilation) : la FORME unifiée des effets « à la touche » d'une arme
// enchantée/invoquée = un `TriggeredEffect` (feuille EffectOp — noyau engine pur, jamais de transition),
// dispatché par `state/triggeredEffects` (pas ici).
import type { TriggeredEffect, FlowTest } from './flowCore';
import {
  ActiveEffect,
  EffectSource,
  ArmourBypass,
  CHAR_LABELS,
  CharKey,
  Combatant,
  Difficulty,
  DIFFICULTY_LABELS,
  HitLocation,
  HIT_LOCATION_LABELS,
  ItemInstance,
  Weapon,
  type ReachValue,
} from './types';
import { formatTrait } from './traits/dispatch';
import { woundsFromHit } from './woundsCalc';
import type { TraitInstance } from './statEntry';
import type { ChaosAlign, ExposureLevel } from './corruption';
import { t } from '../i18n';

// ---------------------------------------------------------------------------
// Formules
// ---------------------------------------------------------------------------

/** Quantité résolue à l'application : littéral, « (Bonus de X) », « (X) », dés, ou la VALEUR du jet
 *  d'une op `rollThreshold` (`{rolled}` — Régénération « récupère [le dé] PB »). */
export type Formula =
  | number
  | { bonusOf: CharKey }
  | { charOf: CharKey }
  | { dice: DiceSpec }
  | { rolled: true }
  /** INDICE de l'attaque NATURELLE en cours (« Morsure +10 », « Souffle +15 ») — injecté par le
   *  résolveur de manœuvre (`ctx.indice`). Permet d'authorer les Dégâts « Indice » d'une manœuvre en
   *  GameOp : `wounds { amount: {indiceOf:true}, ignoreTB:false, ignoreAP:false }`. 0 hors contexte. */
  | { indiceOf: true }
  /** Nombre de PIONS de l'État qui DÉCLENCHE l'effet (Empoisonné « 1 PB/pion », En Flammes « +1/pion ») —
   *  injecté par le bus d'événements (`ctx.stacks`) quand un `effects: onRoundEnd` d'État est joué. 0 hors contexte. */
  | { stacks: 'self' }
  /** ÉCART d'Avantage avec les adversaires ENGAGÉS (`max(0, meilleur Avantage ennemi engagé − le sien)`) —
   *  injecté par le dispatcher de combat (`ctx.engagedAdvantageGap`, calculé sur la `battle`). Valeur
   *  RELATIONNELLE de l'arène (Instable « perd la différence d'Avantage », LDB 85 l.177). 0 hors contexte. */
  | { engagedAdvantageGap: true }
  /** Blessures infligées par l'attaque/lancement courant (`ctx.woundsDealt`) — miroir Formula de la
   *  Condition `woundsDealt`. Absorption « Toute attaque qui touche la créature inflige une quantité ÉGALE
   *  de Dégâts à la victime absorbée » (EDO 11 p.147) : `wounds { amount: { woundsDealt: true } }`. 0 hors contexte. */
  | { woundsDealt: true }
  /** SOMME de termes (composition) — « 1d10 + (pions − 1) » des Dégâts d'En Flammes (LDB 16 l.77). Permet
   *  d'authorer une formule composée sans coder en dur l'addition au moteur. Récursif. */
  | { sum: Formula[] }
  /** FACTEUR multiplicatif (« 1d10 × 10 minutes » — Mystracine/Mandragore, LDB 71 l.33/35) : résout `of`
   *  puis multiplie par `factor`. NB : `10d10` n'est PAS équivalent (distribution différente) — fidélité RAW.
   *  `factor` est lui-même une `Formula` : le PRODUIT DE DEUX FORMULES (« (Force Mentale) × 1d10 minutes »,
   *  VDM 05 — Contact doré) s'écrit `{times:{of:{charOf:'force-mentale'}, factor:{dice:{n:1,sides:10}}}}`. */
  | { times: { of: Formula; factor: Formula } };

/** Résout une formule contre son référent (`ref`) — RNG seedable pour les dés. `rolled` = valeur du
 *  jet courant d'un `rollThreshold` (injectée par l'op ; 0 hors de ce contexte) ; `indice` = Indice
 *  de l'attaque naturelle d'une manœuvre (`{indiceOf}`, 0 hors contexte). */
export function resolveFormula(f: Formula, ref: Combatant, rng: RNG = defaultRNG, rolled?: number, indice?: number, stacks?: number, gap?: number, woundsDealt?: number): number {
  if (typeof f === 'number') return f;
  if (typeof f !== 'object' || f === null) return 0; // formule malformée (donnée invalide) → 0, jamais un crash en plein combat
  if ('bonusOf' in f) return bonus(effectiveChar(ref, f.bonusOf));
  if ('charOf' in f) return effectiveChar(ref, f.charOf);
  if ('rolled' in f) return rolled ?? 0;
  if ('indiceOf' in f) return indice ?? 0;
  if ('stacks' in f) return stacks ?? 0;
  if ('engagedAdvantageGap' in f) return gap ?? 0;
  if ('woundsDealt' in f) return woundsDealt ?? 0;
  if ('sum' in f) return f.sum.reduce<number>((acc, term) => acc + resolveFormula(term, ref, rng, rolled, indice, stacks, gap, woundsDealt), 0);
  if ('times' in f) return resolveFormula(f.times.of, ref, rng, rolled, indice, stacks, gap, woundsDealt) * resolveFormula(f.times.factor, ref, rng, rolled, indice, stacks, gap, woundsDealt);
  return rollDice(f.dice, rng);
}

/** Clés reconnues d'une `Formula` OBJET — SOURCE UNIQUE, alignée sur l'union `Formula` et sur les
 *  branches de `resolveFormula`. Réutilisée par le garde-fou d'intégrité des données
 *  (`src/data/data-wellformed.test.ts`) pour valider les champs Formula des `GameOp` sans re-coder la liste. */
export const FORMULA_OBJECT_KEYS = ['bonusOf', 'charOf', 'dice', 'rolled', 'indiceOf', 'stacks', 'engagedAdvantageGap', 'woundsDealt', 'sum', 'times'] as const;

/** Une valeur est-elle une `Formula` VALIDE — résoluble par `resolveFormula` sans planter ? `number` FINI,
 *  ou objet portant exactement une clé connue (`sum` récursif). PUR. Rejette une string (un `'$indice'`
 *  non substitué qui atteindrait `resolveFormula` — le bug qu'on garde), un objet vide, `NaN`/`Infinity`. */
export function isValidFormula(f: unknown): f is Formula {
  if (typeof f === 'number') return Number.isFinite(f);
  if (typeof f !== 'object' || f === null) return false;
  const o = f as Record<string, unknown>;
  if ('sum' in o) return Array.isArray(o.sum) && o.sum.every(isValidFormula);
  if ('times' in o) {
    const t = o.times as Record<string, unknown> | null;
    return !!t && typeof t === 'object' && isValidFormula(t.of) && isValidFormula(t.factor);
  }
  return FORMULA_OBJECT_KEYS.some((k) => k in o);
}

/** Échelle « par +N DR » d'un sort (LDB 41/42/47 — « +1 par +2 DR », « +DR Dégâts ») :
 *  appliquée au DR du jet d'incantation (`OpsCtx.sl`), jamais négative. */
export interface PerSL {
  /** Palier de DR (« par +2 DR » → 2). */
  every: number;
  /** Quantité ajoutée par palier (peut être négative — retrait de Corruption). */
  amount: number;
  /** Échelle sur l'ÉCHEC (branche `fail` d'un nœud Flow `test`, `ctx.sl` négatif) au lieu de la réussite —
   *  « gagnant un État X pour chaque niveau d'échec » (ex. Hallucinogène, MSRC 15 l.167). Magnitude =
   *  `|sl|` quand `sl < 0`, 0 sinon (symétrique du défaut qui ignore tout `sl` négatif). */
  onFailure?: boolean;
}
export function slBonus(sl: number | undefined, p?: PerSL): number {
  if (!p || sl == null || !Number.isFinite(sl)) return 0; // DR absent OU non fini → 0 (jamais de NaN propagé)
  const magnitude = p.onFailure ? Math.max(0, -sl) : Math.max(0, sl);
  return Math.floor(magnitude / Math.max(1, p.every)) * p.amount;
}

/** Estimation DÉTERMINISTE d'une `Formula` pour le SCORING (jamais de tirage — le planning ne doit PAS
 *  consommer le RNG seedable, sous peine de désync du flux déterministe / coop / tests reproductibles, et
 *  d'une magnitude aléatoire). Calque la convention statique de `missileDamage` (valeur écrite). Les dés
 *  rendent leur MOYENNE (`n×(faces+1)/2 + plus`) ; `(X)`/`(Bonus de X)` la valeur réelle (déterministe) ;
 *  `{rolled}` une valeur de référence neutre (le dé moyen d'un d10 ≈ 5,5) ; les axes relationnels (Indice/
 *  stacks/écart d'Avantage) absents au planning → 0. PUR, sans RNG. */
export function formulaExpectation(f: Formula, ref: Combatant): number {
  if (typeof f === 'number') return f;
  if (typeof f !== 'object' || f === null) return 0; // formule malformée (donnée invalide) → 0, jamais un crash en plein combat
  if ('bonusOf' in f) return bonus(effectiveChar(ref, f.bonusOf));
  if ('charOf' in f) return effectiveChar(ref, f.charOf);
  if ('dice' in f) return f.dice.n * (f.dice.sides + 1) / 2 + (f.dice.plus ?? 0);
  if ('rolled' in f) return 5.5; // référence neutre (dé moyen d'un d10) — jamais tiré
  if ('sum' in f) return f.sum.reduce<number>((acc, term) => acc + formulaExpectation(term, ref), 0);
  if ('times' in f) return formulaExpectation(f.times.of, ref) * formulaExpectation(f.times.factor, ref);
  return 0; // indiceOf / stacks / engagedAdvantageGap : hors contexte au planning
}

/** Somme des bonus de DR à une Compétence (`skillId`) conférés au porteur — op `skillDRBonus` PASSIVE
 *  (`TraitData.passive`, lue PAR ID — Furtif : +Bonus d'Agilité au DR de Discrétion, LDB 85), PROJETÉE
 *  par une aura (`auraMods`), portée par une SÉQUELLE (`traumaPassiveMods` — LDB 18 l.61/l.72), OU
 *  TEMPORISÉE par un effet actif (`ActiveEffect.drBonus` — chansons de marin, MDG 09). Distincte de
 *  `skillMod` (valeur du Test) — consommée au calcul du DR d'un Test
 *  RÉUSSI (Discrétion de la Surprise, incantation, attaque, Test générique). */
export function skillDRBonus(c: Combatant, skillId: string, spec?: string): number {
  // Une op SANS `spec` s'applique à toute spécialisation (Furtif → Discrétion) ; une op AVEC `spec` ne
  // s'applique qu'à cette spécialisation (Aura de Dhar → Langue (Magick) seulement, pas Langue (Bretonnien)).
  const matches = (op: { skill?: string; spec?: string }) => op.skill === skillId && (op.spec == null || op.spec === spec);
  let n = 0;
  for (const t of c.traits ?? []) {
    for (const op of traitById.get(t.id)?.passive ?? []) {
      if (op.op === 'skillDRBonus' && matches(op)) n += resolveFormula(op.bonus, c);
    }
  }
  // Séquelles (`c.traumas`) : leurs ops passives, `kind` = `passiveKind` de la fiche, sinon DÉRIVÉ par
  // `traumaOpKind` — qui ne classe que maxWeaponHands/senseLoss/moveScale et rend `douleur` par défaut,
  // donc annulable par Détermination/Insensible/prothèse. Les cicatrices sociales (LDB 18 l.61 et l.72)
  // portent `passiveKind: "intrinsèque"` : liste d'annulateurs VIDE, leur DR survit à la Détermination.
  // Une séquelle à `skillDRBonus` SANS `passiveKind` tomberait, elle, en `douleur` (annulée par Insensible).
  for (const m of traumaPassiveMods(c)) if (m.op.op === 'skillDRBonus' && matches(m.op)) n += resolveFormula(m.op.bonus, c);
  // Auras (Aura de Dhar : +1 DR Focalisation/Langue (Magick) aux sorciers et démons du dieu à portée,
  // camp indifférent) — `aura.passive` projeté dans `auraMods` par le hook `recompute-auras`. Sommé
  // (le DR cumule), comme les passifs de trait.
  for (const m of c.auraMods ?? []) if (m.op.op === 'skillDRBonus' && matches(m.op)) n += resolveFormula(m.op.bonus, c);
  // Effets ACTIFS temporisés (op `skillDRBonus` exécutée — chanson de marin « Jacques Bret », MDG 09 l.228).
  for (const e of c.activeEffects ?? []) for (const b of e.drBonus ?? []) if (b.skill != null && matches({ skill: b.skill, spec: b.spec })) n += b.bonus;
  // Objets POSSÉDÉS : leur `passive` skillDRBonus (Boussole : « Les Tests d'Orientation bénéficient de
  // +1 DR avec l'aide d'une boussole », MDG 14 l.275) — NON gaté sur le port, comme `lockpicks`/`isRations`
  // (l'outil se sort pour servir) ; les passifs de VALEUR d'objet (skillMod des Bésicles) restent, eux,
  // gatés porté/tenu via `passiveMods`.
  for (const it of c.items ?? []) {
    if (!it.trappingId) continue;
    for (const op of findTrappingById(it.trappingId)?.passive ?? []) if (op.op === 'skillDRBonus' && matches(op)) n += resolveFormula(op.bonus, c);
  }
  return n;
}

/** Ops `offTerrainMod` PASSIVES du combattant (traits INHÉRENTS `c.traits`, lus PAR ID comme
 *  `skillDRBonus` — Créature marine MDG 16 p.140 / Aquatique MSRC 15 p.90). PUR. */
function offTerrainOps(c: Combatant): Extract<GameOp, { op: 'offTerrainMod' }>[] {
  const out: Extract<GameOp, { op: 'offTerrainMod' }>[] = [];
  for (const t of c.traits ?? []) {
    for (const op of traitById.get(t.id)?.passive ?? []) if (op.op === 'offTerrainMod') out.push(op);
  }
  return out;
}

/** Terrains d'ÉLECTION requis par les passifs `offTerrainMod` (`eau` pour Créature marine/Aquatique) —
 *  vide = aucune contrainte. Lu par le state (`placeCombatant`) pour poser le drapeau `offTerrain`. PUR. */
export function requiredTerrains(c: Combatant): string[] {
  return [...new Set(offTerrainOps(c).map((o) => o.terrain))];
}

/** Mouvement IMPOSÉ hors de son terrain (op `offTerrainMod.mSet` — Créature marine : « son M tombe à 1 »,
 *  MDG 16 p.140 ; Aquatique : « ne peut pas se déplacer sur la terre ferme », MSRC 15 p.90 → 0), actif seulement
 *  quand le drapeau POSITIONNEL `c.offTerrain` est posé. Plusieurs sources → la plus contraignante (min).
 *  `null` = pas de contrainte. Lu par `effectiveMovement`. PUR. */
export function offTerrainMoveCap(c: Combatant): number | null {
  if (!c.offTerrain) return null;
  const sets = offTerrainOps(c).filter((o) => o.mSet != null).map((o) => o.mSet!);
  return sets.length ? Math.min(...sets) : null;
}

/** Malus de DR à TOUS les Tests hors de son terrain (op `offTerrainMod.testDR` — Créature marine :
 *  « tous les Tests qu'elle effectue subissent –2 DR », MDG 16 p.140), gaté par `c.offTerrain`. Σ. Consommé
 *  aux épines de Test : attaque (`applyHit` via les sites `skillDRBonus` de combat.ts), Test générique
 *  (`rollFlows`), incantation (`magicTestSLBonus`). PUR. */
export function offTerrainTestDR(c: Combatant): number {
  if (!c.offTerrain) return 0;
  return offTerrainOps(c).reduce((s, o) => s + (o.testDR ?? 0), 0);
}

/** Suffocation hors de son terrain (op `offTerrainMod.suffocates` — Créature marine : « doivent être
 *  immergées pour respirer correctement (…) sinon elles se mettent à suffoquer », MDG 16 l.19), gaté par
 *  `c.offTerrain`. Consommé par `suffocationTick` (`engine/suffocation.ts`) — SOURCE UNIQUE avec le
 *  drapeau d'effet `suffocates` (sorts) ; aucun `hasTrait` de créature nommée. PUR. */
export function offTerrainSuffocates(c: Combatant): boolean {
  if (!c.offTerrain) return false;
  return offTerrainOps(c).some((o) => o.suffocates);
}

/** Somme des bonus de DR aux Tests d'une CARACTÉRISTIQUE (op `charDRBonus` — chanson « Camarades
 *  d'équipage » : +1 DR aux Tests de Sociabilité, MDG 09 l.236) : passifs de trait + auras + effets
 *  actifs. Consommée sur un Test RÉUSSI (même règle d'application que `skillDRBonus`/LDB 10 l.19). */
export function charDRBonusOf(c: Combatant, char: CharKey | undefined): number {
  if (!char) return 0;
  let n = 0;
  for (const t of c.traits ?? []) {
    for (const op of traitById.get(t.id)?.passive ?? []) {
      if (op.op === 'charDRBonus' && op.char === char) n += resolveFormula(op.bonus, c);
    }
  }
  for (const m of c.auraMods ?? []) if (m.op.op === 'charDRBonus' && m.op.char === char) n += resolveFormula(m.op.bonus, c);
  for (const e of c.activeEffects ?? []) for (const b of e.drBonus ?? []) if (b.char === char) n += b.bonus;
  return n;
}

/** Somme des modificateurs au Test d'un ATTAQUANT visant `c` (op PASSIVE `incomingAttackMod`, par id) pour
 *  un mode d'attaque (`melee`/`ranged`) — inclut les ops `all`. Parasité : −10 en mêlée (LDB 85 p.340). */
export function incomingAttackMod(c: Combatant, mode: 'melee' | 'ranged'): number {
  let n = 0;
  for (const t of c.traits ?? []) {
    for (const op of traitById.get(t.id)?.passive ?? []) {
      if (op.op === 'incomingAttackMod' && (op.mode === mode || op.mode === 'all')) n += op.amount;
    }
  }
  return n;
}

/** L'attaque du porteur compte-t-elle comme `keyword` (op passive `attackKeyword`, par id) ? Magique/
 *  Démoniaque/Fabriqué → 'magic'. (La qualité d'arme 'magic' est vérifiée à part par `isMagicWeapon`.) */
export function attackHasKeyword(c: Combatant, keyword: 'magic'): boolean {
  for (const t of c.traits ?? []) for (const op of traitById.get(t.id)?.passive ?? []) if (op.op === 'attackKeyword' && op.keyword === keyword) return true;
  return false;
}

/** Les Dégâts entrants sur `defender` sont-ils NULLIFIÉS (op passive `mitigateIncoming{mode:'nullify'}`,
 *  Éthéré) ? `unlessKeyword:'magic'` laisse passer l'attaque si elle est magique (l'`attacker` porte le
 *  mot-clé OU l'arme est magique → `weaponHasMagic`). */
export function incomingDamageNullified(defender: Combatant, attacker: Combatant, weaponHasMagic: boolean): boolean {
  for (const t of defender.traits ?? []) {
    for (const op of traitById.get(t.id)?.passive ?? []) {
      if (op.op === 'mitigateIncoming' && op.mode === 'nullify') {
        if (op.unlessKeyword === 'magic' && (weaponHasMagic || attackHasKeyword(attacker, 'magic'))) continue;
        return true;
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Ops
// ---------------------------------------------------------------------------

/** Sens PAIRÉ (œil/oreille, LDB 18) — vocabulaire PARTAGÉ par `senseLoss` (perte de l'organe) et la
 *  restriction `skillMod.sense` (le Test SOLLICITE ce sens : Surdité ne pénalise que les Tests de
 *  Perception basés sur l'ouïe, pas ceux basés sur la vue/l'odorat — LDB 18). */
export type PairedSense = 'vue' | 'ouie';

export type GameOp =
  /** Blessures subies DIRECTEMENT. Par DÉFAUT ignore BE ET PA (tables de contrecoup LDB 46/40 ;
   *  sorts « ignorant BE et PA » comme la Comète à Deux Queues). `ignoreTB:false` → le Bonus
   *  d'Endurance de la cible est DÉDUIT (sort « ignorant les PA » SEULEMENT, ex. ZdE de poison) ;
   *  `ignoreAP:false` → les PA (Localisation Corps) sont déduits. `perSL` : « +DR Dégâts » ;
   *  `onlyGroups` : ne touche qu'un Groupe (« les Morts-vivants… », Feu de l'âme). */
  | { op: 'wounds'; amount: Formula; perSL?: PerSL; onlyGroups?: string[]; ignoreTB?: boolean; ignoreAP?: boolean;
      /** Quand les PA sont déduits (`ignoreAP:false`), IGNORE en plus les PA d'une matière (Cieux/Métal =
       *  `metal`, Ombres = `nonMagic`) — attribut de Domaine (l'arc d'Azyr perce le métal). */
      bypassArmour?: 'metal' | 'nonMagic';
      /** Localisation dont les PA sont déduits (quand `ignoreAP:false`). `corps` (défaut) ou `least` =
       *  la Localisation la MOINS protégée (En Flammes brûle là où l'armure protège le moins, LDB 16 l.77). */
      apFrom?: 'corps' | 'least';
      /** Plancher de Blessures infligées APRÈS mitigation (Sang corrosif : « min 1 » même BE/PA élevés). */
      min?: number;
      /** PA ADDITIONNELS de CE coup (situationnels), cumulés aux PA de la Localisation quand `ignoreAP:false` :
       *  ex. les +2 PA de poupe / +5 PA frontaux du Bélier d'une collision (`CollisionDamage.armorBonus`). Garde
       *  la mitigation DANS l'op (langue unique) plutôt que de la pré-calculer côté appelant. */
      extraAP?: number;
      /** Mode COUP D'ARME : résout les Blessures via `woundsFromHit(ctx.weapon, …)` — donc qualités d'arme
       *  (Perforante/Empaleuse), armure à la `ctx.location` et BE, comme une attaque normale (≠ formule + flags).
       *  Requiert `ctx.weapon` ; `amount` = Dégâts totaux (arme + DR + qualités) ; `min` = plancher (0 navire). */
      weaponHit?: boolean }
  /** Blessures rendues (plafonnées au max). */
  | { op: 'heal'; amount: Formula; perSL?: PerSL }
  /** Blessures rendues AU LANCEUR (« Puis vous Guérissez 1 Point de Blessure » — Drain).
   *  Sans `ctx.caster`, s'applique à la cible (auto-sort). */
  | { op: 'healCaster'; amount: Formula }
  /** Ajout d'un État nommé (LDB 16). `durationRounds` : État À DURÉE (« qui dure 1d10
   *  Rounds ») ; `perRound` : État RÉCURRENT — ré-appliqué chaque fin de Round pendant la
   *  durée du sort (ctx.defaultDurationRounds), via un effet actif porteur. */
  | { op: 'condition'; id: string; value?: Formula; durationRounds?: Formula; perRound?: boolean; valuePerSL?: PerSL; onlyGroups?: string[];
      /** Gates d'État (Sommeil, LDB 47 : « Si la cible possède un État À Terre, elle gagne
       *  Inconscient » / sinon « gagnant l'État À Terre ») : appliqué seulement si la cible
       *  porte (`onlyIfCondition`) / ne porte pas (`unlessCondition`) l'État nommé. */
      onlyIfCondition?: string; unlessCondition?: string;
      /** Force d'évasion d'un État à Test opposé (Empêtré : « se libérer » contre cette Force, LDB 16
       *  l.61) — résolue contre le RÉFÉRENT (`ctx.caster ?? target`) À L'APPLICATION et FIGÉE sur l'entrée
       *  de condition. Ex. `{ charOf: 'FM' }` du lanceur (Enchevêtrement de Taal, Toile surprise : « la
       *  Force d'entrave égale votre Force Mentale »), `{ charOf: 'Int' }` (Enchevêtrement des Arcanes),
       *  ou un littéral (`60`). Absente ⇒ le flux de récupération garde son défaut (Force de la source
       *  vivante, ou Test simple). */
      escapeStrength?: Formula;
      /** Seuil de DR FIGÉ d'un État à Test NON opposé (Empêtré « se libérer » contre un seuil, Filets —
       *  Zoo Impérial p.29 : « Test de Force Intermédiaire (+0) et obtenir un nombre de DR égal à l'Indice
       *  du filet »). Résolue contre le RÉFÉRENT et FIGÉE sur l'entrée de condition, comme `escapeStrength`
       *  (mutuellement exclusifs : priorité à `escapeThreshold` s'il est présent — cf. `resolveRecoverTest`). */
      escapeThreshold?: Formula;
      /** Aggravation sur ÉCHEC du Test de récupération (Filets, Zoo Impérial p.29 : « si la cible ne
       *  parvient pas à se dépêtrer, elle gagne un État Empêtré supplémentaire ») — FIGÉE sur l'entrée de
       *  condition. Absent (Immobilisante générique LDB 62 p.298) : un échec n'aggrave rien. */
      entangleOnFail?: boolean;
      /** Dégâts ignorant l'armure infligés à CHAQUE tentative de libération, réussie ou ratée (Filets
       *  BARBELÉS, Zoo Impérial p.29 : « infligent automatiquement des Dégâts qui ignorent l'armure à toute
       *  cible qui se débat »). Résolue contre le RÉFÉRENT et FIGÉE sur l'entrée de condition ; ZI 2 p.29 ne
       *  chiffre pas ce montant — champ de DONNÉE éditable (qualité `filet-barbele`), rien en dur ici. */
      struggleDamage?: Formula;
      /** VERROU de Critique (LDB 18) : l'État posé ne pourra être RETIRÉ que lorsque cette Condition
       *  (algèbre flowCore) sera vraie. Ex. Aveuglé « tant que tous les Hémorragique n'ont pas été
       *  éliminés » (Tête 46-50) ⇒ `{ kind:'compare', subject:{who:'target',condition:'hemorragique'},
       *  op:'==', value:0 }`. Figé sur l'entrée d'État, évalué par `isConditionLocked`. */
      lockedUntil?: import('./flowCore').Condition;
      /** VERROU d'ACTE de soin (LDB 18) : l'État posé « ne peut être retiré que par [acte] » (Aveuglé/Sonné/
       *  Inconscient « par Aide Médicale », Hémorragique « par Chirurgie »). Figé sur l'instance, levé par l'acte
       *  nommé (`releaseConditionLocks`) qui RETIRE alors l'État. Évalué par `isConditionLocked`. */
      unlockBy?: import('./types').ConditionUnlock;
      /** Empoignade (LDB 14 l.159) : poser AUSSI la relation symétrique `grapplingWith` entre le RÉFÉRENT
       *  (`ctx.caster`, l'attaquant) et la cible — la SEULE voie data-driven de démarrage d'une Empoignade
       *  (Constricteur onHit, Tentacules/Langue, Absorption, et l'init JOUEUR migrée). L'État *Empêtré* est
       *  l'effet visible ; ce flag ajoute le lien de lutte (résolu ensuite par le flux/IA d'Empoignade). */
      grapple?: boolean;
      /** État à durée d'HORLOGE (minutes/heures depuis `ctx.now`) — Belladone « un sommeil… dure 1d10+4
       *  heures » (LDB 72 l.18), Fleur de lune Inconscient « Durée : 1d10+5 heures » (LDB 71 l.29). Résolue
       *  à l'application → `ConditionInstance.untilTime`, purgée par `purgeClockEffects` (même patron que
       *  `castPenalty.minutes`). Exclusif de `durationRounds`/`perRound`. */
      durationMinutes?: Formula; durationHours?: Formula }
  /** Retrait d'États : `id` absent = au choix de la cible (1er État porté). `valuePerSL` : échelle
   *  « +1 par +N DR » ajoutée à `value` (Mâchoires d'acier : « chaque DR supprime un État Sonné
   *  supplémentaire », LDB 10) — inerte si absent (calque op `condition`). */
  | { op: 'removeCondition'; id?: string; value?: Formula; valuePerSL?: PerSL; all?: boolean }
  /** Retire un état PSYCHOLOGIQUE porté (`PsychAffliction.type` — collection `psychState`, DISTINCTE de
   *  `conditions` : pas de perte d'Avantage à la pose, LDB 21 ≠ LDB 16). GÉNÉRIQUE (paramétré par `type`) :
   *  sortie de Frénésie (`effects: onTurnStart` → fin + Exténué, LDB 21 l.36). Journalisé via `t()`. */
  | { op: 'endPsych'; type: string }
  /** POSE (ou met à jour) un état PSYCHOLOGIQUE porté — JUMELLE d'`endPsych`, même collection
   *  `psychState` (DISTINCTE de `conditions` : pas de perte d'Avantage à la pose, LDB 21 ≠ LDB 16).
   *  UPSERT : l'entrée visée est celle de même `type` ET même `cible` (Traits CIBLÉS), ou — sans
   *  `cible` — de même `sourceId` (Peur/Terreur : une entrée par créature source) ; absente, créée.
   *  Charge utile lue par le moteur de Psychologie : `indice` (Indice à surmonter), `calmeDR` (DR
   *  cumulé du Test étendu), `active` (Trait ciblé subi / résisté), `lastTestRound` (n° de Round du
   *  dernier Test). Champ absent = INCHANGÉ sur une entrée existante. Journalisé via `t()` ; une
   *  entrée `active:false` est un marqueur inerte (aucune ligne). */
  | { op: 'beginPsych'; type: string; cible?: string; sourceId?: string; indice?: Formula; calmeDR?: Formula; active?: boolean; lastTestRound?: number; fromTest?: boolean }
  /** Modificateur de caractéristique temporisé (ActiveEffect — meilleur bonus +
   *  pire pénalité sans cumul, LDB l.168). `durationRounds` absent = durée du
   *  contexte (sort : Rounds, horloge, ou permanent — cf. `durationFromCtx`).
   *  `durationHours`/`durationMinutes` : durée d'HORLOGE intrinsèque (Aux Armes « −10 Agilité pendant
   *  1d10 jours », `durationHours` = jours×24) — même patron que `condition.durationHours`, résolue
   *  MAINTENANT depuis `ctx.now`, purgée par `purgeClockEffects`. Exclusif de `durationRounds`. */
  | { op: 'charMod'; char: CharKey; mod: number; durationRounds?: Formula; durationMinutes?: Formula; durationHours?: Formula }
  /** PA à une Localisation (`loc`) ou à TOUTES (`loc` absent — Armure Aethyrique « +1 PA à toutes les
   *  Localisations »). Flow de sort → `ActiveEffect` temporisé (apAll/apAt) lu par effectiveArmourAt ;
   *  `passive` de mutation/trait → armure naturelle permanente lue par mutationArmourBonus.
   *  `amount` NÉGATIF = RETRAIT de PA (VDM 05 — Armure de fer blanc « perd 2 Points d'Armure à chaque
   *  Localisation » ; Inscription, volet acide « détruit 1 Point d'Armure à la Localisation touchée ») :
   *  la valeur est portée telle quelle sur l'effet actif, le PLANCHER 0 est appliqué au TOTAL par
   *  `effectiveArmourAt` — jamais ici (un clamp à la pose rendrait la donnée silencieusement inerte).
   *  `noDeviation` (LDB 63 l.30 + EDO App.2 l.196) : ce PA conféré ne peut pas servir à la Déviation
   *  Critique (Écailles) ; défaut absent = déviatable (Trait créature Armure / armure portée restent sacrifiables).
   *  `atHitLocation` : la Localisation est celle du COUP courant (`ctx.location`) — « à la Localisation
   *  touchée » (VDM 05, Inscription). Prime sur `loc` ; hors contexte de touche, l'op est inerte (journalisée). */
  | { op: 'ap'; loc?: HitLocation; amount: Formula; noDeviation?: boolean; atHitLocation?: boolean }
  // (Il n'existe PLUS d'op `test` : un Test est un nœud de la STRUCTURE Flow `{kind:'test'}`, jamais une
  //  feuille d'effet — résolu CADENCE-AWARE par `resolveFlowTest` (héros manuel = jet influençable ;
  //  ennemi/auto = inline), avec sa branche `onFail` et sa continuation honorées. Les derniers usages
  //  inline — les Tests imbriqués des tables d'Imparfaites/Colère, LDB 46/40 — sont désormais des nœuds
  //  Flow `test` produits par `engine/miscast` et joués par `applyMiscast`→`runCombatFlow` (Lot 4d).
  //  « vocabulaire de Test UNIQUE » : aucun jet de héros ne se résout en silence.)
  /** Points de Corruption (LDB 19). Le store branche `ctx.onCorruption` (seuil →
   *  mutation → damnation) ; sans contexte, simple incrément du compteur.
   *  `align` : Puissance du Chaos de la source — force la table EDOC alignée si une mutation survient. */
  | { op: 'corruption'; amount: number; perSL?: PerSL; align?: ChaosAlign }
  /** Points de PÉCHÉ ±N (LDB 40 l.36 : sanction du prêtre fautif ; ACE Annexe I « Pénitence » :
   *  « enlevez 1 point de Péché, ou 2 sur un Succès Impressionnant ») — jamais sous 0. COUTURE UNIQUE
   *  du Péché : l'Effet de scène `giveSin` passe par CETTE op (une seule implémentation). */
  | { op: 'sinMod'; amount: number }
  /** EXPOSITION à une Influence corruptrice (LDB 19 l.23-75) : Test différé par MODALE
   *  (pendingCorruption) — op IMPURE résolue par la couche state via `ctx.onCorruptionExposure`
   *  (même patron que `ctx.onCorruption`) ; sans contexte (moteur pur), journalisée sans jet.
   *  `skill` absent = nature indéterminée → le joueur choisit Résistance/Calme dans la modale.
   *  DEUX SENS, une seule op — `easeSteps` présent = la cible est ABRITÉE : l'op pose une protection
   *  (`ActiveEffect.corruptionEase`, N crans) qui ATTÉNUE toute Influence subie tant qu'elle dure
   *  (VDM 05 — Bouclier en acier doré : « réduit de 2 crans une Influence corruptrice (une Exposition
   *  Majeure en devient une Mineure par exemple) ») ; `level` est alors inutile. Sinon l'op POSE
   *  l'exposition, de niveau `level` atténué par la protection que la cible porte déjà (`easeExposure`).
   *  Un niveau atténué sous la Mineure ne pose AUCUNE exposition. */
  | { op: 'corruptionExposure'; level?: ExposureLevel; skill?: 'resistance' | 'calme'; easeSteps?: number }
  /** Points de Chance OU de Destin accordés (`resource`, LDB 47 — « Les Signes d'Amul », « Que la
   *  chance persiste », « Maître du Destin », « Troisième Signe d'Amul ») : incrément immédiat (peut
   *  dépasser le maximum — c'est un grant de Sort) ; `temporary` pose un effet actif qui RETIRE les
   *  points NON dépensés à l'expiration (rounds OU horloge, engine/grantedResources). `perSL` : « +1
   *  par +2 DR ». `amount` NÉGATIF = retrait (Dague voleuse de chance, VDM 12 l.833) — le compteur
   *  plancher à 0, jamais l'argument. */
  | { op: 'gainResource'; resource: 'fortune' | 'fate'; amount: number; perSL?: PerSL; temporary?: boolean }
  /** Porte l'Avantage de la cible à AU MOINS `amount` (jamais réduit). Trait Redoutable (ZI) : au début
   *  de son tour, la créature complète ses Avantages jusqu'à son *Indice* (`amount: '$indice'` baké).
   *  `feedOpposingPool` : clause d'Avantage de groupe (AA) du Trait Redoutable (`MDG 16 l.13`) — QUAND
   *  cette op S'EXÉCUTE (le garde-fou Empêtré/Inconscient/Surpris, MDG 16 l.11, vit dans le nœud `if`
   *  englobant de la donnée — jamais revérifié ici), la créature génère EN PLUS l'Indice PLEIN (`amount`
   *  résolu, pas le seul manquant) pour la réserve adverse, via `ctx.onOpposingAdvantage` (même patron que
   *  `ctx.onCorruption`) — consommé kind-agnostiquement par la couche state (`state/combat/advantagePool.ts`). */
  | { op: 'gainAdvantage'; amount: Formula; feedOpposingPool?: boolean }
  /** Pénalité/blocage d'incantation temporisé (contrecoups, LDB 46/40) : −N à une
   *  Compétence de magie, Tests interdits, ou DR de Prière plafonné à 0. Durée en
   *  Rounds (combat + entretien hors combat) OU en minutes/jours d'horloge. */
  | { op: 'castPenalty'; skill: 'priere' | 'langue' | 'focalisation' | 'all'; mod?: number; blocked?: boolean; maxZeroDR?: boolean; rounds?: Formula; minutes?: Formula; hours?: Formula; days?: Formula }
  /** Modificateur TEMPORAIRE de Standing (LDB 23 l.228-234 « Réputation » : +1 sur succès, +2 sur Succès
   *  Stupéfiant, −1 sur Échec Stupéfiant) — durée `{scale:'adventure'}` (« pour la prochaine aventure »),
   *  composé par `heroStatus` (interludeFlow.ts), purgé à l'interlude SUIVANT (`purgeAdventureEffects`). */
  | { op: 'statusMod'; amount: Formula }
  /** Jeton d'INVERSION de Test CONSOMMABLE « pour la prochaine aventure » (LDB 23 l.209/218) — durée
   *  `{scale:'adventure'}`, consommé par `consumeReverseToken` (rollFlowSpecs). `skill` absent = tout
   *  Test (« concernant votre cible », l.218). */
  | { op: 'grantReverseToken'; skill?: string; spec?: string }
  /** Trait de créature TEMPORISÉ (Jalon 2.6 — « vous gagnez le Trait X tant que le Sort est
   *  actif ») : posé dans `c.traits` (vu par TOUS les consommateurs — dispatch, psy, IA,
   *  déplacement), retiré à l'expiration de l'ActiveEffect porteur. `indice` : Indice du trait
   *  (« Peur 1 », « Vol (Agilité) » → valeur du lanceur), `indicePerSL` : « +1 par +3 DR ».
   *  `argFrom` : la Cible (`arg`) est TIRÉE à l'attache plutôt que littérale — `'obsessions'` =
   *  Tableau des Obsessions (EDOC 12 : mutation « Haine sporadique » → Haine (Cible déterminée
   *  par les Obsessions)). Résolu par `applyOps` ET `attachMutation` (même tirage, `rollObsession`). */
  | { op: 'grantTrait'; traitId: string; arg?: string; argFrom?: 'obsessions'; indice?: Formula; indicePerSL?: PerSL; onlyGroups?: string[]; durationRounds?: Formula }
  /** Trait PSYCHOLOGIQUE conféré (Colère impie → Frénésie). PASSIF (mutation/trait) : posé dans
   *  `c.psychTraits` à l'attache. `psychType` = `PsychType` (frenesie, peur…). `argFrom` : la Cible
   *  (`cible`) est TIRÉE à l'attache (Tableau des Obsessions, EDOC 12) plutôt que littérale. */
  | { op: 'grantPsychTrait'; psychType: string; cible?: string; argFrom?: 'obsessions' }
  /** Retire UN Trait psychologique porté (`c.psychTraits` — la DONNÉE persistée, ≠ `endPsych` qui
   *  retire une affliction de combat `psychState`). `psychType` absent = un Trait AU CHOIX (le 1ᵉʳ
   *  porté). Convalescence « Les choses s'arrangent » (ADE II Annexe I) : éliminer un Trait psy indésirable. */
  | { op: 'removePsychTrait'; psychType?: string }
  /** Talent OCTROYÉ, TEMPORAIRE porté par l'`ActiveEffect` (`grantedTalent`) ou STRUCTUREL dans
   *  `c.talents` quand l'octroi n'a pas d'échéance (Marques Arcaniques, VDM 02 l.238). La DURÉE vient du
   *  contexte, ce n'est pas une propriété de l'op : `durationFromCtx` retombe sur `{ scale: 'permanent' }`
   *  quand l'appelant ne fournit ni horloge ni compte de Rounds — et les deux régimes ne se rangent PAS
   *  au même endroit :
   *   - durée (Rounds/horloge) → porté par l'`ActiveEffect` (`grantedTalent`), qui s'éteint avec lui.
   *     Canaux servis : `combatFeatures.featuresOf` (capacités de combat) et, via `effectGrantedTalents`,
   *     le collecteur de POSSESSION `effectiveTalents` (fiche, chips, `hasTalent`). NON servis : les
   *     lecteurs qui parcourent `c.talents` en direct — `talentTestSLBonus` (+DR de Talent),
   *     `talentPassiveMods` (passifs), `baseWithTalents`, `extraWounds`, `careerSkillAdditions`/
   *     `careerTalentAdditions`, l'avancement.
   *   - sans échéance (Marques Arcaniques, VDM 02 l.238) → acquisition STRUCTURELLE dans `c.talents`
   *     (comme `attachMutation` et l'effet de Signe astral), bornée par le Maxi du registre : tous les
   *     canaux ci-dessus la voient.
   *  Réf par `talentId` STABLE (+ `spec` éventuel « Sans Peur (Vampires) ») — résolu en libellé concret
   *  par `talentConcrete`. */
  | { op: 'grantTalent'; talentId: string; spec?: string }
  /** Ajoute une Compétence aux listes de TOUTE carrière entamée (Maître artisan/Sorcier!/… LDB 10) —
   *  ref par `skillId` (jamais libellé). `spec='Au choix'` = reportée sur la spec choisie du talent.
   *  Lu par `careerSkillAdditions` (création/avancement), pas appliqué au combattant. */
  | { op: 'grantCareerSkill'; skillId: string; spec?: string }
  /** Ajoute un Talent aux listes de TOUTE carrière entamée (Flagellant → Frénésie « est ajouté à la
   *  liste des Talents de n'importe laquelle de vos Carrières », LDB 10) — analogue Talent de
   *  `grantCareerSkill`, ref par `talentId` STABLE. Lu par `careerTalentAdditions`, pas appliqué au combattant. */
  | { op: 'grantCareerTalent'; talentId: string; spec?: string }
  /** ALTÉRATION d'ARME temporisée — enchantement OU dégradation, une seule primitive (Jalon 2.6 —
   *  Bénédiction de Droiture : Magique ; Marteau ardent : Magique +BSoc + En flammes/À Terre à la touche ; Épée
   *  ardente : +6 + Percutante + En flammes ; VDM 05 — Arme enchantée « ajouter 1 Atout ou retirer 1
   *  Défaut », Défaut « Tous les Atouts de l'arme disparaissent […] −1 DR à tous les Tests pour attaquer
   *  avec elle », enchantements de l'arme neutralisés). Porté par le PORTEUR
   *  (ActiveEffect.enchantRef) + l'objet (`ItemInstance.enchants`), replié dans l'arme à la résolution
   *  (`applyEnchants`). `damageBonus` résolu contre le LANCEUR (BSoc du prêtre). */
  | { op: 'augmentWeapon'; /** ids STABLES de qualité (`QualityRef.id`) — relus par `parseQuality` ; jamais un libellé. */ addQualities?: string[]; damageBonus?: Formula; bypass?: ArmourBypass; requiresWeapon?: string;
      /** Qualités RETIRÉES par id STABLE (VDM 05 — Arme enchantée : « retirer 1 Défaut de l'arme »).
       *  Retire aussi les qualités de FAMILLE du Groupe d'arme, qui sont sur le même plan RAW. */
      removeQualities?: string[];
      /** Retire TOUTES les qualités de ce TYPE, lu dans le registre (`qualities.json` champ `type`, via
       *  `isAtoutQuality`) — VDM 05 Défaut : « Tous les Atouts de l'arme disparaissent ». Jamais une liste
       *  d'ids en dur : le type est une donnée du registre. */
      removeType?: 'atout' | 'defaut';
      /** Neutralise les enchantements PRÉ-EXISTANTS de l'arme tant que celui-ci tient — VDM 05 Défaut,
       *  clause des armes magiques gatée à +4 DR. */
      suppressEnchants?: boolean;
      /** Passifs d'ARME conférés par l'altération — MÊME vocabulaire que le `passive` d'un Atout/Défaut du
       *  registre (`weaponRollMod`/`weaponDamageMod`/`armourPierce`/`critOnRoll`), lu au MÊME point
       *  (`weaponPassiveOps`, engine/qualities/dispatch). VDM 05 Défaut : « −1 DR à tous les Tests pour
       *  attaquer avec elle » ⇒ `[{op:'weaponRollMod', phase:'attack', drMod:-1}]`. */
      passive?: GameOp[];
      /** Effets DÉCLENCHÉS « à la touche » de l'arme enchantée — forme UNIFIÉE (`TriggeredEffect`,
       *  comme les Atouts d'arme et les Traits) : Marteau ardent → En flammes/À Terre ; Épée de
       *  justice → Test du Groupe « Criminel » → Inconscient ; Morsure de l'hiver → Test (hors
       *  Mort-vivant/Démon) → Sonné. Agrégés par `effectsOf` et dispatchés par `fireTriggers('onHit')`. */
      onHitEffects?: TriggeredEffect[] }
  /** Purge de maladies (Amère catharsis, LDB 42) : retire `count` (+échelle DR) maladies. */
  | { op: 'cureDisease'; count?: number; countPerSL?: PerSL }
  /** −N jours sur la durée d'une maladie active. `days` plat (B. de Convalescence, LDB 41) OU `dice`
   *  (Rouille mouchetée : « Chaque dose réduit la durée de la maladie de 1d10 jours », MSRC 4 p.14) ;
   *  `disease` = SCOPE par id (Gesundheit → seulement une `blessure-purulente`, MSRC 4 p.13 — sans filtre,
   *  n'importe quelle maladie active serait raccourcie) ; `oncePerDisease` = une seule fois par maladie
   *  (« Cette Prière ne peut être tentée qu'une fois par maladie », LDB 41 — les herbes se reprennent).
   *  `daysPerSL` : échelle « +N jours par +M DR » du Test AYANT PRÉCÉDÉ l'op (Gesundheit : « un jour par
   *  DR obtenu » au Test de Résistance Accessible, MSRC 04 l.184-186) — alimentée par `ctx.sl`. */
  | { op: 'reduceDiseaseDays'; days?: number; dice?: DiceSpec; disease?: string; oncePerDisease?: boolean; daysPerSL?: PerSL }
  /** Les Blessures ne s'infecteront pas (Cautériser, LDB 47 → flag `woundDressed`, LDB 18 l.298). */
  | { op: 'preventInfection' }
  /** EXPOSE la cible à une Maladie (`disease` = id de `maladies.json`) → Test de Contraction au bilan de
   *  fin de combat (LDB 20 l.32/49). Op GÉNÉRIQUE : Infecté → 'blessure-purulente', trait Maladie →
   *  l'`arg` (ex. 'fievre-du-rongeur' pour les rats/skavens). Cumule sans doublon dans `diseaseExposure`
   *  (double exposition à la même maladie → on garde la PIRE : shift le plus dur, `instant` si l'une
   *  l'impose). Contagieux (Type), EDO App.2 l.228-230 : `difficultyShift: -2` (« le Test est de 2
   *  niveaux plus difficile » — sens `easeDifficulty`, négatif = plus difficile) + `incubation:
   *  'instant'` (« son incubation est changée en “Instantanée” »). Inerte sur un non-héros (bilan
   *  héros-only). */
  | { op: 'exposeDisease'; disease: string; difficultyShift?: number; incubation?: 'instant' }
  /** CONTRACTE instantanément une Maladie (`disease` = id) — incubation 0, durée tirée. Complète
   *  `exposeDisease` (exposition→test). Utilisé p.ex. par la conséquence `onFail` d'un symptôme « Blessé »
   *  (→ Blessure Purulente) ; applicable par tout effet (artefact maudit…). Inerte si déjà porteur. */
  | { op: 'contractDisease'; disease: string }
  /** Mort DIRECTE hors Tableau des Critiques (Toxine, LDB 20 l.215 : « ou vous mourrez ») — 1 Point de
   *  Destin sauve (LDB 17 l.29-39, « circonstances les plus difficiles […] éviter une mort certaine »,
   *  MÊME patron que la mort par Hémorragie hors combat, `outOfCombatUpkeep.ts`), sinon `target.dead = true`. */
  | { op: 'kill' }
  /** Guérit `count` (+échelle DR) Blessures critiques de convalescence — jamais une amputation
   *  (Larmes de Shallya, LDB 42). */
  | { op: 'cureCriticalWound'; count?: number; countPerSL?: PerSL }
  /** PB réduits à 0 SEUL (Châtiment, Tonnerre et foudre — LDB 40). L'Inconscient/Enflammé est posé
   *  par une op `condition` séparée dans l'entrée appelante. */
  | { op: 'reduceToZero' }
  /** RETRAIT DU JEU : la cible est destituée, sa forme se dissipe — la force qui la soutenait cède.
   *  `narration` choisit la prose : défaut/`'chaos'` = Démoniaque banni (« son âme retourne dans les
   *  Royaumes du Chaos », LDB 85 p.339) ; `'unravel'` = Instable qui se délite (« les magies la maintenant
   *  s'effondrent », LDB 85 l.177). Op IMPURE (marque `dead`), portée par l'`effects` du trait (édité au
   *  Codex) — plus de branche en dur. L'unicité est garantie en amont (déclencheur `onSlain` / `if` à 0 PB).
   *  `onlyGroups` : gaté par Groupe (Fauche-démon → cible Démoniaque seulement). */
  | { op: 'banish'; narration?: 'chaos' | 'unravel'; onlyGroups?: string[] }
  /** « Ne subit aucune pénalité causée par les États » (Endurance de l'anachorète, LDB 42) —
   *  drapeau d'effet actif lu par combatTestPenalty/testStatePenalty. `count` : n'ignore que les
   *  pénalités des N PIRES États (chanson « Les dames de L'Anguille » : « peut ignorer un État »,
   *  MDG 09 l.244 — un seul, au choix ; le pool non-cumul rend rationnel d'ignorer le pire). */
  | { op: 'ignoreStatePenalties'; count?: number }
  /** « Peut relancer le prochain Test auquel elle échoue » (Bénédiction de Chance, LDB 41) —
   *  drapeau consommé à l'usage au point de relance des flux de jet. */
  | { op: 'freeReroll' }
  /** « Deux lancers [de Blessure Critique], choisissez le meilleur » quand le porteur INFLIGE un
   *  Critique (Bénédiction de Sauvagerie, LDB 41) — lu par rollCritical via l'attaquant. */
  | { op: 'critTwice' }
  /** Putréfaction (LDB 47) : « le cuir se racornit (perdant 1 PA à 1 Localisation) » — seule la
   *  matière `cuir` est mécanisée (pièce d'armure portée) ; le reste (denrées, vêtements) reste MJ. */
  | { op: 'damageArmour'; material: 'cuir' }
  /** Baume pour un esprit blessé (LDB 42) : « Tous les Traits Psychologiques sont retirés pour la
   *  durée du Miracle » — Traits psy SUSPENDUS (portés par l'effet), restitués à l'expiration. */
  | { op: 'suppressPsych' }
  /** N'écoutez point la Sorcière (LDB 42) : « Tous les Sorts qui ciblent quelque chose ou quelqu'un
   *  dans les (BSoc) mètres subissent -20 aux Tests de Langue (Magick) » — aura portée par la cible
   *  (le prêtre), rayon élargi « +BSoc m par +2 DR » via `perSL.radiusFormula`. */
  | { op: 'castWard'; radius: Formula; perSL?: { every: number; radiusFormula: Formula } }
  /** « Soumis aux règles de la Suffocation » (LDB 18 l.345-346 — Ombres étrangleuses,
   *  Transmutation de Chamon) : −1 PB/Round, 0 PB → Inconscient, mort après BE Rounds. */
  | { op: 'suffocate' }
  /** Bouclier anti-flèches (LDB 47 — L11) : « les projectiles constitués de matière organique
   *  sont automatiquement détruits s'ils entrent dans la Zone d'Effet ». Aura sur la cible. */
  | { op: 'arrowWard'; radius: Formula }
  /** Dôme (LDB 47 — L11) : « Quiconque dans la ZdE gagne Protection (6+) contre les Attaques
   *  magiques ou à distance provenant de l'extérieur du dôme ». Aura sur la cible. */
  | { op: 'domeWard'; radius: Formula }
  /** Bénédiction de Protection (LDB 41 — L13) : « Les ennemis doivent effectuer un Test de FM
   *  Accessible (+20) pour attaquer votre cible ». Drapeau lu à la déclaration d'attaque. */
  | { op: 'attackWardFM' }
  /** Martyr (LDB 43 l.107) : « Vous recevez tous les Dégâts subis en principe par vos cibles.
   *  […] votre Bonus d'Endurance est doublé pour le calcul des PB subis à cause de ces Dégâts. »
   *  — l'effet est posé sur LA CIBLE protégée, avec l'id du prêtre (ctx.caster). */
  | { op: 'martyr' }
  /** « N'a pas besoin de respirer et ignore les règles de suffocation » (B. de Souffle, LDB 41). */
  | { op: 'noBreath' }
  /** « N'a pas besoin de manger ou de boire » (Graisse de la terre, LDB 48) : exempte de la Faim
   *  (système de provisions) tant que le Sort dure. Lu par `dailyFoodUpkeep` (engine/provisions). */
  | { op: 'noHunger' }
  /** « Vous êtes mon meilleur ami ! » (Ivresse 3-4, LDB 09 l.480) : ignore Préjugés et Animosités
   *  existants tant que l'effet dure — flag `ActiveEffect.ignoreAnimosity`. */
  | { op: 'ignoreAnimosity' }
  /** Modificateur de Test du porteur (Malédiction de malchance : −10 global). Sans `char` = GLOBAL (tous les
   *  Tests, porté par un effet actif, STACKE sur les États, lu par `combat/testStatePenalty`). AVEC `char` =
   *  modificateur de TEST qualifié par Caractéristique (Visage inversé −20 Soc, objet Laid −20 Soc), émis par
   *  le collecteur passif et lu par `testValue/passiveTestMod` — n'altère PAS la Caractéristique (≠ charMod).
   *  EXÉCUTÉ via `applyOps` (≠ passif d'État) : porte aussi `movementOnly`/`weaponHand`, portée MEMBRE d'une
   *  pénalité de récupération (#193, Épaule luxée/Genou démis LDB+AA, « Tests effectués avec ce bras »/« cette
   *  jambe ») — `weaponHand` restreint un `char:'CC'` à l'arme tenue dans CETTE main (lu par `combatValue`/
   *  `defenseValue` parade uniquement, JAMAIS l'autre main) ; `movementOnly` restreint (`char:'Ag'` typiquement)
   *  aux Tests classés « déplacement » (`SkillData.movement` — Athlétisme/Chevaucher/Escalade/Esquive/Natation,
   *  MÊME catégorie que l'État À Terre/Empêtré) — lu par `testValue`/`defenseValue` (Esquive). Absent des deux
   *  = comportement historique (global, comme avant #193). */
  | { op: 'testMod'; amount: number; char?: CharKey; combatOnly?: boolean; movementOnly?: boolean; hearingOnly?: boolean; exceptSkills?: string[]; weaponHand?: 'main' | 'off' }
  /** Immunité à l'EXPOSITION météo (froid/pluie/neige/tempête) tant que le Sort dure — Peau de loup
   *  d'hiver (Ulric), Protection contre la pluie. Lu par `exposureNight` (engine/exposure). */
  | { op: 'weatherWard' }
  /** Crée un objet (`trapping`) dans l'inventaire de la cible — nom RÉEL de la base → objet à stats,
   *  nom inconnu → objet CUSTOM (misc). Même vocabulaire que l'Effet de scène `giveTrapping`.
   *  Alimente tout sort qui DONNE du matériel : Rations (Générosité de Manann, Récolte de Rhya →
   *  système de provisions/Faim), etc. `count`/`perSL` : « +1 par +2 DR ». */
  | { op: 'giveTrapping'; trappingId?: string; custom?: string; count?: number; perSL?: PerSL }
  /** Invoque une arme MAGIQUE temporaire (Arme aethyrique : Dégâts = BFM ; Faux de Shyish : Arme
   *  d'hast, BFM+3 ; Épée ardente de Rhuin : Dégâts +6, Percutante). `damage` (résolue vs lanceur)
   *  + `damagePlus` (offset constant) donnent la composante chiffrée ; `plusBF` y ajoute le Bonus de
   *  Force (défaut : Dégâts FIXES, sans BF — conforme aux armes invoquées). L'objet invoqué est posé
   *  dans un SET d'armes DÉDIÉ actif (engine/conjuredWeapons.equipConjuredWeapon) puis retiré à
   *  l'expiration. `onHitEffects` : effets DÉCLENCHÉS à la touche (Épée ardente → En flammes) — même
   *  forme `TriggeredEffect` unifiée que `augmentWeapon`/les Atouts d'arme. */
  | { op: 'grantWeapon'; label: string; damage: Formula; damagePlus?: number; plusBF?: boolean;
      qualities?: string[]; subType?: string /* `id` de Groupe d'arme (WeaponGroupData.id) */; reach?: ReachValue; hands?: 1 | 2;
      onHitEffects?: TriggeredEffect[];
      /** SKIN cosmétique magique (token→hex, ex. lame aethyrique bleutée / améthyste / ardente) —
       *  propagé à `Weapon.skin` par recomputeLoadout, l'arme se rend recolorée (système d'objet unique). */
      skin?: Record<string, string>;
      /** Silhouette de RENDU : `id` de Possession (`TrappingData.id`) pour les conjures à forme FIXE
       *  (Faux → `serpe-de-guerre`, Épée ardente → `arme-simple`) — résolu par id (`findTrappingById`,
       *  `gameIso/rig/parts/equipment.ts`). `chooseForm` la prend du choix du lanceur. */
      form?: string;
      /** Forme LIBRE (Arme aethyrique) : le lanceur choisit l'arme → `ctx.conjureForm` clone le profil
       *  (Groupe/allonge/mains) d'une arme RÉELLE de la base ; sinon stats fixes du Sort. */
      chooseForm?: boolean }
  /** Accorde une ARME NATURELLE (Dent et griffe : Morsure BF+3 / Arme BF+4 ; Incarnation de Wyssan) :
   *  attaque ADDITIONNELLE de mêlée injectée dans `c.weapons` (recomputeLoadout), retirée à
   *  l'expiration. Dégâts SB-relatifs par défaut (`+BF+`+damage), `qualities` (Magique…) portés. */
  | { op: 'grantNaturalWeapon'; label: string; damage: Formula; damagePlus?: number; plusBF?: boolean; bare?: boolean; qualities?: string[]; attackKind?: string; subType?: string; uid?: string }
  /** ATTAQUE GRATUITE accordée par un talent/état (Frénésie : 1 attaque d'Arme/Round ; Assaut féroce :
   *  attaque supplémentaire à la touche ; Frappe réactive : riposte quand on est Chargé). Effet IMPUR (ouvre
   *  une frappe) RÉSOLU par la couche state (le hook `freeAttack` de `combatFlow`, appelé par `runCombatFlow`
   *  sur ce `do`) ; INERTE dans `applyOps`. `weapon` : arme tenue / main principale / naturelle. `when` :
   *  'available' = surfacée comme OPTION du Tour (Frénésie, lue par `availableAttacks`) ou 'immediate' = résolue
   *  tout de suite (depuis un effet déclenché). `cost` : Avantage et/ou Mouvement. `activeIf` : condition
   *  d'activation d'une grant 'available' (l'état `frenzied`). `perChargerOncePerRound` : 1× par chargeur. Le
   *  plafond /Round est porté par la couche state (= niveau du talent). Un éventuel jet PRÉALABLE (Frappe
   *  réactive : Test d'Initiative) est un nœud Flow `test` EN AMONT du `do`, pas un champ de l'op (cadence-aware
   *  via `resolveFlowTest`). */
  | { op: 'grantFreeAttack'; weapon: 'held' | 'mainHand' | 'natural'; when: 'available' | 'immediate';
      cost?: { advantage?: number; movement?: boolean; advantageOrMovement?: boolean };
      activeIf?: 'frenzied'; perChargerOncePerRound?: boolean; label?: string }
  /** Marqueur IMPUR de la branche d'ÉCHEC du Test de Calme d'interruption de Focalisation (LDB 46 l.144) :
   *  la cible perd tous les DR focalisés (couverts par son composant) et subit une Incantation Imparfaite
   *  Mineure. Résolu par la couche state (combatFlow : `applyFocusInterruption` via le hook injecté
   *  `focusInterrupt` appelé par `runCombatFlow`), qui détient get/set et le combattant. `applyOps` (moteur
   *  pur) le laisse INERTE — comme `grantFreeAttack`/`summon`/`zone`. */
  | { op: 'interruptFocus' }
  /** Marqueur IMPUR de la branche de VICTOIRE d'un Test opposé de Piège-lame (LDB 62 l.280) : l'adversaire
   *  est désarmé (sa lame arrachée) et, sur un Succès Stupéfiant (marge nette ≥ 6 DR), sa lame est BRISÉE à
   *  moins qu'elle ne possède l'Atout Incassable. Résolu par la couche state (combatFlow : `applyBladeTrap`
   *  via le hook injecté `bladeTrap` appelé par `runCombatFlow`), qui détient get/set, l'attaquant ciblé et
   *  l'arme visée (contexte sérialisé `ctx.bladeTrap`). `applyOps` (moteur pur) le laisse INERTE — comme
   *  `grantFreeAttack`/`interruptFocus`/`summon`/`zone`. */
  | { op: 'breakBlade' }
  /** POUSSÉE POSITIONNELLE (Poussée, LDB 47 p.244) : chaque cible affectée est repoussée en ligne
   *  (direction lanceur→cible) de `meters` mètres jusqu'à l'obstacle ; la collision est journalisée. Op
   *  IMPURE (déplace sur la grille) — INERTE dans applyOps, résolue par combatFlow (`applyCast` : scan
   *  `spellOps(spell.effects,'caster')`, `pushAway` + `applyZoneCrossings`). */
  | { op: 'push'; meters: Formula }
  /** TÉLÉPORTATION du lanceur (Téléportation, LDB 47 p.244 / Portail d'Ombre / Eau de la terre, LDB 48 p.245) : le
   *  lanceur se déplace de `meters` mètres (+`perSL` « +metersFormula par `every` DR ») en survolant les
   *  obstacles. Op IMPURE (pose le mode 'teleport' = choix de case d'arrivée) — INERTE dans applyOps,
   *  résolue par combatFlow (`applyCast` : scan + `flyReachable`, puis pose différée `action:'teleport'`). */
  | { op: 'teleport'; meters: Formula; perSL?: { every: number; metersFormula: Formula } }
  /** ATTAQUES EN CHAÎNE (LDB 47 p.243) : si le Projectile réduit la cible à 0 Blessure, il rebondit sur
   *  l'ennemi le plus proche (≤ `hopMeters` m, dans la portée initiale), mêmes Dégâts, jusqu'à `maxBounces`
   *  rebonds. Op IMPURE (rebond sur la grille) — INERTE dans applyOps, résolue par combatFlow (`applyCast`,
   *  branche missile : scan + boucle de rebond). */
  | { op: 'chain'; maxBounces: Formula; hopMeters: Formula }
  /** Effet RÉCURRENT multi-Rounds : pose un effet actif porteur qui re-joue `ops` à CHAQUE fin de
   *  Round tant que le sort dure (`ctx.defaultDurationRounds`, Surincantation de Durée incluse —
   *  LDB 47). Généralise l'ancien « État par Round » : 1 Ration/Round (Récolte de Rhya), 1 État
   *  X/Round (malédictions). Les `ops` internes sont résolues MAINTENANT (valeurs littérales) puis
   *  ré-appliquées telles quelles — pas de dépendance au lanceur à chaque tick. */
  | { op: 'perRound'; ops: GameOp[] }
  /** Jet à PALIERS (Régénération : un d10 → soin = le dé ; sur 10, soigne aussi un Critique) : roule
   *  1d`sides` UNE fois, applique les `ops` de CHAQUE palier dont `atLeast` est atteint (cumulatif).
   *  Les ops de palier voient `{rolled}` = la valeur du dé. UN seul jet partagé (≠ jets indépendants). */
  | { op: 'rollThreshold'; sides: number; thresholds: { atLeast: number; ops: GameOp[] }[] }
  /** Tirage sur TABLE (`die` = d10/d100) : lookup par fourchette `[min,max]` (`findTableEntry`, source
   *  unique), les `ops` de la rangée touchée sont appliquées avec le MÊME ctx. DEUX formes exclusives de
   *  la table : `rows` INLINE (authorées sur l'op) OU `tableId` = référence à `tables.json`
   *  (`findEffectTableById`, fail-fast) — jamais les deux (garde `data-wellformed`). `mod` = modificateur
   *  CONSTANT ajouté au jet (Haute Alchimie « lancez 1d10 + 3 », VDM 03 l.698) — se cumule avec
   *  `addNegativeSL` (le RAW enchaîne les deux : « lancez 1d10 + 3. Ajoutez les degrés d'échec »).
   *  `addNegativeSL` ajoute |ctx.sl| au jet quand le contexte porte un DR négatif (Vers de carie
   *  « ajoutez le nombre de DR négatifs », MSRC 16 l.90). `extraRollsPerStep` = un jet SUPPLÉMENTAIRE
   *  par PAS de Surincantation CHOISI (`ctx.chosenTableRolls`, borné à `ctx.overcastDurationSteps` —
   *  LDB 47 l.13-17 / EDOC 13 l.230+270-276 : « pour chaque +2 DR […] vous POUVEZ à la fois prolonger
   *  la durée et refaire un jet sur le Tableau » — déclinable ; la durée se prolonge sur TOUS les pas
   *  alloués quel que soit le choix). Généralise tout « lancez 1dN [+ modif], consultez le tableau ». */
  | { op: 'rollTable'; die: 'd10' | 'd100'; mod?: number; addNegativeSL?: boolean; extraRollsPerStep?: number; rows: { min: number; max: number; ops: GameOp[] }[] }
  | { op: 'rollTable'; die?: 'd10' | 'd100'; mod?: number; addNegativeSL?: boolean; extraRollsPerStep?: number; tableId: string }
  /** Tirage d'une MUTATION sur une table de Corruption (`mutationTables.json`, par id `table`) —
   *  réutilise `rollMutation()` + `attachMutation()` (`corruption.ts`/`mutations.ts`). DURÉE identique à
   *  `grantTrait` (EDOC 13 l.276-277 « appliquez […] pour toute la durée du Sort ») : durée du contexte
   *  (`durationFromCtx`) par défaut → mutation attachée + ActiveEffect porteur (`grantedMutation`) qui la
   *  DÉTACHE à l'expiration (`dropExpiredGrantedMutations`) ; PERMANENTE si `duration:'permanent'` OU si le
   *  ctx ne porte aucune durée (exactement `grantTrait`). Le chemin CORRUPTION (corruptionFlow →
   *  `attachMutation` direct) reste permanent, intouché. PUR (moteur : profil du personnage). */
  | { op: 'rollMutation'; table: string; duration?: 'permanent' }
  /** Perte PERMANENTE de Caractéristique (Vers de carie « −1d10 Initiative… », MSRC 16 l.94-97) : décrémente
   *  la Caractéristique de BASE (`c.characteristics`), jamais sous 0 — irréversible « sauf par des moyens
   *  magiques ou miraculeux » (l.103). `amount` = Formula (1d10). Distincte de `charMod` (temporisé, effet
   *  actif) : ceci ronge le profil lui-même (comme les mutations `passive`, mais soustractif direct). */
  | { op: 'charDamage'; char: CharKey; amount: Formula }
  /** INVOCATION de créature(s) (Nécromancie « Réanimation/Relever les morts », Ulric « Hurlement du
   *  loup », Démonologie « Manifestation », Taal « Roi de la Nature »…). Effet IMPUR (grille +
   *  initiative) RÉSOLU par la couche state (`state/summonFlow.applySummon`) ; `applyOps` (moteur pur)
   *  le laisse INERTE. `ref` = créature du bestiaire (forme libre) ; `count` (+`countPerSL`) = nombre ;
   *  `addTraits`/`size` surchargent le statbloc (loup blanc = Loup + Frénésie + Grand) ; `allyOfCaster`
   *  = camp du lanceur (défaut) sinon hostile (démons « hors de votre contrôle ») ; `despawnIfCasterDown`
   *  = s'effondre si le lanceur tombe (minions liés au sorcier). */
  | { op: 'summon'; ref: string; count: Formula; countPerSL?: PerSL; addTraits?: TraitInstance[];
      size?: SizeCategory; allyOfCaster?: boolean; despawnIfCasterDown?: boolean }
  /** RECONSTITUTION DIFFÉRÉE (Gardien éternel, Middenheim — « se reconstitue au bout de d10 jours »).
   *  À la MORT du porteur, programme la ré-invocation de la créature `ref` (`'self'` = la défunte, par son
   *  `creatureId`) après `delayDays` jours d'HORLOGE, sauf si `cancelFlag` est posé entre-temps (les
   *  « précautions appropriées » : drain/rituel/corruption de la Source — un Effet de scène/MJ pose le flag).
   *  Effet IMPUR (file `scheduledEffects` + `applySummon`) RÉSOLU par la couche state — programmé par
   *  `resolveTriggerImpureOps` au décès, déclenché par `fireScheduledEffects` à l'échéance ; INERTE dans
   *  `applyOps` (moteur pur), comme `summon`. */
  | { op: 'scheduleRespawn'; ref: string; delayDays: Formula; count?: Formula; allyOfCaster?: boolean; cancelFlag?: string }
  /** ZONE PERSISTANTE posée par le sort (Mur de feu, Grands feux d'U'Zhul, Vol du Destin). Effet IMPUR
   *  (pose une zone dans la scène/bataille) RÉSOLU par la couche state (`state/combatEffects`) ; INERTE
   *  dans `applyOps`. `shape` disc/wall ; `radiusMeters` (disque) ou `lengthMeters` (mur, +`lengthPerSL`
   *  « +N m par +2 DR ») ; `blocksLoS` ; `onCross`/`perRound` = effets de zone (traversée / fin de Round). */
  | { op: 'zone'; shape: 'disc' | 'wall'; radiusMeters?: Formula; lengthMeters?: Formula;
      lengthPerSL?: { every: number; metersFormula: Formula }; blocksLoS?: boolean;
      /** Effets de zone = `GameOp[]` (vocabulaire unique) appliqués par `applyOps` : `onCross` à la
       *  TRAVERSÉE (« quiconque traverse le mur »), `perRound` au franchissement de Round pour qui
       *  STATIONNE. Un dégât mitigé BE+PA = `op:'wounds' {ignoreTB:false, ignoreAP:false}` ; un État
       *  entretenu = `op:'condition' {unlessCondition: <le même État>}` ; un soin = `op:'heal'`. */
      onCross?: GameOp[]; perRound?: GameOp[];
      /** GATE de Test à la TRAVERSÉE (Forêt d'épines, LDB 48 l.749) — cf. `BattleZone.crossTest`
       *  (zones.ts) pour la sémantique complète (résolution cadence-aware, succès saute `onCross`). */
      crossTest?: FlowTest;
      /** BARRIÈRE infranchissable (Protection de Phâ : « ne peuvent pas entrer ») ; `gate:'profane'`
       *  restreint barrière + `perRound` aux créatures profanes ; `noCorruption` : nul gain de Corruption
       *  pour les occupants tant que la zone dure (LDB 48 p.249). */
      barrier?: boolean; gate?: 'profane'; noCorruption?: boolean }
  /** MÉTAMORPHOSE en créature (Forme bestiale, LDB 48) : remplace F/E/Ag/Dex (charMod différentiel) et
   *  accorde les Traits de la créature sauf Bestial (grantTrait), auto-restitués à l'expiration. `ref` =
   *  créature du bestiaire (forme LIBRE — « les Bêtes du Reikland », pas l'Ours seul). Pure : expansée
   *  par `polymorphOps` (engine/polymorph) puis ré-appliquée. */
  | { op: 'polymorph'; ref: string }
  /** TRANSFORMATION durable & réversible (≠ `polymorph`, buff temporaire de sort) — Métamorphose de
   *  créature (Enfant d'Ulric humain↔hybride, Middenheim p.116) : applique un jeu de deltas AUTHORÉS
   *  (`ops` — charMod/moveMod/grantTrait… du tableau RAW VERBATIM) sous un LABEL déterministe (`tag`) et
   *  une durée PERMANENTE (jamais auto-restituée), + override d'APPARENCE (`morphRef`, couche rig). Le
   *  `tag` groupe TOUS les effets posés → retrait ATOMIQUE par `endTransform`. Générique (toute forme
   *  alternative authorée : lycanthrope, phase de démon…), zéro nom d'entité en dur. */
  | { op: 'transform'; tag: string; ops: GameOp[]; morphRef?: string }
  /** Fin de TRANSFORMATION (`transform`) : retire d'un coup tous les effets actifs portant le `tag` (deltas
   *  de profil + traits accordés + apparence) et recale les Blessures — retour à la forme de base. */
  | { op: 'endTransform'; tag: string }
  /** VOL DE VIE (LDB 48 — Caresse de Laniph, Vol de vie) : le lanceur (`ctx.caster`) regagne une
   *  fraction (`num/den`, arrondi `round`, défaut plancher) des Blessures RÉELLEMENT infligées ce
   *  lancement (`ctx.woundsDealt`, jamais plus que les PB perdus par la cible). */
  | { op: 'lifeSteal'; num: number; den: number; round?: 'floor' | 'ceil' }
  /** Modificateur (pénalité/bonus) à UNE Compétence nommée — GÉNÉRALISE les pénalités de séquelle
   *  `skillPenalty` (Langue −100 « auto-échec parole ») ET `dodgePenalty` (Esquive −20, mobilité). Lu en
   *  PASSIF par les helpers de trauma depuis `t.ops` (annulable par prothèse), et — si posé par un sort
   *  via `applyOps` — par `ActiveEffect.skillMods` (testValue/defenseValue). Une op, n'importe quelle compétence.
   *  `sense` (optionnel) RESTREINT l'application aux Tests qui SOLLICITENT ce sens (Surdité, LDB 18 : « Tests
   *  de Perception basés sur l'ouïe » — PAS toute Perception) : gaté par le `sense` du CONTEXTE de Test
   *  (`testValue`), pas une liste de compétences codée en dur. Absent = inconditionnel (Cécité : compétences
   *  nommément listées CC/CT/Esquive/Chevaucher, `sense` inutile car déjà scopé par `skill`). */
  | { op: 'skillMod'; skill: string; mod: number; sense?: PairedSense }
  /** +N DR à un Test de Compétence nommé (Furtif : +Bonus d'Agilité au DR de Discrétion, LDB 85 p.339 ;
   *  chanson « Jacques Bret » : +1 DR sur tout Test de Corps à corps réussi, MDG 09 l.228).
   *  Lu par `skillDRBonus` — PASSIF depuis les `TraitData.passive` du porteur (par id), ET, quand
   *  l'op est EXÉCUTÉE par un sort/une chanson (`applyOps`), depuis un `ActiveEffect.drBonus` temporisé.
   *  DISTINCT de `skillMod` (qui modifie la VALEUR du Test, pas le DR obtenu). `spec` OPTIONNEL :
   *  restreint à une spécialisation (Aura de Dhar → Langue (Magick) seulement) ; absent = toute spéc.
   *  `testType` OPTIONNEL (#221, traits navals `naval-traits.json` uniquement) : cible un TYPE de Test
   *  d'équipage (`crew-test-types.json`) plutôt qu'une compétence — `skill` devient alors optionnel (une
   *  Poursuite se court à la Voile OU aux avirons, le bonus est agnostique de la compétence) ; lu par
   *  `navalTestTypeDR`, JAMAIS par `skillDRBonus` (personnage) ni `navalSkillTestDR` (coque). */
  | { op: 'skillDRBonus'; skill?: string; bonus: Formula; spec?: string; testType?: string }
  /** +N DR aux Tests d'une CARACTÉRISTIQUE (chanson « Camarades d'équipage » : +1 DR sur tout Test de
   *  Sociabilité, MDG 09 l.236) — variante par carac de `skillDRBonus`. Exécutée → `ActiveEffect.drBonus`
   *  temporisé ; lisible aussi en PASSIF (trait/aura). Consommée par `charDRBonusOf` sur un Test RÉUSSI. */
  | { op: 'charDRBonus'; char: CharKey; bonus: Formula }
  /** Modificateur aux Tests INDIVIDUELS composant un TEST D'ÉQUIPAGE (MDG 14) — chanson « Naviguons
   *  tous ensemble » : « +10 sur les Tests individuels de chaque membre d'équipage impliqué dans un Test
   *  d'équipage » (MDG 09 l.224). Exécutée → `ActiveEffect.crewTestMod`, lu par `crewRoleValue`
   *  (engine/crewMorale) — le SEUL point de valeur des Tests d'équipage. */
  | { op: 'crewTestMod'; mod: number }
  /** Modificateur au Test de l'ATTAQUANT qui vise le porteur (Parasité : −10 au toucher en mêlée, LDB 85
   *  p.340). PASSIF, lu par `incomingAttackMod` à la collecte des mods d'attaque — DISTINCT de `testMod`
   *  (qui modifie les Tests du porteur LUI-MÊME). `mode` : portée concernée (`all` = mêlée ET distance).
   *  Inerte dans `applyOps`. */
  | { op: 'incomingAttackMod'; mode: 'melee' | 'ranged' | 'all'; amount: number;
      /** Ne s'applique QUE si l'attaquant frappe par le flanc ou par derrière (Assourdi : « par le flanc
       *  ou par derrière gagne +10 », LDB 16 l.29) — bonus ADDITIF (« supplémentaire ») évalué par
       *  `meleeAttackerBonus` seulement quand l'appelant a établi l'angle (facing). Absent = inconditionnel. */
      flankRear?: boolean }
  /** L'ASSAILLANT du porteur GAGNE `amount` Avantage(s) avant son attaque (Sonné : « +1 Avantage », LDB 16
   *  l.123). PASSIF de l'État/trait du DÉFENSEUR, lu par `incomingMeleeAdvantage` au moment de l'attaque
   *  (≠ `incomingAttackMod` = bonus de TOUCHE éphémère). Inerte dans `applyOps`. */
  | { op: 'incomingAdvantage'; mode: 'melee' | 'ranged' | 'all'; amount: number }
  /** Modificateur au DR des SORTS qui affectent le porteur (Résistance à la Magie — trait `LDB 85 l.302`,
   *  talent `LDB 10 l.1026`). `amount` est le modificateur PAR RANG de la source qui le porte : Indice du
   *  trait (`TraitInstance.value`) ou niveau du talent (`times`) — négatif = réduction. PASSIF, lu par
   *  `traitSpellDRMod`/`talentSpellDRMod` (engine/magic) au calcul du DR du Sort CONTRE cette cible
   *  (Dégâts du Projectile, `ctx.sl` des Flows, zone, NI par cible). Inerte dans `applyOps`. */
  | { op: 'incomingSpellDRMod'; amount: Formula }
  /** +N au Bonus de Force employé aux DÉGÂTS (Frénésie : +1 « grâce à votre férocité », LDB 21 l.34). PASSIF,
   *  sommé par `damageSBBonus` et injecté dans `sb` au calcul des dégâts (combat.ts) — AVANT le `max` du Tueur
   *  et `effectiveWeaponDamage` (une arme à dégâts FIXES n'en profite donc pas). Inerte dans `applyOps`. */
  | { op: 'sbBonus'; amount: number }
  /** L'attaque du porteur porte un MOT-CLÉ (Magique/Démoniaque/Fabriqué → 'magic', LDB 85). PASSIF, lu par
   *  `attackHasKeyword` — sert la mitigation (Éthéré : seules les attaques 'magic' blessent). Inerte dans applyOps. */
  | { op: 'attackKeyword'; keyword: 'magic' }
  /** MITIGE les Dégâts ENTRANTS du porteur (Éthéré : nullifie sauf attaque 'magic', LDB 85 p.339). PASSIF, lu
   *  par `incomingDamageNullified` à la résolution de touche. `mode:'nullify'` = 0 Blessure (critique inclus) ;
   *  `unlessKeyword` = laisse passer une attaque portant ce mot-clé. Inerte dans applyOps. */
  | { op: 'mitigateIncoming'; mode: 'nullify'; unlessKeyword?: 'magic' }
  /** Échelle MULTIPLICATIVE du Mouvement — GÉNÉRALISE le drapeau `movementHalved` (= 1/2). `num/den` = la
   *  fraction appliquée à `c.movement` (amputation de jambe : 1/2). Trauma : lu par `traumaMovementHalved` ;
   *  sort : `ActiveEffect.moveScale`. (`M` n'est pas une Caractéristique → op de mouvement dédiée.)
   *  `durationRounds` : effet TEMPORAIRE à durée intrinsèque (Souffle coupé « Mouvement réduit de moitié
   *  pendant 1d10 Rounds », LDB 18-Traumatisme) — MÊME patron que `maxWeaponHands.durationRounds` : résolu
   *  indépendamment du ctx ; absent = durée du ctx (`durationFromCtx`, sort/effet permanent de trauma). */
  | { op: 'moveScale'; num: number; den: number; durationRounds?: Formula }
  /** Modificateur ADDITIF de Mouvement (trait Brutal −1 / Rapide +1, mutation ±1, encombrement) — distinct de
   *  `moveScale` (multiplicatif). `effectiveMovement` somme les `moveMod` PUIS applique les `moveScale`. */
  | { op: 'moveMod'; mod: number }
  /** HORS de son terrain d'élection (`terrain` = type de tuile de la case occupée, ex. `eau`), le porteur
   *  est diminué : `mSet` REMPLACE son Mouvement (Créature marine : « son M tombe à 1 », MDG 16 p.140 ;
   *  Aquatique : « ne peut pas se déplacer sur la terre ferme », MSRC 15 p.90 → `mSet: 0`) et `testDR`
   *  s'applique à TOUS ses Tests (Créature marine : « tous les Tests qu'elle effectue subissent –2 DR »).
   *  GÉNÉRIQUE (aucun nom de créature) : porté par le `passive` d'un Trait, GATÉ par la POSITION — le
   *  state pose le drapeau dérivé `Combatant.offTerrain` à chaque placement (`placeCombatant`), les
   *  consommateurs purs (`offTerrainMoveCap`/`offTerrainTestDR`, trauma.ts) lisent le drapeau. `suffocates` :
   *  hors du terrain, la créature suffoque (Créature marine : « sinon elles se mettent à suffoquer »,
   *  MDG 16 l.19) — lu par `offTerrainSuffocates`/`suffocationTick`. Inerte dans applyOps (passif pur,
   *  jamais « lancé »). */
  | { op: 'offTerrainMod'; terrain: string; mSet?: number; testDR?: number; suffocates?: boolean }
  /** Modificateur d'un ATTRIBUT SECONDAIRE À MAXIMUM (≠ CharKey, ≠ Mouvement) : Blessures (Dur à cuire +BE),
   *  Chance (Chanceux), Détermination (Obstiné). `mod` = Formula (`{bonusOf:'E'}` pour Dur à cuire).
   *  Lu par heroMaxWounds/fortuneMax/resolveMax — data-driven, jamais par libellé. Destin/Résilience
   *  N'ONT PAS de maximum dérivé (un octroi passe par `gainResource`) → EXCLUS de l'union (#292). */
  | { op: 'attrMod'; attr: 'wounds' | 'fortune' | 'resolve'; mod: Formula }
  /** Plafond de mains d'arme maniables — GÉNÉRALISE `noTwoHanded` (hands:1 = pas d'arme à deux mains).
   *  Une amputation de main/bras pose `maxWeaponHands:1` (PERMANENT, via Trauma.ops). `durationRounds` :
   *  effet TEMPORAIRE à durée intrinsèque (Aux Armes « main/bras inutilisable Nd10 [−BE] Rounds », l.2557/
   *  2562/2588) — résolu indépendamment du ctx, comme `condition`/`charMod` ; absent = durée du ctx
   *  (`durationFromCtx`, sort). Lu par `cannotWieldTwoHanded`/`recomputeLoadout` (via `passiveMods`,
   *  channel `activeEffects` — même collecteur que la séquelle permanente). */
  | { op: 'maxWeaponHands'; hands: number; durationRounds?: Formula }
  /** Lâche l'objet tenu dans UNE main (Aux Armes, bras/corps « Vous lâchez ce que vous teniez dans
   *  cette main ») — vide le slot de loadout (`main`/`off`) et `recomputeLoadout` (même patron que
   *  `breakBacleArmour` : mutation de l'ItemInstance/loadout puis re-dérivation, PAS un ground-item —
   *  aucun tel concept dans le moteur). Main RÉSOLUE depuis `ctx.location` (convention DROITIER
   *  partagée avec `handAmputated` : `brasD`→`main`, `brasG`→`off`) ; localisation `corps` ou absente
   *  (« Choisissez au hasard l'un de vos deux bras ») → tirage aléatoire (`ctx.rng`). Sans objet tenu
   *  dans cette main : inerte (journalisé). */
  | { op: 'disarm' }
  /** Main « ensanglantée » (Aux Armes bras 46-50, l.2569 : Main ensanglantée) — pose un marqueur PAR-MAIN
   *  (`Combatant.handGates`), DISTINCT du compteur global Hémorragique, qui impose un Test de Dextérité
   *  (+20) AVANT toute Action employant l'arme tenue par cette main (`attackHandGate` ; Échec → op `disarm`).
   *  Main RÉSOLUE depuis `ctx.location` (convention DROITIER, comme `disarm` : `brasD`→`main`, `brasG`→`off`).
   *  Le gate tient tant que l'Hémorragique tient (`removeCondition` purge le marqueur à 0). */
  | { op: 'handGate' }
  /** Perte d'un organe sensoriel PAIRÉ (œil/oreille). Porté par une séquelle ; `escalateSensoryLoss`
   *  compte les `senseLoss` par sens (2 du même → Cécité/Surdité). */
  | { op: 'senseLoss'; sense: PairedSense }
  /** Perd sa prochaine Action ET/OU son prochain Mouvement (Affamé : « festoie » ; échec du gate de la
   *  Racine de mandragore : « une Action ou un Mouvement (un au choix) », LDB 71 l.35 → l'issue du choix
   *  pose `what:'action'` ou `'movement'`). `what` absent = les deux (comportement historique). Pose les
   *  drapeaux lus au début du Round du porteur. */
  | { op: 'loseTurn'; what?: 'action' | 'movement' }
  /** GATE d'action par Round (Racine de mandragore, LDB 71 l.35 : « Les utilisateurs doivent réussir un
   *  Test de Force Mentale à chaque Round pour effectuer une Action ou un Mouvement (un au choix) ») —
   *  `ActiveEffect.actGate` vérifié au DÉBUT du tour du porteur en combat (cadence-aware : héros manuel =
   *  étape de cascade influençable + choix Action/Mouvement ; IA/auto = jet inline, l'Action est gardée).
   *  Hors combat (pas de Rounds) : inerte. */
  | { op: 'actGate'; char: CharKey }
  /** Bonus/malus aux Tests LIÉS À UNE MALADIE (contraction, cycle quotidien, Test de fin) —
   *  Fleur de lune « +30 à tous les Tests associés pour résister à la [Peste noire] » (LDB 71 l.26),
   *  Racine de terre +10 (LDB 72 l.28), Tonique digestif +20 (l.32). `diseases` = ids ciblés (absent =
   *  toutes). → `ActiveEffect.diseaseTestMod`, sommé par `activeDiseaseTestMod` (engine/disease) aux
   *  call-sites qui calculent la Résistance d'un Test de maladie. */
  | { op: 'diseaseTestMod'; diseases?: string[]; amount: number }
  /** SUSPEND un symptôme de maladie par id (Racine de terre : « annuler les effets de bubons causés par
   *  la Peste noire », LDB 72 l.28) — analogue de `suppressPsych` : les canaux `passive`/`onTick` du
   *  symptôme sont ignorés tant que l'effet dure (`ActiveEffect.suppressedSymptom`, lu par
   *  `symptomSuppressed` dans engine/disease), restitués à l'expiration. */
  | { op: 'suppressSymptom'; symptomId: string }
  /** Ops DIFFÉRÉES à échéance d'horloge (op IMPURE — file `scheduledEffects`, résolue couche state comme
   *  `summon`/`zone` ; INERTE dans `applyOps`). Délai : `afterMinutes`/`afterHours`/`afterDays` depuis
   *  maintenant, OU `afterDuration:true` = à l'échéance de la durée du contexte (`ctx.defaultUntilTime` —
   *  Bonnet de fou « Quand l'effet se dissipe, l'utilisateur perd 1d10 PB », LDB 71 l.20). `forMinutes`/
   *  `forHours`/`forDays` : durée d'horloge PROPRE des effets durables de `ops` à partir de l'échéance
   *  (Délice de Ranald : pénalité pendant le reste du jour, LDB 71 l.24). */
  | { op: 'delayed'; afterMinutes?: Formula; afterHours?: Formula; afterDays?: Formula; afterDuration?: true;
      forMinutes?: Formula; forHours?: Formula; forDays?: Formula; ops: GameOp[] }
  /** Retire une pièce d'artillerie d'une COQUE (« Canon perdu », MDG 13 l.765 : la pièce passe par-dessus
   *  bord) : `target.postes` perd UN poste au hasard (`ctx.rng`) ; si son chef de pièce (`crewIds[0]`, résolu
   *  dans `ctx.crew`) la servait, il est démancipé (`mannedPoste` + arme dérivée retirés). GÉNÉRIQUE — remplace
   *  le flag ad hoc `losePoste`. Inerte si la coque n'a aucun poste. */
  | { op: 'removeShipPoste' }
  /** Commandant d'équipe (AA 13 l.29-35) : lie CE chef de pièce (`target`) au commandant `commanderId` qui
   *  vient de le diriger (Test de Commandement réussi) → l'équipe tire ENSUITE au score de Projectiles du
   *  commandant (substitution re-validée à chaque tir tant qu'il vit et reste à portée de voix). */
  | { op: 'teamCommander'; commanderId: string }
  /** PASSIF d'ARME (Atout/Défaut, LDB 62-63) : modificateur de DR/plat à une PHASE de jet de combat —
   *  Précise (+10 `flatMod` en attaque), Imprécise (−1 DR en attaque), Pointue (+1 DR au Test d'attaque
   *  RÉUSSI, `phase:'attackSuccess'`, LDB 62 l.288), Défensive (+1 DR parade du défenseur), À Enroulement
   *  (−1 DR parade adverse), Lente (+1 DR à TOUTE défense adverse), Pratique/Peu Fiable (±1 DR à
   *  un Test raté). Lu PAR ID par `engine/qualities/dispatch` (attackDRAdjust/parryDRAdjust/vsDefenseDRAdjust/
   *  qualitySum/craftTestDRAdjust). INERTE dans `applyOps`. */
  | { op: 'weaponRollMod'; phase: 'attack' | 'attackSuccess' | 'parryByDefender' | 'parryAgainstAttacker' | 'vsDefense' | 'testFail'; drMod?: number; flatMod?: number }
  /** PASSIF d'ARME : modificateur de DÉGÂTS (LDB 62-63) — Dévastatrice (DR = max(DR,
   *  dé des unités), `mode:'maxUnits'`), Percutante (+ dé des unités, `plusUnits`), Inoffensive (annule les
   *  Atouts de Dégâts, `negateAtouts`), Épuisante (`chargeGated` : Percutante/Dévastatrice de l'arme inertes
   *  hors Charge). Lu PAR ID par `qualityDamageStep`. INERTE dans `applyOps`. */
  | { op: 'weaponDamageMod'; mode?: 'maxUnits'; plusUnits?: boolean; negateAtouts?: boolean; chargeGated?: boolean }
  /** PASSIF d'ARME : Perforante (LDB 62 l.270) — `bypass` (ex. `'nonMetal'`) puis `amount` PA retirés du
   *  reliquat à la mitigation. Lu PAR ID par `qualitySum('armourReduction')`/`qualityArmourBypasses`.
   *  INERTE dans `applyOps`. */
  | { op: 'armourPierce'; amount: number; bypass?: ArmourBypass }
  /** PASSIF d'ARME : Empaleuse (LDB 62) — déclenche un Coup Critique quand `roll % mod === equals`
   *  (`{mod:10, equals:0}` = multiple de 10). Forme DÉCLARATIVE sérialisable (remplace le hook fonction
   *  `critTrigger`). Lu PAR ID par `qualityCritTriggered`. INERTE dans `applyOps`. */
  | { op: 'critOnRoll'; mod: number; equals: number }
  /** Dépense `amount` Points d'Avantage du RÉFÉRENT (Déstabilisante : coût d'un Test de renversement).
   *  Effet PUR appliqué par `applyOps` (jamais sous 0). */
  | { op: 'spendAdvantage'; amount: number }
  /** Émission de LUMIÈRE (rayon en cases, brouillard de guerre, 1 case=2 m). Côté OBJET (`passive`) :
   *  INERTE dans applyOps — lu par `combatantLights` (vision) pour les objets PORTÉS/TENUS. Côté SORT :
   *  pousse un `ActiveEffect.light` temporisé (durée), lu au MÊME point.
   *  `tone` : id d'un `lightTones` — APPARENCE seule (couleur/intensité/vacillement), résolue au bord
   *  du rendu et jamais ici ; absent = `flamme`. Le RAYON reste seul à porter une conséquence de règle. */
  | { op: 'light'; radiusTiles: number; tone?: string; durationRounds?: Formula }
  /** Boisson alcoolisée : enregistre UN échec de Résistance à l'alcool (LDB 09 l.475) sur la cible —
   *  −10 aux CC/CT/Ag/Dex/Int (plafond −30), et Ivresse (1d10) au seuil BE. Posé sur la branche `fail`
   *  du Flow de consommable d'une boisson (le Test de Résistance à l'alcool est le nœud `test` du Flow). */
  | { op: 'intoxicate' }
  /** Effet non modélisé : journalisé verbatim, arbitrage MJ (rien d'inventé). */
  | { op: 'narrative'; text: string };

/** Profil d'ANNULATION d'un effet PASSIF (système unifié) — le « flag de typage » qui dit CE QUI le neutralise.
 *  Porté par chaque `PassiveMod` ; une table `kind → annulateurs` (engine/trauma) applique le gating. */
export type PassiveKind =
  | 'douleur'      // pénalité de douleur (séquelle) : Détermination + Insensible + prothèse 'all'
  | 'mobilité'     // pénalité de mobilité (séquelle de jambe) : idem + prothèse 'movement'
  | 'structurel'   // membre perdu : prothèse 'all' SEULE (ni Détermination ni Insensible)
  | 'sensoriel'    // organe perdu : rien
  | 'maladie'      // symptôme de maladie : Détermination SEULE (pas Insensible)
  | 'faim'         // pénalité de Faim : « Plus besoin de manger »
  | 'magique'      // effet de SORT actif (ActiveEffect) : inconditionnel mais combiné en POOL non-cumul ; expire seul
  | 'etat'         // pénalité/effet d'un État (LDB 16) : pool NON-CUMUL, le pire seul (l.20) ; Exténué ×stacks
  | 'ivresse'      // pénalité d'Ivresse (LDB 09 l.475) : pool non-cumul ; ignorée 1 Round par la Détermination (flag `drunkIgnore`)
  | 'intrinsèque'; // trait/mutation/qualité : inconditionnel ET ADDITIF (Σ dans la base — corps/équipement permanent)

/** Effet PASSIF porté par un élément (trauma/trait/mutation/qualité…) : une op + son profil d'annulation.
 *  Unité du collecteur unifié `passiveMods` ; `kind` absent ⇒ `intrinsèque`.
 *
 *  `src` = IDENTITÉ Codex de l'entité qui porte le passif (l'État pour un `kind:'etat'`, le symptôme
 *  pour un `kind:'maladie'`, le trait pour une aura) — posée par le collecteur, qui la connaît au
 *  moment où il pousse. Elle sert l'AFFICHAGE nommé d'une composante (chip « −30 Brisé » et son
 *  renvoi Codex, `combatTestPenaltyParts`) ; le calcul ne la lit jamais. */
export interface PassiveMod {
  op: GameOp;
  kind?: PassiveKind;
  /** Entité ÉMETTRICE en ids stables — c'est elle qui NOMME la composante d'un détail de jet et lui
   *  donne son renvoi Codex (`passivePartLine`). À poser à l'ÉMISSION, jamais devinée au rendu. */
  src?: CodexTarget;
  /** Nom PROPRE de l'émetteur, pour une entité HORS CATALOGUE (armure forgée à la main, mutation
   *  maison) : il n'y a aucune fiche à ouvrir, mais la composante doit rester NOMMÉE — jamais repliée
   *  sur sa famille (« Passif »). Lu par `passivePartLine` quand `src` manque ou ne résout pas. */
  label?: string;
}

export interface OpsCtx {
  rng?: RNG;
  /** Référent des formules « (Bonus de X) » (le lanceur d'un sort) ; défaut : la cible. */
  caster?: Combatant;
  /** Équipage d'une COQUE (`crewIds` résolus en Combattants) — pour les ops de navire : `removeShipPoste`
   *  démancipe le chef de pièce. Passé par `applyHullCritical`. */
  crew?: Combatant[];
  /** SORT SOURCE en cours d'incantation : tout `ActiveEffect` POSÉ par cet `applyOps` en est marqué
   *  (`ActiveEffect.spell`), pour la DISSIPATION (LDB 46 l.158-162). Posé par `applyCast` (Sorts durables). */
  sourceSpell?: { spellId: string; ni: number; casterId: string; label: string };
  /** id STABLE du sort/prière en cours d'incantation — posé sur TOUT `ActiveEffect` durable de ce lancement
   *  (`ActiveEffect.sourceSpellId`), Prières COMPRISES (≠ `sourceSpell`, arcane-only dissipation). Sert
   *  l'IDENTITÉ du sort pour l'anti-spam de buff de l'IA. Posé par `applyCast` à CHAQUE lancement. */
  sourceSpellId?: string;
  /** Forme choisie par le lanceur pour une arme invoquée à forme libre (op `grantWeapon` +
   *  `chooseForm`) — fixe Groupe/allonge/mains. Défaut (absent) : la 1ʳᵉ forme proposée. */
  conjureForm?: ConjureForm;
  /** Branché par le store : EXPOSITION corruptrice (op `corruptionExposure`) → Test différé par modale
   *  (pendingCorruption). Sans hook (moteur pur/tests), l'op est journalisée inerte. */
  onCorruptionExposure?: (level: ExposureLevel, skill?: 'resistance' | 'calme') => string[];
  /** Libellé de la source (sort/table) — ActiveEffect.label + journal. */
  label?: string;
  /** ENTITÉ SOURCE des ops en cours (sort, talent, trait, objet, maladie, mutation…) — marquée sur TOUT
   *  `ActiveEffect` posé par cet `applyOps` (`ActiveEffect.source`). Ancrage de règle GÉNÉRAL : c'est
   *  elle qui donne sa fiche Codex à une pastille d'effet, quel que soit le TYPE de source (arbitrage
   *  user 2026-07-18 — « les GameOps sont rattachés à quelque chose »). `sourceSpellId` reste le canal
   *  SPÉCIFIQUE des sorts (anti-spam de buff côté IA) : les deux cohabitent, aucun n'est redondant. */
  source?: EffectSource;
  /** id STABLE de l'effet en cours (langue-indépendant) — marqué sur TOUT `ActiveEffect` posé par cet
   *  `applyOps` (`ActiveEffect.effectId`), même mécanisme que `sourceSpell`/`sourceSpellId` ci-dessus.
   *  Sert l'identité de retrait/détection (`transform`/`endTransform`, chansons de marin…) — JAMAIS le `label`
   *  (affichage, non stable/traductible). */
  effectId?: string;
  /** Durée (en Rounds) des `charMod` sans durée propre — celle du sort. */
  defaultDurationRounds?: number;
  /** Échéance d'HORLOGE (minutes `gameTime`) des effets actifs d'un sort à durée en
   *  minutes/heures/jours (LDB 47) : devient une durée `{scale:'clock'}` (cf. `durationFromCtx`),
   *  purgée par l'horloge (`purgeClockEffects`). Exclusif de `defaultDurationRounds`. */
  defaultUntilTime?: number;
  /** Horloge de jeu (minutes) — base des `castPenalty` à durée en minutes/jours. */
  now?: number;
  /** DR du jet d'incantation — alimente les échelles « par +N DR » (`PerSL`) des ops. */
  sl?: number;
  /** PAS de Surincantation alloués à l'axe Durée (`pendingCast.overcast.duration`) — alimente
   *  `rollTable.extraRollsPerStep` (LDB 47 l.13-17, EDOC 13 l.230+270-276). */
  overcastDurationSteps?: number;
  /** Jets sur le Tableau RÉELLEMENT choisis par le lanceur (EDOC 13 l.276 : « vous POUVEZ » — décidable,
   *  jamais forcé), borné à `overcastDurationSteps`. Absent = tous les pas alloués (défaut, IA/rétrocompat). */
  chosenTableRolls?: number;
  /** Marqueur de RÉ-ENTRANCE `onOwnTestFailed` : posé sur le flowCtx des effets déclenchés par ce trigger
   *  (MSRC 16 — Crampes). Threadé jusqu'à un nœud Flow `test` (le FM de palier 2) routé en cascade : son
   *  étape est tamponnée `meta.noOwnTestFailed` pour que sa résolution NE ré-émette JAMAIS le trigger
   *  (garde de ré-entrance qui survit à la cadence asynchrone du héros). */
  noReentryOwnTestFailed?: boolean;
  /** Blessures RÉELLEMENT infligées par le lancement courant (Projectile magique) — base du Vol de
   *  vie (op `lifeSteal`). Posé par la résolution missile avant d'appliquer les ops du lanceur. */
  woundsDealt?: number;
  /** Valeur du jet courant d'une op `rollThreshold` — résout les Formula `{rolled}` des ops de palier. */
  rolled?: number;
  /** INDICE de l'attaque naturelle d'une MANŒUVRE en cours (« Morsure +10 ») — résout les Formula
   *  `{indiceOf}` (Dégâts authorés en GameOp). Posé par le résolveur de manœuvre. */
  indice?: number;
  /** Nombre de PIONS de l'État qui déclenche un `effects: onRoundEnd` — résout les Formula `{stacks:'self'}`
   *  (Empoisonné « 1 PB/pion », En Flammes « +1/pion »). Posé par le bus à la diffusion d'un effet d'État. */
  stacks?: number;
  /** Écart d'Avantage avec les adversaires Engagés — résout `{engagedAdvantageGap:true}` ET la Condition
   *  `engagedAdvantageGap` (Instable). Calculé sur la `battle` par le dispatcher de combat. */
  engagedAdvantageGap?: number;
  /** Avance d'Avantage SIGNÉE sur tous les adversaires Engagés — résout la Condition `engagedAdvantageLead`
   *  (Absorption : `> 0` = strictement supérieur à tous). Calculée sur la `battle` par le dispatcher. */
  engagedAdvantageLead?: number;
  /** Localisation de la touche courante (dé inversé) — lue par la Condition Flow `location` (Assommante). */
  location?: HitLocation;
  /** KIND de l'attaque courante (`creatureAttackKind` : 'morsure'/'cornes'/…) — lu par la Condition Flow
   *  `attackKind` (Vampirique : Vol de vie sur Morsure seulement). */
  attackKind?: string;
  /** CAUSE de l'effarouchement courant ('noise'/'magic', LDB 85 l.197) — lue par la Condition Flow
   *  `startleCause` (exemption Dressé : Guerre ignore les bruits, Magie ignore la magie). */
  startleCause?: 'noise' | 'magic';
  /** Un adversaire vivant est-il dans la Ligne de Vue du porteur — résout la Condition `foeInLoS`
   *  (sortie de Frénésie, Brisé). Précalculé sur la `battle` par le dispatcher de combat. */
  foeInLoS?: boolean;
  /** Géométrie d'arène de la récupération du Brisé (LDB 16) — précalculée par le dispatcher : aucun ennemi
   *  ne voit l'acteur (`hiddenFromFoes`), acteur Engagé (`engaged`), distance au plus proche (`nearestFoeDist`).
   *  Résolvent les Conditions `hiddenFromFoes`/`engaged`/`nearestFoe`. */
  hiddenFromFoes?: boolean;
  engaged?: boolean;
  nearestFoeDist?: number;
  /** Gain de Corruption AVEC seuil → mutation (corruptionFlow) ; sans contexte
   *  store, l'op `corruption` incrémente simplement le compteur. */
  onCorruption?: (n: number, align?: ChaosAlign) => string[];
  /** Clause d'Avantage de groupe (AA) du Trait Redoutable (`MDG 16 l.13`) : branché par le store
   *  (`state/combat/advantagePool.ts` `creditOpposingAdvantage`, fourni par `turnHooks.fireTurnEdgeTriggers`
   *  pour `onTurnStart`) sur l'op `gainAdvantage{feedOpposingPool:true}` — crédite `n` (l'Indice PLEIN) à la
   *  réserve du camp OPPOSÉ. Sans contexte (moteur pur/tests, hors mode groupe), la clause est inerte. */
  onOpposingAdvantage?: (n: number) => string[];
  /** ARME du coup courant — quand un `op:'wounds' { weaponHit:true }` résout les Blessures comme un coup
   *  d'arme (`woundsFromHit` : qualités + armure à `location` + BE). Posé par le routeur d'attaque (S4) et
   *  par les effets d'AIRE d'une arme (munitions). Absent → l'op reste en mode Formula. */
  weapon?: Weapon;
}

/** Rounds attribués à un effet dont la durée (minutes/heures/jours) dépasse le combat. */
/**
 * Durée d'un effet actif posé au cours d'une incantation, dérivée du contexte. Échelles mutuellement
 * exclusives (cf. `engine/duration.ts`) : horloge (minutes/heures/jours, LDB 47) prime ; sinon Rounds ;
 * sinon permanent (effet sans durée déclarée, retiré explicitement) — aucune sentinelle de repli.
 */
export function durationFromCtx(ctx: OpsCtx): Duration {
  if (ctx.defaultUntilTime != null) return { scale: 'clock', until: ctx.defaultUntilTime };
  if (ctx.defaultDurationRounds != null) return { scale: 'rounds', left: ctx.defaultDurationRounds };
  return { scale: 'permanent' };
}

/** Applique un effet actif sans cumul : un seul bonus (le meilleur) ET une seule
 *  pénalité (la pire) coexistent par caractéristique (Livre de base l.168). */
/** Pose un effet actif porteur d'ops RÉCURRENTES (re-jouées chaque fin de Round par `endOfRound`).
 *  Durée = celle du sort (`ctx`), Surincantation de Durée incluse. Les `ops` doivent être round-safe
 *  (valeurs littérales) — pas de résolution de formule/`perSL` au tick. */
function pushPerRound(target: Combatant, ops: GameOp[], ctx: OpsCtx): void {
  target.activeEffects = target.activeEffects ?? [];
  target.activeEffects.push({
    label: ctx.label ?? 'Effet', bonus: 0,
    duration: durationFromCtx(ctx),
    opsPerRound: ops,
  });
}

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
  if (effect.char === 'force' || effect.char === 'endurance' || effect.char === 'force-mentale') refreshWounds(target);
}

/** Ligne de journal d'un Test résolu inline — SOURCE UNIQUE du format « X — Test de Y Difficulté :
 *  roll / cible → réussite/échec. » Réutilisée par l'op `test` ET par la branche inline de
 *  `resolveFlowTest` (parité du journal des jets de trigger résolus en silence). */
export function describeTestRoll(
  name: string, what: string, difficulty: Difficulty, res: { roll: number; target: number; success: boolean },
): string {
  return t('op.testRoll', {
    name, what, diff: DIFFICULTY_LABELS[difficulty],
    roll: res.roll, target: res.target, outcome: res.success ? 'réussite' : 'échec',
  });
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
  // DISSIPATION (LDB 46) : on retient les ActiveEffect PRÉ-EXISTANTS (par référence) pour ne marquer,
  // en fin d'op, QUE ceux posés par CE sort source (robuste au dédoublonnage en place de `applyActiveEffect`).
  const preEffects = (ctx.sourceSpell || ctx.sourceSpellId || ctx.effectId || ctx.source) ? new Set(target.activeEffects ?? []) : null;
  // Agrégation des charMod (une ligne par source, façon « Écorce (-10 Ag, -10 Dex, 6 rounds) »).
  const charParts: string[] = [];
  let charRounds: number | null = null;
  let charClockMin: number | null = null;
  const flushCharMods = () => {
    if (!charParts.length) return;
    const dur = charRounds != null ? t('op.frag.rounds', { n: charRounds })
      : charClockMin != null ? (charClockMin >= 60 ? t('op.frag.hours', { n: Math.round(charClockMin / 60), s: charClockMin >= 120 ? 's' : '' }) : t('op.frag.min', { n: charClockMin }))
      : t('op.frag.outOfCombat');
    lines.push(t('op.charModLine', { name: target.label, label: ctx.label ?? 'Effet', parts: charParts.join(', '), dur }));
    charParts.length = 0;
  };
  // Filtre par Groupe de la CIBLE (engine/groups) : `only` = doit appartenir à l'un (« les
  // Morts-vivants gagnent aussi… ») ; `except` = exclu si appartient à l'un (Morsure de l'hiver :
  // hors Mort-vivant/Démon).
  const groupGate = (only?: string[], except?: string[]): boolean =>
    (!only || only.some((g) => groupMatch(g, target.groups ?? [])))
    && (!except || !except.some((g) => groupMatch(g, target.groups ?? [])));
  for (const o of ops) {
    if (o.op !== 'charMod') flushCharMods();
    switch (o.op) {
      case 'wounds': {
        if (!groupGate(o.onlyGroups)) break;
        const raw = Math.max(0, resolveFormula(o.amount, ref, rng, ctx.rolled, ctx.indice, ctx.stacks, ctx.engagedAdvantageGap, ctx.woundsDealt) + slBonus(ctx.sl, o.perSL));
        // MODE COUP D'ARME (S1) : délègue au résolveur partagé `woundsFromHit` → qualités d'arme
        // (Perforante/Empaleuse), armure à la `ctx.location` et BE, sans dupliquer la mitigation.
        if (o.weaponHit && ctx.weapon) {
          const n = woundsFromHit(ctx.weapon, target, ctx.location ?? 'corps', raw, o.extraAP ?? 0, o.min ?? 1);
          ctx.woundsDealt = loseWounds(target, n); // PB réellement perdus (drain/Vol de vie suivant)
          lines.push(t('op.wounds', { name: target.label, n, mitig: '' }));
          break;
        }
        // Défaut : ignore BE+PA. `ignoreTB:false` → déduit le Bonus d'Endurance ; `ignoreAP:false` → déduit les PA.
        const tb = o.ignoreTB === false ? bonus(effectiveChar(target, 'endurance')) : 0;
        // `apFrom:'least'` → PA de la Localisation la moins protégée (En Flammes) ; sinon le Corps.
        const totalAP = o.apFrom === 'least'
          ? Math.max(0, Math.min(...Object.values(target.armour)))
          : Math.max(0, target.armour.corps ?? 0);
        const bypass = o.bypassArmour ? bypassedAP(target, 'corps', o.bypassArmour, totalAP) : 0; // attribut de Domaine : perce le métal/non-magique
        // PA de la Localisation (si non ignorés) + PA situationnels du coup (`extraAP` : poupe/Bélier de collision…).
        const ap = (o.ignoreAP === false ? Math.max(0, totalAP - bypass) : 0) + (o.extraAP ?? 0);
        const n = Math.max(o.min ?? 0, raw - tb - ap);
        // `ctx.woundsDealt` = PB RÉELLEMENT perdus (clampé par loseWounds) → un drain/Vol de vie qui SUIT
        // (`lifeSteal`) soigne « le même nombre » que la victime a effectivement perdu (Absorption EDO 11 p.147).
        ctx.woundsDealt = loseWounds(target, n); // perte centralisée (−Avantage + À Terre à 0)
        const mitig = o.ignoreTB === false || o.ignoreAP === false ? ` (${o.ignoreAP === false ? t('op.frag.apHit') : t('op.frag.apIgnored')}, ${o.ignoreTB === false ? t('op.frag.beDeduced') : t('op.frag.beIgnored')})` : t('op.frag.mitigNone');
        lines.push(t('op.wounds', { name: target.label, n, mitig }));
        break;
      }
      case 'heal': {
        const n = Math.max(0, resolveFormula(o.amount, ref, rng, ctx.rolled, ctx.indice, ctx.stacks) + slBonus(ctx.sl, o.perSL));
        // SOURCE UNIQUE `applyHealWounds` (`healing.ts`) : plafonné par munition Empaleuse logée (LDB
        // 62 l.250) comme le reste ; ni verrou « soin de rencontre » (Guérison seulement) ni réveil
        // ici — sort/potion inconscient géré par `receiveMedicalAid`/`releaseConditionLocks` ci-dessous.
        lines.push(...applyHealWounds(target, n, { skillCheck: false, wake: false, log: (healed) => [t('op.heal', { name: target.label, n: healed })] }));
        lines.push(...receiveMedicalAid(target)); // sort/prière de soin = Aide Médicale (LDB 18 l.311)
        lines.push(...releaseConditionLocks(target, ctx.sourceSpellId != null ? 'magic' : 'medicalAid')); // verrous d'État (LDB 18) : soin d'un sort = magie (⊇ Aide Médicale) ; potion/objet = Aide Médicale
        break;
      }
      case 'healCaster': {
        const who = ctx.caster ?? target;
        const n = Math.max(0, resolveFormula(o.amount, ref, rng));
        lines.push(...applyHealWounds(who, n, { skillCheck: false, wake: false, log: (healed) => [t('op.heal', { name: who.label, n: healed })] }));
        lines.push(...receiveMedicalAid(who)); // sort/prière de soin = Aide Médicale (LDB 18 l.311)
        lines.push(...releaseConditionLocks(who, 'magic')); // healCaster = soin d'un sort → magie (lève aussi les verrous Aide Médicale, LDB 18)
        break;
      }
      case 'gainAdvantage': {
        // Porte l'Avantage à AU MOINS `amount` (jamais réduit) — Redoutable complète jusqu'à l'Indice.
        const want = Math.max(0, resolveFormula(o.amount, ref, rng, ctx.rolled, ctx.indice, ctx.stacks));
        if ((target.advantage ?? 0) < want) { target.advantage = want; lines.push(t('op.gainAdvantage', { name: target.label, n: want })); }
        // Clause AA Redoutable (MDG 16 l.13) : l'op S'EXÉCUTE ⇒ le garde-fou de la donnée (empetre/
        // inconscient/surpris, dans le nœud `if` englobant) est déjà franchi — l'Indice PLEIN part EN
        // PLUS pour la réserve adverse, indépendamment de si `target.advantage` avait déjà atteint `want`.
        // Garde HÉRITÉE par le feed de groupe : arbitrage user 2026-07-16 (#536).
        if (o.feedOpposingPool) lines.push(...(ctx.onOpposingAdvantage?.(want) ?? []));
        break;
      }
      case 'condition': {
        if (!groupGate(o.onlyGroups)) break;
        // Gates d'État (Sommeil, LDB 47) : l'op ne s'applique que si la cible porte / ne porte pas l'État.
        if (o.onlyIfCondition && !hasCondition(target, o.onlyIfCondition)) break;
        if (o.unlessCondition && hasCondition(target, o.unlessCondition)) break;
        const v = Math.max(1, resolveFormula(o.value ?? 1, ref, rng, ctx.rolled, ctx.indice, ctx.stacks) + slBonus(ctx.sl, o.valuePerSL));
        // Force d'évasion (Empêtré « se libérer » — LDB 16 l.61) : résolue MAINTENANT contre le
        // référent (le lanceur pour un sort) et FIGÉE sur l'entrée d'État → le flux de récupération
        // l'opposera, même si le lanceur n'est plus en jeu.
        const escape = o.escapeStrength != null ? Math.max(0, resolveFormula(o.escapeStrength, ref, rng)) : undefined;
        const threshold = o.escapeThreshold != null ? Math.max(0, resolveFormula(o.escapeThreshold, ref, rng)) : undefined;
        const struggleDamage = o.struggleDamage != null ? Math.max(0, resolveFormula(o.struggleDamage, ref, rng)) : undefined;
        if (o.perRound) {
          // État récurrent = cas particulier de l'effet récurrent général (op `perRound`) : la
          // valeur est figée maintenant, l'op `condition` littérale est re-jouée chaque fin de Round.
          pushPerRound(target, [{ op: 'condition', id: o.id, value: v, ...(escape != null ? { escapeStrength: escape } : {}), ...(threshold != null ? { escapeThreshold: threshold } : {}), ...(o.entangleOnFail ? { entangleOnFail: true } : {}), ...(struggleDamage != null ? { struggleDamage } : {}) }], ctx);
          lines.push(t('op.condPerRound', { name: target.label, v, cond: conditionLabel(o.id), src: ctx.label ?? 'sort' }));
        } else if (o.durationMinutes != null || o.durationHours != null) {
          // État à durée d'HORLOGE (Belladone/Fleur de lune : sommeil « 1d10+4/5 heures ») — échéance
          // résolue MAINTENANT depuis ctx.now, purgée par purgeClockEffects (patron castPenalty.minutes).
          const min = Math.max(1, resolveFormula(o.durationMinutes ?? 0, ref, rng) + resolveFormula(o.durationHours ?? 0, ref, rng) * 60);
          addClockCondition(target, o.id, v, (ctx.now ?? 0) + min, escape, threshold, o.entangleOnFail, struggleDamage);
          lines.push(t('op.condTimed', { name: target.label, v, cond: conditionLabel(o.id), roundsTxt: min >= 60 ? t('op.frag.hours', { n: Math.round(min / 60), s: min >= 120 ? 's' : '' }) : t('op.frag.min', { n: min }) }));
        } else if (o.durationRounds != null) {
          const rounds = Math.max(1, resolveFormula(o.durationRounds, ref, rng));
          addTimedCondition(target, o.id, v, rounds, escape, threshold, o.entangleOnFail, struggleDamage);
          lines.push(t('op.condTimed', { name: target.label, v, cond: conditionLabel(o.id), roundsTxt: t('op.frag.roundsCap', { n: rounds, s: rounds > 1 ? 's' : '' }) }));
        } else {
          addCondition(target, o.id, v, escape, o.lockedUntil, o.unlockBy, threshold, o.entangleOnFail, struggleDamage); // verrous de Critique (LDB 18) : prédicat d'état / acte de soin
          lines.push(t('op.cond', { name: target.label, v, cond: conditionLabel(o.id) })); // libellé (« Exténué »), cohérent avec removeCond
        }
        // Empoignade (LDB 14 l.159) : le flag `grapple` pose la relation symétrique entre l'attaquant
        // (`ctx.caster`) et la cible — UNE seule fois (les ré-applications perRound ne portent pas le flag).
        if (o.grapple && ctx.caster && ctx.caster.id !== target.id) setGrapple(ctx.caster, target);
        break;
      }
      case 'removeCondition': {
        const id = o.id ?? target.conditions[0]?.id;
        if (id) {
          // `all` : retire TOUT l'État (Potion de vitalité « tout État Exténué ») ; sinon `value` pions (défaut 1).
          const v = o.all
            ? (target.conditions.find((x) => x.id === id)?.value ?? 1)
            : Math.max(1, resolveFormula(o.value ?? 1, ref, rng) + slBonus(ctx.sl, o.valuePerSL));
          removeCondition(target, id, v);
          lines.push(t('op.removeCond', { name: target.label, what: o.all ? "tout l'État" : `${v} État`, cond: conditionLabel(id) }));
        } else {
          lines.push(t('op.noCondToRemove', { name: target.label }));
        }
        break;
      }
      case 'endPsych': {
        // Retrait d'un état psychologique porté (collection `psychState`, ≠ `conditions`). GÉNÉRIQUE.
        if (target.psychState?.some((p) => p.type === o.type)) {
          target.psychState = target.psychState.filter((p) => p.type !== o.type);
          lines.push(t('op.endPsych', { name: target.label, psych: psychologyLabel(o.type) }));
        }
        break;
      }
      case 'beginPsych': {
        // Pose/mise à jour d'un état psychologique porté (collection `psychState`, ≠ `conditions`).
        // UPSERT par (`type` + `cible`) pour un Trait CIBLÉ, par (`type` + `sourceId`) sinon : un
        // re-Test contre la MÊME source met à jour SON entrée au lieu d'en empiler une seconde.
        const list = [...(target.psychState ?? [])];
        const at = list.findIndex((p) => p.type === o.type && (o.cible != null ? p.cible === o.cible : p.sourceId === o.sourceId));
        const next = {
          ...(at >= 0 ? list[at] : {}),
          type: o.type as PsychType,
          ...(o.cible != null ? { cible: o.cible } : {}),
          ...(o.sourceId != null ? { sourceId: o.sourceId } : {}),
          ...(o.indice != null ? { indice: Math.max(0, resolveFormula(o.indice, ref, rng, ctx.rolled, ctx.indice, ctx.stacks)) } : {}),
          ...(o.calmeDR != null ? { calmeDR: Math.max(0, resolveFormula(o.calmeDR, ref, rng)) } : {}),
          ...(o.active != null ? { active: o.active } : {}),
          ...(o.lastTestRound != null ? { lastTestRound: o.lastTestRound } : {}),
          ...(o.fromTest != null ? { fromTest: o.fromTest } : {}),
        };
        if (at >= 0) list[at] = next; else list.push(next);
        target.psychState = list;
        // `active:false` = marqueur d'affliction RÉSISTÉE (empêche le re-déclenchement) : rien n'est subi.
        if (o.active !== false) lines.push(t('op.beginPsych', { name: target.label, psych: psychologyLabel(o.type) }));
        break;
      }
      case 'grantPsychTrait': {
        // Trait PSYCHOLOGIQUE conféré (≠ état de combat) : posé dans `c.psychTraits` (la DONNÉE persistée),
        // noyau PARTAGÉ `grantPsychTrait` (`grantedTraits.ts`) — même chemin qu'`attachMutation` (permanent).
        const cible = o.cible ?? (o.argFrom === 'obsessions' ? rollObsession(rng) : undefined);
        grantPsychTrait(target, o.psychType as PsychType, cible);
        lines.push(t('op.grantPsychTrait', { name: target.label, psych: psychologyLabel(o.psychType), src: ctx.label ?? 'sort' }));
        break;
      }
      case 'removePsychTrait': {
        // Convalescence « Les choses s'arrangent » (ADE II Annexe I) : retire UN Trait psy de `c.psychTraits`
        // (≠ `endPsych`, qui apaise une affliction de combat `psychState`). Sans `psychType` = le 1ᵉʳ porté.
        const traits = [...(target.psychTraits ?? [])];
        const idx = o.psychType ? traits.findIndex((p) => p.type === o.psychType) : (traits.length ? 0 : -1);
        if (idx >= 0) {
          const [removed] = traits.splice(idx, 1);
          target.psychTraits = traits;
          lines.push(t('op.removePsychTrait', { name: target.label, psych: psychologyLabel(removed.type) }));
        } else {
          lines.push(t('op.noPsychToRemove', { name: target.label }));
        }
        break;
      }
      case 'charMod': {
        // Le charMod peut porter SA propre durée en Rounds OU en horloge (sinon il suit la durée du sort, ctx).
        let clockMin: number | null = null;
        const dur: Duration = o.durationRounds != null
          ? { scale: 'rounds', left: resolveFormula(o.durationRounds, ref, rng) }
          : o.durationMinutes != null || o.durationHours != null
            ? (() => {
                const min = Math.max(1, resolveFormula(o.durationMinutes ?? 0, ref, rng) + resolveFormula(o.durationHours ?? 0, ref, rng) * 60);
                clockMin = min;
                return { scale: 'clock' as const, until: (ctx.now ?? 0) + min };
              })()
            : durationFromCtx(ctx);
        applyActiveEffect(target, {
          label: ctx.label ?? 'Effet', char: o.char, bonus: o.mod, duration: dur,
        });
        charParts.push(`${o.mod >= 0 ? '+' : ''}${o.mod} ${CHAR_LABELS[o.char]}`);
        charRounds = dur.scale === 'rounds' ? dur.left : null;
        charClockMin = dur.scale === 'clock' ? clockMin : null;
        break;
      }
      case 'ap': {
        // Signe PRÉSERVÉ : un `amount` négatif RETIRE des PA (VDM 05). Le plancher 0 est celui du TOTAL,
        // appliqué par `effectiveArmourAt` — jamais à la pose.
        const n = resolveFormula(o.amount, ref, rng);
        // « à la Localisation touchée » (VDM 05) : la Localisation vient du COUP courant. Hors contexte
        // de touche, rien n'est posé — jamais un repli silencieux sur « toutes les Localisations ».
        const loc = o.atHitLocation ? ctx.location : o.loc;
        if (o.atHitLocation && loc == null) {
          lines.push(t('op.apNoLocation', { name: target.label }));
          break;
        }
        const dur = durationFromCtx(ctx);
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0, duration: dur, ...(loc ? { apAt: { [loc]: n } } : { apAll: n }),
          ...(o.noDeviation ? { noDeviation: true } : {}),
        });
        lines.push(t(n < 0 ? 'op.apLoss' : 'op.ap', { name: target.label, n: Math.abs(n), src: ctx.label ?? 'sort', durTxt: dur.scale === 'rounds' ? `, ${t('op.frag.rounds', { n: dur.left })}` : '' }));
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
          lines.push(t('op.corruptionRemove', { name: target.label, delta: target.corruption - before, total: target.corruption }));
        } else if (ctx.onCorruption) {
          lines.push(...ctx.onCorruption(amount, o.align));
        } else {
          // Sans contexte store (moteur pur, tests unitaires) : simple incrément — align ignoré.
          target.corruption = (target.corruption ?? 0) + amount;
          lines.push(t('op.corruptionAdd', { name: target.label, amount, s: amount > 1 ? 's' : '', total: target.corruption }));
        }
        break;
      }
      case 'sinMod': {
        // Péché ±N (LDB 40 l.36 ; ACE Annexe I « Pénitence ») — plancher 0, delta RÉEL journalisé.
        const before = target.sinPoints ?? 0;
        target.sinPoints = Math.max(0, before + o.amount);
        const delta = target.sinPoints - before;
        lines.push(t(delta > 0 ? 'op.sinAdd' : 'op.sinRemove', { name: target.label, amount: Math.abs(delta), total: target.sinPoints }));
        break;
      }
      case 'corruptionExposure': {
        // Sens ABRI (VDM 05) : pose la protection en crans, aucune exposition posée.
        if (o.easeSteps != null) {
          target.activeEffects = target.activeEffects ?? [];
          target.activeEffects.push({ label: ctx.label ?? 'Effet', bonus: 0, duration: durationFromCtx(ctx), corruptionEase: o.easeSteps });
          lines.push(t('op.corruptionEase', { name: target.label, n: o.easeSteps, src: ctx.label ?? 'sort' }));
          break;
        }
        // Test d'Exposition différé (LDB 19 l.23-75) : le store ouvre la modale (pendingCorruption) ;
        // moteur pur sans hook → journalisé inerte (rien de tiré en silence). Le niveau posé est celui
        // ATTÉNUÉ par les abris que la cible porte — sous le premier cran, l'Influence ne s'applique plus.
        const level = easeExposure(o.level ?? 'mineure', corruptionEaseSteps(target));
        if (level == null) {
          lines.push(t('op.corruptionWarded', { name: target.label }));
          break;
        }
        if (ctx.onCorruptionExposure) lines.push(...ctx.onCorruptionExposure(level, o.skill));
        else lines.push(t('op.corruptionExposure', { name: target.label, level }));
        break;
      }
      case 'gainResource': {
        // `amount` négatif = RETRAIT (VDM 12 l.833). Seul le COMPTEUR porte un plancher (0) ; l'argument
        // de l'op n'en porte pas — le neutraliser rendrait un retrait indistinguable d'un no-op.
        const n = o.amount + slBonus(ctx.sl, o.perSL);
        if (n === 0) break;
        const fate = o.resource === 'fate';
        const key = fate ? 'fate' : 'fortune';
        const before = target[key] ?? 0;
        target[key] = Math.max(0, before + n);
        if (o.temporary && n > 0) {
          target.activeEffects = target.activeEffects ?? [];
          target.activeEffects.push({
            label: ctx.label ?? 'Effet', bonus: 0,
            duration: durationFromCtx(ctx),
            ...(fate ? { grantedFate: n } : { grantedFortune: n }),
          });
        }
        const moved = Math.abs(target[key] - before);
        // Le journal dit ce qui a BOUGÉ : compteur déjà à 0, rien n'est retiré, rien ne se journalise
        // (« −0 Point » serait un événement inventé).
        if (n > 0) lines.push(t('op.gainResource', { name: target.label, n, s: n > 1 ? 's' : '', res: fate ? 'Destin' : 'Chance', temp: o.temporary ? ' (le temps du Sort)' : '', total: target[key] }));
        else if (moved > 0) lines.push(t('op.loseResource', { name: target.label, n: moved, s: moved > 1 ? 's' : '', res: fate ? 'Destin' : 'Chance', total: target[key] }));
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
          dureeTxt = t('op.frag.roundsCap', { n: cp.roundsLeft, s: cp.roundsLeft > 1 ? 's' : '' });
        } else if (o.minutes != null) {
          const min = Math.max(1, resolveFormula(o.minutes, ref, rng));
          cp.untilTime = (ctx.now ?? 0) + min;
          dureeTxt = t('op.frag.min', { n: min });
        } else if (o.hours != null) {
          const h = Math.max(1, resolveFormula(o.hours, ref, rng));
          cp.untilTime = (ctx.now ?? 0) + h * 60;
          dureeTxt = t('op.frag.hours', { n: h, s: h > 1 ? 's' : '' });
        } else if (o.days != null) {
          const d = Math.max(1, resolveFormula(o.days, ref, rng));
          cp.untilTime = (ctx.now ?? 0) + d * 24 * 60;
          dureeTxt = t('op.frag.days', { n: d, s: d > 1 ? 's' : '' });
        }
        target.castPenalties = [...(target.castPenalties ?? []), cp];
        const skillTxt = cp.skill === 'all' ? t('op.frag.allMagic') : refLabel('skills', { id: cp.skill });
        const what = cp.blocked
          ? t('op.castPenalty.blocked', { skill: skillTxt })
          : cp.maxZeroDR
            ? t('op.castPenalty.maxZeroDR')
            : t('op.castPenalty.mod', { mod: String(cp.mod), skill: skillTxt });
        lines.push(t('op.castPenalty', { name: target.label, what, duree: dureeTxt ? t('op.frag.during', { dureeTxt }) : '', label: cp.label }));
        break;
      }
      case 'statusMod': {
        const n = resolveFormula(o.amount, ref, rng);
        if (n === 0) break;
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({ label: ctx.label ?? 'Effet', bonus: 0, duration: { scale: 'adventure' }, statusMod: n });
        lines.push(t('op.statusMod', { name: target.label, sign: n >= 0 ? '+' : '', n }));
        break;
      }
      case 'grantReverseToken': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({ label: ctx.label ?? 'Effet', bonus: 0, duration: { scale: 'adventure' }, reverseToken: { skill: o.skill, spec: o.spec } });
        lines.push(t('op.grantReverseToken', { name: target.label, skill: o.skill ? refLabel('skills', { id: o.skill }) : 'un Test concernant sa cible' }));
        break;
      }
      case 'grantTrait': {
        if (!groupGate(o.onlyGroups)) break; // « les Mort-vivant/Démoniaque gagnent Instable » (Bannissement)
        const ind = o.indice != null ? resolveFormula(o.indice, ref, rng) + slBonus(ctx.sl, o.indicePerSL) : null;
        const arg = o.arg ?? (o.argFrom === 'obsessions' ? rollObsession(rng) : undefined);
        const inst: TraitInstance = { id: o.traitId, ...(arg ? { arg } : {}), ...(ind != null ? { value: ind } : {}) };
        grantTrait(target, inst);
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          duration: o.durationRounds != null ? { scale: 'rounds', left: Math.max(1, resolveFormula(o.durationRounds, ref, rng)) } : durationFromCtx(ctx),
          grantedTrait: inst,
        });
        lines.push(t('op.grantTrait', { name: target.label, trait: formatTrait(inst), src: ctx.label ?? 'sort' }));
        break;
      }
      case 'augmentWeapon': {
        const dmg = o.damageBonus != null ? Math.max(0, resolveFormula(o.damageBonus, ref, rng)) : undefined;
        // L'altération se pose SUR L'ARME TENUE (set actif : main puis 2nde) qui matche la famille requise
        // (Épée de justice → une épée ; ungated → la main). Aucune arme valable tenue → fizzle journalisé.
        const lo = activeLoadout(target);
        const held = [lo?.main, lo?.off]
          .map((u) => (target.items ?? []).find((i) => i.uid === u))
          .filter((i): i is ItemInstance => !!i && (i.kind === 'melee' || i.kind === 'ranged'));
        const item = held.find((i) => weaponMatchesFamily(i, o.requiresWeapon));
        if (!item) {
          lines.push(t('op.noWeaponToEnchant', { name: target.label, src: ctx.label ?? 'sort' }));
          break;
        }
        const enchantId = newUid();
        item.enchants = [
          ...(item.enchants ?? []),
          {
            id: enchantId,
            ...(o.addQualities?.length ? { addQualities: o.addQualities } : {}),
            ...(dmg ? { damageBonus: dmg } : {}),
            ...(o.bypass != null ? { bypass: o.bypass } : {}),
            ...(o.onHitEffects?.length ? { onHitEffects: o.onHitEffects } : {}),
            ...(o.removeQualities?.length ? { removeQualities: o.removeQualities } : {}),
            ...(o.removeType != null ? { removeType: o.removeType } : {}),
            ...(o.suppressEnchants ? { suppressEnchants: true } : {}),
            ...(o.passive?.length ? { passive: o.passive } : {}),
          },
        ];
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          duration: durationFromCtx(ctx),
          enchantRef: { itemUid: item.uid, enchantId },
        });
        recomputeLoadout(target); // replie l'enchant dans l'arme active (visible + appliqué)
        const parts = [
          ...(o.addQualities ?? []).map((id) => qualityRefLabel({ id })), // id stable → libellé affiché
          ...(dmg ? [`+${dmg} Dégâts`] : []),
          ...(o.onHitEffects?.length ? ['effet à la touche'] : []),
          ...(o.removeQualities ?? []).map((id) => `−${qualityRefLabel({ id })}`),
          ...(o.removeType ? [t(o.removeType === 'atout' ? 'op.frag.loseAtouts' : 'op.frag.loseDefauts')] : []),
          ...(o.suppressEnchants ? [t('op.frag.enchantsSuppressed')] : []),
          ...(o.passive?.length ? [t('op.frag.weaponPassive')] : []),
        ];
        lines.push(t('op.enchantWeapon', { name: target.label, item: item.label, parts: parts.join(', '), src: ctx.label ?? 'sort' }));
        break;
      }
      case 'cureDisease': {
        const n = Math.max(0, (o.count ?? 1) + slBonus(ctx.sl, o.countPerSL));
        const cured = cureDiseases(target, n);
        lines.push(...(cured.length ? cured : [t('op.noDiseaseToCure', { name: target.label })]));
        break;
      }
      case 'reduceDiseaseDays': {
        // `dice` (Rouille mouchetée : 1d10 jours) tiré à l'application ; `disease` = filtre par id ;
        // `oncePerDisease` = verrou « une fois par maladie » (Bénédiction de Convalescence, LDB 41) ;
        // `daysPerSL` = échelle sur le DR du Test précédent (Gesundheit, MSRC 04 l.184-186).
        const days = (o.dice ? rollDice(o.dice, rng) : (o.days ?? 1)) + slBonus(ctx.sl, o.daysPerSL);
        lines.push(...blessDiseaseDuration(target, days, { disease: o.disease, once: o.oncePerDisease }));
        break;
      }
      case 'preventInfection': {
        target.woundDressed = true; // pas d'Infection post-critique (LDB 18 l.298)
        lines.push(t('op.preventInfection', { name: target.label, src: ctx.label ?? 'sort' }));
        lines.push(...receiveMedicalAid(target)); // bandage/cataplasme = Aide Médicale (LDB 18 l.310)
        lines.push(...releaseConditionLocks(target, 'medicalAid')); // verrous d'État « par Aide Médicale » (LDB 18)
        break;
      }
      case 'exposeDisease': {
        // SILENCIEUX (comme l'ancien flag) : l'exposition ne s'exprime qu'au bilan de fin de combat.
        // Double exposition à la MÊME maladie → fusion en gardant la PIRE (shift le plus dur, instant si l'une l'impose).
        const entry = { disease: o.disease, ...(o.difficultyShift ? { difficultyShift: o.difficultyShift } : {}), ...(o.incubation === 'instant' ? { instant: true } : {}) };
        const prev = (target.diseaseExposure ?? []).find((e) => e.disease === o.disease);
        target.diseaseExposure = prev
          ? (target.diseaseExposure ?? []).map((e) => e !== prev ? e : {
              disease: e.disease,
              ...(Math.min(e.difficultyShift ?? 0, entry.difficultyShift ?? 0) !== 0 ? { difficultyShift: Math.min(e.difficultyShift ?? 0, entry.difficultyShift ?? 0) } : {}),
              ...(e.instant || entry.instant ? { instant: true } : {}),
            })
          : [...(target.diseaseExposure ?? []), entry];
        break;
      }
      case 'contractDisease': {
        // Contraction instantanée (incubation 0) — délègue à la machinerie de maladie (cycle-safe :
        // disease.ts n'importe `ops` qu'en type). Inerte si déjà porteur.
        lines.push(...contractDiseaseOnce(target, o.disease, rng));
        break;
      }
      case 'kill': {
        lines.push(fateSaveOrDie(target) ? t('op.kill.fateSaved', { name: target.label }) : t('op.kill', { name: target.label }));
        break;
      }
      case 'cureCriticalWound': {
        const n = Math.max(0, (o.count ?? 1) + slBonus(ctx.sl, o.countPerSL));
        const cured = cureCriticalWounds(target, n);
        lines.push(...(cured.length ? cured : [t('op.noCritToCure', { name: target.label })]));
        break;
      }
      case 'grantTalent': {
        const dur = durationFromCtx(ctx);
        // Octroi SANS échéance (table de contrecoup — Marques Arcaniques, VDM 02 l.238) = acquisition
        // STRUCTURELLE dans `c.talents`, MÊME chemin que `attachMutation` (corruption.ts) et que l'effet
        // de Signe astral (`applyCreationOps`) : fiche, avancement, +DR de Talent et passifs de Talent
        // lisent `c.talents`. Le Maxi du registre borne l'octroi (LDB 10 l.13-21, `talentMaxReached`).
        if (dur.scale === 'permanent') {
          target.talents = target.talents ?? [];
          if (talentMaxReached(target, o.talentId, o.spec)) {
            lines.push(t('op.grantTalent.max', { name: target.label, talent: talentConcrete(o), src: ctx.label ?? 'sort' }));
            break;
          }
          const has = target.talents.some((x) => x.talentId === o.talentId && (x.spec ?? '') === (o.spec ?? ''));
          target.talents = has
            ? target.talents.map((x) => (x.talentId === o.talentId && (x.spec ?? '') === (o.spec ?? '') ? { ...x, times: (x.times ?? 1) + 1 } : x))
            : [...target.talents, { talentId: o.talentId, ...(o.spec ? { spec: o.spec } : {}), times: 1 }];
          lines.push(t('op.grantTalent', { name: target.label, talent: talentConcrete(o), src: ctx.label ?? 'sort' }));
          break;
        }
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          duration: dur,
          grantedTalent: { talentId: o.talentId, ...(o.spec ? { spec: o.spec } : {}) },
        });
        lines.push(t('op.grantTalent', { name: target.label, talent: talentConcrete(o), src: ctx.label ?? 'sort' }));
        break;
      }
      case 'reduceToZero': {
        // PB à 0 SEUL ; l'Inconscient ou l'Enflammé est posé par une op `condition` séparée
        // dans l'entrée appelante (ex. Châtiment ajoute inconscient, Tonnerre ajoute en-flammes).
        target.wounds.current = 0;
        lines.push(t('op.reduceToZero', { name: target.label }));
        break;
      }
      case 'banish': {
        if (!groupGate(o.onlyGroups)) break; // Fauche-démon : ne bannit qu'une cible Démoniaque
        // Retrait du jeu — pas de corps/Inconscient/Critique. Émet TOUJOURS la narration (la cible peut être
        // déjà `dead` d'un Critique létal : le retrait est l'issue NARRÉE de SA mort). L'unicité est garantie
        // en amont (déclencheur `onSlain` pour le Démoniaque, `if woundsCurrent<=0` pour l'Instable).
        target.dead = true;
        lines.push(t(o.narration === 'unravel' ? 'op.banish.unravel' : 'op.banish', { name: target.label }));
        break;
      }
      case 'removeShipPoste': {
        // « Canon perdu » (MDG 13 l.765) : une pièce passe par-dessus bord — retirée de la coque + son
        // chef démancipé. La coque (`target`) est la source de vérité ; l'équipage vient de `ctx.crew`.
        const postes = target.postes;
        if (postes?.length) {
          const [lost] = postes.splice(rng.int(0, postes.length - 1), 1);
          const chef = lost.crewIds?.[0] ? ctx.crew?.find((c) => c.id === lost.crewIds![0]) : undefined;
          if (chef?.mannedPoste === lost) { // il ne sert plus rien
            chef.mannedPoste = undefined;
            chef.weapons = (chef.weapons ?? []).filter((w) => w.uid !== lost.item.uid);
          }
          lines.push(t('op.removeShipPoste', { name: lost.item.label }));
        }
        break;
      }
      case 'ignoreStatePenalties': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          duration: durationFromCtx(ctx),
          // `count` (Les dames de L'Anguille, MDG 09 l.244 : « peut ignorer UN État ») → n'ignore que
          // les N pires États ; absent = TOUTES les pénalités d'État (Endurance de l'anachorète, LDB 42).
          ...(o.count != null ? { ignoreStatesCount: o.count } : { ignoreStatePenalties: true }),
        });
        lines.push(t('op.ignoreStatePenalties', { name: target.label, src: ctx.label ?? 'sort' }));
        break;
      }
      case 'freeReroll': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          duration: durationFromCtx(ctx),
          freeReroll: true,
        });
        lines.push(t('op.freeReroll', { name: target.label, src: ctx.label ?? 'sort' }));
        break;
      }
      case 'critTwice': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          duration: durationFromCtx(ctx),
          critRollTwice: true,
        });
        lines.push(t('op.critTwice', { name: target.label, src: ctx.label ?? 'sort' }));
        break;
      }
      case 'damageArmour': {
        const loc = damageLeatherArmour(target);
        lines.push(loc
          ? t('op.armourLeatherShrink', { name: target.label, loc: HIT_LOCATION_LABELS[loc] })
          : t('op.noLeatherToRot', { name: target.label }));
        break;
      }
      case 'suppressPsych': {
        const suppressed = suppressPsychTraits(target);
        if (!suppressed) {
          lines.push(t('op.noPsychToSuppress', { name: target.label }));
          break;
        }
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          duration: durationFromCtx(ctx),
          suppressedPsych: suppressed,
        });
        lines.push(t('op.suppressPsych', { name: target.label, src: ctx.label ?? 'sort' }));
        break;
      }
      case 'suffocate': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          duration: durationFromCtx(ctx),
          suffocates: true,
        });
        lines.push(t('op.suffocate', { name: target.label, src: ctx.label ?? 'sort' }));
        break;
      }
      case 'noHunger': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          duration: durationFromCtx(ctx),
          noHunger: true,
        });
        lines.push(t('op.noHunger', { name: target.label, src: ctx.label ?? 'sort' }));
        break;
      }
      case 'testMod': {
        // `char` présent = modificateur QUALIFIÉ (Mystracine « +10 aux Tests d'Endurance et de FM,
        // −10 Ag/I/Int », LDB 71 l.33) → `testModChar`, lu par `testValue` pour les seuls Tests de cette
        // Caractéristique ; absent = mod GLOBAL (lu par `effectGlobalTestMod`, qui EXCLUT les qualifiés).
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          duration: durationFromCtx(ctx),
          testMod: o.amount,
          ...(o.char ? { testModChar: o.char } : {}),
          ...(o.weaponHand ? { testModHand: o.weaponHand } : {}),
          ...(o.movementOnly ? { testModMovementOnly: true } : {}),
        });
        lines.push(t('op.testMod', { name: target.label, mod: `${o.amount >= 0 ? '+' : ''}${o.amount}${o.char ? ` (${CHAR_LABELS[o.char]})` : ''}`, src: ctx.label ?? 'sort' }));
        break;
      }
      case 'attrMod': {
        // EXÉCUTABLE (Bonnet de fou « +4 Blessures », LDB 71 l.20) : effet actif `attrMods`, lu par le
        // calcul du max concerné (wounds → effectiveMaxWounds/refreshWounds ; fortune → fortuneMax ;
        // resolve → resolveMax). Destin/Résilience exclus de l'union `attr` (#292, ci-dessus).
        const n = resolveFormula(o.mod, ref, rng);
        if (!n) break;
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          duration: durationFromCtx(ctx),
          attrMods: { [o.attr]: n },
        });
        if (o.attr === 'wounds') refreshWounds(target); // le max bouge → PB courants suivent le delta
        lines.push(t('op.attrMod', { name: target.label, mod: `${n >= 0 ? '+' : ''}${n}`, attr: { wounds: 'Blessures', fortune: 'Chance', resolve: 'Détermination' }[o.attr], src: ctx.label ?? 'sort' }));
        break;
      }
      case 'diseaseTestMod': {
        // Bonus aux Tests liés à une maladie (Fleur de lune/Racine de terre/Tonique digestif) — sommé par
        // `activeDiseaseTestMod` (engine/disease) aux Tests de contraction/cycle/fin.
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          duration: durationFromCtx(ctx),
          diseaseTestMod: { amount: o.amount, ...(o.diseases?.length ? { diseases: o.diseases } : {}) },
        });
        lines.push(t('op.diseaseTestMod', { name: target.label, mod: `${o.amount >= 0 ? '+' : ''}${o.amount}`, what: o.diseases?.length ? o.diseases.map((d) => refLabel('maladies', { id: d })).join(', ') : t('op.frag.allDiseases'), src: ctx.label ?? 'sort' }));
        break;
      }
      case 'suppressSymptom': {
        // Suspension d'un symptôme par id (Racine de terre → bubons) — les canaux passive/onTick du
        // symptôme sont ignorés tant que l'effet dure (`symptomSuppressed`), restitués à l'expiration.
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          duration: durationFromCtx(ctx),
          suppressedSymptom: o.symptomId,
        });
        lines.push(t('op.suppressSymptom', { name: target.label, symptom: refLabel('symptoms', { id: o.symptomId }), src: ctx.label ?? 'sort' }));
        break;
      }
      case 'actGate': {
        // Gate d'action par Round (Racine de mandragore) : le drapeau est lu au début du tour du porteur
        // en combat (`resolveActGates`, couche state) — cadence-aware, jamais un jet silencieux de héros.
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          duration: durationFromCtx(ctx),
          actGate: { char: o.char },
        });
        lines.push(t('op.actGate', { name: target.label, char: CHAR_LABELS[o.char], src: ctx.label ?? 'sort' }));
        break;
      }
      case 'noBreath': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          duration: durationFromCtx(ctx),
          noBreath: true,
        });
        lines.push(t('op.noBreath', { name: target.label, src: ctx.label ?? 'sort' }));
        break;
      }
      case 'weatherWard': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          duration: durationFromCtx(ctx),
          weatherImmune: true,
        });
        lines.push(t('op.weatherWard', { name: target.label, src: ctx.label ?? 'sort' }));
        break;
      }
      case 'giveTrapping': {
        const n = Math.max(1, (o.count ?? 1) + slBonus(ctx.sl, o.perSL));
        target.items = target.items ?? [];
        for (let i = 0; i < n; i++) {
          const it = itemFromGive(o, ctx.source);
          target.items.push(it);
          autoStowNewItem(target, it); // #204 : rangement par défaut
        }
        lines.push(t('op.giveTrapping', { name: target.label, count: n > 1 ? `${n}× ` : '', item: giveTrappingLabel(o), src: ctx.label ?? 'sort' }));
        break;
      }
      case 'perRound': {
        pushPerRound(target, o.ops, ctx);
        break;
      }
      case 'rollThreshold': {
        const rolled = roll(1, o.sides, rng);
        for (const th of o.thresholds) {
          if (rolled >= th.atLeast) lines.push(...applyOps(target, th.ops, { ...ctx, rolled }));
        }
        break;
      }
      case 'rollTable': {
        // Table INLINE (`rows`) ou RÉFÉRENCÉE (`tableId` → tables.json, fail-fast) — jamais les deux.
        const tbl = 'tableId' in o ? findEffectTableById(o.tableId) : null;
        const rows: { min: number; max: number; ops: GameOp[] }[] = tbl ? tbl.rows : ('rows' in o ? o.rows : []);
        const sides = (tbl ? tbl.die : o.die) === 'd100' ? 100 : 10;
        // Modificateur CONSTANT (Haute Alchimie « 1d10 + 3 », VDM 03 l.698) + |DR négatif| (Vers de carie,
        // MSRC 16 l.90) → lookup `[min,max]` (source unique) → ops de la rangée.
        const modifier = (o.mod ?? 0) + (o.addNegativeSL ? Math.max(0, -(ctx.sl ?? 0)) : 0);
        // Multiplicité : 1 jet + `extraRollsPerStep` par PAS de Surincantation CHOISI (EDOC 13 l.276 :
        // « vous pouvez » — déclinable, jamais forcé) ; borné aux pas réellement alloués à la Durée
        // (la durée, elle, se prolonge intégralement sur TOUS les pas alloués — couplage asymétrique).
        const allocatedSteps = Math.max(0, ctx.overcastDurationSteps ?? 0);
        const chosenSteps = Math.min(ctx.chosenTableRolls ?? allocatedSteps, allocatedSteps);
        const times = 1 + (o.extraRollsPerStep ? chosenSteps * o.extraRollsPerStep : 0);
        for (let i = 0; i < times; i++) {
          const die = roll(1, sides, rng);
          const entry = findTableEntry(rows, die + modifier);
          lines.push(...applyOps(target, entry.ops, { ...ctx, rolled: die }));
        }
        break;
      }
      case 'rollMutation': {
        // Mutation à DURÉE du Sort (EDOC 13 l.276-277) — même chemin que la Corruption (rollMutation +
        // attachMutation), sans reveal ni damnation (moteur pur ; la couche state expose la modale via son
        // propre flux de mutation). Durée du ctx par défaut → ActiveEffect porteur qui la détache à
        // l'expiration ; permanente (`duration:'permanent'` OU ctx sans durée) → aucun porteur (comme grantTrait).
        const dur = o.duration === 'permanent' ? { scale: 'permanent' as const } : durationFromCtx(ctx);
        const m = rollMutation(o.table, rng);
        attachMutation(target, m, rng);
        if (dur.scale !== 'permanent') {
          target.activeEffects = target.activeEffects ?? [];
          target.activeEffects.push({ label: ctx.label ?? 'Mutation', bonus: 0, duration: dur, grantedMutation: m });
        }
        if (target.items?.length) recomputeLoadout(target); // armes/PA naturels de mutation → loadout
        refreshWounds(target); // F/E/FM rongés → max de PB suit
        // Libellé FIDÈLE à la durée RÉELLE (jamais « permanente » en dur pour un octroi temporisé,
        // même vocabulaire que les autres effets à durée, cf. `op.suppressPsych`/`op.suppressSymptom`
        // « pour la durée »).
        lines.push(t('op.rollMutation', { name: target.label, mutation: m.label, durability: dur.scale === 'permanent' ? 'mutation permanente' : 'pour la durée' }));
        break;
      }
      case 'charDamage': {
        // Perte PERMANENTE de Caractéristique de BASE (Vers de carie, MSRC 16 l.94-103) — jamais sous 0.
        const n = Math.max(0, resolveFormula(o.amount, ref, rng, ctx.rolled, ctx.indice, ctx.stacks));
        if (n > 0) {
          const before = target.characteristics[o.char];
          target.characteristics[o.char] = Math.max(0, before - n);
          refreshWounds(target); // E/F rongées → le max de PB suit (comme un charMod permanent du profil)
          lines.push(t('op.charDamage', { name: target.label, n: before - target.characteristics[o.char], char: CHAR_LABELS[o.char] }));
        }
        break;
      }
      case 'grantNaturalWeapon': {
        const n = Math.max(0, resolveFormula(o.damage, ref, rng) + (o.damagePlus ?? 0));
        const plusBF = o.plusBF !== false; // attaques naturelles = SB-relatives par défaut
        const weapon = buildWeapon({
          label: o.label, attackKind: o.attackKind, subType: o.subType,
          damage: { plusBF, flat: n, bare: o.bare ? true : undefined },
          qualities: (o.qualities ?? []).map((id) => ({ id })), uid: o.uid ?? { prefix: `nat-${norm(o.label)}` },
          source: ctx.source,
        });
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? o.label, bonus: 0,
          duration: durationFromCtx(ctx),
          naturalWeapon: weapon,
        });
        recomputeLoadout(target);
        const natQuals = weapon.qualities.map(qualityRefLabel).join(', ');
        lines.push(t('op.grantNaturalWeapon', { name: target.label, weapon: o.label, dmg: damageString(weapon.damage), quals: weapon.qualities.length ? `, ${natQuals}` : '', src: ctx.label ?? 'sort' }));
        break;
      }
      case 'grantWeapon': {
        const flat = Math.max(0, resolveFormula(o.damage, ref, rng) + (o.damagePlus ?? 0));
        // Forme LIBRE (Arme aethyrique) : on CLONE le profil (Groupe/allonge/mains) d'une arme RÉELLE
        // choisie par le lanceur (ctx.conjureForm, défaut = sa meilleure Spé de CC) ; sinon stats du
        // Sort. Seuls les Dégâts (= BFM…) et les Atouts du Sort surchargent le profil → un OBJET ordinaire.
        const form = o.chooseForm ? (ctx.conjureForm ?? conjureFormOptions(ref)[0]) : null;
        const tpl = form ? itemFromTrappingById(form.weapon) : null;
        // L'objet vit dans un SET dédié (equipConjuredWeapon), hors Set I/II auto → `weaponItem` (conjured).
        // Silhouette de rendu : forme choisie (chooseForm) ou silhouette fixe du Sort → le rig dessine
        // l'arme réelle bien que nommée « Arme aethyrique » / « Faux de Shyish ».
        const item = weaponItem({
          label: form ? `${o.label} (${tpl?.label ?? form.weapon})` : o.label,
          damage: { plusBF: !!o.plusBF, flat },
          subType: form ? tpl?.subType : o.subType,
          reach: form ? tpl?.reach : (o.reach ?? null),
          hands: form ? (tpl?.hands ?? 1) : (o.hands ?? 1),
          qualities: (o.qualities ?? []).map((id) => ({ id })), // Atouts du Sort (ids) — PAS ceux du gabarit ; copiés par buildWeapon
          conjured: true,
          uid: { prefix: 'conjure' },
          ...(o.skin ? { skin: o.skin } : {}), // teinte magique unique (aethyrique/améthyste/ardente)
          ...(form ? { form: form.weapon } : o.form ? { form: o.form } : {}),
          source: ctx.source,
        });
        // SET d'armes DÉDIÉ rendu actif (réutilise les loadouts) — le joueur peut rebasculer sur ses
        // armes ; à l'expiration, le set d'origine est restauré (engine/conjuredWeapons).
        // Effets « à la touche » (Épée ardente → En flammes) PORTÉS PAR L'OBJET invoqué (enchant) ;
        // equipConjuredWeapon recompose le loadout → repliés dans l'arme active. Pas d'enchantRef :
        // l'objet est retiré en bloc à l'expiration (dropExpiredGrantedWeapons).
        if (o.onHitEffects?.length) item.enchants = [{ id: newUid(), onHitEffects: o.onHitEffects }];
        const conjuredSet = equipConjuredWeapon(target, item);
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? o.label, bonus: 0,
          duration: durationFromCtx(ctx),
          conjuredSet,
        });
        const conjQuals = item.qualities.map(qualityRefLabel).join(', ');
        lines.push(t('op.grantWeapon', { name: target.label, item: item.label, dmg: item.damage ? damageString(item.damage) : '—', quals: item.qualities.length ? `, ${conjQuals}` : '', src: ctx.label ?? 'sort' }));
        break;
      }
      case 'castWard': {
        let radius = Math.max(0, resolveFormula(o.radius, ref, rng));
        if (o.perSL) {
          radius += Math.floor(Math.max(0, ctx.sl ?? 0) / Math.max(1, o.perSL.every))
            * Math.max(0, resolveFormula(o.perSL.radiusFormula, ref, rng));
        }
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          duration: durationFromCtx(ctx),
          castWard: { radiusMeters: radius },
        });
        lines.push(t('op.castWard', { name: target.label, radius, src: ctx.label ?? 'sort' }));
        break;
      }
      case 'arrowWard': {
        const radius = Math.max(0, resolveFormula(o.radius, ref, rng));
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          duration: durationFromCtx(ctx),
          arrowWard: { radiusMeters: radius },
        });
        lines.push(t('op.arrowWard', { name: target.label, radius, src: ctx.label ?? 'sort' }));
        break;
      }
      case 'domeWard': {
        const radius = Math.max(0, resolveFormula(o.radius, ref, rng));
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          duration: durationFromCtx(ctx),
          domeWard: { radiusMeters: radius },
        });
        lines.push(t('op.domeWard', { name: target.label, radius, src: ctx.label ?? 'sort' }));
        break;
      }
      case 'attackWardFM': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          duration: durationFromCtx(ctx),
          attackWardFM: true,
        });
        lines.push(t('op.attackWardFM', { name: target.label, src: ctx.label ?? 'sort' }));
        break;
      }
      case 'martyr': {
        if (!ctx.caster) {
          lines.push(t('op.martyrNoPriest', { name: target.label }));
          break;
        }
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          duration: durationFromCtx(ctx),
          martyrGuard: ctx.caster.id,
        });
        lines.push(t('op.martyr', { caster: ctx.caster.label, name: target.label, src: ctx.label ?? 'sort' }));
        break;
      }
      case 'summon':
      case 'scheduleRespawn':
      case 'zone':
      case 'grantFreeAttack':
      case 'interruptFocus':
      case 'breakBlade':
      case 'push':
      case 'teleport':
      case 'chain':
      case 'delayed':
        // Effets IMPURS (grille + initiative / reconstitution programmée / zones de bataille / ouverture
        // d'une frappe / interruption de Focalisation / désarmement-bris de Piège-lame / poussée /
        // téléportation / rebond de Projectile / ops différées à échéance d'horloge) — résolus par la
        // couche state (combatFlow : applySummon / scheduleRespawn → file horloge / placeSpellZone ; les
        // hooks `freeAttack`/`focusInterrupt`/`bladeTrap` appelés par `runCombatFlow` ; `applyCast` scanne
        // push/teleport/chain ; `delayed` → `scheduleDelayedOps` aux points d'application d'un EffectOp),
        // qui détient get/set et le combattant. `applyOps` (moteur pur) les laisse INERTES.
        break;
      case 'polymorph':
        // Métamorphose : développée en charMod différentiel + grantTrait (auto-restitués) — pure. + override
        // d'APPARENCE le temps de l'effet (morphRef, rendu par la couche rig), restitué à l'expiration.
        lines.push(...applyOps(target, polymorphOps(target, o.ref), ctx));
        applyActiveEffect(target, { label: ctx.label ?? 'Métamorphose', morphRef: o.ref, bonus: 0, duration: durationFromCtx(ctx) });
        break;
      case 'transform': {
        // Applique les deltas AUTHORÉS sous le LABEL `tag` (déterministe → retrait atomique) et une durée
        // PERMANENTE (forme durable ≠ buff de sort : on efface toute durée héritée du ctx). L'apparence
        // (morphRef) porte le MÊME tag pour être retirée avec le reste par `endTransform`.
        const inner: OpsCtx = { ...ctx, label: o.tag, effectId: o.tag, defaultDurationRounds: undefined, defaultUntilTime: undefined };
        lines.push(...applyOps(target, o.ops, inner));
        if (o.morphRef) applyActiveEffect(target, { label: o.tag, effectId: o.tag, morphRef: o.morphRef, bonus: 0, duration: { scale: 'permanent' } });
        lines.push(t('op.transform', { name: target.label, tag: o.tag }));
        break;
      }
      case 'endTransform': {
        const eff = target.activeEffects ?? [];
        const removed = eff.filter((e) => e.effectId === o.tag);
        if (!removed.length) break; // pas dans cette forme → no-op
        dropExpiredGrantedTraits(target, removed); // dé-accorde les Traits posés par la transformation
        target.activeEffects = eff.filter((e) => e.effectId !== o.tag);
        refreshWounds(target); // les deltas de profil (F/E/FM) retirés → PB max recalés
        lines.push(t('op.endTransform', { name: target.label, tag: o.tag }));
        break;
      }
      case 'lifeSteal': {
        const who = ctx.caster ?? target;
        const dealt = Math.max(0, ctx.woundsDealt ?? 0);
        const healed = (o.round ?? 'floor') === 'ceil'
          ? Math.ceil((dealt * o.num) / o.den)
          : Math.floor((dealt * o.num) / o.den);
        if (healed > 0) {
          // SOURCE UNIQUE `applyHealWounds` — même plafond de munition logée (LDB 62 l.250) que le
          // reste ; le message ne sort que si le drain rend RÉELLEMENT des PB (post-plafond).
          lines.push(...applyHealWounds(who, healed, { skillCheck: false, wake: false, log: (h) => (h > 0 ? [t('op.lifeSteal', { name: who.label, n: h })] : []) }));
        }
        break;
      }
      case 'skillMod': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          duration: durationFromCtx(ctx),
          skillMods: { [o.skill]: o.mod },
        });
        lines.push(t('op.skillMod', { name: target.label, mod: `${o.mod >= 0 ? '+' : ''}${o.mod}`, skill: o.skill, src: ctx.label ?? 'sort' }));
        break;
      }
      // +DR temporisé à une Compétence / une Caractéristique (chansons de marin, MDG 09 l.228/236) :
      // porté par `ActiveEffect.drBonus`, lu par `skillDRBonus`/`charDRBonusOf` sur un Test RÉUSSI.
      case 'skillDRBonus': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0, duration: durationFromCtx(ctx),
          drBonus: [{ skill: o.skill, ...(o.spec != null ? { spec: o.spec } : {}), bonus: resolveFormula(o.bonus, ref, rng) }],
        });
        lines.push(t('op.drBonus', { name: target.label, what: o.skill ?? o.testType ?? '', src: ctx.label ?? 'sort' }));
        break;
      }
      case 'charDRBonus': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0, duration: durationFromCtx(ctx),
          drBonus: [{ char: o.char, bonus: resolveFormula(o.bonus, ref, rng) }],
        });
        lines.push(t('op.drBonus', { name: target.label, what: CHAR_LABELS[o.char], src: ctx.label ?? 'sort' }));
        break;
      }
      // Modificateur aux Tests INDIVIDUELS d'un Test d'équipage (« Naviguons tous ensemble », MDG 09 l.224).
      case 'crewTestMod': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0, duration: durationFromCtx(ctx),
          crewTestMod: o.mod,
        });
        lines.push(t('op.crewTestMod', { name: target.label, mod: `${o.mod >= 0 ? '+' : ''}${o.mod}`, src: ctx.label ?? 'sort' }));
        break;
      }
      case 'light': {
        // Chemin SORT : pose un ActiveEffect.light TEMPORISÉ (durée du sort), lu par `combatantLights`
        // (vision) au MÊME point que la lumière d'un objet porté. (Côté OBJET le `passive` n'est jamais
        // exécuté par applyOps → l'op est naturellement inerte là-bas.)
        const dur: Duration = o.durationRounds != null
          ? { scale: 'rounds', left: resolveFormula(o.durationRounds, ref, rng) }
          : durationFromCtx(ctx);
        const lumière = o.tone ? { radiusTiles: o.radiusTiles, tone: o.tone } : { radiusTiles: o.radiusTiles };
        applyActiveEffect(target, { label: ctx.label ?? 'Lumière', bonus: 0, light: lumière, duration: dur });
        lines.push(t('op.light', { name: target.label, n: o.radiusTiles, src: ctx.label ?? 'sort' }));
        break;
      }
      case 'moveScale': {
        target.activeEffects = target.activeEffects ?? [];
        // Durée INTRINSÈQUE (Souffle coupé : « pendant 1d10 Rounds ») résolue MAINTENANT, indépendamment
        // du ctx — même patron que `maxWeaponHands`.
        const dur: Duration = o.durationRounds != null
          ? { scale: 'rounds', left: Math.max(1, resolveFormula(o.durationRounds, ref, rng)) }
          : durationFromCtx(ctx);
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          duration: dur,
          moveScale: { num: o.num, den: o.den },
        });
        lines.push(t('op.moveScale', { name: target.label, num: o.num, den: o.den, src: ctx.label ?? 'sort' }));
        break;
      }
      case 'moveMod': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          duration: durationFromCtx(ctx),
          moveMod: o.mod,
        });
        lines.push(t('op.moveMod', { name: target.label, mod: `${o.mod >= 0 ? '+' : ''}${o.mod}`, src: ctx.label ?? 'sort' }));
        break;
      }
      case 'maxWeaponHands': {
        target.activeEffects = target.activeEffects ?? [];
        // Durée INTRINSÈQUE (Aux Armes : « main/bras inutilisable Nd10[-BE] Rounds », minimum 1) résolue
        // MAINTENANT, indépendamment du ctx — même patron que `charMod`/`condition`.
        const dur: Duration = o.durationRounds != null
          ? { scale: 'rounds', left: Math.max(1, resolveFormula(o.durationRounds, ref, rng)) }
          : durationFromCtx(ctx);
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          duration: dur,
          maxWeaponHands: o.hands,
        });
        lines.push(t('op.maxWeaponHands', { name: target.label, hands: o.hands, src: ctx.label ?? 'sort' }));
        break;
      }
      case 'disarm': {
        // Main RÉSOLUE depuis la localisation du coup courant (convention DROITIER, `handAmputated`) ;
        // `corps`/absente (« au hasard l'un de vos deux bras ») → tirage aléatoire.
        const hand: 'main' | 'off' = ctx.location === 'brasG' ? 'off' : ctx.location === 'brasD' ? 'main' : rng.int(0, 1) === 0 ? 'main' : 'off';
        const lo = activeLoadout(target);
        const uid = hand === 'main' ? lo?.main : lo?.off;
        const held = uid ? (target.items ?? []).find((i) => i.uid === uid) : undefined;
        if (held && itemCapability(held, 'disarmImmune')) {
          // Poing de fer ogre (ADE II 02 l.694-698) : « solidement fixé... il ne pourra pas en être désarmé ».
          lines.push(t('op.disarmImmune', { name: target.label, item: held.label }));
        } else if (held && lo) {
          if (hand === 'main') lo.main = undefined; else lo.off = undefined;
          recomputeLoadout(target);
          lines.push(t('op.disarm', { name: target.label, item: held.label }));
        } else {
          lines.push(t('op.disarmNothing', { name: target.label }));
        }
        break;
      }
      case 'handGate': {
        // Main gatée résolue depuis la Localisation du coup (convention DROITIER partagée avec `disarm`) —
        // un Critique Main ensanglantée frappe toujours un bras (`brasG`/`brasD`) ; `corps`/absente → au hasard.
        const hand: 'main' | 'off' = ctx.location === 'brasG' ? 'off' : ctx.location === 'brasD' ? 'main' : rng.int(0, 1) === 0 ? 'main' : 'off';
        target.handGates = [...(target.handGates ?? []).filter((h) => h !== hand), hand];
        lines.push(t('op.handGate', { name: target.label }));
        break;
      }
      case 'senseLoss': {
        lines.push(t('op.senseLoss', { name: target.label, sense: o.sense === 'vue' ? 'un œil' : 'une oreille', src: ctx.label ?? 'séquelle' }));
        break;
      }
      case 'loseTurn':
        // `what` cible UNE des deux ressources (issue du choix du gate de Mandragore) ; absent = les deux.
        if (o.what !== 'movement') target.loseNextAction = true;
        if (o.what !== 'action') target.loseNextMovement = true;
        lines.push(t(o.what === 'action' ? 'op.loseAction' : o.what === 'movement' ? 'op.loseMovement' : 'op.loseTurn', { name: target.label }));
        break;
      case 'teamCommander':
        // Commandant d'équipe (AA) : pose le lien chef→commandant. La substitution effective du score est
        // re-dérivée à chaque tir (vivant + à portée de voix), pas figée ici — cf. `state/commandTeam`.
        target.teamCommanderId = o.commanderId;
        break;
      case 'weaponRollMod':
      case 'weaponDamageMod':
      case 'armourPierce':
      case 'critOnRoll':
      case 'offTerrainMod':
        // PASSIFS d'arme (Atouts/Défauts) lus PAR ID par `engine/qualities/dispatch` aux moments de combat —
        // INERTES dans le moteur d'ops (comme skillDRBonus/incomingAttackMod/attackKeyword/mitigateIncoming).
        // `offTerrainMod` : passif POSITIONNEL (Créature marine/Aquatique), lu par offTerrainMoveCap/TestDR.
        break;
      case 'spendAdvantage': {
        const who = ctx.caster ?? target;
        who.advantage = Math.max(0, (who.advantage ?? 0) - o.amount);
        break;
      }
      case 'ignoreAnimosity': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          duration: durationFromCtx(ctx),
          ignoreAnimosity: true,
        });
        break;
      }
      case 'intoxicate': {
        // Boisson alcoolisée (LDB 09 l.475) : un échec de Résistance à l'alcool → −10 aux CC/CT/Ag/Dex/Int,
        // Ivresse (1d10) au seuil BE. Le Test lui-même est le nœud `test` du Flow de consommable (branche fail).
        const be = bonus(effectiveChar(target, 'endurance'));
        const { log, drunkOps } = applyAlcoholTest(target, false, be, rng);
        lines.push(...log);
        // La MÉCANIQUE du résultat d'Ivresse (Bravoure/meilleur ami/belligérant, `drunkenness.json`)
        // est un `GameOp[]` — exécutée ICI (`effectId:'ivresse'` marque les ActiveEffect posés, retirés
        // en bloc par `soberUp`), pas dans `drunkenness.ts` (cycle d'import évité, cf. son en-tête).
        if (drunkOps?.length) lines.push(...applyOps(target, drunkOps, { ...ctx, effectId: 'ivresse' }));
        break;
      }
      case 'narrative':
        lines.push(o.text);
        break;
    }
  }
  flushCharMods();
  // Marque les effets actifs POSÉS par ce sort source (durables) : identité + NI → Dissipation (Sorts
  // seulement, `sourceSpell`) ET id du sort → anti-spam IA (TOUT lancement, Prières comprises, `sourceSpellId`)
  // ET id STABLE de l'effet en cours (`effectId` — transform/chansons de marin…, retrait par IDENTITÉ).
  if ((ctx.sourceSpell || ctx.sourceSpellId || ctx.effectId || ctx.source) && target.activeEffects) {
    for (const e of target.activeEffects) {
      if (preEffects!.has(e)) continue;
      if (ctx.sourceSpell && !e.spell) e.spell = ctx.sourceSpell;
      if (ctx.sourceSpellId && !e.sourceSpellId) e.sourceSpellId = ctx.sourceSpellId;
      if (ctx.effectId && !e.effectId) e.effectId = ctx.effectId;
      if (ctx.source && !e.source) e.source = ctx.source;
    }
  }
  return lines;
}
