export const ENGINE_ROOT: string;

export function fichiersMoteur(root?: string): string[];

export interface EngineExportRow {
  name: string;
  file: string;
  line: number;
  role: string | null;
  kind: 'function' | 'const' | 'class' | 'interface' | 'type' | 'enum';
}

export function fileExports(path: string): EngineExportRow[];

export function allEngineExports(root?: string): EngineExportRow[];
