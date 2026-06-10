import { describe, it, expect } from 'vitest';
import { creatureAttacks, venomDifficulty, ATTACK_LABEL } from './creatureAttacks';

const DRAGON = ['Arme +10', 'Armure 5', 'Attaque caudale +9', 'Morsure +10', 'Souffle +15 (Feu)', 'Taille (Énorme)', 'Vol 80'];
const by = (ts: string[], k: string) => creatureAttacks(ts).find((a) => a.kind === k)!;

describe('creatureAttacks — attaques + RÈGLES dérivées des traits (RAW)', () => {
  it('le Dragon a Arme, Attaque caudale, Morsure, Souffle (ordre des traits)', () => {
    expect(creatureAttacks(DRAGON).map((a) => a.kind)).toEqual(['arme', 'caudale', 'morsure', 'souffle']);
  });
  it('extrait l’Indice de Dégâts (+N)', () => {
    expect(by(DRAGON, 'morsure').bonus).toBe(10);
    expect(by(DRAGON, 'caudale').bonus).toBe(9);
    expect(by(DRAGON, 'souffle').bonus).toBe(15);
  });

  it('Arme = action normale, sans coût d’Avantage', () => {
    const a = by(DRAGON, 'arme');
    expect(a.trigger).toBe('action');
    expect(a.avantage).toBe(0);
  });
  it('Morsure = Attaque gratuite à 1 Avantage', () => {
    const a = by(DRAGON, 'morsure');
    expect(a.trigger).toBe('free');
    expect(a.avantage).toBe(1);
  });
  it('Attaque caudale = gratuite 1 Avantage + À Terre sur cible plus petite', () => {
    const a = by(DRAGON, 'caudale');
    expect([a.trigger, a.avantage, a.prone]).toEqual(['free', 1, true]);
  });
  it('Cornes = Attaque gratuite à la CHARGE (pas de coût d’Avantage)', () => {
    const a = by(['Cornes +7'], 'cornes');
    expect([a.trigger, a.avantage]).toEqual(['charge', 0]);
  });
  it('Souffle = gratuite 2 Avantages, zone, magique, Type lu', () => {
    const a = by(DRAGON, 'souffle');
    expect([a.trigger, a.avantage, a.aoe, a.magic, a.type]).toEqual(['free', 2, true, true, 'Feu']);
  });
  it('Souffle « (divers) » → Type non spécifié', () => {
    expect(by(['Souffle +12 (divers)'], 'souffle').type).toBeUndefined();
  });
  it('Tentacules = une Attaque gratuite PAR tentacule, Empêtré, sans coût d’Avantage', () => {
    const a = by(['Tentacules +6'], 'tentacules');
    expect([a.trigger, a.avantage, a.perTentacle, a.entangle]).toEqual(['free', 0, true, true]);
  });
  it('« 8 Tentacules +9 » (Pieuvre des tourbières) : compte en tête lu, Indice non avalé', () => {
    const a = by(['8 Tentacules +9'], 'tentacules');
    expect([a.count, a.bonus, a.avantage, a.entangle]).toEqual([8, 9, 0, true]);
  });
  it('Étreinte glaciale = 2 Avantages + Action, magique', () => {
    const a = by(['Étreinte glaciale'], 'etreinte');
    expect([a.trigger, a.avantage, a.magic]).toEqual(['action', 2, true]);
  });

  it('le Venin n’est PAS une attaque (Atout de la Morsure)', () => {
    expect(creatureAttacks(['Venin (Difficile)', 'Morsure +8']).map((a) => a.kind)).toEqual(['morsure']);
  });
  it('venomDifficulty lit la Difficulté (défaut Intermédiaire si absente)', () => {
    expect(venomDifficulty(['Venin (Difficile)'])).toBe('Difficile');
    expect(venomDifficulty(['Venin'])).toBe('Intermédiaire');
    expect(venomDifficulty(['Morsure +8'])).toBeNull();
  });
  it('ignore les traits non-attaque (Armure, Taille, Vol…)', () => {
    expect(creatureAttacks(['Armure 3', 'Taille (Grande)', 'Vision nocturne'])).toEqual([]);
  });
  it('chaque type a un libellé FR', () => {
    expect(ATTACK_LABEL.caudale).toBe('Attaque caudale');
  });
});
