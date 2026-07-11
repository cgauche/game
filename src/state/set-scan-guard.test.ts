import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { runSetScan } from '../../scripts/guards/lib/setScan.mjs';

/**
 * Garde-fou « set() bruts des flows » (#321 lentille 3, cliquet baseline patron `scripts/guards/lib/`) :
 * fige l'AGRÉGAT de `set({...})` de `src/state/*.ts` (hors `store.ts`/`stateFields.ts`) qui réinitialisent
 * un champ `STATE_FIELDS` (pending*) DIRECTEMENT, hors `...resetFields(...)`. MESURE globale, PAS un
 * verrou par-fichier : le rapport `docs/plans/2026-07-11-chasse-3-synthese.md` documente que la majorité
 * de ces sites sont des fermetures de modale LÉGITIMES (chaque flow ferme sa propre pending — cf. chasse-2
 * « cœur des set() sains ») ; ce cliquet borne la CROISSANCE non revue plutôt que d'exiger un helper
 * `clearPending` immédiat (aucune correction faite dans cette passe). Baseline gelée au recensement
 * (2026-07-11) : 689 set() / 280 resets ad hoc directs ; +1 set() légitime (voyage : l'applier de poste
 * SCINDÉ en `stagePoste` sans-Test + `stagePosteBatch` pour le pas batch des postes — chacun ré-émet le groupe).
 */
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const BASELINE = { totalCalls: 690, totalAdHocResets: 280 };

describe('garde-fou set() bruts des flows (agrégat)', () => {
  it("le nombre total de set() littéraux détectés dans src/state/*.ts ne dépasse pas la baseline", () => {
    const { totalCalls } = runSetScan(ROOT);
    expect(
      totalCalls,
      `Croissance des set() de src/state/*.ts (${BASELINE.totalCalls} → ${totalCalls}) — revoir le nouveau flux puis AJUSTER la baseline de ce test si légitime`,
    ).toBeLessThanOrEqual(BASELINE.totalCalls);
  });

  it("le nombre de set() qui réinitialisent un champ STATE_FIELDS hors resetFields(...) ne dépasse pas la baseline", () => {
    const { totalAdHocResets } = runSetScan(ROOT);
    expect(
      totalAdHocResets,
      `Croissance des resets ad hoc de champ pending* (${BASELINE.totalAdHocResets} → ${totalAdHocResets}) — un nouveau site direct hors resetFields(...) : envisager le helper partagé, sinon AJUSTER la baseline`,
    ).toBeLessThanOrEqual(BASELINE.totalAdHocResets);
  });
});
