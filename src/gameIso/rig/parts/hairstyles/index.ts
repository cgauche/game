import { HAIRSTYLE_DEFS } from './_registry.generated';
import type { HairstyleDef } from './types';
export type { HairstyleDef } from './types';
export { HAIRSTYLE_DEFS };

/** Coiffures d'un sexe, dans l'ordre du pool (`order`) — porte front/profile/back par coiffure. */
export function hairstylesForSex(sex: 'M' | 'F'): HairstyleDef[] {
  return HAIRSTYLE_DEFS.filter((h) => h.sex === sex).sort((a, b) => a.order - b.order);
}
