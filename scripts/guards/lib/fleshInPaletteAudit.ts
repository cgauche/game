/**
 * AUDIT « une TENUE n'a ni peau ni cheveux » (#583 chair, #599 flanc jumeau cheveux) —
 * définition UNIQUE, partagée par la garde `src/gameIso/rig/parts/tenues/no-flesh-in-tenue-palette.test.ts`
 * (et sa morsure).
 *
 * `TenueDef.palette` déclare le cuir, le tissu, le métal d'un vêtement — jamais les jetons du
 * PORTEUR (`peau`/`peauO`/`peauH`, `cheveux`/`cheveuxO`/`cheveuxH`) : la chair et la chevelure
 * appartiennent au PERSONNAGE (espèce + personnalisation, `raceAppearance.json`), jamais au
 * costume. Une tenue qui déclare `peauO`/`cheveuxO` écrase la peau/chevelure de TOUT porteur
 * (`tenuePaletteFor` prime sur l'espèce dans `rigStoredPalette` — même si `career.ts` les
 * strippe désormais en défense, cf. `stripPorterTokens`).
 */
import type { TenueDef } from '../../../src/gameIso/rig/parts/tenues/types';
import { slugId } from '../../../src/data/slug';

const PORTER_KEYS = ['peau', 'peauO', 'peauH', 'cheveux', 'cheveuxO', 'cheveuxH'] as const;

function porterKeysOf(def: TenueDef): string[] {
  if (!def.palette) return [];
  return PORTER_KEYS.filter((k) => k in def.palette!);
}

/** `{ id, keys }` pour chaque def dont la `palette` déclare au moins un jeton du PORTEUR
 *  (chair ou chevelure). */
export function auditFleshInPalette(defs: readonly TenueDef[]): { id: string; keys: string[] }[] {
  return defs
    .map((def) => ({ id: slugId(def.label), keys: porterKeysOf(def) }))
    .filter((o) => o.keys.length > 0);
}
