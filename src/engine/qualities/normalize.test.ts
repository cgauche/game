import { describe, it, expect } from 'vitest';
import { parseQuality, splitIndice } from './normalize';

describe('normalize — parseQuality (canonicalisation + Indice)', () => {
  it('label exact → clé canonique', () => {
    expect(parseQuality('Précise')).toEqual({ key: 'Précise' });
    expect(parseQuality('Perforante')).toEqual({ key: 'Perforante' });
  });
  it('casse ignorée → clé canonique', () => {
    expect(parseQuality('précise')?.key).toBe('Précise');
    expect(parseQuality('À ENROULEMENT')?.key).toBe('À Enroulement');
  });
  it('Indice « X N » et « X (N) » extrait, clé canonique', () => {
    expect(parseQuality('Solide 3')).toEqual({ key: 'Solide', indice: 3 });
    expect(parseQuality('Solide (2)')).toEqual({ key: 'Solide', indice: 2 });
    expect(parseQuality('solide 5')).toEqual({ key: 'Solide', indice: 5 });
  });
  it('qualité inconnue du registre → null', () => {
    expect(parseQuality('Tournoyante')).toBeNull();
    expect(parseQuality('Bidon 9')).toBeNull();
    expect(parseQuality('')).toBeNull();
  });
  it('robuste : un label non-exact ne matche plus (fin du startsWith fragile)', () => {
    expect(parseQuality('Précise lame')).toBeNull(); // un startsWith aurait faussement matché 'Précise'
    expect(parseQuality('Pré')).toBeNull();
  });
});

describe('normalize — splitIndice', () => {
  it('sépare l’Indice de fin (« X N » / « X (N) ») et conserve les labels sans Indice', () => {
    expect(splitIndice('Solide 3')).toEqual({ label: 'Solide', indice: 3 });
    expect(splitIndice('Recharge (2)')).toEqual({ label: 'Recharge', indice: 2 });
    expect(splitIndice('Précise')).toEqual({ label: 'Précise' });
    expect(splitIndice('  À Enroulement ')).toEqual({ label: 'À Enroulement' });
  });
});
