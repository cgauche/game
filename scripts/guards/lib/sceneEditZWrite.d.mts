export interface Finding {
  name: string;
  line: number;
  prop: string;
}

export const Z_BEARING_PROPS: Set<string>;
export function scanSceneEditZWrites(contenu: string): Finding[];
