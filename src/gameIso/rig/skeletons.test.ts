import { describe, it, expect } from 'vitest';
import { baseSpeciesOf, baseSkeleton, applyBuild } from './skeletons';

describe('baseSpeciesOf', () => {
  it('normalise les variantes régionales', () => {
    expect(baseSpeciesOf('Humains (Reiklander)')).toBe('Humain');
    expect(baseSpeciesOf('Nains (Norse)')).toBe('Nain');
    expect(baseSpeciesOf('Halflings (Cendreplaine)')).toBe('Halfling');
    expect(baseSpeciesOf('Hauts Elfes')).toBe('Haut-Elfe');
    expect(baseSpeciesOf('Elfes sylvains')).toBe('Elfe sylvain');
  });
});

describe('baseSkeleton', () => {
  it('un Nain a des jambes plus courtes qu’un Humain', () => {
    const h = baseSkeleton('Humain', 'M');
    const n = baseSkeleton('Nain', 'M');
    expect(n.cuisseG.length).toBeLessThan(h.cuisseG.length);
  });
  it('un Haut-Elfe est plus élancé (membres plus longs) qu’un Humain', () => {
    const h = baseSkeleton('Humain', 'M');
    const e = baseSkeleton('Haut-Elfe', 'M');
    expect(e.cuisseG.length).toBeGreaterThan(h.cuisseG.length);
  });
  it('M et F diffèrent en proportions sans être identiques', () => {
    const m = baseSkeleton('Humain', 'M');
    const f = baseSkeleton('Humain', 'F');
    expect(f.epauleG.pivot.x).not.toBe(m.epauleG.pivot.x);
  });
  it('espèce inconnue retombe sur Humain', () => {
    const u = baseSkeleton('Inconnu', 'M');
    const h = baseSkeleton('Humain', 'M');
    expect(u.torse.length).toBe(h.torse.length);
  });
});

describe('applyBuild', () => {
  it('build élevé épaissit le torse de façon monotone', () => {
    const sk = baseSkeleton('Humain', 'M');
    const thin = applyBuild(sk, 0).torse.thickness;
    const mid = applyBuild(sk, 0.5).torse.thickness;
    const fat = applyBuild(sk, 1).torse.thickness;
    expect(thin).toBeLessThan(mid);
    expect(mid).toBeLessThan(fat);
  });
  it('ne mute pas l’entrée', () => {
    const sk = baseSkeleton('Humain', 'M');
    const before = sk.torse.thickness;
    applyBuild(sk, 1);
    expect(sk.torse.thickness).toBe(before);
  });
});
