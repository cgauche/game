import { describe, it, expect } from 'vitest';
import { TENUES, TENUE_NUE, CAREER_TENUE_DEFS } from './index';
import { TENUE_DEFS } from './_registry.generated';
import { pickView } from '../types';
import { careerTenueFor, tenuePaletteFor } from '../career';

describe('registre des tenues (auto-découverte defs/)', () => {
  it('dérive TENUES des fichiers defs/ : 8 archétypes de classe + Nu (+ tenues de carrière career:true)', () => {
    for (const c of ['Guerriers', 'Lettrés', 'Roublards', 'Ruraux', 'Citadins', 'Courtisans', 'Itinérants', 'Riverains', 'Nu']) {
      expect(TENUES[c], `tenue manquante : ${c}`).toBeDefined();
    }
    expect(TENUE_DEFS.filter((d) => !d.career).length).toBe(9);
  });

  it("une tenue de CARRIÈRE déposée en defs/ (career:true) est consommée par careerTenueFor — un fichier, zéro édition d'existant", () => {
    expect(CAREER_TENUE_DEFS['Guerrier du Chaos']).toBeDefined();
    const t = careerTenueFor('Guerrier du Chaos');
    expect(pickView(t.tete, 'profile')).toContain('@metal'); // heaume cornu, vue dédiée
    expect(tenuePaletteFor('Guerrier du Chaos').metal).toBe('#3a3a46'); // palette du def
  });

  it('chaque def expose torse + jambes non vides', () => {
    for (const d of TENUE_DEFS) {
      expect(pickView(d.set.torse, 'front'), d.name).toContain('<');
      expect(pickView(d.set.jambes, 'front'), d.name).toContain('<');
    }
  });

  it('la tenue Nu utilise le token de peau (@peau) — suit la palette d’espèce', () => {
    expect(pickView(TENUE_NUE.torse, 'front')).toContain('@peau');
  });

  it('careerTenueFor("Nu") renvoie le corps nu', () => {
    expect(careerTenueFor('Nu')).toBe(TENUE_NUE);
  });

  it('careerTenueFor(carrière inconnue) retombe sur un archétype de classe (Citadins)', () => {
    expect(careerTenueFor('Carrière imaginaire')).toBe(TENUES.Citadins);
  });
});
