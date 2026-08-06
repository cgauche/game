/**
 * Registre des SETS D'ÉQUIPEMENT quadrupèdes : un set = un fichier `defs/<id>.ts`, collecté par
 * `npm run gen` (même patron que `heads/`, `tails/`, `manes/`). L'art de chaque set est CUIT par
 * `scripts/rig/compile-dessin-quad.mts` depuis son dessin d'atelier `harnais/<id>@<espèce>-<vue>`.
 */
import { QUAD_HARNAIS_DEFS } from './_registry.generated';
import type { QuadHarnaisDef } from './types';

export type { QuadHarnaisDef } from './types';
export type { QuadHarnaisId } from './_registry.generated';

/** Table DÉRIVÉE des fichiers `defs/` (id de set → def). */
export const QUAD_HARNAIS: Record<string, QuadHarnaisDef> = Object.fromEntries(QUAD_HARNAIS_DEFS.map((d) => [d.id, d]));
