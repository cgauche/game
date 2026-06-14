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
import { addCondition, addTimedCondition, removeCondition, loseWounds, hasCondition } from './conditions';
import { groupMatch } from './groups';
import { grantTrait } from './grantedTraits';
import { cureDiseases, blessDiseaseDuration } from './rest';
import { cureCriticalWounds } from './trauma';
import { damageLeatherArmour, itemFromTrapping, customTrapping, newUid, recomputeLoadout } from './items';
import { suppressPsychTraits } from './psychology';
import { norm } from '../lib/normalize';
import { ConjureForm, conjureFormOptions, equipConjuredWeapon } from './conjuredWeapons';
import {
  ActiveEffect,
  ArmourBypass,
  CHAR_LABELS,
  CharKey,
  Combatant,
  Difficulty,
  DIFFICULTY_LABELS,
  HIT_LOCATION_LABELS,
  ItemInstance,
  Weapon,
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
  | { op: 'condition'; name: string; value?: Formula; durationRounds?: Formula; perRound?: boolean; valuePerSL?: PerSL; onlyGroups?: string[];
      /** Gates d'État (Sommeil, LDB 47 : « Si la cible possède un État À Terre, elle gagne
       *  Inconscient » / sinon « gagnant l'État À Terre ») : appliqué seulement si la cible
       *  porte (`onlyIfCondition`) / ne porte pas (`unlessCondition`) l'État nommé. */
      onlyIfCondition?: string; unlessCondition?: string }
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
  /** Points de Chance accordés (LDB 47 — « Les Signes d'Amul », « Que la chance persiste »,
   *  « Maître du Destin ») : incrément immédiat de `fortune` (peut dépasser le maximum — c'est un
   *  grant de Sort) ; `temporary` pose un effet actif qui RETIRE les points NON dépensés à
   *  l'expiration (rounds OU horloge, engine/grantedResources). `perSL` : « +1 par +2 DR ». */
  | { op: 'gainFortune'; amount: number; perSL?: PerSL; temporary?: boolean }
  /** Points de Destin accordés (LDB 47 — « Le Troisième Signe d'Amul »). `temporary` : retiré à
   *  l'expiration s'il n'est pas dépensé (cf. gainFortune). */
  | { op: 'gainFate'; amount: number; perSL?: PerSL; temporary?: boolean }
  /** Pénalité/blocage d'incantation temporisé (contrecoups, LDB 46/40) : −N à une
   *  Compétence de magie, Tests interdits, ou DR de Prière plafonné à 0. Durée en
   *  Rounds (combat + entretien hors combat) OU en minutes/jours d'horloge. */
  | { op: 'castPenalty'; skill: 'Prière' | 'Langue' | 'Focalisation' | 'all'; mod?: number; blocked?: boolean; maxZeroDR?: boolean; rounds?: Formula; minutes?: Formula; hours?: Formula; days?: Formula }
  /** Trait de créature TEMPORISÉ (Jalon 2.6 — « vous gagnez le Trait X tant que le Sort est
   *  actif ») : posé dans `c.traits` (vu par TOUS les consommateurs — dispatch, psy, IA,
   *  déplacement), retiré à l'expiration de l'ActiveEffect porteur. `indice` : Indice du trait
   *  (« Peur 1 », « Vol (Agilité) » → valeur du lanceur), `indicePerSL` : « +1 par +3 DR ». */
  | { op: 'grantTrait'; trait: string; indice?: Formula; indicePerSL?: PerSL; onlyGroups?: string[] }
  /** Talent TEMPORISÉ (Jalon 2.6 — « +1 Talent Sans peur tant que le Sort est actif ») : porté
   *  par l'ActiveEffect, lu par le registre `combatFeatures` (featuresOf) — PAS posé dans
   *  `c.talents` (fiche/avancement intacts). Seuls les talents AVEC def mécanique ont un effet. */
  | { op: 'grantTalent'; talent: string }
  /** Enchantement d'ARME temporisé (Jalon 2.6 — B. de Droiture : Magique ; Marteau ardent :
   *  Magique +BSoc + En flammes/À Terre à la touche ; Épée ardente : +6 + Percutante + En
   *  flammes). Porté par le PORTEUR (ActiveEffect.weaponEnchant), fusionné à l'arme à la
   *  résolution (`enchantedWeapon`). `damageBonus` résolu contre le LANCEUR (BSoc du prêtre). */
  | { op: 'enchantWeapon'; addQualities?: string[]; damageBonus?: Formula; bypass?: ArmourBypass; requiresWeapon?: string; onHitConditions?: { name: string; value?: number; onlyGroups?: string[] }[];
      /** Test à la touche gaté par Groupe (Épée de justice : Criminel → Inconscient ; Morsure de
       *  l'hiver : vivant → Sonné). La cible teste `skill`/`difficulty` ; ÉCHEC → `onFail`. */
      onHitTest?: { onlyGroups?: string[]; exceptGroups?: string[]; skill: string; difficulty: Difficulty; onFail: { name: string; value?: number }[] } }
  /** Purge de maladies (Amère catharsis, LDB 42) : retire `count` (+échelle DR) maladies. */
  | { op: 'cureDisease'; count?: number; countPerSL?: PerSL }
  /** −N jours sur la durée d'une maladie active (B. de Convalescence, LDB 41 — 1×/maladie). */
  | { op: 'reduceDiseaseDays'; days?: number }
  /** Les Blessures ne s'infecteront pas (Cautériser, LDB 47 → flag `woundDressed`, LDB 18 l.382). */
  | { op: 'preventInfection' }
  /** Guérit `count` (+échelle DR) Blessures critiques de convalescence — jamais une amputation
   *  (Larmes de Shallya, LDB 42). */
  | { op: 'cureCriticalWound'; count?: number; countPerSL?: PerSL }
  /** PB réduits à 0 + Inconscient (Châtiment, Tonnerre et foudre — LDB 40). `onlyGroups` : gaté par
   *  Groupe (Fauche-démon → cible Démoniaque seulement). */
  | { op: 'reduceToZero'; onlyGroups?: string[] }
  /** « Ne subit aucune pénalité causée par les États » (Endurance de l'anachorète, LDB 42) —
   *  drapeau d'effet actif lu par combatTestPenalty/testStatePenalty. */
  | { op: 'ignoreStatePenalties' }
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
  /** « Soumis aux règles de la Suffocation » (LDB 18 l.424-425 — Ombres étrangleuses,
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
  /** Martyr (LDB 42 — L13) : « Vous recevez tous les Dégâts subis en principe par vos cibles.
   *  […] votre Bonus d'Endurance est doublé pour le calcul des PB subis à cause de ces Dégâts. »
   *  — l'effet est posé sur LA CIBLE protégée, avec l'id du prêtre (ctx.caster). */
  | { op: 'martyr' }
  /** « N'a pas besoin de respirer et ignore les règles de suffocation » (B. de Souffle, LDB 41). */
  | { op: 'noBreath' }
  /** « N'a pas besoin de manger ou de boire » (Graisse de la terre, LDB 48) : exempte de la Faim
   *  (système de provisions) tant que le Sort dure. Lu par `dailyFoodUpkeep` (engine/provisions). */
  | { op: 'noHunger' }
  /** Modificateur GLOBAL à TOUS les Tests du porteur (Malédiction de malchance : −10) — porté par un
   *  effet actif, STACKE par-dessus les pénalités d'État. Lu par `combat/testStatePenalty`. */
  | { op: 'testMod'; amount: number }
  /** Immunité à l'EXPOSITION météo (froid/pluie/neige/tempête) tant que le Sort dure — Peau de loup
   *  d'hiver (Ulric), Protection contre la pluie. Lu par `exposureNight` (engine/exposure). */
  | { op: 'weatherWard' }
  /** Crée un objet (`trapping`) dans l'inventaire de la cible — nom RÉEL de la base → objet à stats,
   *  nom inconnu → objet CUSTOM (misc). Même vocabulaire que l'Effet de scène `giveTrapping`.
   *  Alimente tout sort qui DONNE du matériel : Rations (Générosité de Manann, Récolte de Rhya →
   *  système de provisions/Faim), etc. `count`/`perSL` : « +1 par +2 DR ». */
  | { op: 'giveTrapping'; trapping: string; count?: number; perSL?: PerSL }
  /** Invoque une arme MAGIQUE temporaire (Arme aethyrique : Dégâts = BFM ; Faux de Shyish : Arme
   *  d'hast, BFM+3 ; Épée ardente de Rhuin : Dégâts +6, Percutante). `damage` (résolue vs lanceur)
   *  + `damagePlus` (offset constant) donnent la composante chiffrée ; `plusBF` y ajoute le Bonus de
   *  Force (défaut : Dégâts FIXES, sans BF — conforme aux armes invoquées). L'objet invoqué est posé
   *  dans un SET d'armes DÉDIÉ actif (engine/conjuredWeapons.equipConjuredWeapon) puis retiré à
   *  l'expiration. `onHitConditions` : États infligés à la touche (Épée ardente → En flammes). */
  | { op: 'conjureWeapon'; name: string; damage: Formula; damagePlus?: number; plusBF?: boolean;
      qualities?: string[]; subType?: string; reach?: string; hands?: 1 | 2;
      onHitConditions?: { name: string; value?: number }[];
      /** SKIN cosmétique magique (token→hex, ex. lame aethyrique bleutée / améthyste / ardente) —
       *  propagé à `Weapon.skin` par recomputeLoadout, l'arme se rend recolorée (système d'objet unique). */
      skin?: Record<string, string>;
      /** Silhouette de RENDU (libellé d'arme du catalogue) pour les conjures à forme FIXE (Faux →
       *  « Hallebarde », Épée ardente → « Épée bâtarde ») — `chooseForm` la prend du choix du lanceur. */
      form?: string;
      /** Forme LIBRE (Arme aethyrique) : le lanceur choisit l'arme → `ctx.conjureForm` clone le profil
       *  (Groupe/allonge/mains) d'une arme RÉELLE de la base ; sinon stats fixes du Sort. */
      chooseForm?: boolean }
  /** Accorde une ARME NATURELLE (Dent et griffe : Morsure BF+3 / Arme BF+4 ; Incarnation de Wyssan) :
   *  attaque ADDITIONNELLE de mêlée injectée dans `c.weapons` (recomputeLoadout), retirée à
   *  l'expiration. Dégâts SB-relatifs par défaut (`+BF+`+damage), `qualities` (Magique…) portés. */
  | { op: 'grantNaturalWeapon'; name: string; damage: Formula; damagePlus?: number; plusBF?: boolean; qualities?: string[] }
  /** Effet RÉCURRENT multi-Rounds : pose un effet actif porteur qui re-joue `ops` à CHAQUE fin de
   *  Round tant que le sort dure (`ctx.defaultDurationRounds`, Surincantation de Durée incluse —
   *  LDB 47). Généralise l'ancien « État par Round » : 1 Ration/Round (Récolte de Rhya), 1 État
   *  X/Round (malédictions). Les `ops` internes sont résolues MAINTENANT (valeurs littérales) puis
   *  ré-appliquées telles quelles — pas de dépendance au lanceur à chaque tick. */
  | { op: 'perRound'; ops: GameOp[] }
  /** Effet non modélisé : journalisé verbatim, arbitrage MJ (rien d'inventé). */
  | { op: 'narrative'; text: string };

export interface OpsCtx {
  rng?: RNG;
  /** Référent des formules « (Bonus de X) » (le lanceur d'un sort) ; défaut : la cible. */
  caster?: Combatant;
  /** Forme choisie par le lanceur pour une arme invoquée à forme libre (op `conjureWeapon` +
   *  `chooseForm`) — fixe Groupe/allonge/mains. Défaut (absent) : la 1ʳᵉ forme proposée. */
  conjureForm?: ConjureForm;
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
/** Pose un effet actif porteur d'ops RÉCURRENTES (re-jouées chaque fin de Round par `endOfRound`).
 *  Durée = celle du sort (`ctx.defaultDurationRounds`), Surincantation de Durée incluse. Les `ops`
 *  doivent être round-safe (valeurs littérales) — pas de résolution de formule/`perSL` au tick. */
function pushPerRound(target: Combatant, ops: GameOp[], ctx: OpsCtx): void {
  target.activeEffects = target.activeEffects ?? [];
  target.activeEffects.push({
    label: ctx.label ?? 'Effet', bonus: 0,
    roundsLeft: ctx.defaultDurationRounds ?? COMBAT_PERSIST,
    ...(ctx.defaultUntilTime != null ? { untilTime: ctx.defaultUntilTime } : {}),
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
        // Gates d'État (Sommeil, LDB 47) : l'op ne s'applique que si la cible porte / ne porte pas l'État.
        if (o.onlyIfCondition && !hasCondition(target, o.onlyIfCondition)) break;
        if (o.unlessCondition && hasCondition(target, o.unlessCondition)) break;
        const v = Math.max(1, resolveFormula(o.value ?? 1, ref, rng) + slBonus(ctx.sl, o.valuePerSL));
        if (o.perRound) {
          // État récurrent = cas particulier de l'effet récurrent général (op `perRound`) : la
          // valeur est figée maintenant, l'op `condition` littérale est re-jouée chaque fin de Round.
          pushPerRound(target, [{ op: 'condition', name: o.name, value: v }], ctx);
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
      case 'gainFortune': {
        const n = Math.max(0, o.amount + slBonus(ctx.sl, o.perSL));
        if (n <= 0) break;
        target.fortune = (target.fortune ?? 0) + n;
        if (o.temporary) {
          target.activeEffects = target.activeEffects ?? [];
          target.activeEffects.push({
            label: ctx.label ?? 'Effet', bonus: 0,
            roundsLeft: ctx.defaultDurationRounds ?? COMBAT_PERSIST,
            ...(ctx.defaultUntilTime != null ? { untilTime: ctx.defaultUntilTime } : {}),
            grantedFortune: n,
          });
        }
        lines.push(`${target.name} : +${n} Point${n > 1 ? 's' : ''} de Chance${o.temporary ? ' (le temps du Sort)' : ''} (total ${target.fortune}).`);
        break;
      }
      case 'gainFate': {
        const n = Math.max(0, o.amount + slBonus(ctx.sl, o.perSL));
        if (n <= 0) break;
        target.fate = (target.fate ?? 0) + n;
        if (o.temporary) {
          target.activeEffects = target.activeEffects ?? [];
          target.activeEffects.push({
            label: ctx.label ?? 'Effet', bonus: 0,
            roundsLeft: ctx.defaultDurationRounds ?? COMBAT_PERSIST,
            ...(ctx.defaultUntilTime != null ? { untilTime: ctx.defaultUntilTime } : {}),
            grantedFate: n,
          });
        }
        lines.push(`${target.name} : +${n} Point${n > 1 ? 's' : ''} de Destin${o.temporary ? ' (le temps du Sort)' : ''} (total ${target.fate}).`);
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
        if (!groupGate(o.onlyGroups)) break; // « les Mort-vivant/Démoniaque gagnent Instable » (Bannissement)
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
      case 'enchantWeapon': {
        const dmg = o.damageBonus != null ? Math.max(0, resolveFormula(o.damageBonus, ref, rng)) : undefined;
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          roundsLeft: ctx.defaultDurationRounds ?? COMBAT_PERSIST,
          ...(ctx.defaultUntilTime != null ? { untilTime: ctx.defaultUntilTime } : {}),
          weaponEnchant: {
            ...(o.addQualities?.length ? { addQualities: o.addQualities } : {}),
            ...(dmg ? { damageBonus: dmg } : {}),
            ...(o.bypass != null ? { bypass: o.bypass } : {}),
            ...(o.requiresWeapon ? { requiresWeapon: o.requiresWeapon } : {}),
            ...(o.onHitConditions?.length ? { onHitConditions: o.onHitConditions } : {}),
            ...(o.onHitTest ? { onHitTest: o.onHitTest } : {}),
          },
        });
        const parts = [
          ...(o.addQualities ?? []),
          ...(dmg ? [`+${dmg} Dégâts`] : []),
          ...(o.onHitConditions ?? []).map((x) => `${x.name} à la touche`),
          ...(o.onHitTest ? [`${o.onHitTest.onFail.map((c) => c.name).join('/')} à la touche (Test de ${o.onHitTest.skill})`] : []),
        ];
        lines.push(`${target.name} : son arme est enchantée — ${parts.join(', ')} (${ctx.label ?? 'sort'}).`);
        break;
      }
      case 'cureDisease': {
        const n = Math.max(0, (o.count ?? 1) + slBonus(ctx.sl, o.countPerSL));
        const cured = cureDiseases(target, n);
        lines.push(...(cured.length ? cured : [`${target.name} n'a aucune maladie à purger.`]));
        break;
      }
      case 'reduceDiseaseDays': {
        lines.push(...blessDiseaseDuration(target, o.days ?? 1));
        break;
      }
      case 'preventInfection': {
        target.woundDressed = true; // pas d'Infection post-critique (LDB 18 l.382)
        lines.push(`${target.name} : ses blessures ne s'infecteront pas (${ctx.label ?? 'sort'}).`);
        break;
      }
      case 'cureCriticalWound': {
        const n = Math.max(0, (o.count ?? 1) + slBonus(ctx.sl, o.countPerSL));
        const cured = cureCriticalWounds(target, n);
        lines.push(...(cured.length ? cured : [`${target.name} n'a aucune Blessure critique guérissable (les amputations sont hors d'atteinte).`]));
        break;
      }
      case 'grantTalent': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          roundsLeft: ctx.defaultDurationRounds ?? COMBAT_PERSIST,
          ...(ctx.defaultUntilTime != null ? { untilTime: ctx.defaultUntilTime } : {}),
          grantedTalent: o.talent,
        });
        lines.push(`${target.name} gagne le Talent ${o.talent} (${ctx.label ?? 'sort'}).`);
        break;
      }
      case 'reduceToZero': {
        if (!groupGate(o.onlyGroups)) break; // Fauche-démon : n'annihile qu'une cible Démoniaque
        target.wounds.current = 0;
        addCondition(target, 'Inconscient');
        lines.push(`${target.name} : Blessures réduites à 0 (Inconscient).`);
        break;
      }
      case 'ignoreStatePenalties': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          roundsLeft: ctx.defaultDurationRounds ?? COMBAT_PERSIST,
          ...(ctx.defaultUntilTime != null ? { untilTime: ctx.defaultUntilTime } : {}),
          ignoreStatePenalties: true,
        });
        lines.push(`${target.name} ne subit plus aucune pénalité d'État (${ctx.label ?? 'sort'}).`);
        break;
      }
      case 'freeReroll': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          roundsLeft: ctx.defaultDurationRounds ?? COMBAT_PERSIST,
          ...(ctx.defaultUntilTime != null ? { untilTime: ctx.defaultUntilTime } : {}),
          freeReroll: true,
        });
        lines.push(`${target.name} pourra relancer le prochain Test auquel il échoue (${ctx.label ?? 'sort'}).`);
        break;
      }
      case 'critTwice': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          roundsLeft: ctx.defaultDurationRounds ?? COMBAT_PERSIST,
          ...(ctx.defaultUntilTime != null ? { untilTime: ctx.defaultUntilTime } : {}),
          critRollTwice: true,
        });
        lines.push(`${target.name} : ses Blessures Critiques infligées tireront deux lancers — le meilleur conservé (${ctx.label ?? 'sort'}).`);
        break;
      }
      case 'damageArmour': {
        const loc = damageLeatherArmour(target);
        lines.push(loc
          ? `${target.name} : le cuir de son armure se racornit — −1 PA (${HIT_LOCATION_LABELS[loc]}).`
          : `${target.name} ne porte pas de cuir à pourrir (autres matières organiques : arbitrage MJ).`);
        break;
      }
      case 'suppressPsych': {
        const suppressed = suppressPsychTraits(target);
        if (!suppressed) {
          lines.push(`${target.name} n'a aucun Trait psychologique à apaiser.`);
          break;
        }
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          roundsLeft: ctx.defaultDurationRounds ?? COMBAT_PERSIST,
          ...(ctx.defaultUntilTime != null ? { untilTime: ctx.defaultUntilTime } : {}),
          suppressedPsych: suppressed,
        });
        lines.push(`${target.name} : Traits psychologiques apaisés pour la durée (${ctx.label ?? 'sort'}).`);
        break;
      }
      case 'suffocate': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          roundsLeft: ctx.defaultDurationRounds ?? COMBAT_PERSIST,
          ...(ctx.defaultUntilTime != null ? { untilTime: ctx.defaultUntilTime } : {}),
          suffocates: true,
        });
        lines.push(`${target.name} suffoque (${ctx.label ?? 'sort'}) — −1 PB par Round.`);
        break;
      }
      case 'noHunger': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          roundsLeft: ctx.defaultDurationRounds ?? COMBAT_PERSIST,
          ...(ctx.defaultUntilTime != null ? { untilTime: ctx.defaultUntilTime } : {}),
          noHunger: true,
        });
        lines.push(`${target.name} n'a plus besoin de manger ni de boire (${ctx.label ?? 'sort'}).`);
        break;
      }
      case 'testMod': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          roundsLeft: ctx.defaultDurationRounds ?? COMBAT_PERSIST,
          ...(ctx.defaultUntilTime != null ? { untilTime: ctx.defaultUntilTime } : {}),
          testMod: o.amount,
        });
        lines.push(`${target.name} : ${o.amount >= 0 ? '+' : ''}${o.amount} à tous les Tests (${ctx.label ?? 'sort'}).`);
        break;
      }
      case 'noBreath': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          roundsLeft: ctx.defaultDurationRounds ?? COMBAT_PERSIST,
          ...(ctx.defaultUntilTime != null ? { untilTime: ctx.defaultUntilTime } : {}),
          noBreath: true,
        });
        lines.push(`${target.name} n'a plus besoin de respirer (${ctx.label ?? 'sort'}).`);
        break;
      }
      case 'weatherWard': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          roundsLeft: ctx.defaultDurationRounds ?? COMBAT_PERSIST,
          ...(ctx.defaultUntilTime != null ? { untilTime: ctx.defaultUntilTime } : {}),
          weatherImmune: true,
        });
        lines.push(`${target.name} est protégé des intempéries (${ctx.label ?? 'sort'}).`);
        break;
      }
      case 'giveTrapping': {
        const n = Math.max(1, (o.count ?? 1) + slBonus(ctx.sl, o.perSL));
        target.items = target.items ?? [];
        for (let i = 0; i < n; i++) target.items.push(itemFromTrapping(o.trapping) ?? customTrapping(o.trapping));
        lines.push(`${target.name} obtient ${n > 1 ? `${n}× ` : ''}${o.trapping} (${ctx.label ?? 'sort'}).`);
        break;
      }
      case 'perRound': {
        pushPerRound(target, o.ops, ctx);
        break;
      }
      case 'grantNaturalWeapon': {
        const n = Math.max(0, resolveFormula(o.damage, ref, rng) + (o.damagePlus ?? 0));
        const plusBF = o.plusBF !== false; // attaques naturelles = SB-relatives par défaut
        const weapon: Weapon = {
          name: o.name, type: 'melee', damage: plusBF ? `+BF+${n}` : `+${n}`,
          qualities: [...(o.qualities ?? [])], hands: 1, uid: `nat-${norm(o.name)}-${newUid()}`,
        };
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? o.name, bonus: 0,
          roundsLeft: ctx.defaultDurationRounds ?? COMBAT_PERSIST,
          ...(ctx.defaultUntilTime != null ? { untilTime: ctx.defaultUntilTime } : {}),
          naturalWeapon: weapon,
        });
        recomputeLoadout(target);
        lines.push(`${target.name} gagne l'attaque naturelle ${o.name} (Dégâts ${weapon.damage}${weapon.qualities.length ? `, ${weapon.qualities.join(', ')}` : ''}) (${ctx.label ?? 'sort'}).`);
        break;
      }
      case 'conjureWeapon': {
        const flat = Math.max(0, resolveFormula(o.damage, ref, rng) + (o.damagePlus ?? 0));
        const dmg = o.plusBF ? `+BF+${flat}` : `+${flat}`;
        // Forme LIBRE (Arme aethyrique) : on CLONE le profil (Groupe/allonge/mains) d'une arme RÉELLE
        // choisie par le lanceur (ctx.conjureForm, défaut = sa meilleure Spé de CC) ; sinon stats du
        // Sort. Seuls les Dégâts (= BFM…) et les Atouts du Sort surchargent le profil → un OBJET ordinaire.
        const form = o.chooseForm ? (ctx.conjureForm ?? conjureFormOptions(ref)[0]) : null;
        const tpl = form ? itemFromTrapping(form.weapon) : null;
        const item: ItemInstance = {
          uid: `conjure-${newUid()}`,
          name: form ? `${o.name} (${tpl?.name ?? form.weapon})` : o.name,
          kind: 'melee',
          damage: dmg,
          subType: form ? tpl?.subType : o.subType,
          reach: form ? tpl?.reach : (o.reach ?? null),
          hands: form ? (tpl?.hands ?? 1) : (o.hands ?? 1),
          qualities: [...(o.qualities ?? [])], // Atouts du Sort (Magique, Percutante) — PAS ceux du gabarit
          enc: 0,
          equipped: false, // hors Set I/II auto : l'objet vit dans son SET dédié (equipConjuredWeapon)
          conjured: true,
          ...(o.skin ? { skin: o.skin } : {}), // teinte magique unique (aethyrique/améthyste/ardente)
          // Silhouette de rendu : forme choisie (chooseForm) ou silhouette fixe du Sort → le rig dessine
          // l'arme réelle bien que nommée « Arme aethyrique » / « Faux de Shyish ».
          ...(form ? { form: form.weapon } : o.form ? { form: o.form } : {}),
        };
        // SET d'armes DÉDIÉ rendu actif (réutilise les loadouts) — le joueur peut rebasculer sur ses
        // armes ; à l'expiration, le set d'origine est restauré (engine/conjuredWeapons).
        const conjuredSet = equipConjuredWeapon(target, item);
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? o.name, bonus: 0,
          roundsLeft: ctx.defaultDurationRounds ?? COMBAT_PERSIST,
          ...(ctx.defaultUntilTime != null ? { untilTime: ctx.defaultUntilTime } : {}),
          conjuredSet,
          ...(o.onHitConditions?.length ? { weaponEnchant: { requiresWeapon: o.name, onHitConditions: o.onHitConditions } } : {}),
        });
        lines.push(`${target.name} invoque ${item.name} (Dégâts ${dmg}${item.qualities.length ? `, ${item.qualities.join(', ')}` : ''}) (${ctx.label ?? 'sort'}).`);
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
          roundsLeft: ctx.defaultDurationRounds ?? COMBAT_PERSIST,
          ...(ctx.defaultUntilTime != null ? { untilTime: ctx.defaultUntilTime } : {}),
          castWard: { radiusMeters: radius },
        });
        lines.push(`${target.name} : les Sorts visant la zone (${radius} m) subissent −20 en Langue (Magick) (${ctx.label ?? 'sort'}).`);
        break;
      }
      case 'arrowWard': {
        const radius = Math.max(0, resolveFormula(o.radius, ref, rng));
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          roundsLeft: ctx.defaultDurationRounds ?? COMBAT_PERSIST,
          ...(ctx.defaultUntilTime != null ? { untilTime: ctx.defaultUntilTime } : {}),
          arrowWard: { radiusMeters: radius },
        });
        lines.push(`${target.name} : les projectiles organiques entrant dans la zone (${radius} m) sont détruits (${ctx.label ?? 'sort'}).`);
        break;
      }
      case 'domeWard': {
        const radius = Math.max(0, resolveFormula(o.radius, ref, rng));
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          roundsLeft: ctx.defaultDurationRounds ?? COMBAT_PERSIST,
          ...(ctx.defaultUntilTime != null ? { untilTime: ctx.defaultUntilTime } : {}),
          domeWard: { radiusMeters: radius },
        });
        lines.push(`${target.name} : un dôme (${radius} m) protège la zone — Protection (6+) contre les attaques extérieures à distance/magiques (${ctx.label ?? 'sort'}).`);
        break;
      }
      case 'attackWardFM': {
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          roundsLeft: ctx.defaultDurationRounds ?? COMBAT_PERSIST,
          ...(ctx.defaultUntilTime != null ? { untilTime: ctx.defaultUntilTime } : {}),
          attackWardFM: true,
        });
        lines.push(`${target.name} : l'attaquer exige un Test de Force Mentale Accessible (+20) (${ctx.label ?? 'sort'}).`);
        break;
      }
      case 'martyr': {
        if (!ctx.caster) {
          lines.push(`${target.name} : Martyr sans prêtre identifié — arbitrage MJ.`);
          break;
        }
        target.activeEffects = target.activeEffects ?? [];
        target.activeEffects.push({
          label: ctx.label ?? 'Effet', bonus: 0,
          roundsLeft: ctx.defaultDurationRounds ?? COMBAT_PERSIST,
          ...(ctx.defaultUntilTime != null ? { untilTime: ctx.defaultUntilTime } : {}),
          martyrGuard: ctx.caster.id,
        });
        lines.push(`${ctx.caster.name} recevra les Dégâts subis par ${target.name} (${ctx.label ?? 'sort'}).`);
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
