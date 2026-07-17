export function variantRulesOf(data: unknown): { key: string; rule: string }[];
export function unknownVariantRules(
  dataDir: string,
  knownRuleIds: ReadonlySet<string>,
): { key: string; file: string; rule: string }[];
