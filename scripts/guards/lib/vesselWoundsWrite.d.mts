export interface Finding {
  line: number;
  detail: string;
}

export function stripComments(src: string): string;
export const VESSEL_WOUNDS_WRITE_RX: RegExp;
export function scanVesselWoundsWrite(relPath: string, contenu: string): Finding[];
export function countVesselWoundsWrite(relPath: string, contenu: string): number;
