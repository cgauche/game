/**
 * POSTES D'ARTILLERIE d'un navire — placement & répartition (MDG ch.12 « Navires et construction navale »).
 * Couche STATE (le côté de montage est un `FireArc`, cf. fireArc.ts). RAW vérifié FR + VO (« Boats and
 * Boatbuilding ») : PAS de slots fixes — placement LIBRE, seule limite = le poids (Enc) des pièces sur un
 * « facing » vs la Contenance (`ship.capacity`). Le Sabord (Gun Port) est une Amélioration optionnelle qui
 * donne un couvert TOTAL au servant qui tire à travers (sinon tir depuis le pont, aucun couvert).
 */
import type { FireArc } from './fireArc';

/** Le poids (Enc) d'une pièce montée sur un bord donné — entrée du calcul de pénalité de répartition. */
export interface MountWeight {
  side: FireArc;
  weight: number;
}

/** Pénalité de placement appliquée au navire (M, Man, et DR aux Tests de Navigation). */
export interface PlacementPenalty {
  m: number;
  man: number;
  navDR: number;
}

/**
 * Pénalité de PLACEMENT des pièces (MDG ch.12 l.432-433 / VO l.315-317). Si le poids (Enc) des pièces sur
 * UN seul « facing » (proue/poupe/bâbord/tribord) dépasse 25 % de la Contenance → −1 M / −1 Man / −1 DR aux
 * Tests de Navigation ; >50 % → −2. Seuil STRICT ; la pénalité est le PIRE palier atteint par un seul bord
 * (non cumulatif entre les bords). PUR — `capacity` = `ship.capacity` (Contenance, déjà en donnée). */
export function placementPenalty(mounts: MountWeight[], capacity: number): PlacementPenalty {
  const bySide = new Map<FireArc, number>();
  for (const m of mounts) bySide.set(m.side, (bySide.get(m.side) ?? 0) + m.weight);
  const maxSide = Math.max(0, ...bySide.values());
  if (maxSide > capacity * 0.5) return { m: -2, man: -2, navDR: -2 };
  if (maxSide > capacity * 0.25) return { m: -1, man: -1, navDR: -1 };
  return { m: 0, man: 0, navDR: 0 };
}
