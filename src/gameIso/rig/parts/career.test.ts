import { describe, it, expect, vi } from 'vitest';
import { careerClass, tenueForClass, tenueFor, tenuePaletteFor, wardrobeKeyResolves } from './career';
import { CLASS_TENUE_BY_ID, TENUE_BY_ID } from './tenues';
import { pickView } from './types';
import { careers } from '../../../data';

describe('careerClass — renvoie un id de CLASSE, par id de carrière EXACT (aucun libellé)', () => {
  it('lit la classe depuis careers.json (id → classe)', () => {
    expect(careerClass('soldat')).toBe('guerriers');
    expect(careerClass('sorcier')).toBe('lettres');
    expect(careerClass('agitateur')).toBe('citadins');
  });
  it('un LIBELLÉ (« Soldat ») n’est PAS un id → citadins (défaut neutre)', () => {
    expect(careerClass('Soldat')).toBe('citadins');
    expect(careerClass('Carrière imaginaire')).toBe('citadins');
  });
});

describe('tenueForClass (par id de classe)', () => {
  it('fournit au moins torse + jambes pour chaque classe connue', () => {
    for (const c of ['guerriers', 'lettres', 'roublards', 'ruraux', 'citadins', 'courtisans', 'itinerants', 'riverains']) {
      const t = tenueForClass(c);
      expect(pickView(t.torse, 'front')).toContain('<');
      expect(pickView(t.jambes, 'front')).toContain('<');
    }
  });
});

describe('tenueFor — garde-robe id→id (aucun slugId au milieu)', () => {
  it('tenue EXPLICITE : un id de def de tenue résout sa tenue spécifique', () => {
    expect(tenueFor('noble')).toBe(TENUE_BY_ID.noble);
    expect(tenueFor('soldat')).toBe(TENUE_BY_ID.soldat);
  });
  it('carrières SANS def de tenue dédiée (∉ TENUE_BY_ID) NI réutilisation explicite (`CareerData.tenue` absent) : repli sur la tenue d’archétype de CLASSE (via careerClass) — ensemble dérivé de careers.json, VIDE = vague de tenues dédiées achevée', () => {
    const withoutSpecificTenue = (careers as Array<{ id: string; tenue?: string }>)
      .filter((c) => !(c.id in TENUE_BY_ID) && !c.tenue)
      .map((c) => c.id);
    for (const id of withoutSpecificTenue) {
      expect(tenueFor(id)).toBe(tenueForClass(careerClass(id)));
    }
  });
  it('id INCONNU (ni carrière ∪ classe ∪ tenue) → warn BRUYANT + repli citadins (#223)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(tenueFor('carriere-imaginaire')).toBe(CLASS_TENUE_BY_ID.citadins);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
  it('un LIBELLÉ (« Soldat ») ne résout PAS sa tenue → warn + citadins', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(tenueFor('Soldat')).toBe(CLASS_TENUE_BY_ID.citadins);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
  it('vues dos/profil E·7 branchées (tenue générée)', () => {
    const t = tenueFor('noble');
    const front = pickView(t.torse, 'front');
    expect(front).toContain('<');
    expect(pickView(t.torse, 'back')).not.toBe(front);
    expect(pickView(t.torse, 'profile')).not.toBe(front);
  });
});

describe('tenueFor — carrière SANS archétype de classe réutilisant la tenue d’une autre (CareerData.tenue, MDG 09 « Côtier »)', () => {
  it('marin/naufrageur/nautonier (Côtier) résolvent la tenue de leur carrière de base', () => {
    expect(tenueFor('marin-cotier')).toBe(TENUE_BY_ID.marin);
    expect(tenueFor('naufrageur-cotier')).toBe(TENUE_BY_ID.naufrageur);
    expect(tenueFor('nautonier-cotier')).toBe(TENUE_BY_ID.nautonier);
  });
  it('tenuePaletteFor en miroir exact', () => {
    expect(tenuePaletteFor('marin-cotier')).toBe(tenuePaletteFor('marin'));
    expect(tenuePaletteFor('naufrageur-cotier')).toBe(tenuePaletteFor('naufrageur'));
    expect(tenuePaletteFor('nautonier-cotier')).toBe(tenuePaletteFor('nautonier'));
  });
  it('garde d’intégrité : toute `CareerData.tenue` référence une tenue connue (TENUE_BY_ID)', () => {
    const orphans = (careers as Array<{ id: string; tenue?: string }>)
      .filter((c) => c.tenue && !(c.tenue in TENUE_BY_ID))
      .map((c) => `${c.id} → ${c.tenue}`);
    expect(orphans, `tenue(s) orpheline(s) : ${orphans.join(', ')}`).toEqual([]);
  });
});

describe('wardrobeKeyResolves — exact-id (carrière ∪ classe ∪ tenue ∪ nu ∪ vide)', () => {
  it('accepte les ids valides, refuse les libellés', () => {
    expect(wardrobeKeyResolves('soldat')).toBe(true); // carrière (et tenue)
    expect(wardrobeKeyResolves('guerriers')).toBe(true); // classe
    expect(wardrobeKeyResolves('noble')).toBe(true); // tenue
    expect(wardrobeKeyResolves('nu')).toBe(true);
    expect(wardrobeKeyResolves('')).toBe(true);
    expect(wardrobeKeyResolves(undefined)).toBe(true);
    expect(wardrobeKeyResolves('Soldat')).toBe(false);
    expect(wardrobeKeyResolves('carriere-imaginaire')).toBe(false);
  });
});
