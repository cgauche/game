/**
 * Activités « Entre deux aventures » (LDB ch.23 + LDB 08) — calculs PURS, cités à la source :
 *
 *  - **Artisanat** (ch.23 l.65-92) : « Pour créer l'équipement, effectuez un Test étendu de
 *    Métier, dont la Difficulté est [fixée par] la Disponibilité de l'Équipement » (Commune
 *    Accessible +20 / Limitée Intermédiaire +0 / Rare Complexe −10 / Exotique Très difficile
 *    −30) ; « Le nombre nécessaire de DR » par prix courant (Bronze 5 / Argent 10 / Or 15+) ;
 *    « Chaque Défaut diminue de moitié le nombre de DR requis, et chaque Atout ajoute +5
 *    (ajouté après avoir appliqué les Défauts). »
 *  - **Apprentissage particulier** (ch.23 l.58-63) : « le prix pour apprendre le Talent est de
 *    2D10 pistoles d'argent par 100PX que coûte l'achat du Talent. »
 *  - **Opérations bancaires** (ch.23 l.154-165) : invest — « Lancez 1d100 : si le résultat est
 *    inférieur ou égal à votre Indice d'intérêts, l'entreprise a fait faillite » ; planque —
 *    « si le résultat est de 10 ou inférieur, votre planque a été découverte ».
 *  - **Revenus** = « Gagner de l'argent grâce au Statut » (LDB 08 l.130-144) : Bronze
 *    « 2d10 sous de cuivre » / Argent « 1d10 pistoles d'argent » / Or « 1 couronne d'or »
 *    PAR Standing ; « Sur un Échec, vous ne gagnez que la moitié de la somme. Sur un Échec
 *    Stupéfiant (-6) […] vous n'avez rien gagné. »
 */
import { RNG, defaultRNG, roll as rollDice } from './dice';
import { Money, fromBrass, toBrass, PA_PER_SC, PA_PER_CO } from './money';
import type { Combatant, Difficulty, SkillInstance } from './types';
import { trappings, talents, levelsForCareer, type TrappingData } from '../data';
import { talentSlotsUpTo, designationsFor, inCareerStatus, talentMaxReached, splitLabel } from './careerSlots';
import { talentCost } from './advancement';

export type PriceTier = 'bronze' | 'argent' | 'or';
export type Availability = 'Commune' | 'Limitée' | 'Rare' | 'Exotique';

const CRAFT_BASE_DR: Record<PriceTier, number> = { bronze: 5, argent: 10, or: 15 };
const CRAFT_DIFFICULTY: Record<Availability, Difficulty> = {
  Commune: 'accessible',
  Limitée: 'intermediaire',
  Rare: 'complexe',
  Exotique: 'tresDifficile',
};

/** Cible d'un Test étendu d'Artisanat : DR requis + Difficulté (ch.23 l.68-85). */
export function craftTarget(tier: PriceTier, avail: Availability, atouts: number, defauts: number): { dr: number; difficulty: Difficulty } {
  let dr = CRAFT_BASE_DR[tier];
  for (let i = 0; i < Math.max(0, defauts); i++) dr = Math.ceil(dr / 2); // « chaque Défaut diminue de moitié »
  dr += Math.max(0, atouts) * 5; // « chaque Atout ajoute +5 (après les Défauts) »
  return { dr: Math.max(1, dr), difficulty: CRAFT_DIFFICULTY[avail] };
}

/** Coût du tuteur d'Apprentissage particulier : 2d10 pa PAR tranche de 100 PX (ch.23 l.63). */
export function apprenticeshipTutorCost(talentXpCost: number, rng: RNG = defaultRNG): Money {
  const tranches = Math.max(1, Math.ceil(talentXpCost / 100));
  let pa = 0;
  for (let i = 0; i < tranches; i++) pa += rollDice(2, 10, rng);
  return fromBrass(pa * PA_PER_SC);
}

/** Retrait bancaire (ch.23 l.157-159) : `roll` = le 1d100 du retrait. */
export function bankWithdrawOutcome(kind: 'invest' | 'stash', rate: number, roll: number): 'ok' | 'lost' {
  if (kind === 'invest') return roll <= Math.max(1, Math.min(10, rate)) ? 'lost' : 'ok';
  return roll <= 10 ? 'lost' : 'ok';
}

/** Somme d'un dépôt récupéré avec intérêts (« les fonds de départ, plus les intérêts générés »,
 *  l.157 — taux = Indice %). La planque ne rapporte jamais d'intérêts (l.159). */
export function bankPayout(kind: 'invest' | 'stash', amountBrass: number, rate: number): number {
  if (kind === 'stash') return amountBrass;
  return amountBrass + Math.floor((amountBrass * Math.max(1, Math.min(10, rate))) / 100);
}

// ── Catalogues des Activités (pour des sélecteurs UI alimentés par la DONNÉE — fini la saisie
//    du libellé exact). Tout reste cité ; les arbitrages « jeu sans MJ » sont documentés. ──────

/** Compétence Métier (≥ 1 avance) du héros — porte d'entrée RAW de l'Artisanat (ch.23 l.66 :
 *  « si vous possédez les Compétences Métier appropriées »). */
export function metierOf(c: Combatant): SkillInstance | undefined {
  return c.skills.find((s) => s.skillId === 'metier' && (s.advances ?? 0) > 0);
}

/** Dérivation Artisanat d'un équipement : gamme de prix, Disponibilité jouable et matériaux.
 *  - matériaux = « un quart du prix de l'équipement » (ch.23 l.66) ;
 *  - Disponibilité ND/absente (objet jamais en vente) → Rare prudent (arbitrage documenté). */
/** Champ de prix de la donnée brute : nombre, ou texte non chiffré (« ND », « Variable », ''). */
const numPrice = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function craftSpecOf(t: Pick<TrappingData, 'price' | 'availability'>): {
  tier: PriceTier; avail: Availability; priceBrass: number; materialsBrass: number;
} {
  const price = { gold: numPrice(t.price?.gold), silver: numPrice(t.price?.silver), brass: numPrice(t.price?.bronze) };
  const priceBrass = toBrass(price);
  const a = t.availability;
  const avail: Availability = a === 'Commune' || a === 'Limitée' || a === 'Rare' || a === 'Exotique' ? a : 'Rare';
  return {
    tier: price.gold > 0 ? 'or' : price.silver > 0 ? 'argent' : 'bronze',
    avail,
    priceBrass,
    materialsBrass: Math.max(1, Math.floor(priceBrass / 4)),
  };
}

export interface CraftOption {
  label: string;
  /** Famille de données (melee/ranged/armor/trapping…) pour grouper le sélecteur. */
  type: string;
  tier: PriceTier;
  avail: Availability;
  priceBrass: number;
  materialsBrass: number;
  /** Cible du Test étendu SANS Atout/Défaut (la cible réelle se recalcule au choix). */
  dr: number;
  difficulty: Difficulty;
}

/** Catalogue d'Artisanat : « créer de l'équipement du Chapitre 11 » (ch.23 l.66) = tout
 *  équipement de la base à prix chiffré. L'adéquation du Métier à l'objet est laissée au MJ
 *  par le canon — jeu sans MJ : catalogue non restreint (le Métier reste requis), arbitrage
 *  documenté. Trié par famille puis prix croissant. */
export function craftCatalog(): CraftOption[] {
  return trappings
    .filter((t) => toBrass({ gold: numPrice(t.price?.gold), silver: numPrice(t.price?.silver), brass: numPrice(t.price?.bronze) }) > 0)
    .map((t) => {
      const spec = craftSpecOf(t);
      const target = craftTarget(spec.tier, spec.avail, 0, 0);
      return { label: t.label, type: t.type, ...spec, dr: target.dr, difficulty: target.difficulty };
    })
    .sort((a, b) => (a.type === b.type ? a.priceBrass - b.priceBrass : a.type.localeCompare(b.type)));
}

/** Fourchette du prix du tuteur (« 2D10 pistoles d'argent par 100PX », ch.23 l.63) — pour
 *  afficher le risque AVANT de s'engager (le tirage réel reste 2d10/tranche). */
export function tutorCostRange(talentXpCost: number): { minBrass: number; maxBrass: number } {
  const tranches = Math.max(1, Math.ceil(talentXpCost / 100));
  return { minBrass: tranches * 2 * PA_PER_SC, maxBrass: tranches * 20 * PA_PER_SC };
}

export interface LearnOption {
  label: string;
  /** Coût PX de la PROCHAINE acquisition (talentCost × fois déjà prises). */
  xpCost: number;
  tutorMinBrass: number;
  tutorMaxBrass: number;
}

/** Talents apprenables par Apprentissage particulier : « apprendre un Talent en dehors de
 *  votre Carrière » (ch.23 l.59) → exclut les talents offerts par la Carrière courante
 *  (jusqu'au Niveau atteint — eux s'achètent par l'Avancement) et ceux au Maxi (LDB 10). */
export function learnableTalents(hero: Combatant): LearnOption[] {
  const levels = levelsForCareer(hero.career ?? '');
  const slots = talentSlotsUpTo(levels, hero.careerLevel ?? 1);
  const desig = designationsFor(hero, hero.career ?? '');
  return talents
    .filter((t) => {
      const { name, spec } = splitLabel(t.label);
      if (inCareerStatus(slots, desig, name, spec) != null) return false; // de carrière → Avancement
      if (talentMaxReached(hero, t.label)) return false;
      return true;
    })
    .map((t) => {
      const xpCost = talentCost(hero.talents.find((k) => k.talentId === t.id)?.times ?? 0);
      const { minBrass, maxBrass } = tutorCostRange(xpCost);
      return { label: t.label, xpCost, tutorMinBrass: minBrass, tutorMaxBrass: maxBrass };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Catalogue de « Passer commande » (ch.23 l.167-172) : objets de rareté Exotique (ou jamais
 *  en vente — ND) à prix chiffré, payés à la commande. */
export function orderCatalog(): { label: string; type: string; priceBrass: number }[] {
  return trappings
    .filter((t) => (t.availability === 'Exotique' || t.availability === 'ND' || t.availability == null))
    .map((t) => ({ label: t.label, type: t.type, priceBrass: toBrass({ gold: numPrice(t.price?.gold), silver: numPrice(t.price?.silver), brass: numPrice(t.price?.bronze) }) }))
    .filter((t) => t.priceBrass > 0)
    .sort((a, b) => a.priceBrass - b.priceBrass);
}

/** Revenus d'une semaine de travail par Statut (LDB 08 l.135-144). */
export function statusIncome(
  tier: PriceTier,
  standing: number,
  rng: RNG = defaultRNG,
  outcome: 'success' | 'fail' | 'astoundingFail' = 'success',
): Money {
  if (outcome === 'astoundingFail') return fromBrass(0);
  let brass = 0;
  for (let i = 0; i < Math.max(0, standing); i++) {
    if (tier === 'bronze') brass += rollDice(2, 10, rng); // 2d10 sous de cuivre
    else if (tier === 'argent') brass += rollDice(1, 10, rng) * PA_PER_SC; // 1d10 pistoles
    else brass += PA_PER_CO; // 1 couronne d'or
  }
  if (outcome === 'fail') brass = Math.floor(brass / 2); // « la moitié de la somme »
  return fromBrass(brass);
}
