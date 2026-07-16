import { describe, it, expect } from 'vitest';
import { findStructureById } from './index';

/**
 * Catalogue AA « Tableau des Structures Courantes » (AA l.3686-3723, VERBATIM) — 18 entrées ajoutées
 * au catalogue `structures.json` (5 colonnes ENC / Limite d'Encombrement / Endurance / Blessures /
 * Pénalité de Couvert, DISTINCT du profil ADE II ch.08 à 2 colonnes BE/B). `BE` se dérive de
 * l'Endurance BRUTE de la table par troncature à la dizaine (convention Bonus = dizaines).
 */
describe('Structures AA (AA l.3686-3723)', () => {
  it('Mur de château : ENC N/A, Limite 150, Endurance 65 → BE 6, Blessures 100, Couvert Très Difficile', () => {
    const s = findStructureById('mur-de-chateau')!;
    expect(s.enc).toBeUndefined();
    expect(s.encLimit).toBe(150);
    expect(s.char).toEqual({ BE: 6, B: 100 });
    expect(s.couvertPenalty).toBe('tresDifficile');
    expect(s.kind).toBe('mur');
    expect(s.source).toEqual({ book: 'aux-armes', chapter: 10 });
  });

  it('Mur de forteresse naine : Limite 200, Endurance 80 → BE 8, Blessures 150, Couvert Très Difficile', () => {
    const s = findStructureById('mur-de-forteresse-naine')!;
    expect(s.encLimit).toBe(200);
    expect(s.char).toEqual({ BE: 8, B: 150 });
    expect(s.couvertPenalty).toBe('tresDifficile');
  });

  it('Charrette : ENC 10, Limite 30, Endurance 25 → BE 2, Blessures 10, Couvert Intermédiaire', () => {
    const s = findStructureById('charrette')!;
    expect(s.enc).toBe(10);
    expect(s.encLimit).toBe(30);
    expect(s.char).toEqual({ BE: 2, B: 10 });
    expect(s.couvertPenalty).toBe('intermediaire');
  });

  it("Bateau de patrouille : ENC 130, Limite 50, Endurance 60 → BE 6, Blessures 120, Couvert Difficile", () => {
    const s = findStructureById('bateau-de-patrouille')!;
    expect(s.enc).toBe(130);
    expect(s.encLimit).toBe(50);
    expect(s.char).toEqual({ BE: 6, B: 120 });
    expect(s.couvertPenalty).toBe('difficile');
  });

  it('Herse et Solide porte en bois : aucune Pénalité de Couvert (N/A dans la table)', () => {
    expect(findStructureById('herse')!.couvertPenalty).toBeUndefined();
    expect(findStructureById('solide-porte-en-bois')!.couvertPenalty).toBeUndefined();
  });

  it("Solide porte en bois : SEULE nouvelle entrée AA de kind 'porte' (Bélier applicable)", () => {
    const ids = ['charrette', 'chariot-leger', 'chariot-moyen', 'chariot-lourd', 'diligence',
      'barge-moyenne', 'bateau-de-patrouille', 'chaloupe', 'cloture-en-clayonnage', 'herse',
      'mantelet-de-bois', 'mur-a-ossature-en-bois', 'mur-de-chateau', 'mur-de-forteresse-naine',
      'mur-en-pierres-seches', 'palissade-de-pieux', 'solide-porte-en-bois', 'terrassement'];
    expect(ids).toHaveLength(18);
    for (const id of ids) {
      const s = findStructureById(id);
      expect(s, `${id} manquant`).toBeTruthy();
      expect(s!.kind).toBe(id === 'solide-porte-en-bois' ? 'porte' : 'mur');
      expect(s!.source).toEqual({ book: 'aux-armes', chapter: 10 });
    }
  });
});
