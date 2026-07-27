export interface ResolvedGroundingCase {
  id: string;
  question: string;
  keywords: string[];
  surface: string;
  status: 'resolu';
  incident: string;
  resolves: (text: string) => boolean;
  sabotage: (text: string) => string;
}

export interface PendingGroundingCase {
  id: string;
  question: string;
  keywords: string[];
  surface: null;
  status: 'attente';
  incident: string;
  surfaceManquante: string;
}

export type GroundingCase = ResolvedGroundingCase | PendingGroundingCase;

export const GROUNDING_CASES: GroundingCase[];
