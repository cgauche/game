/**
 * Garde-fou STRUCTUREL — une TENUE n'a ni peau ni cheveux (#583 chair, couture avant-bras/main ;
 * #599 flanc jumeau cheveux).
 *
 * `TenueDef.palette` déclare le cuir, le tissu, le métal d'un vêtement — jamais les jetons du
 * PORTEUR (`peau`/`peauO`/`peauH`, `cheveux`/`cheveuxO`/`cheveuxH`) : la chair et la chevelure
 * appartiennent au PERSONNAGE (espèce + personnalisation, `raceAppearance.json`), jamais au
 * costume. Une tenue qui déclare `peauO`/`cheveuxO` écrase la peau/chevelure de TOUT porteur
 * (`tenuePaletteFor` prime sur l'espèce dans `rigStoredPalette` — même si `career.ts` les
 * strippe désormais en défense, cf. `stripPorterTokens`), ce qui a produit 174/210 paires
 * avant-bras↔main à couture > 30 RGB (jusqu'à 227) sur le corpus complet pour la chair, et un
 * écart de 296 RGB mesuré sur un Vampire (`#161214`) coiffé de la palette `Nonne` (`#aebfce`)
 * pour les cheveux.
 *
 * Balaie TOUS les defs (`TENUE_DEFS`), pas un échantillon — le trou vécu (16 tenues sur 117)
 * était invisible à un audit partiel.
 */
import { describe, it, expect } from 'vitest';
import { TENUE_DEFS } from './_registry.generated';
import { auditFleshInPalette } from '../../../../../scripts/guards/lib/fleshInPaletteAudit';
import { slugId } from '../../../../data/slug';

describe('une tenue n\'a ni peau ni cheveux : `peau`/`peauO`/`peauH`/`cheveux`/`cheveuxO`/`cheveuxH` interdits dans TenueDef.palette (#583, #599)', () => {
  it('aucun def ne déclare de jeton du porteur (chair ou chevelure) dans sa palette', () => {
    const offenders = auditFleshInPalette(TENUE_DEFS);
    expect(offenders, `Tenues qui déclarent un jeton du PORTEUR (peau/peauO/peauH ou\n` +
      `cheveux/cheveuxO/cheveuxH) — chair et chevelure viennent de l'espèce, jamais du costume\n` +
      `(retirer ces clés de la palette, ou les renommer si le jeton peint en fait une AUTRE\n` +
      `matière — ex. la guimpe/voile de Nonne) :\n` +
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

/** MORSURE — déclarer `cheveuxO` dans une tenue rougit-elle vraiment la garde (#599) ? */
describe('morsure : une tenue qui déclare `cheveuxO` rougit la garde (#599)', () => {
  const target = TENUE_DEFS[0];

  it('un jeton de chevelure injecté dans la palette rougit', () => {
    const saved = target.palette;
    try {
      target.palette = { ...(saved ?? {}), cheveuxO: '#33301a' };
      const offenders = auditFleshInPalette(TENUE_DEFS);
      expect(offenders.some((o) => o.id === slugId(target.name) && o.keys.includes('cheveuxO'))).toBe(true);
    } finally {
      target.palette = saved;
    }
  });

  it('restaurée, la garde redevient verte', () => {
    const offenders = auditFleshInPalette(TENUE_DEFS);
    expect(offenders).toEqual([]);
  });
});
