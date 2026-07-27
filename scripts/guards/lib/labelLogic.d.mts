/** Règle ayant produit un finding : `label-logic` = les formes `.label` historiques (#142, tolérance
 *  ZÉRO) ; `collection-key` = `.label`/`.name` en clé de collection (#602) ; `display-key` = un champ
 *  d'AFFICHAGE interpolé dans une CLÉ (#598) ; `label-as-id-arg` = `.label` passé en ARGUMENT à un
 *  paramètre de déclaration nommé `id` (#142 LOT 5). */
export type LabelRule = 'label-logic' | 'collection-key' | 'display-key' | 'label-as-id-arg';

/** Règle du scan des libellés HORS champ `label` (#142 LOT 7) : `label-literal` = égalité entre une
 *  valeur de champ (ou son alias) et un littéral de libellé ; `label-switch` = même aiguillage en
 *  `switch` ; `label-record` = table indexée par des libellés. */
export type LabelLiteralRule = 'label-literal' | 'label-switch' | 'label-record';

export interface Finding {
  line: number;
  detail: string;
  rule: LabelRule;
}

export interface LabelLiteralFinding {
  line: number;
  detail: string;
  rule: LabelLiteralRule;
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
export function isLabelLiteral(text: string): boolean;
export function scanLabelLiteralCompare(relPath: string, contenu: string): LabelLiteralFinding[];
export const LABEL_LITERAL_STOCK: Readonly<Record<string, number>>;
export function labelLiteralStockDrift(measured: Map<string, number> | Record<string, number>): string[];

/** Finding d'appel à un résolveur d'entité par libellé (#909), depuis `src/engine`/`src/state`. */
export interface LabelResolverCallFinding {
  line: number;
  detail: string;
  rule: 'label-entity-resolver-call';
  fn: string;
}
export function collectLabelEntityResolvers(contenu: string): Set<string>;
export function labelEntityResolverNames(root: string): Set<string>;
export function scanLabelResolverCalls(relPath: string, contenu: string, resolverNames: Set<string>): LabelResolverCallFinding[];
