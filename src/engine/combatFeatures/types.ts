import type { Combatant } from '../types';

/** Famille d'incantation conférée par un Talent de lanceur (LDB 10) — pilote l'apprentissage
 *  des sorts (grimoire.ts). Source UNIQUE du type, partagée avec `CasterTalent`. */
export type CastingKind = 'mineure' | 'arcane' | 'invocation' | 'beni' | 'chaos';

/** Contexte lecture seule d'un hook de capacité (level = times du talent / Indice du trait). */
export interface CombatFeatureCtx {
  combatant: Combatant;
  level: number;
  /** Spécialisation du talent (« Sans Peur (Vampires) » → « Vampires ») — absente sur un
   *  talent accordé par sort (op grantTalent) ou non spécialisé. */
  spec?: string;
}

/**
 * Une capacité de combat/de jeu conférée par un TALENT (LDB 10) — registre `defs/` généré
 * (gen-registry.mjs), même patron que `engine/qualities`. Chaque champ décrit UN effet écrit de la
 * source ; les helpers de `dispatch.ts` les agrègent et les consommateurs (combat.ts, combatFlow,
 * rollFlows, store) les appellent aux moments de jeu. `level` = nombre de fois pris (times).
 *
 * Les talents de CRÉATION (+5 carac., addSkill, Blessures/Chance/Détermination/Mouvement) restent
 * pilotés par les données via `talentEffects.ts` ; les talents NARRATIFS sont allowlistés par le
 * test de parité (`parity.test.ts`) — rien d'inventé.
 */
export interface CombatFeature {
  /** Nom FR canonique (clé de correspondance avec `Combatant.talents[].name`). */
  key: string;
  kind: 'talent' | 'trait';
  /** Transforme la pénalité de main secondaire (Ambidextre : -20 → -10/0, LDB 10). */
  modifyOffHandPenalty?: (penalty: number, ctx: CombatFeatureCtx) => number;
  /** Modes d'attaque ajoutés par la capacité (Maniement de deux armes → 'dual-wield'). */
  attackModes?: (ctx: CombatFeatureCtx) => string[];
  // ── Dégâts (× niveau) ──────────────────────────────────────────────────────
  /** Coup puissant : +niveau Dégâts avec les armes de Corps à corps. */
  meleeDamageBonus?: boolean;
  /** Tir précis : +niveau Dégâts avec les armes à distance. */
  rangedDamageBonus?: boolean;
  /** Combat déloyal : +niveau Dégâts avec Corps à corps (Bagarre). */
  brawlDamageBonus?: boolean;
  /** Charge berserk / Déterminé : +niveau Dégâts quand on Charge. */
  chargeDamageBonus?: boolean;
  /** Tueur : Bonus de Force = Bonus d'Endurance de la cible s'il est plus élevé. */
  slayer?: boolean;
  /** Robuste : réduit tous les Dégâts SUBIS de niveau (min 1 Blessure). */
  damageReduction?: boolean;
  /** Frappe blessante : +niveau Blessures quand on inflige une Blessure Critique. */
  critExtraWounds?: boolean;
  /** Tir sûr : ignore niveau PA de la cible au tir. */
  rangedAPIgnore?: boolean;
  // ── Modificateurs de Test d'attaque ────────────────────────────────────────
  /** Frappe assommante : pas de −10 de Localisation visée (Tête) avec une arme Assommante. */
  ignoreCalledShotHead?: boolean;
  /** Tir mortel : choisit la Localisation au tir — pas de −10 de Localisation visée à distance. */
  ignoreCalledShotRanged?: boolean;
  /** Tireur d'élite : ignore les modificateurs de Taille de la cible au tir. */
  ignoreSizeRangedMods?: boolean;
  /** Tireur embusqué : aucune pénalité à Longue portée, moitié à Portée extrême. */
  sniper?: boolean;
  // ── Initiative / économie d'action ─────────────────────────────────────────
  /** Combat instinctif : +10 × niveau à l'Initiative de combat. */
  initiativeBonus?: boolean;
  /** Tir rapide : tire hors de l'ordre d'Initiative si l'arme à distance est chargée (pré-emption gratuite). */
  strikeFirstRanged?: boolean;
  /** Vigilance : Test de Perception Intermédiaire (+0) pour ignorer la Surprise. */
  surpriseSave?: boolean;
  /** Rechargement rapide ('all') / Artilleur ('blackpowder') : +niveau DR aux Tests de rechargement. */
  reloadDR?: 'all' | 'blackpowder';
  /** Sprinter : Mouvement +1 quand on Court. */
  runBonus?: boolean;
  /** Fuite ! : Mouvement +1 quand on Fuit. */
  fleeBonus?: boolean;
  // ── Défense / Avantage ─────────────────────────────────────────────────────
  /** Porte-Bouclier : +niveau Avantage quand on se défend au Bouclier (défense gagnée). */
  shieldAdvantage?: boolean;
  /** Riposte : avec une arme Rapide, inflige des Dégâts en gagnant un Test opposé en défense. */
  riposte?: boolean;
  /** Renversement : en gagnant le Test opposé de Corps à corps, prend TOUS les Avantages adverses au lieu de +1. */
  stealAdvantage?: boolean;
  /** Maîtrise du combat : compte pour 1+niveau personnes au calcul du surnombre. */
  outnumberCount?: boolean;
  /** Mâchoires d'acier : Test de Résistance pour ignorer des États Sonné gagnés (1 + DR). */
  stunSave?: boolean;
  /** Cœur vaillant : tente de retirer le Brisé même Engagé (Calme en fin de Round). */
  braveheart?: boolean;
  /** Sans peur (LDB 10 l.859) : ignore Peur/Terreur de l'Ennemi spécifié (`ctx.spec` ; sans
   *  spec — talent ACCORDÉ par Flambeau de Vertu/Cœurs ardents — toutes sources). Le Test de
   *  Calme Accessible (+20) d'activation est supposé réussi (simplification documentée). */
  fearImmune?: boolean;
  /** Endurci : ignore niveau Points de Blessure perdus par l'État Hémorragique. */
  bleedIgnore?: boolean;
  // ── Magie / psychologie ────────────────────────────────────────────────────
  /** Résistance à la Magie (talent) : le DR des Sorts affectant le porteur est réduit de 2 × niveau. */
  magicResistance2?: boolean;
  /** Harmonisation aethyrique : pas d'Incantation Imparfaite sur un double RÉUSSI de Focalisation. */
  focusNoMiscastOnDouble?: boolean;
  /** Effrayant : le porteur a un Indice de Peur égal à son niveau. */
  causesFear?: boolean;
  // ── Tests hors combat ──────────────────────────────────────────────────────
  /** +niveau DR aux Tests de la Compétence qui matche (Menaçant → Intimidation…). */
  testDR?: { match: string };
  /** Inverse un Test RATÉ de la Compétence qui matche s'il devient réussi (Sociable → Ragot, Studieux →
   *  Recherche…). `capDR` plafonne le DR obtenu (Pansement de fortune +1). */
  reverseFailed?: { match: string; capDR?: number };
  // ── Économie / social ──────────────────────────────────────────────────────
  /** Négociateur (LDB 60 l.12) : un Marchandage GAGNÉ réduit le prix de 20 % (au lieu de 10 %) même
   *  sans Succès Stupéfiant (DR net ≥ 6). Lu par merchantFlow lors de la conclusion du Marchandage. */
  bargainBonus?: boolean;
  // ── Incantation (apprentissage des sorts — grimoire.ts) ──────────────────────
  /** Talent de lanceur (LDB 10) : famille d'incantation qu'il ouvre (Magie mineure → 'mineure',
   *  Magie des Arcanes → 'arcane', Invocation → 'invocation', Béni → 'beni', Magie du Chaos → 'chaos').
   *  La spécialisation (Domaine/Culte) est portée par `ctx.spec`. Remplace le name-match de grimoire. */
  castingKind?: CastingKind;
  /** Béni (LDB 41 l.14) : « reçoit les SIX Bénédictions de son culte » à l'acquisition (octroi
   *  automatique, pas un achat à 0 PX). Lu par talentEffects à l'acquisition. */
  grantsCultBlessings?: boolean;
}
