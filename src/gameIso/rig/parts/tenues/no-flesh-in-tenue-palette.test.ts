/**
 * Garde-fou STRUCTUREL — une TENUE n'a pas de peau (#583, couture avant-bras/main).
 *
 * `TenueDef.palette` déclare le cuir, le tissu, le métal d'un vêtement — jamais la CHAIR
 * (`peau`/`peauO`/`peauH`) : la chair appartient au PERSONNAGE (espèce + personnalisation,
 * `raceAppearance.json`), jamais au costume. Une tenue qui déclare `peauO` écrase la peau de
 * TOUT porteur (`tenuePaletteFor` prime sur l'espèce dans `rigStoredPalette` — même si
 * `career.ts` la strippe désormais en défense, cf. `stripFlesh`), ce qui a produit 174/210
 * paires avant-bras↔main à couture > 30 RGB (jusqu'à 227) sur le corpus complet.
 *
 * Balaie TOUS les defs (`TENUE_DEFS`), pas un échantillon — le trou vécu (16 tenues sur 117)
 * était invisible à un audit partiel.
 */
import { describe, it, expect } from 'vitest';
import { TENUE_DEFS } from './_registry.generated';
import { auditFleshInPalette } from '../../../../../scripts/guards/lib/fleshInPaletteAudit';
import { slugId } from '../../../../data/slug';

describe('une tenue n\'a pas de peau : `peau`/`peauO`/`peauH` interdits dans TenueDef.palette (#583)', () => {
  it('aucun def ne déclare de jeton de chair dans sa palette', () => {
    const offenders = auditFleshInPalette(TENUE_DEFS);
    expect(offenders, `Tenues qui déclarent une CHAIR (peau/peauO/peauH) — la chair vient de\n` +
      `l'espèce, jamais du costume (retirer ces clés de la palette) :\n` +
      offenders.map((o) => `  ${o.id}: ${o.keys.join(', ')}`).join('\n'),
    ).toEqual([]);
  });
});

/** MORSURE — déclarer `peauO` dans une tenue rougit-elle vraiment la garde ? */
describe('morsure : une tenue qui déclare `peauO` rougit la garde (#583)', () => {
  const target = TENUE_DEFS[0];

  it('un jeton de chair injecté dans la palette rougit', () => {
    const saved = target.palette;
    try {
      target.palette = { ...(saved ?? {}), peauO: '#8a5a36' };
      const offenders = auditFleshInPalette(TENUE_DEFS);
      expect(offenders.some((o) => o.id === slugId(target.name) && o.keys.includes('peauO'))).toBe(true);
    } finally {
      target.palette = saved;
    }
  });

  it('restaurée, la garde redevient verte', () => {
    const offenders = auditFleshInPalette(TENUE_DEFS);
    expect(offenders).toEqual([]);
  });
});
