import { describe, it, expect } from 'vitest';
import { creatureAttacks, ATTACK_LABEL } from './creatureAttacks';

describe('creatureAttacks — attaques dérivées des traits (data-driven)', () => {
  it('le Dragon a Morsure, Attaque caudale, Souffle et Arme (depuis ses traits canon)', () => {
    const a = creatureAttacks(['Arme +10', 'Armure 5', 'Attaque caudale +9', 'Morsure +10', 'Souffle +15 (divers)', 'Taille (Énorme)', 'Vol 80']);
    expect(a.map((x) => x.kind)).toEqual(['arme', 'caudale', 'morsure', 'souffle']);
  });
  it('extrait l’Indice de Dégâts (+N)', () => {
    const a = creatureAttacks(['Morsure +10', 'Attaque caudale +9']);
    expect(a.find((x) => x.kind === 'morsure')!.bonus).toBe(10);
    expect(a.find((x) => x.kind === 'caudale')!.bonus).toBe(9);
  });
  it('le Venin n’est PAS une attaque (Atout de la Morsure)', () => {
    expect(creatureAttacks(['Venin (Difficile)', 'Morsure +8']).map((x) => x.kind)).toEqual(['morsure']);
  });
  it('ignore les traits non-attaque (Armure, Taille, Vol…)', () => {
    expect(creatureAttacks(['Armure 3', 'Taille (Grande)', 'Vision nocturne'])).toEqual([]);
  });
  it('chaque type a un libellé FR', () => {
    expect(ATTACK_LABEL.caudale).toBe('Attaque caudale');
    expect(ATTACK_LABEL.morsure).toBe('Morsure');
  });
});
