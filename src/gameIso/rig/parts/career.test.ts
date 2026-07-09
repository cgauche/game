import { describe, it, expect, vi } from 'vitest';
import { careerClass, tenueForClass, tenueFor, wardrobeKeyResolves } from './career';
import { CLASS_TENUE_BY_ID, TENUE_BY_ID } from './tenues';
import { pickView } from './types';

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
  it('carrière SANS tenue dédiée : repli sur la tenue d’archétype de CLASSE (via careerClass)', () => {
    // 'archer' est une carrière (class 'guerriers') sans def de tenue spécifique.
    expect(tenueFor('archer')).toBe(tenueForClass('guerriers'));
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
