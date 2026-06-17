import { describe, it, expect } from 'vitest';
import { traitOverlaysFor } from './traitVisuals';
import type { TraitInstance } from '../../../engine/statEntry';
import type { Combatant } from '../../../engine/types';

const mk = (traits: TraitInstance[], species = 'Humain'): Combatant =>
  ({ id: 'c1', name: 'C', kind: 'enemy', species, traits }) as unknown as Combatant;

describe('visuels dérivés des traits de créature (statbloc éditeur, sorts grantTrait)', () => {
  it('sans traits → rien', () => {
    expect(traitOverlaysFor(mk([]))).toEqual([]);
  });

  it('Cornes → cornes derrière la tête ; Attaque caudale → queue dorsale (3 vues, profil vers −x)', () => {
    const ovs = traitOverlaysFor(mk([{ id: 'cornes', value: 6 }, { id: 'attaque-caudale', value: 8 }]));
    expect(ovs.some((o) => o.bone === 'tete' && o.behind && o.svg.includes('data-trait="cornes"'))).toBe(true);
    const queue = ovs.filter((o) => o.svg.includes('data-trait="queue"'));
    expect(queue.map((o) => o.view).sort()).toEqual(['back', 'front', 'profile']);
    expect(queue.find((o) => o.view === 'profile')?.plane).toBeUndefined(); // racine posée SUR le dos
    expect(queue.find((o) => o.view === 'profile')?.svg).toContain('M-2 2'); // part vers −x (le dos)
  });

  it('anti-doublon : la race qui fournit déjà cornes/queue (feature behind) fait foi', () => {
    expect(traitOverlaysFor(mk([{ id: 'cornes', value: 6 }], 'Homme-bête'))).toEqual([]); // cornes caprines de race
    expect(traitOverlaysFor(mk([{ id: 'attaque-caudale', value: 8 }], 'Skaven'))).toEqual([]); // queue de rat de race
    // un Nain (barbe en layer positif) garde ses cornes de trait
    expect(traitOverlaysFor(mk([{ id: 'cornes', value: 6 }], 'Nain')).length).toBe(1);
  });

  it('Tentacules → bras gauche remplacé (poing effacé)', () => {
    const ovs = traitOverlaysFor(mk([{ id: 'tentacules', count: 8, value: 9 }]));
    expect(ovs.some((o) => o.bone === 'epauleG' && o.replace && o.svg.includes('data-trait="tentacules"'))).toBe(true);
    expect(ovs.some((o) => o.bone === 'mainG' && o.replace && o.svg === '')).toBe(true);
  });

  it('Vol → ailes par vue (face/dos/profil) — donc le sort Envol (grantTrait Vol) en hérite', () => {
    const ovs = traitOverlaysFor(mk([{ id: 'vol', value: 90 }]));
    const wings = ovs.filter((o) => o.svg.includes('data-trait="vol"'));
    expect(wings.map((o) => o.view).sort()).toEqual(['back', 'front', 'profile']);
    expect(wings.every((o) => o.bone === 'torse')).toBe(true);
    // Plan dédié : derrière TOUT le corps de face (z inégal des bras), devant tout de dos ;
    // de profil, calque d'os normal (la racine se peint SUR le bord du dos, sinon elle flotte).
    expect(wings.find((o) => o.view === 'front')?.plane).toBe('fond');
    expect(wings.find((o) => o.view === 'profile')?.plane).toBeUndefined();
    expect(wings.find((o) => o.view === 'back')?.plane).toBe('avant');
  });
});
