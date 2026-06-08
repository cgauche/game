import { describe, it, expect } from 'vitest';
import { baseSpeciesOf, baseSkeleton, applyBuild, gabaritForSpecies } from './skeletons';
import { worldTransforms, apply } from './kinematics';
import { BONE_IDS } from './bones';

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
  it("un Nain a des jambes plus courtes qu'un Humain", () => {
    const h = baseSkeleton(gabaritForSpecies('Humain'), 'M');
    const n = baseSkeleton(gabaritForSpecies('Nain'), 'M');
    expect(n.cuisseG.length).toBeLessThan(h.cuisseG.length);
  });
  it("un Haut-Elfe est plus élancé (membres plus longs) qu'un Humain", () => {
    const h = baseSkeleton(gabaritForSpecies('Humain'), 'M');
    const e = baseSkeleton(gabaritForSpecies('Haut-Elfe'), 'M');
    expect(e.cuisseG.length).toBeGreaterThan(h.cuisseG.length);
  });
  it('M et F diffèrent en proportions sans être identiques', () => {
    const m = baseSkeleton(gabaritForSpecies('Humain'), 'M');
    const f = baseSkeleton(gabaritForSpecies('Humain'), 'F');
    expect(f.epauleG.pivot.x).not.toBe(m.epauleG.pivot.x);
  });
  it("espèce inconnue retombe sur Humain", () => {
    const u = baseSkeleton(gabaritForSpecies('Inconnu'), 'M');
    const h = baseSkeleton(gabaritForSpecies('Humain'), 'M');
    expect(u.torse.length).toBe(h.torse.length);
  });
});

describe('géométrie au repos (proxy visuel sans navigateur)', () => {
  const w = worldTransforms(baseSkeleton(gabaritForSpecies('Humain'), 'M'), {});
  const origin = (id: keyof typeof w) => apply(w[id], { x: 0, y: 0 });

  it('la figure est debout : tête en haut, bassin au milieu, pieds en bas', () => {
    const tete = origin('tete');
    const bassin = origin('bassin');
    const pied = origin('piedG');
    expect(tete.y).toBeLessThan(bassin.y);     // tête au-dessus du bassin
    expect(bassin.y).toBeLessThan(pied.y);     // bassin au-dessus des pieds
    expect(bassin.y).toBeGreaterThan(80);      // bassin ~96
    expect(bassin.y).toBeLessThan(110);
    expect(pied.y).toBeGreaterThan(140);       // pieds proches de la ligne de sol (150)
    expect(pied.y).toBeLessThan(160);
    expect(tete.y).toBeLessThan(60);           // tête dans le haut de la boîte
  });

  it('la posture est symétrique : mains/jambes en miroir autour de x=60', () => {
    const mainG = origin('mainG');
    const mainD = origin('mainD');
    const piedG = origin('piedG');
    const piedD = origin('piedD');
    // main droite à droite du centre, main gauche à gauche
    expect(mainD.x).toBeGreaterThan(60);
    expect(mainG.x).toBeLessThan(60);
    // symétrie autour de x=60 (tolérance)
    expect(Math.abs((60 - mainG.x) - (mainD.x - 60))).toBeLessThan(3);
    expect(Math.abs((60 - piedG.x) - (piedD.x - 60))).toBeLessThan(2);
  });

  it('tous les os tiennent dans la boîte 120×150 (± marge)', () => {
    for (const id of BONE_IDS) {
      const p = origin(id);
      expect(p.x).toBeGreaterThan(-10);
      expect(p.x).toBeLessThan(130);
      expect(p.y).toBeGreaterThan(-10);
      expect(p.y).toBeLessThan(165);
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    }
  });
});

describe('applyBuild', () => {
  it('build élevé épaissit le torse de façon monotone', () => {
    const sk = baseSkeleton(gabaritForSpecies('Humain'), 'M');
    const thin = applyBuild(sk, 0).torse.thickness;
    const mid = applyBuild(sk, 0.5).torse.thickness;
    const fat = applyBuild(sk, 1).torse.thickness;
    expect(thin).toBeLessThan(mid);
    expect(mid).toBeLessThan(fat);
  });
  it("ne mute pas l'entrée", () => {
    const sk = baseSkeleton(gabaritForSpecies('Humain'), 'M');
    const before = sk.torse.thickness;
    applyBuild(sk, 1);
    expect(sk.torse.thickness).toBe(before);
  });
});
