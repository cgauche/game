export interface RevealProducer {
  kind: string;
  line: number;
  forme: 1 | 2 | 3 | 4;
}

export function stripComments(src: string): string;
export function unionKinds(pendingsSrc: string): string[];
export function scanRevealProducers(relPath: string, contenu: string): RevealProducer[];
