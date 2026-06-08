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
  /** Taux de rachat (défaut 0.10 — non RAW, LDB 59 « achat/vente optionnels »). */
  resaleRate: number;
  /** Articles garantis en stock (labels exacts), Disponibilité ignorée. */
  curated?: string[];
}
