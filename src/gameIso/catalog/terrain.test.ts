import { describe, it, expect } from 'vitest';
import { TERRAIN_VIZ, terrainGradient, MISSING_GRADIENT } from './terrain';
import { TERRAIN_DEFS } from '../../state/terrain';
import { DEFS } from '../sprites';
import { MISSING_TONE } from './missing';

describe('présentation des terrains (dégradé/aperçu dérivés du registre)', () => {
  it('chaque terrain du registre résout SON dégradé', () => {
    for (const t of TERRAIN_DEFS) expect(terrainGradient(t.id), t.id).toBe(t.gradient);
  });

  it('id absent du registre → dégradé de REPLI VISIBLE (#877), jamais celui d’un terrain réel', () => {
    expect(terrainGradient('inconnu')).toBe(MISSING_GRADIENT);
    const gradients = Object.values(TERRAIN_VIZ).map((v) => v.gradient);
    expect(gradients).not.toContain(MISSING_GRADIENT);
  });

  it('DEFS émet le dégradé d’alarme du repli, prêt à peindre la case fautive', () => {
    expect(DEFS).toContain(`<linearGradient id="${MISSING_GRADIENT}"`);
    expect(DEFS).toContain(`stop-color="${MISSING_TONE}"`);
  });
});
