export interface NakedTimerFinding {
  line: number;
  call: string;
}
export function scanNakedTimers(content: string): NakedTimerFinding[];
export const SCAN_DIR: string;
export const ALLOWED: string[];
