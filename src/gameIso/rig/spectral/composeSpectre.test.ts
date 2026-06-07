import { describe, it, expect } from 'vitest';
import {
  resolveSpectreFromProps, spectreFloat, spectreLunge, SPECTRE_REST, SPECTRE_DEATH, SPECTRE_DEFAULT,
} from './composeSpectre';

describe('gabarit spectral', () => {
  it('résout corps + tête + 2 bras (z), translucide (opacity bakée)', () => {
    const bones = resolveSpectreFromProps(SPECTRE_DEFAULT, 'front', {});
    expect(bones.map((b) => b.id).sort()).toEqual(['brasD', 'brasG', 'corps', 'tete']);
    expect(bones.every((b) => b.parts[0].svg.includes('opacity'))).toBe(true); // immatériel
  });

  it('recolor : colors.corps change le markup', () => {
    const a = JSON.stringify(resolveSpectreFromProps(SPECTRE_DEFAULT, 'front', {}));
    const b = JSON.stringify(resolveSpectreFromProps(SPECTRE_DEFAULT, 'front', {}, { corps: '#402a50' }));
    expect(a).not.toEqual(b);
  });

  it('capuche vs visage nu changent la tête', () => {
    const hooded = resolveSpectreFromProps({ ...SPECTRE_DEFAULT, hood: true }, 'front', {}).find((b) => b.id === 'tete')!.parts[0].svg;
    const bare = resolveSpectreFromProps({ ...SPECTRE_DEFAULT, hood: false, face: 'cri' }, 'front', {}).find((b) => b.id === 'tete')!.parts[0].svg;
    expect(hooded).not.toEqual(bare);
  });

  it('les poses diffèrent (flottement ≠ repos, ruée projette les bras, dissipation)', () => {
    expect(spectreFloat(0.25)).not.toEqual(SPECTRE_REST);
    expect(spectreLunge(0.5).brasG).toBeGreaterThan(10);
    expect(SPECTRE_DEATH.corps).toBeGreaterThan(10);
  });
});
