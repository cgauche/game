import { describe, it, expect } from 'vitest';
import { creatureView, hasCreatureViews, enemySprite } from './sprites';

describe('creatureView (F2 — facing des créatures non-humanoïdes)', () => {
  it('un monstre généré a des vues directionnelles', () => {
    expect(hasCreatureViews('Rat géant')).toBe(true);
  });

  it('back et profile diffèrent du front et entre eux', () => {
    const front = creatureView('Rat géant', 'front');
    const back = creatureView('Rat géant', 'back');
    const profile = creatureView('Rat géant', 'profile');
    expect(back).not.toBe(front);
    expect(profile).not.toBe(front);
    expect(back).not.toBe(profile);
    expect(back).toContain('<');
    expect(profile).toContain('<');
  });

  it('la vue front == enemySprite (même source monolithique)', () => {
    expect(creatureView('Rat géant', 'front')).toBe(enemySprite('Rat géant'));
  });

  it('repli sur le front pour un label sans vues (humanoïde riggé)', () => {
    expect(hasCreatureViews('Cultiste')).toBe(false);
    expect(creatureView('Cultiste', 'back')).toBe(enemySprite('Cultiste'));
  });

  it('label inconnu ne plante pas (chaîne non vide)', () => {
    expect(typeof creatureView('Zzz inconnu', 'back')).toBe('string');
  });
});
