export interface Finding {
  line: number;
  detail: string;
}

export const ROLL_SEAM_RX: RegExp;
export function scanRollSeamExclusivity(relPath: string, contenu: string): Finding[];

/** Registre des chemins de jet (#1066) — famille (F) « fabrication d'un pending de jet ». */
export const PENDING_JET_RX: RegExp;
export function scanPendingJetFabrication(relPath: string, contenu: string): Finding[];

/** Registre des chemins de jet (#1066) — famille (D) « roulage délégué à un export de src/engine ». */
export function engineRollerExports(
  engineFiles: { rel: string; text: string }[],
): Map<string, { file: string; line: number }>;
export function engineHomonyms(
  engineFiles: { rel: string; text: string }[],
): Map<string, { files: string[]; rollsDirectly: boolean }>;
export function scanEngineDelegatedRoll(
  relPath: string,
  contenu: string,
  rollerNames: Iterable<string>,
): { line: number; name: string }[];
