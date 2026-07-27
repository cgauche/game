export const CATEGORY_FILES: Record<string, string>;
export function loadCategoryIds(dataDir: string): Record<string, string[]>;
export function buildConsumerCorpus(dataDir: string, srcDir: string): string;
export function isConsumed(corpus: string, id: string): boolean;
export const META_CATALOG_ENTRIES: ReadonlySet<string>;
export interface FieldPredicateRecognized { category: string; loc: string; predicate: string; matched: string[] }
export interface FieldPredicateSkipped { category: string; loc: string; raw: string; reason: string }
export interface FieldPredicateConsumersResult {
  consumed: Map<string, Set<string>>;
  recognized: FieldPredicateRecognized[];
  skipped: FieldPredicateSkipped[];
}
export function computeFieldPredicateConsumers(dataDir: string, srcDir: string): FieldPredicateConsumersResult;
