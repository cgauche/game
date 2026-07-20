/**
 * PALETTE NON INVERSÉE — garde de données (#638 volet A).
 *
 * Pour chaque famille de jeton (`@vet1`, `@cuir`, `@metal`…) d'une tenue, la LUMIÈRE (`…H`)
 * doit être plus claire que la BASE (sinon `scripts/qc/mesure-volume.mts` rend
 * « ECHEC palette inversée » — le contrat y est inexprimable). Le chemin réel est
 * `buildTokenMap` (`palette.ts`), le MÊME que le harnais : un token non stocké est dérivé via
 * `SHADES` (H = base × 1.18, toujours plus clair) — seul un token `…H` STOCKÉ explicitement
 * plus sombre que sa base peut inverser la palette.
 */
import { describe, it, expect } from 'vitest';
import { TENUE_DEFS } from './_registry.generated';
import { buildTokenMap, lum } from '../../palette';

function rgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) throw new Error(`hex invalide : ${hex}`);
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

describe('palette non inversée : pour chaque famille, la LUMIÈRE (`…H`) est plus claire que la BASE (#638)', () => {
  for (const def of TENUE_DEFS) {
    if (!def.palette || Object.keys(def.palette).length === 0) continue;
    const tmap = buildTokenMap(def.palette);
    const fams = [...new Set(Object.keys(def.palette).map((k) => k.replace(/(O|H)$/, '')))];
    for (const fam of fams) {
      const base = tmap[fam];
      const hi = tmap[`${fam}H`];
      if (base == null || hi == null) continue;
      it(`${def.id} — famille "${fam}" : L(${hi}) > L(${base})`, () => {
        const lBase = lum(...rgb(base));
        const lHi = lum(...rgb(hi));
        expect(lHi, `${def.id}/${fam} : lumière ${hi} (L=${lHi.toFixed(1)}) n'est pas plus claire que ` +
          `la base ${base} (L=${lBase.toFixed(1)}) — palette inversée`).toBeGreaterThan(lBase);
      });
    }
  }
});
