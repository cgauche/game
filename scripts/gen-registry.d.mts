/* eslint-disable no-irregular-whitespace */
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
/** Exports de premier niveau d'un def, lus à leur forme canonique — lève sur toute autre forme. */
export function lireExports(src: string, noms: readonly string[], def: string): Record<string, string | string[] | true | undefined>;
export function lireDefs(dir: string, noms: readonly string[]): ({ module: string } & Record<string, string | string[] | true | undefined>)[];
export function discriminantsDeclares(dir?: string): Map<string, string>;
export function marqueursDeclares(dir?: string): Map<string, string[]>;
export function idsParMarqueur(racine: unknown, champs: readonly string[], dataset: string): Record<string, string[]>;
