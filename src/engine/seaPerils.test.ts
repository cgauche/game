import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import { SEA_HAZARDS, findSeaHazard, pickSeaHazard, strandingPenalty, rollStranding, rollDebrisEntangle, perilManagement } from './seaPerils';

/**
 * PÉRILS EN MER — couche pure (MDG 13 l.423-564), ORPHELINE avant le câblage #444 (`seaVoyageFlow.ts`
 * `case 'collision'`). Verbatim re-vérifié `Source/WH - V4 - La Mer de Griffe/13 - Navigation
 * maritime.md` l.471-499.
 */
describe('SEA_HAZARDS — les 4 périls verbatim (l.475-499)', () => {
  it('4 entrées, IC exacts (Iceberg 25, Débris marins 3, Rocher 47, Bas-fonds 10)', () => {
    expect(SEA_HAZARDS).toHaveLength(4);
    expect(findSeaHazard('iceberg')!.ic).toBe(25);
    expect(findSeaHazard('debris-marins')!.ic).toBe(3);
    expect(findSeaHazard('rocher')!.ic).toBe(47);
    expect(findSeaHazard('bas-fonds')!.ic).toBe(10);
  });

  it('chances d’Échouage verbatim (Rocher 20 %, Bas-fonds 40 %) ; Débris marins n’Échoue pas (empêtrement)', () => {
    expect(findSeaHazard('rocher')!.strandChancePct).toBe(20);
    expect(findSeaHazard('bas-fonds')!.strandChancePct).toBe(40);
    expect(findSeaHazard('debris-marins')!.strandChancePct).toBeUndefined();
  });
});

describe('pickSeaHazard — tirage pondéré (#444, poids MAISON défaut équiprobable)', () => {
  it('ne renvoie toujours qu’un péril RÉEL de SEA_HAZARDS (RNG seedé)', () => {
    const rng = makeRNG(7);
    for (let i = 0; i < 20; i++) expect(SEA_HAZARDS).toContain(pickSeaHazard(rng));
  });

  it('un poids à 0 sur les 3 autres force le tirage sur le 4ᵉ — la pondération est bien LUE en donnée', () => {
    const original = SEA_HAZARDS.map((h) => h.weight);
    try {
      for (const h of SEA_HAZARDS) h.weight = h.id === 'bas-fonds' ? 1 : 0;
      const rng = makeRNG(3);
      for (let i = 0; i < 10; i++) expect(pickSeaHazard(rng).id).toBe('bas-fonds');
    } finally {
      SEA_HAZARDS.forEach((h, i) => { h.weight = original[i]; });
    }
  });
});

describe('strandingPenalty / rollStranding (Échouage, l.471-473/497/499)', () => {
  it('pénalité = −(Enc navire + Enc cargaison), jamais positive', () => {
    expect(strandingPenalty(20, 10)).toBe(-30);
    expect(strandingPenalty(0, 0)).toBe(-0);
    expect(strandingPenalty(-5, 10)).toBe(-10); // Enc négatif ignoré (Math.max 0)
  });

  it('rollStranding : jamais d’Échouage pour un péril SANS strandChancePct (Débris marins)', () => {
    const debris = findSeaHazard('debris-marins')!;
    const rng = makeRNG(1);
    for (let i = 0; i < 20; i++) expect(rollStranding(debris, rng)).toBe(false);
  });
});

describe('rollDebrisEntangle (l.485-491)', () => {
  it('pénalité par Taille : Minuscule-Petite −2 DR Man/−1 M, Moyenne-Grande −1 DR Man/0 M, au-delà rien', () => {
    const debris = findSeaHazard('debris-marins')!;
    const rng = { int: () => 1 } as never; // 1 ≤ 20 % → toujours empêtré
    expect(rollDebrisEntangle(debris, 'petite', rng)).toEqual({ entangled: true, manDR: -2, mMod: -1 });
    expect(rollDebrisEntangle(debris, 'grande', rng)).toEqual({ entangled: true, manDR: -1, mMod: 0 });
    expect(rollDebrisEntangle(debris, 'enorme', rng)).toEqual({ entangled: true, manDR: 0, mMod: 0 });
  });

  it('au-delà de 20 %, aucun empêtrement', () => {
    const debris = findSeaHazard('debris-marins')!;
    const rng = { int: () => 21 } as never;
    expect(rollDebrisEntangle(debris, 'petite', rng).entangled).toBe(false);
  });
});

describe('perilManagement (Gestion des périls, l.429-436) — ORPHELIN (#444, non câblé)', () => {
  it('Distance 100/50/10 m → Perception/Manœuvre verbatim de la table', () => {
    expect(perilManagement(100)).toEqual({ spot: 'difficile', avoid: 'facile' });
    expect(perilManagement(50)).toEqual({ spot: 'intermediaire', avoid: 'accessible' });
    expect(perilManagement(10)).toEqual({ spot: 'accessible', avoid: 'complexe' });
    expect(perilManagement(5)).toEqual({ spot: 'accessible', avoid: 'complexe' }); // plancher : la ligne la plus proche
  });
});
