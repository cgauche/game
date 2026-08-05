/**
 * CONTRAT des defs de QUEUE quadrupèdes (#1082 P2) — même contrat que les têtes : vues déclarées,
 * couverture des espèces, axes DÉCLARÉS mesurés à l'exécution, repli VISIBLE d'une clé sans def.
 */
import { describe, it, expect, vi } from 'vitest';
import { QUAD_TAILS, quadTailDef } from './index';
import type { QuadTailDef } from './types';
import { quadArt } from '../partArt';
import type { QuadArt } from '../partArt';
import { QUAD_SPECIES, WINGED_SPECIES } from '../../creatures';
import { MISSING_TONE } from '../../viewArt';
import { consumedAxes, witnessesOf } from '../axis-fuzz.fixture';
import type { QuadProps } from '../quadSkeleton';

const SPECIES: Record<string, QuadProps> = { ...QUAD_SPECIES, ...WINGED_SPECIES };

/** Props d'une espèce qui PORTE cette queue. */
const witness = (key: string): QuadProps => witnessesOf(SPECIES, 'tail', key)[0];
const arts = (d: QuadTailDef): QuadArt[] => [d.art.profile, d.art.back];

describe('defs de queue quadrupèdes : contrat de vues, d\'axes et de repli', () => {
  it('chaque clé de queue portée par une espèce a sa def enregistrée', () => {
    for (const [id, p] of Object.entries(SPECIES))
      expect(QUAD_TAILS[p.tail], `espèce ${id} : queue « ${p.tail} » sans def`).toBeDefined();
  });

  it('profil et dos rendent un art non vide — sauf l\'absence DÉCLARÉE (`vide`)', () => {
    for (const d of Object.values(QUAD_TAILS)) {
      const p = witness(d.key);
      for (const a of arts(d))
        if (d.vide) expect(quadArt(a, p), `${d.key} (vide)`).toBe('');
        else expect(quadArt(a, p), d.key).not.toBe('');
    }
    expect(Object.values(QUAD_TAILS).filter((d) => d.vide).map((d) => d.key)).toEqual(['sans']);
  });

  it('axes DÉCLARÉS = axes CONSOMMÉS (TOUS les témoins × produit des valeurs déclarées)', () => {
    for (const d of Object.values(QUAD_TAILS)) {
      const declared = [...new Set<string>(d.params ?? [])].sort();
      const { used, missingDomain } = consumedAxes(arts(d), witnessesOf(SPECIES, 'tail', d.key), declared);
      expect(missingDomain, `${d.key} : axe déclaré sans domaine de fuzz (AXIS_FUZZ)`).toEqual([]);
      expect(used, `${d.key} : axes consommés non déclarés`).toEqual(declared);
    }
  });

  it('une clé SANS def rend la silhouette de REPLI VISIBLE + un avertissement', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const d = quadTailDef('espece-de-queue-inconnue-xyz');
    for (const a of arts(d)) expect(quadArt(a, witness('crin'))).toContain(MISSING_TONE);
    if (import.meta.env?.DEV) expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
