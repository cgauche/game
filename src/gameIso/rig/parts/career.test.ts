import { describe, it, expect } from 'vitest';
import { careerClass, careerTenue } from './career';

describe('careerClass', () => {
  it('lit la classe depuis careers.json', () => {
    expect(careerClass('Soldat')).toBe('Guerriers');
    expect(careerClass('Sorcier')).toBe('Lettrés');
  });
  it('carrière inconnue → Citadins (défaut neutre)', () => {
    expect(careerClass('Carrière imaginaire')).toBe('Citadins');
  });
});

describe('careerTenue', () => {
  it('fournit au moins torse + jambes pour chaque classe connue', () => {
    for (const c of ['Guerriers', 'Lettrés', 'Roublards', 'Ruraux', 'Citadins', 'Courtisans', 'Itinérants', 'Riverains']) {
      const t = careerTenue(c);
      expect(t.torse?.svg).toContain('<');
      expect(t.jambes?.svg).toContain('<');
    }
  });
});
