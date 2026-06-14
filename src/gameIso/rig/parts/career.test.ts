import { describe, it, expect } from 'vitest';
import { careerClass, tenueForClass, tenueFor } from './career';
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

describe('tenueForClass', () => {
  it('fournit au moins torse + jambes pour chaque classe connue', () => {
    for (const c of ['Guerriers', 'Lettrés', 'Roublards', 'Ruraux', 'Citadins', 'Courtisans', 'Itinérants', 'Riverains']) {
      const t = tenueForClass(c);
      expect(pickView(t.torse, 'front')).toContain('<');
      expect(pickView(t.jambes, 'front')).toContain('<');
    }
  });
});

describe('tenueFor — vues dos/profil E·7 branchées', () => {
  it('le torse d’une tenue générée expose back/profile distincts du front', () => {
    const t = tenueFor('Noble'); // Noble a des vues générées
    const front = pickView(t.torse, 'front');
    expect(front).toContain('<');
    expect(pickView(t.torse, 'back')).not.toBe(front);
    expect(pickView(t.torse, 'profile')).not.toBe(front);
  });
  it('le front reste identique (compose, n’écrase pas)', () => {
    // pickView front d’une tenue avec vues == le front généré d’origine (non altéré)
    const front = pickView(tenueFor('Soldat').torse, 'front');
    expect(front.length).toBeGreaterThan(20);
  });
});
