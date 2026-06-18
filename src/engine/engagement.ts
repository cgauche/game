/**
 * État ENGAGÉ + bonus de Charge — Livre de base, « Combat » (13) et « Déplacement » (15).
 *
 * Engagé (13-Combat l.174-175) : « Quand vous attaquez un adversaire, ou que vous êtes
 * attaqué, en combat au Corps à corps, vous êtes Engagé. … Si vous n'attaquez pas l'autre
 * pendant un Round complet, vous n'êtes plus Engagé. » → relationnel, symétrique, purgé en
 * fin de Round si aucune attaque échangée. Tout vient de la Source (aucune invention).
 */
import { Combatant, Weapon } from './types';

/**
 * Portée d'ENGAGEMENT / d'attaque d'une arme de MÊLÉE, en CASES. RAW : LDB 62 l.211 (Allonge
 * « Très longue » → Engage jusqu'à 4 m) et l.213 (« Considérable » → 6 m), avec 1 case = 2 m
 * (LDB 15 l.55) → 2 et 3 cases. Toute autre Allonge (ou arme à distance / mains nues) = contact = 1.
 * L'Option « Longueur d'Arme » (LDB 62 l.215 : −10 à l'adversaire) est une règle optionnelle dont le
 * modificateur de Test vit dans combat.ts (`weaponReachPenalty`) ; l'engagement reste basé sur les cases. Pure.
 */
export function reachTiles(weapon: Weapon | null | undefined): number {
  if (!weapon || weapon.type !== 'melee') return 1;
  if (weapon.reach === 'Très longue') return 2;
  if (weapon.reach === 'Considérable') return 3;
  return 1;
}

/** Échelle d'Allonge des armes de mêlée (LDB 62), de la plus COURTE à la plus LONGUE. Sert à l'Option
 *  « Longueur d'Arme » (`weaponReachPenalty`, combat.ts). Allonge null/Variable/inconnue = « Moyenne ». */
export const REACH_ORDER = ['Personnelle', 'Très courte', 'Courte', 'Moyenne', 'Longue', 'Très longue', 'Considérable'] as const;

/** Rang d'Allonge d'une arme (index dans REACH_ORDER) ; défaut « Moyenne » si null/Variable/inconnu. */
export function reachRank(reach: string | null | undefined): number {
  const i = (REACH_ORDER as readonly string[]).indexOf(reach ?? '');
  return i >= 0 ? i : (REACH_ORDER as readonly string[]).indexOf('Moyenne');
}

/** Portée de mêlée d'un combattant = Allonge de son arme de mêlée employée (la 1ʳᵉ, comme `attackWeapon`).
 *  Source UNIQUE de l'éligibilité d'attaque de mêlée (héros, résolution, IA) → symétrie garantie. Pure. */
export function meleeReachTiles(weapons: Weapon[]): number {
  return reachTiles(weapons.find((w) => w.type === 'melee'));
}

export function isEngaged(c: Combatant): boolean {
  return (c.engagedWith?.length ?? 0) > 0;
}

export function isEngagedWith(a: Combatant, bId: string): boolean {
  return !!a.engagedWith?.includes(bId);
}

/** Pose Engagé symétriquement ET marque le coup échangé ce Round (les deux côtés).
 *  Idempotent (LDB 13-Combat l.174-175). À appeler sur TOUTE attaque de mêlée résolue
 *  (touche ou non : « ou que vous êtes attaqué » l.174). */
export function engage(a: Combatant, b: Combatant): void {
  for (const [x, y] of [
    [a, b],
    [b, a],
  ] as const) {
    x.engagedWith ??= [];
    x.meleeThisRound ??= [];
    if (!x.engagedWith.includes(y.id)) x.engagedWith.push(y.id);
    if (!x.meleeThisRound.includes(y.id)) x.meleeThisRound.push(y.id);
  }
}

/** Retire le lien Engagé A↔B des deux côtés (désengagement réussi, ou cible hors d'action). */
export function disengageFrom(a: Combatant, b: Combatant): void {
  if (a.engagedWith) a.engagedWith = a.engagedWith.filter((id) => id !== b.id);
  if (b.engagedWith) b.engagedWith = b.engagedWith.filter((id) => id !== a.id);
}

/** Retire `id` (combattant qui vient d'être neutralisé) de TOUS les liens d'Engagement, des deux côtés.
 *  À appeler DÈS qu'une cible tombe hors d'action : on ne reste pas Engagé avec une cible morte (LDB 13).
 *  Sans cela, l'Engagement avec le cadavre persisterait jusqu'au franchissement de Round (decayEngagement). */
export function clearEngagementOf(all: Combatant[], id: string): void {
  for (const c of all) {
    if (c.engagedWith?.length) c.engagedWith = c.engagedWith.filter((x) => x !== id);
  }
  const self = all.find((c) => c.id === id);
  if (self) self.engagedWith = [];
}

/** Fin de Round : lève l'Engagement d'une paire si AUCUNE mêlée n'a été échangée ce Round
 *  (LDB 13-Combat l.175), puis vide meleeThisRound. Engagé étant symétrique, un coup dans
 *  UN sens rafraîchit la paire dans les DEUX. Lit un instantané AVANT de muter (sinon la
 *  mutation de A→B casserait la lecture B→A). Purge aussi tout lien vers un combattant
 *  hors d'action (Blessures ≤ 0). */
export function decayEngagement(all: Combatant[]): void {
  const fresh = new Map<string, Set<string>>(all.map((c) => [c.id, new Set(c.meleeThisRound ?? [])]));
  const alive = new Set(all.filter((c) => c.wounds.current > 0).map((c) => c.id));
  for (const c of all) {
    if (c.engagedWith?.length) {
      c.engagedWith = c.engagedWith.filter((id) => alive.has(id) && (fresh.get(c.id)?.has(id) || fresh.get(id)?.has(c.id)));
    }
    c.meleeThisRound = [];
  }
}

/**
 * Bonus d'Avantage d'une Charge, en CASES (distance chebyshev départ→cible AVANT déplacement).
 * Lecture STRICTE (décision utilisateur 2026-06-10) : +1 UNIQUEMENT si la cible était « au moins à
 * une distance, en mètres, égale à votre caractéristique de Mouvement » (LDB 15-Dépl l.77), dans la
 * portée de Course. 1 case = 2 m (l.55) → seuil = ceil(M/2) cases ; Course = 2M cases (Tableau des
 * Mouvements l.61-72). La charge ARRIVE sur une case ADJACENTE à la cible : la case d'arrivée est à
 * 1 de moins que la cible, donc une charge valide va jusqu'à une distance-cible de 2M+1.
 */
export function chargeAdvantage(movementCases: number, distFromCases: number): 0 | 1 {
  const M = movementCases;
  if (distFromCases < 1 || distFromCases > M * 2 + 1) return 0;
  return distFromCases >= Math.ceil(M / 2) ? 1 : 0;
}
