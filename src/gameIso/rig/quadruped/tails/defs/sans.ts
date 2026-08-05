import type { QuadTailDef } from '../types';

export const quadTail: QuadTailDef = {
  key: 'sans',
  label: 'Sans queue',
  // batracien : pas de queue — l'absence est DÉCLARÉE (`vide`), elle ne se déduit pas d'un art vide
  // oublié : la garde de contrat exige un art non vide pour toute autre def.
  vide: true,
  art: { profile: '', back: '' },
};
