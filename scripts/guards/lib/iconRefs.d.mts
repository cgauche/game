export interface IconRef {
  id: string;
  line: number;
}

export function iconRefsIn(text: string): IconRef[];
