/**
 * Surface TYPÉE de `gen-registry.mjs` consommée par les gardes (`src/**​/*.test.ts`) — le générateur
 * reste écrit en `.mjs` (il tourne sous `node` nu, hors chaîne TS).
 */
export function verifieExhaustiviteDesIds(
  datasetsAIds: ReadonlySet<string>,
  familles?: ReadonlyMap<string, string>,
  defauts?: Readonly<Record<string, string>>,
): void;
export function idsDuDataset(racine: unknown, famille?: string): string[] | null;
export function genAll(verbose?: boolean): void;
