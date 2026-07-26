/**
 * Corruption & mutations — Livre de base, chapitre 19 (p.184-187).
 *
 * Modèle : `Combatant.corruption` (Points de Corruption) + `Combatant.mutations`
 * (la DONNÉE persistée ; les effets mécaniques sont lus à la volée — effectiveChar,
 * testValue, effectiveMovement, recomputeLoadout — pour survivre au writeback de
 * fin de combat, comme les Traumatismes).
 *
 *  - Gains (l.30-75) : expositions mineure/modérée/majeure — Test de Résistance ou
 *    de Calme, Points selon le DR ; Sombre Pacte (l.16/41) : +1 Point volontaire
 *    pour relancer un Test, même après une relance de Chance.
 *  - Seuil (l.80) : corruption > BFM + BE → Test de Résistance Intermédiaire (+0)
 *    à CHAQUE nouveau gain ; échec → mutation.
 *  - Mutation (l.85-91) : −BFM Points, d100 corps/esprit PAR ESPÈCE, tirage sur le
 *    Tableau de Corruption physique ou mentale (src/data/mutations.ts, verbatim).
 *  - Limites (l.87) : mutations physiques > BE ou mentales > BFM → DAMNÉ (le
 *    personnage bascule dans le Chaos — hors-jeu définitif).
 */
import { Combatant, HitLocation } from './types';
import { RNG, defaultRNG } from './dice';
import { bonus, effectiveChar } from './characteristics';
import { talentCorruptionThreshold } from './combatFeatures/dispatch';
import { mutationBodyMaxForSpecies } from '../data';
import { rollObsession } from '../data/obsessions';
import { grantTrait, grantPsychTrait, removeGrantedTrait } from './grantedTraits';
import type { PsychType } from './psychology';
import type { GameOp } from './ops';

export type ExposureLevel = 'mineure' | 'moderee' | 'majeure';

export const EXPOSURE_LABELS: Record<ExposureLevel, string> = {
  mineure: 'mineure',
  moderee: 'modérée',
  majeure: 'majeure',
};

/** Échelle ORDONNÉE des Expositions (LDB 19 l.23-75), du plus léger au plus lourd — SOURCE UNIQUE du
 *  « cran » d'Influence corruptrice. */
export const EXPOSURE_LADDER: ExposureLevel[] = ['mineure', 'moderee', 'majeure'];

/** Atténue une Influence corruptrice de `steps` CRANS sur l'échelle (VDM 05 — Bouclier en acier doré :
 *  « réduit de 2 crans une Influence corruptrice (une Exposition Majeure en devient une Mineure par
 *  exemple) »). Sous le premier cran, l'Influence ne s'applique plus : `null`. `steps` ≤ 0 = inchangé. PUR. */
export function easeExposure(level: ExposureLevel, steps: number): ExposureLevel | null {
  if (steps <= 0) return level;
  const i = EXPOSURE_LADDER.indexOf(level) - steps;
  return i >= 0 ? EXPOSURE_LADDER[i] : null;
}

/** Crans d'atténuation d'Influence corruptrice portés par le combattant (op `corruptionExposure`
 *  `easeSteps` exécutée → `ActiveEffect.corruptionEase`). Σ des abris actifs. PUR. */
export function corruptionEaseSteps(c: Combatant): number {
  return (c.activeEffects ?? []).reduce((s, e) => s + (e.corruptionEase ?? 0), 0);
}

/** Alignement d'une SOURCE de Corruption (Puissance du Chaos) : si fourni, choisit la table EDOC
 *  à tirer pour la mutation, quelle que soit la règle globale ; sinon la règle `corruption-tables-edoc`
 *  décide. `toute` = Chaos non aligné (table EDOC élargie). */
export type ChaosAlign = 'toute' | 'khorne' | 'nurgle' | 'slaanesh' | 'tzeentch';

export const CHAOS_ALIGN_LABELS: Record<ChaosAlign, string> = {
  toute: 'Toute Puissance',
  khorne: 'Khorne',
  nurgle: 'Nurgle',
  slaanesh: 'Slaanesh',
  tzeentch: 'Tzeentch',
};

/** Mutation subie (donnée persistée ; cf. Tableaux LDB 19 p.184-185). */
export interface Mutation {
  /** `id` STABLE (slug) — clé de résolution runtime/données (registre, table de Corruption, rendu).
   *  « On ne se base plus sur le label » : le `label` ne sert qu'à l'affichage. */
  id: string;
  label: string;
  /** Description VERBATIM (LDB 19, colonne « Description Effet ») — affichage seul, jamais lue par le moteur.
   *  Les mutations n'ont pas de flavor en source : c'est donc le texte d'effet littéral du livre. */
  desc: string;
  kind: 'physique' | 'mentale';
  /** Jet d100 sur le tableau (traçabilité). */
  roll: number;
  /** TOUTE la mécanique de la mutation en `GameOp[]` — MÊME vocabulaire/éditeur (GameOpEditor) que
   *  traits et sorts : charMod/moveMod/skillMod/testMod (collecteur passif unifié engine/trauma) ;
   *  `ap` (armure naturelle, loc absent = toutes — lue par mutationArmourBonus) ; `grantNaturalWeapon`
   *  (arme de créature, lue par recomputeLoadout) ; `grantTrait` / `grantPsychTrait` (traits de créature
   *  et psychologiques conférés, posés par attachMutation). Plus aucun champ ad hoc. */
  passive?: GameOp[];
  /** Partie non modélisée de l'effet — verbatim, arbitrage MJ (rien d'inventé). */
  note?: string;
  /** Provenance livre/page — LDB 19 IMPLICITE si absent ; EXPLICITE pour les suppléments (EDO Appendice 2…). */
  source?: { book: string; page: number };
  /** Mutation PHYSIQUE sans manifestation CORPORELLE visible (Souffle du feu, Sang acide, Cri
   *  assourdissant…) : pas de calque rig attendu — déclaré explicitement (≠ visuel à dessiner). */
  nonVisual?: boolean;
  /** Pointeur de SOUS-TABLE (ex. « Tête bestiale » EDOC → re-tirer sur la sous-table Tête Bestiale) :
   *  `rollMutation` re-tire sur `${subTable}-${alignement}` (suffixe hérité de la table courante). */
  subTable?: string;
  /** Apparence COSMÉTIQUE déclarée en DONNÉE (calques du catalogue via `features` + `colors` + `eyes`) —
   *  fusionnée sur le rig quand la mutation est présente (cf. `combatantVisuals`). Type erased : le
   *  moteur ne la lit jamais (comme `Combatant.appearance` côté types). */
  appearance?: import('./authoringAppearance').EntityAppearance;
}

// ---------------------------------------------------------------------------
// Gains de Corruption (l.30-75)
// ---------------------------------------------------------------------------

/**
 * Points de Corruption gagnés à l'issue du Test de résistance à une exposition :
 *  - mineure (l.31) : échec → 1 ; succès → 0.
 *  - modérée (l.52) : échec → 2 ; Succès Minime (0-1 DR) → 1 ; Succès (2+) → 0.
 *  - majeure (l.65) : échec → 3 ; 0-1 DR → 2 ; 2-3 DR → 1 ; Impressionnant (4+) → 0.
 */
export function corruptionGain(level: ExposureLevel, success: boolean, dr: number): number {
  if (level === 'mineure') return success ? 0 : 1;
  if (level === 'moderee') return success ? (dr <= 1 ? 1 : 0) : 2;
  return success ? (dr <= 1 ? 2 : dr <= 3 ? 1 : 0) : 3;
}

/** Seuil « Corrompu » (l.80) : BFM + BE (+ niveau d'Âme pure, LDB 10 — « Vous pouvez gagner un nombre de
 *  Points de Corruption supplémentaires égal à votre niveau d'Âme pure avant d'avoir à effectuer un Test
 *  pour savoir si vous êtes corrompu »). SOURCE UNIQUE de la valeur (jauge de fiche + `corruptionThresholdExceeded`). */
export function corruptionThreshold(c: Combatant): number {
  return bonus(effectiveChar(c, 'force-mentale')) + bonus(effectiveChar(c, 'endurance')) + talentCorruptionThreshold(c);
}

/** Seuil « Corrompu » (l.80) : plus de Points de Corruption que BFM + BE. Talent Âme pure (LDB 10) :
 *  « Vous pouvez gagner un nombre de Points de Corruption supplémentaires égal à votre niveau d'Âme
 *  pure avant d'avoir à effectuer un Test pour savoir si vous êtes corrompu » → seuil +niveau. */
export function corruptionThresholdExceeded(c: Combatant): boolean {
  return (c.corruption ?? 0) > corruptionThreshold(c);
}

/** « PROFANE » au sens de la Protection de Phâ (LDB 48 p.249) : créature ayant le Trait Mort-vivant OU
 *  Démoniaque, OU porteuse de Mutations, OU dont la Corruption dépasse ses Bonus de FM + E combinés.
 *  Lue par la Zone sacrée (barrière d'entrée + Brisé aux profanes présents). */
export function isProfane(c: Combatant): boolean {
  const traits = c.traits ?? [];
  if (traits.some((t) => t.id === 'mort-vivant' || t.id === 'demoniaque')) return true;
  if ((c.mutations?.length ?? 0) > 0) return true;
  return (c.corruption ?? 0) > bonus(effectiveChar(c, 'force-mentale')) + bonus(effectiveChar(c, 'endurance'));
}

// ---------------------------------------------------------------------------
// Dissolution du corps et de l'esprit (l.82-91)
// ---------------------------------------------------------------------------

/**
 * Corps ou esprit, selon l'espèce (`id` STABLE) et le d100 (Tableau l.87-91) — le seuil par espèce
 * vit en DONNÉE (`SpeciesData.mutationBodyMax`, lu par `mutationBodyMaxForSpecies`), plus de match sur
 * le nom : Corps si d100 ≤ seuil, sinon Esprit. Seuils SOURCÉS : Elfe 0, Nain 5, Halfling 10, Humain 50
 * (LDB 19) ; Ogre 10 (ADE II « Ogres et Mutations ») ; Gnome 50 = Humain (NADJ « Gnomes et Corruption »).
 */
export function mutationKindFor(species: string | undefined, roll: number): 'physique' | 'mentale' {
  return roll <= mutationBodyMaxForSpecies(species) ? 'physique' : 'mentale';
}

/** Limites de Corruption (l.87) : mutations physiques > BE OU mentales > BFM → damné. */
export function mutationLimitExceeded(c: Combatant): boolean {
  const phys = (c.mutations ?? []).filter((m) => m.kind === 'physique').length;
  const ment = (c.mutations ?? []).filter((m) => m.kind === 'mentale').length;
  return phys > bonus(effectiveChar(c, 'endurance')) || ment > bonus(effectiveChar(c, 'force-mentale'));
}

/** Attache une mutation au personnage : donnée + traits dérivés (créature/psychologie). RNG seedable
 *  pour les Cibles TIRÉES (`argFrom:'obsessions'` — Haine sporadique / Terribles phobies, EDOC 12).
 *  `grantTrait`/`grantPsychTrait` (noyau PARTAGÉ `grantedTraits.ts`, ci-dessus importé) : MÊME chemin
 *  que l'op homonyme de `applyOps`, permanent (aucun `ActiveEffect` porteur — une mutation n'expire
 *  jamais). `grantTalent` reste local parce qu'une mutation doit apparaître sur la FICHE : il écrit
 *  `c.talents` (structurel, visible à l'avancement), là où l'op homonyme d'`applyOps` passe par
 *  `ActiveEffect.grantedTalent` — effectif de la même façon au combat (`featuresOf` lit les deux),
 *  mais invisible à la fiche. ⚠ La différence n'est PAS la durée : l'op est permanente elle aussi
 *  quand l'appelant ne fournit pas de durée (`durationFromCtx`). */
export function attachMutation(c: Combatant, m: Mutation, rng: RNG = defaultRNG): void {
  c.mutations = [...(c.mutations ?? []), m];
  for (const op of m.passive ?? []) {
    if (op.op === 'grantTrait') {
      // Valeur LITTÉRALE (les mutations RAW ont des indices fixes : Peur 3, Morsure +5).
      const value = typeof op.indice === 'number' ? op.indice : undefined;
      // Cible : littérale (`arg`), ou TIRÉE sur le Tableau des Obsessions (`argFrom:'obsessions'`,
      // « Haine sporadique » → Haine (Cible) déterminée par les Obsessions, EDOC 12).
      const arg = op.arg ?? (op.argFrom === 'obsessions' ? rollObsession(rng) : undefined);
      grantTrait(c, { id: op.traitId, ...(arg ? { arg } : {}), ...(value != null ? { value } : {}) });
    } else if (op.op === 'grantPsychTrait') {
      const cible = op.cible ?? (op.argFrom === 'obsessions' ? rollObsession(rng) : undefined);
      grantPsychTrait(c, op.psychType as PsychType, cible);
    } else if (op.op === 'grantTalent') {
      c.talents = [...(c.talents ?? []), { talentId: op.talentId, ...(op.spec ? { spec: op.spec } : {}), times: 1 }];
    }
  }
}

/** INVERSE structurel d'`attachMutation` : retire l'instance de `c.mutations` (ses passifs charMod/moveMod/
 *  ap/skillMod/grantNaturalWeapon/apparence — lus EN DIRECT sur `c.mutations` par passiveMods/le rig/le
 *  loadout — disparaissent avec elle) et RÉVERSE les grants STRUCTURELS posés à l'attache (Trait, Trait psy,
 *  Talent). Sert la mutation TEMPORISÉE de l'op `rollMutation` (Allure démoniaque « pour toute la durée du
 *  Sort », EDOC 13 l.276-277) ; le chemin CORRUPTION (corruptionFlow → `attachMutation` direct, sans effet
 *  actif porteur) reste PERMANENT, jamais détaché. Le loadout/PB dérivés se recalculent chez l'appelant
 *  (comme pour `attachMutation`). Mute `c`. */
export function detachMutation(c: Combatant, m: Mutation): void {
  const list = c.mutations ?? [];
  let i = -1;
  for (let k = list.length - 1; k >= 0; k--) if (list[k].id === m.id && (list[k].roll ?? null) === (m.roll ?? null)) { i = k; break; }
  if (i < 0) return;
  c.mutations = [...list.slice(0, i), ...list.slice(i + 1)];
  for (const op of m.passive ?? []) {
    if (op.op === 'grantTrait') {
      const value = typeof op.indice === 'number' ? op.indice : undefined;
      removeGrantedTrait(c, { id: op.traitId, ...(op.arg ? { arg: op.arg } : {}), ...(value != null ? { value } : {}) });
    } else if (op.op === 'grantPsychTrait') {
      const j = (c.psychTraits ?? []).findIndex((x) => x.type === op.psychType && (x.cible ?? '') === (op.cible ?? ''));
      if (j >= 0) c.psychTraits = [...c.psychTraits!.slice(0, j), ...c.psychTraits!.slice(j + 1)];
      if (c.psychTraits && !c.psychTraits.length) delete c.psychTraits;
    } else if (op.op === 'grantTalent') {
      const j = (c.talents ?? []).findIndex((x) => x.talentId === op.talentId && (x.spec ?? '') === (op.spec ?? ''));
      if (j >= 0) c.talents = [...c.talents!.slice(0, j), ...c.talents!.slice(j + 1)];
    }
  }
}

/** Détache les mutations portées par les ActiveEffect EXPIRÉS (op `rollMutation` temporisée) — MIROIR de
 *  `dropExpiredGrantedTraits`, appelé aux MÊMES coutures d'expiration (fin de Round / horloge / dissipation).
 *  Renvoie `true` si au moins une mutation a été détachée (→ l'appelant recalcule loadout/PB dérivés). */
export function dropExpiredGrantedMutations(c: Combatant, expired: { grantedMutation?: Mutation }[]): boolean {
  let dropped = false;
  for (const e of expired) if (e.grantedMutation) { detachMutation(c, e.grantedMutation); dropped = true; }
  return dropped;
}

// ---------------------------------------------------------------------------
// Lecture des effets (à la volée, comme les Traumatismes)
// ---------------------------------------------------------------------------

// charMods/Mouvement des mutations : lus DIRECT par le collecteur passif unifié (engine/trauma `passiveMods`
// → passiveCharSum/passiveMoveMod). Plus de helpers `mutationCharDelta`/`mutationMovementDelta` dédiés.

/** PA naturels de mutation à `loc` (Peau d'acier, Écailles épineuses, Cornes…) — op `ap` du `passive`
 *  (loc absent = toutes les Localisations) ; additifs. */
export function mutationArmourBonus(c: Combatant, loc: HitLocation): number {
  let d = 0;
  for (const m of c.mutations ?? []) for (const op of m.passive ?? []) {
    if (op.op === 'ap' && (op.loc == null || op.loc === loc)) d += typeof op.amount === 'number' ? op.amount : 0;
  }
  return d;
}

/** PA de mutation à `loc` marqués HORS Déviation Critique (op `ap` avec `noDeviation` — Écailles épineuses,
 *  EDO App.2 l.196). Calque `mutationArmourBonus` mais ne somme QUE ces PA — à soustraire pour le PA sacrifiable
 *  (`deviatableArmourAt`). Le Trait créature Armure (LDB 85) n'est PAS marqué → reste déviatable. */
export function nonDeviatableMutationAP(c: Combatant, loc: HitLocation): number {
  let d = 0;
  for (const m of c.mutations ?? []) for (const op of m.passive ?? []) {
    if (op.op === 'ap' && op.noDeviation === true && (op.loc == null || op.loc === loc)) {
      d += typeof op.amount === 'number' ? op.amount : 0;
    }
  }
  return d;
}

// Les mods de TEST des mutations (compétence nommée Groin poilu, ou char-qualifiés Visage inversé −20 Soc)
// sont désormais émis par le collecteur passif unifié (`passiveSkillSum`/`passiveTestMod`, engine/trauma).
