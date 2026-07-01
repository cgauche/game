import { describe, it, expect } from 'vitest';
import { structureAppearance, STRUCTURE_APPEARANCES } from './index';
import { STRUCTURE_APPEARANCE_DEFS } from './_registry.generated';

describe('apparence de structure (registre partagé iso/POV)', () => {
  it('mur-en-pierre : pierre + parapet', () => {
    const s = structureAppearance('mur-en-pierre');
    expect(s.material).toBe('pierre');
    expect(s.parapet).toBeDefined();
  });

  it('porte-de-ville : herse à 6 barreaux', () => {
    expect(structureAppearance('porte-de-ville').door?.herse?.bars).toBe(6);
  });

  it('mur-en-bois : palette bois définie', () => {
    expect(structureAppearance('mur-en-bois').wood).toBeDefined();
  });

  it('repli sur plain (undefined + id inconnu)', () => {
    expect(structureAppearance(undefined).id).toBe('plain');
    expect(structureAppearance('inconnu').id).toBe('plain');
  });

  it('les 6 defs sont présentes', () => {
    expect(STRUCTURE_APPEARANCE_DEFS).toHaveLength(6);
    for (const id of ['plain', 'mur-en-bois', 'mur-en-pierre', 'porte', 'porte-blindee', 'porte-de-ville']) {
      expect(STRUCTURE_APPEARANCES[id]).toBeDefined();
    }
  });
});
