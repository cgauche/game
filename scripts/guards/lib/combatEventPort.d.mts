export const QUARANTINED: string[];
export interface PortFinding {
  line: number;
  symbol: string;
}
export function scanCombatEventPort(contenu: string): PortFinding[];
