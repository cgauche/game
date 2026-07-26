export type RegistryIdBranchRule = 'id-equality' | 'id-switch' | 'id-membership' | 'id-record';

export interface Finding {
  line: number;
  detail: string;
  rule: RegistryIdBranchRule;
}

export const SCAN_DIRS: string[];
export const SCAN_EXTS: string[];
export function isRegistryIdBranchExcluded(rel: string): boolean;
export function scanRegistryIdBranch(relPath: string, contenu: string): Finding[];
export function countRegistryIdBranch(rel: string, contenu: string): number;
