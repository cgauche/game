import { describe, it, expect } from 'vitest';
import { hairPool, hairIndexById, cosmeticPart } from './cosmetic';
import { hairstylesForSex } from './hairstyles';

/**
 * Imposer une coiffure par ID stable (#637) — `appearance.hairstyle`. On MANIPULE des ids : forcer une
 * coiffure = référencer son id, jamais son index (fragile) ni son label (affichage multilangue).
 */
describe('coiffure imposée par id (#637)', () => {
  const anId = hairstylesForSex('M')[0].id; // une coiffure NOMMÉE réelle (id = slug du nom de fichier)

  it('hairIndexById résout un id vers l’entrée EXACTE du pool (pas un index arbitraire)', () => {
    const pool = hairPool('Humain', 'M');
    const idx = hairIndexById('Humain', 'M', anId);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect((pool[idx] as { id?: string }).id).toBe(anId);
  });

  it('deux ids DIFFÉRENTS imposent des coiffures DIFFÉRENTES (l’id sélectionne bien l’art)', () => {
    const ms = hairstylesForSex('M');
    expect(ms.length).toBeGreaterThanOrEqual(2);
    const a = cosmeticPart('cheveux', 'Humain', 'M', hairIndexById('Humain', 'M', ms[0].id));
    const b = cosmeticPart('cheveux', 'Humain', 'M', hairIndexById('Humain', 'M', ms[1].id));
    expect(a).not.toEqual(b); // l’art rendu diffère selon l’id imposé
    expect(a).toBeTruthy();
  });

  it('FAIL-FAST si l’id est introuvable — aucun repli silencieux (directive user 2026-07-20)', () => {
    expect(() => hairIndexById('Humain', 'M', 'coiffure-qui-nexiste-pas-xyz')).toThrow(/introuvable/);
  });
});
