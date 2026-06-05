import { describe, it, expect } from 'vitest';
import { careerClass, careerTenue, careerTenueFor } from './career';
import { pickView } from './types';

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
      expect(pickView(t.torse, 'front')).toContain('<');
      expect(pickView(t.jambes, 'front')).toContain('<');
    }
  });
});

describe('careerTenueFor — vues dos/profil E·7 branchées', () => {
  it('le torse d’une carrière générée expose back/profile distincts du front', () => {
    const t = careerTenueFor('Noble'); // Noble a des vues générées
    const front = pickView(t.torse, 'front');
    expect(front).toContain('<');
    expect(pickView(t.torse, 'back')).not.toBe(front);
    expect(pickView(t.torse, 'profile')).not.toBe(front);
  });
  it('le front reste identique (compose, n’écrase pas)', () => {
    // pickView front d’une carrière avec vues == le front généré d’origine (non altéré)
    const front = pickView(careerTenueFor('Soldat').torse, 'front');
    expect(front.length).toBeGreaterThan(20);
  });
});
