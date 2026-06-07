import { describe, it, expect } from 'vitest';
import { bodyShapeOf, creatureToCombatant } from './spawn';
import { findCreature } from '../data';

// Forme du corps → Tableau de Localisation (LDB « Point d'Impact des Créatures » p.312).
// Dérivée du gabarit rigué de la créature (bodyPlanOf) ; serpent/araignée = Localisations Alternatives.
describe('bodyShapeOf — forme du corps dérivée du gabarit (LDB p.312)', () => {
  it('mappe les formes canoniques depuis le bestiaire', () => {
    expect(bodyShapeOf('Araignée géante')).toBe('araignee');
    expect(bodyShapeOf('Serpent')).toBe('serpent');
    expect(bodyShapeOf('Loup')).toBe('quadrupede');
    expect(bodyShapeOf('Cheval')).toBe('quadrupede');
    expect(bodyShapeOf('Ogre')).toBe('humanoide');
  });
  it('défaut humanoïde pour un nom inconnu (table par défaut, pas d’invention)', () => {
    expect(bodyShapeOf('Créature inexistante xyz')).toBe('humanoide');
  });
  it('creatureToCombatant : bodyShape posé sur le Combattant', () => {
    const spider = findCreature('Araignée géante');
    if (spider) expect(creatureToCombatant(spider, 'a', { x: 0, y: 0 }).bodyShape).toBe('araignee');
    const snake = findCreature('Serpent');
    if (snake) expect(creatureToCombatant(snake, 's', { x: 0, y: 0 }).bodyShape).toBe('serpent');
  });
});
