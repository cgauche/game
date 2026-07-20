import { describe, it, expect } from 'vitest';
import { TENUE_NUE, CLASS_TENUE_BY_ID, TENUE_BY_ID, TENUE_BAREFOOT } from './index';
import { TENUE_DEFS } from './_registry.generated';
import { pickView } from '../types';
import { tenueFor, tenuePaletteFor } from '../career';
import { careers } from '../../../../data';
import { slugId } from '../../../../data/slug';

describe('registre des tenues (defs/ = source UNIQUE, data-driven)', () => {
  it('chaque archétype de classe déclaré expose bien un def torse+jambes chargé', () => {
    for (const c of Object.keys(CLASS_TENUE_BY_ID)) {
      expect(pickView(CLASS_TENUE_BY_ID[c].torse, 'front'), c).toContain('<');
      expect(pickView(CLASS_TENUE_BY_ID[c].jambes, 'front'), c).toContain('<');
    }
  });

  it('toute carrière de careers.json résout une tenue SPÉCIFIQUE (def dédié ou tenue réutilisée) — jamais le repli archétype de classe silencieux', () => {
    const defSlugs = new Set(TENUE_DEFS.map((d) => slugId(d.label)));
    const fautives = careers
      .filter((c) => {
        const parDef = c.id in TENUE_BY_ID;
        const parTenueReutilisee = !!c.tenue && c.tenue in TENUE_BY_ID;
        return !parDef && !parTenueReutilisee;
      })
      .map((c) => {
        if (c.tenue) return `${c.id} (classe ${c.class}) : champ tenue « ${c.tenue} » introuvable en defs/ (slugId(name) dérivé ?)`;
        if (defSlugs.has(c.id)) return `${c.id} (classe ${c.class}) : un def au slug « ${c.id} » existe hors TENUE_BY_ID — vérifier isClassDef/palette`;
        return `${c.id} (classe ${c.class}) : aucun def ni champ tenue authoré (slugId(name) attendu « ${c.id} »)`;
      });
    expect(fautives).toEqual([]);
  });

  it("une tenue SPÉCIFIQUE déposée en defs/ est consommée par tenueFor (par ID) — un fichier, zéro merge", () => {
    expect(TENUE_BY_ID['guerrier-du-chaos']).toBeDefined();
    const t = tenueFor('guerrier-du-chaos');
    expect(pickView(t.tete, 'profile')).toContain('@metal'); // heaume cornu, vue dédiée
    expect(tenuePaletteFor('guerrier-du-chaos').metal).toBe('#3a3a46'); // palette portée par le def
  });

  it('chaque def expose torse + jambes non vides', () => {
    for (const d of TENUE_DEFS) {
      expect(pickView(d.set.torse, 'front'), d.label).toContain('<');
      expect(pickView(d.set.jambes, 'front'), d.label).toContain('<');
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

  it("l'archétype « citadins » existe et expose un rendu réel — repli ultime de tenueForClass/tenueFor pour tout vocabulaire inconnu", () => {
    expect(CLASS_TENUE_BY_ID.citadins).toBeDefined();
    expect(pickView(CLASS_TENUE_BY_ID.citadins.torse, 'front')).toContain('<');
    expect(pickView(CLASS_TENUE_BY_ID.citadins.jambes, 'front')).toContain('<');
  });

  it("tenueFor(id inconnu) retombe sur l'archétype de classe Citadins", () => {
    expect(tenueFor('carriere-imaginaire')).toBe(CLASS_TENUE_BY_ID.citadins);
  });
});
