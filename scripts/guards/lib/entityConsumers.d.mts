export const CATEGORY_FILES: Record<string, string>;
export function loadCategoryIds(dataDir: string): Record<string, string[]>;
export function buildConsumerCorpus(dataDir: string, srcDir: string): string;
export function isConsumed(corpus: string, id: string): boolean;
