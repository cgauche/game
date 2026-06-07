import { describe, it, expect } from 'vitest';
import { clearEngagementOf } from './engagement';
import type { Combatant } from './types';

const mk = (id: string, eng: string[]): Combatant => ({ id, engagedWith: eng } as unknown as Combatant);

describe('clearEngagementOf — ne pas rester Engagé avec une cible neutralisée (LDB 13)', () => {
  it('retire le combattant tombé de TOUS les liens, des deux côtés', () => {
    const a = mk('a', ['b', 'c']);
    const b = mk('b', ['a']);
    const c = mk('c', ['a']);
    clearEngagementOf([a, b, c], 'b'); // b vient de tomber
    expect(a.engagedWith).toEqual(['c']); // b retiré de a
    expect(b.engagedWith).toEqual([]); // b lui-même vidé
    expect(c.engagedWith).toEqual(['a']); // c (non lié à b) inchangé
  });
});
