import { describe, it, expect } from 'vitest';
import { TENUE_NUE, CLASS_TENUE_BY_ID, TENUE_BY_ID, TENUE_BAREFOOT } from './index';
import { TENUE_DEFS } from './_registry.generated';
import { pickView } from '../types';
import { tenueFor, tenuePaletteFor } from '../career';

describe('registre des tenues (defs/ = source UNIQUE, data-driven)', () => {
  it('8 archétypes de classe dérivés des defs/ (taxonomie careers.json, sans flag)', () => {
    for (const c of ['guerriers', 'lettres', 'roublards', 'ruraux', 'citadins', 'courtisans', 'itinerants', 'riverains']) {
      expect(CLASS_TENUE_BY_ID[c], `archétype de classe manquant : ${c}`).toBeDefined();
    }
    expect(Object.keys(CLASS_TENUE_BY_ID).length).toBe(8);
  });

  it("une tenue SPÉCIFIQUE déposée en defs/ est consommée par tenueFor (par ID) — un fichier, zéro merge", () => {
    expect(TENUE_BY_ID['guerrier-du-chaos']).toBeDefined();
    const t = tenueFor('guerrier-du-chaos');
    expect(pickView(t.tete, 'profile')).toContain('@metal'); // heaume cornu, vue dédiée
    expect(tenuePaletteFor('guerrier-du-chaos').metal).toBe('#3a3a46'); // palette portée par le def
  });

  it('chaque def expose torse + jambes non vides', () => {
    for (const d of TENUE_DEFS) {
      expect(pickView(d.set.torse, 'front'), d.name).toContain('<');
      expect(pickView(d.set.jambes, 'front'), d.name).toContain('<');
    }
  });

  it('barefoot = SOURCE UNIQUE (flag du def) : Nu + Squelette, plus de hardcode par id', () => {
    expect(pickView(TENUE_NUE.torse, 'front')).toContain('@peau'); // suit la palette d'espèce
    expect(TENUE_BAREFOOT.has('nu')).toBe(true);
    expect(TENUE_BAREFOOT.has('squelette')).toBe(true);
  });

  it('tenueFor("nu") renvoie le corps nu', () => {
    expect(tenueFor('nu')).toBe(TENUE_NUE);
  });

  it("tenueFor(id inconnu) retombe sur l'archétype de classe Citadins", () => {
    expect(tenueFor('carriere-imaginaire')).toBe(CLASS_TENUE_BY_ID.citadins);
  });
});
