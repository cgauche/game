/**
 * AUDIT « une TENUE n'a pas de peau » (#583) — définition UNIQUE, partagée par la garde
 * `src/gameIso/rig/parts/tenues/no-flesh-in-tenue-palette.test.ts` (et sa morsure).
 *
 * `TenueDef.palette` déclare le cuir, le tissu, le métal d'un vêtement — jamais la CHAIR
 * (`peau`/`peauO`/`peauH`) : la chair appartient au PERSONNAGE (espèce + personnalisation,
 * `raceAppearance.json`), jamais au costume. Une tenue qui déclare `peauO` écrase la peau de
 * TOUT porteur (`tenuePaletteFor` prime sur l'espèce dans `rigStoredPalette` — même si
 * `career.ts` la strippe désormais en défense, cf. `stripFlesh`).
 */
import type { TenueDef } from '../../../src/gameIso/rig/parts/tenues/types';
import { slugId } from '../../../src/data/slug';

const FLESH_KEYS = ['peau', 'peauO', 'peauH'] as const;

function fleshKeysOf(def: TenueDef): string[] {
  if (!def.palette) return [];
  return FLESH_KEYS.filter((k) => k in def.palette!);
}

/** `{ id, keys }` pour chaque def dont la `palette` déclare au moins une clé de chair. */
export function auditFleshInPalette(defs: readonly TenueDef[]): { id: string; keys: string[] }[] {
  return defs
    .map((def) => ({ id: slugId(def.name), keys: fleshKeysOf(def) }))
    .filter((o) => o.keys.length > 0);
}
