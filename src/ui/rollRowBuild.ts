/**
 * MONTEUR CANONIQUE d'une rangée de jet (#1262) — fonction PURE d'affichage : elle n'a ni store, ni
 * `Get`, ni RNG. Elle vit donc avec la donnée qu'elle monte (`RollRowData`, `RollShell.tsx`), pas dans
 * la couche `state` — le SURFAÇAGE (`rollSeam.surfaceOf`/`surfaceRow`/`bandStep`), lui, y reste.
 */
import type { Combatant } from '../engine/types';
import type { RollRowData } from './RollShell';
import type { PanelRowData } from './RollPanel';

/**
 * MARQUE d'origine d'une rangée d'affichage. La propriété est OPTIONNELLE : les monteurs canoniques la
 * posent, les 25 littéraux historiques ne la portent pas et restent assignables. V3 la rend obligatoire
 * (retrait du `?`) — « monter une rangée à la main » cesse alors de compiler.
 */
declare const ROLL_ROW_BRAND: unique symbol;

/** Rangée d'affichage MONTÉE par `buildRollRow`. */
export type BuiltRollRow = RollRowData & { readonly [ROLL_ROW_BRAND]?: true };

/** NOYAU d'une rangée MONO — les 11 champs que tout monteur de rangée remplit. Chance, relance
 *  gratuite et Résilience n'y sont PAS : elles se DÉRIVENT de `actor` une seule fois, au rendu
 *  (`RollRow`), au lieu d'être recopiées (et divergées) par chaque site. */
export interface RollRowCore {
  row: PanelRowData;
  /** Le jeteur — porte Chance/Résilience. Absent = rangée sans `Combatant` (vue pure, adversaire
   *  abstrait) : alors le site fournit lui-même les primitives via `extras`. */
  actor?: Combatant;
  onRoll?: () => void;
  rerollable?: boolean;
  onReroll?: () => void;
  darkPactable?: boolean;
  onDarkPact?: () => void;
  onBonusSL?: () => void;
  onForce?: () => void;
  forceShow?: boolean;
  freeReroll?: boolean;
}

/**
 * MONTEUR MONO — le noyau ci-dessus + les extras TYPÉS du site (`resist`, `reverse`, `extendedDr`,
 * `declare`, `forcedRoll`…). Il pose `rolled` depuis la donnée du jet (`row.d` existe ⇒ le dé est
 * tombé) : plus un site pour l'oublier ou le calculer autrement.
 */
export function buildRollRow(core: RollRowCore, extras?: Omit<RollRowData, keyof RollRowCore | 'rolled'>): BuiltRollRow {
  return { ...core, rolled: !!core.row.d, ...extras };
}
