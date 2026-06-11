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
import { Money, fromBrass, PA_PER_SC, PA_PER_CO } from './money';
import type { Difficulty } from './types';

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
