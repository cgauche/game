/** Règle ayant produit un finding : `label-logic` = les formes `.label` historiques (#142, tolérance
 *  ZÉRO) ; `display-key` = un champ d'AFFICHAGE (`label`/`name`) interpolé dans une CLÉ (#598). */
export type LabelRule = 'label-logic' | 'display-key';

export interface Finding {
  line: number;
  detail: string;
  rule: LabelRule;
}

export function stripComments(src: string): string;
export const BY_LABEL_RX: RegExp;
export const LABEL_EQ_RX: RegExp;
export const LABEL_PREDICATE_RX: RegExp;
export const LABEL_SWITCH_RX: RegExp;
export const DISPLAY_KEY_TEMPLATE_RX: RegExp;
export function scanLabelLogic(relPath: string, contenu: string): Finding[];
