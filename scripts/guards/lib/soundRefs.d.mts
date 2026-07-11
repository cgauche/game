export interface SoundRef {
  id: string;
  line: number;
}

export function soundRefsIn(text: string): SoundRef[];
