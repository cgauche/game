export interface Finding {
  line: number;
  detail: string;
}

export const MUTATING_ARRAY_METHODS: Set<string>;
export function scanSceneMutation(relPath: string, contenu: string): Finding[];
