import { describe, it, expect } from 'vitest';
import { bodyPlanOf, planById } from './bodyPlan';

describe('bodyPlanOf', () => {
  it('quadrupèdes → quadruped', () => {
    for (const n of ['Cheval', 'Loup', 'Sanglier', 'Rat géant', 'Ours', 'Charognard', 'Chien']) {
      expect(bodyPlanOf(n)).toBe('quadruped');
    }
  });
  it('humanoïdes peau-humaine + monstres bipèdes (Phase B) → biped', () => {
    for (const n of [
      'Soldat', 'Bandit', 'Mendiant', 'Noble', 'Guerrier des clans', 'Vermine de choc', 'Rat ogre',
      // Phase B : peaux-vertes, hommes-bêtes, morts-vivants humanoïdes, gros/démons.
      'Orc', 'Gobelin', 'Snotling', 'Gor', 'Minotaure', 'Squelette', 'Zombie', 'Goule de crypte',
      'Troll', 'Vampire', 'Sanguinaire de Khorne',
    ]) {
      expect(bodyPlanOf(n)).toBe('biped');
    }
  });
  it('exotiques/monstres pas encore rapatriés → monolithic', () => {
    for (const n of ['Araignée géante', 'Serpent', 'Dragon', 'Démonette de Slaanesh']) {
      expect(bodyPlanOf(n)).toBe('monolithic');
    }
  });
});

describe('planById(quadruped)', () => {
  it('rend des os non vides avec les pieds vers le sol', () => {
    const bones = planById('quadruped').resolve('Cheval', 'profile', {});
    expect(bones.length).toBeGreaterThan(8);
    const feet = bones.filter((b) => b.id.startsWith('pied'));
    expect(feet.length).toBe(4);
    const footY = Math.max(...feet.map((b) => b.matrix[5]));
    expect(footY).toBeGreaterThan(120); // pieds dans le bas de la boîte 150
  });
  it('walkPose diffère du repos (la démarche bouge)', () => {
    expect(planById('quadruped').walkPose(0.25)).not.toEqual(planById('quadruped').restPose());
  });
  it('recolor : colors.corps change le markup', () => {
    const a = planById('quadruped').resolve('Cheval', 'profile', {});
    const b = planById('quadruped').resolve('Cheval', 'profile', {}, { colors: { corps: '#aa1133' } });
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });
});
