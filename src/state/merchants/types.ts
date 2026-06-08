import type { Settlement } from '../../engine/disponibilite';

/** Archétype de marchand (#2) — 1 fichier `defs/` = 1 entrée du registre généré. */
export interface MerchantArchetypeDef {
  /** Clé unique (référencée par l'entité de scène `merchant.archetype`). */
  name: string;
  /** Libellé FR (UI). */
  label: string;
  /** Familles vendues : filtre le catalogue par `type` et/ou `subType` de trapping
   *  (« un herboriste ne vend pas d'arquebuses »). */
  category: { types?: string[]; subTypes?: string[] };
  /** Taille d'agglo par défaut (overridable par l'entité de scène). */
  settlement: Settlement;
  /** Taux de rachat : ½ du prix listé sur un Marchandage de vente GAGNÉ (LDB 60 l.22) ; sinon ¼ (resaleRate/2). */
  resaleRate: number;
  /** Majoration d'achat : multiplie le prix listé à l'ACHAT (1 = prix listé ; >1 = ce marchand vend plus cher,
   *  ex. village isolé/monopole). Défaut 1 si absent. */
  buyMarkup?: number;
  /** Valeur de Marchandage du marchand (opposant au Test, LDB 60 l.12). Défaut 40 si absent. */
  bargainSkill?: number;
  /** Articles garantis en stock (labels exacts), Disponibilité ignorée. */
  curated?: string[];
}
