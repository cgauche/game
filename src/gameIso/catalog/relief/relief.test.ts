import { describe, it, expect } from 'vitest';
import { reliefMaterial } from './index';
import { reliefMaterials } from '../../../data';
import { shade } from '../../shade';

/** Distance max par canal entre deux hex `#rrggbb`. */
function hexDist(a: string, b: string): number {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [ca, cb] = [p(a), p(b)];
  return Math.max(...ca.map((v, i) => Math.abs(v - cb[i])));
}

describe('apparence de relief (JSON pur iso/POV)', () => {
  it('les 6 matériaux sont présents', () => {
    const ids = reliefMaterials.map((m) => m.id).sort();
    expect(ids).toEqual(['pierre', 'pilier', 'plafond', 'riser', 'sol-inconnu', 'terre']);
  });

  it('résolution par id + valeurs de face', () => {
    expect(reliefMaterial('pierre').face).toBe('#6b6f76');
    expect(reliefMaterial('terre').face).toBe('#5a4a33');
    expect(reliefMaterial('riser').face).toBe('#57534c');
    expect(reliefMaterial('plafond').face).toBe('#2c2a26');
    expect(reliefMaterial('sol-inconnu').face).toBe('#6b6250');
  });

  it('repli sur pierre pour un id inconnu', () => {
    expect(reliefMaterial('inconnu').id).toBe('pierre');
  });

  it('ombrage data-driven : shade(face, shadeDark) reproduit les tons sombres hand-tunés (±3/canal)', () => {
    const pierre = reliefMaterial('pierre');
    expect(hexDist(shade(pierre.face, pierre.shadeDark!), '#494d54')).toBeLessThanOrEqual(3); // ancien stone-dark
    expect(hexDist(shade(pierre.foot!, pierre.shadeDark!), '#34373c')).toBeLessThanOrEqual(3); // ancien stone-foot-dark
    const terre = reliefMaterial('terre');
    expect(hexDist(shade(terre.face, terre.shadeDark!), '#33291c')).toBeLessThanOrEqual(3); // ancien earth-dark
    expect(hexDist(shade(terre.foot!, terre.shadeDark!), '#241c12')).toBeLessThanOrEqual(3); // ancien earth-foot-dark
  });
});
