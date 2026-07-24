/** Règle ayant produit un finding : `label-logic` = les formes `.label` historiques (#142, tolérance
 *  ZÉRO) ; `collection-key` = `.label`/`.name` en clé de collection (#602) ; `display-key` = un champ
 *  d'AFFICHAGE interpolé dans une CLÉ (#598) ; `label-as-id-arg` = `.label` passé en ARGUMENT à un
 *  paramètre de déclaration nommé `id` (#142 LOT 5). */
export type LabelRule = 'label-logic' | 'collection-key' | 'display-key' | 'label-as-id-arg';

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
export function collectIdParamFunctions(contenu: string): Map<string, number>;
export function collectDeclaredNames(contenu: string): Set<string>;
export function scanLabelAsIdArg(relPath: string, contenu: string, idParamFns: Map<string, number>): Finding[];
export function isCorpusExcluded(rel: string): boolean;
export function collectIdParamFnsAcrossDirs(root: string, dirs: string[]): Map<string, number>;
export function effectiveIdParamFns(contenu: string, globalIdParamFns: Map<string, number>): Map<string, number>;
export const STRICT_DIRS: string[];
export const RATCHET_DIRS: string[];
export const RATCHET_EXCEPTIONS: Record<string, string>;
export function ratchetShortKey(finding: { rel: string; line: number }): string;
