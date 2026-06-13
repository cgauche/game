import { describe, it, expect } from 'vitest';
import { createHero } from './character';
import { makeRNG } from './dice';
import { casterTalents, learnableSpells } from './grimoire';
import { blessingsOf } from './cults/registry';
import { featuresOf } from './combatFeatures/dispatch';
import { rationCount, dailyFoodUpkeep } from './provisions';
import { bonus } from './characteristics';

/**
 * Verrouillage de l'INTÉGRATION création ↔ {Magie (Jalon 2), règles 2.5, Voyage #T2} :
 * les quatre features ont été livrées par des sessions parallèles — ces tests garantissent
 * qu'un personnage SORTI DU CRÉATEUR alimente bien les registres livrés à côté (labels de
 * talents identiques data ↔ moteurs, trappings ↔ rations, Béni ↔ Bénédictions du culte).
 */
describe('création ↔ Magie (grimoire, LDB 10/41/46)', () => {
  it('un Prêtre créé (Béni) reçoit AUTOMATIQUEMENT les six Bénédictions de son culte (LDB 41)', () => {
    const h = createHero({
      speciesLabel: 'Humains (Reiklander)', careerLabel: 'Prêtre', name: 'P', rng: makeRNG(7),
      careerTalent: 'Béni (Sigmar)',
    });
    expect(casterTalents(h).some((t) => t.kind === 'beni' && t.spec === 'Sigmar')).toBe(true);
    for (const b of blessingsOf('Sigmar')) expect(h.spells).toContain(b); // « reçoit les SIX »
  });

  it('un Sorcier créé (Magie mineure) peut mémoriser des sorts via le grimoire (coûts par bandes)', () => {
    const h = createHero({
      speciesLabel: 'Humains (Reiklander)', careerLabel: 'Sorcier', name: 'S', rng: makeRNG(7),
      careerTalent: 'Magie mineure', // le talent de carrière choisi (1 seul au Niveau 1)
    });
    expect(casterTalents(h).some((t) => t.kind === 'mineure')).toBe(true);
    const learnable = learnableSpells(h);
    expect(learnable.length).toBeGreaterThan(0);
    const minor = learnable.filter((x) => x.spell.type === 'Magie mineure');
    expect(minor.length).toBeGreaterThan(0);
    expect(minor[0].cost).toBe(0); // BFM sorts INCLUS au Talent (LDB 10 l.587), payants ensuite
  });
});

describe('création ↔ règles 2.5 (registre combatFeatures, LDB 10)', () => {
  it('un Ratier créé (Coup puissant, Frappe assommante) résout dans le registre des talents câblés', () => {
    const h = createHero({
      speciesLabel: 'Humains (Reiklander)', careerLabel: 'Ratier', name: 'R', rng: makeRNG(7),
      careerTalent: 'Coup puissant',
    });
    expect(h.talents.some((t) => t.name === 'Coup puissant')).toBe(true);
    expect(featuresOf(h).some(({ def }) => def.meleeDamageBonus)).toBe(true); // câblé, pas juste affiché
  });
});

describe('création ↔ Voyage & Nourriture (#T2, LDB 18 l.417-422)', () => {
  it('les Rations des trappings de classe sont vues par le système de faim et consommées', () => {
    // Classe « Ruraux » (Villageois…) : « Rations (1 jour) » dans les trappings de classe.
    const h = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Villageois', name: 'V', rng: makeRNG(7) });
    const before = rationCount(h);
    expect(before).toBeGreaterThan(0); // le créateur produit des objets compatibles isRation
    const r = dailyFoodUpkeep(h, 50, bonus(h.characteristics.E), makeRNG(1));
    expect(r.ate).toBe(true);
    expect(r.rationConsumed).toBe(true);
    expect(rationCount(h)).toBe(before - 1);
  });
});
