import { describe, it, expect } from 'vitest';
import { dropExpiredGrantedResources } from './grantedResources';
import type { Combatant } from './types';

const mk = (fortune: number, fate: number): Combatant => ({ fortune, fate } as Combatant);

describe('dropExpiredGrantedResources — retrait des Points accordés à l’expiration (clamp ≥ 0)', () => {
  it('retire les Points de Chance accordés non dépensés', () => {
    const c = mk(3, 0);
    dropExpiredGrantedResources(c, [{ grantedFortune: 2 }]);
    expect(c.fortune).toBe(1);
  });
  it('clamp à 0 si les Points accordés ont été dépensés (approximation min(accordé, courant))', () => {
    const c = mk(1, 0);
    dropExpiredGrantedResources(c, [{ grantedFortune: 2 }]);
    expect(c.fortune).toBe(0); // pas -1
  });
  it('cumule plusieurs effets expirés', () => {
    const c = mk(5, 0);
    dropExpiredGrantedResources(c, [{ grantedFortune: 2 }, { grantedFortune: 1 }]);
    expect(c.fortune).toBe(2);
  });
  it('Destin (fate) suit la même règle', () => {
    const c = mk(0, 2);
    dropExpiredGrantedResources(c, [{ grantedFate: 1 }]);
    expect(c.fate).toBe(1);
  });
  it('effet sans ressource accordée → aucun changement', () => {
    const c = mk(3, 3);
    dropExpiredGrantedResources(c, [{}]);
    expect(c.fortune).toBe(3);
    expect(c.fate).toBe(3);
  });
});
