/**
 * #223 — « seed + repli bruyant » : toute résolution qui ÉCHOUE crie (console) et laisse une trace
 * VISIBLE, jamais un clone silencieux. Couvre le repli de réf. (marqueur au nom + console.error),
 * l'arme hors catalogue (console.warn), la garde-robe inconnue (console.warn + citadins), et la
 * variété COSMÉTIQUE seedée des humains génériques (déterministe par id, distincte entre ids).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { spawnEnemy } from './spawn';
import { enemyRigProfile } from '../gameIso/rig/enemyProfile';
import { tenueFor, tenueForClass } from '../gameIso/rig/parts/career';
import type { Combatant } from '../engine/types';

const POS = { x: 0, y: 0 };
afterEach(() => vi.restoreAllMocks());

describe('#223 — repli bruyant de réf. irrésoluble', () => {
  it('réf. absente → mannequin marqué au nom + console.error', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const c = spawnEnemy(undefined, undefined, 'x1', POS);
    expect(c.name).toContain('RÉF ?');
    expect(err).toHaveBeenCalledWith(expect.stringContaining('irrésoluble'));
  });

  it('réf. bidon → le nom porte la réf. littérale (visible au token/frise)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const c = spawnEnemy('creature-fantome-xyz', undefined, 'x2', POS);
    expect(c.name).toBe('RÉF ? « creature-fantome-xyz »');
  });
});

describe('#223 — arme d’authoring hors catalogue', () => {
  it('libellé inconnu → console.warn (l’arme de rendu reste, générique)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    spawnEnemy(undefined, { name: 'PNJ', char: { B: 10 } }, 'w1', POS, { weapon: 'Hache' });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('« Hache »'));
  });

  it('libellé de catalogue → aucun warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    spawnEnemy(undefined, { name: 'PNJ', char: { B: 10 } }, 'w2', POS, { weapon: 'Dague' });
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('#223 — garde-robe inconnue = repli citadins BRUYANT', () => {
  it('id hors catalogue (marchande) → console.warn + tenue de classe Citadins', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t = tenueFor('marchande');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('marchande'));
    expect(t).toEqual(tenueForClass('citadins'));
  });

  it('LIBELLÉ pris pour un id (Marchand, majuscule) → console.warn + Citadins', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t = tenueFor('Marchand');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Marchand'));
    expect(t).toEqual(tenueForClass('citadins'));
  });

  it('id de tenue RÉSOLU du catalogue (marchand) → aucun warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    tenueFor('marchand');
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('#223 — variété seedée des humains génériques', () => {
  const mkGeneric = (id: string): Combatant => spawnEnemy(undefined, { name: 'Passant', char: { B: 10 } }, id, POS);
  const look = (id: string): string => {
    const p = enemyRigProfile(mkGeneric(id))!;
    return JSON.stringify({ colors: p.appearance.colors, cheveux: p.appearance.parts?.cheveux });
  };

  it('deux ids DIFFÉRENTS → apparences distinctes (le seed varie couleurs/coiffure)', () => {
    const looks = new Set(['erengrad-1', 'erengrad-2', 'erengrad-3', 'erengrad-4', 'docker-a', 'docker-b'].map(look));
    expect(looks.size).toBeGreaterThan(1);
  });

  it('même id → apparence STABLE (déterministe, goldens/multi)', () => {
    expect(look('kramer')).toBe(look('kramer'));
  });

  it('un humain générique reçoit des couleurs de peau ET de cheveux dérivées du seed', () => {
    const p = enemyRigProfile(mkGeneric('passant-x'))!;
    expect(p.appearance.colors?.peau).toBeTruthy();
    expect(p.appearance.colors?.cheveux).toBeTruthy();
  });

  it('un override d’auteur (colors) N’est PAS écrasé par la variété seedée', () => {
    const c = spawnEnemy(undefined, { name: 'Passant', char: { B: 10 } }, 'authored', POS, {
      appearance: { colors: { peau: '#123456' } },
    });
    expect(enemyRigProfile(c)!.appearance.colors?.peau).toBe('#123456');
  });
});
