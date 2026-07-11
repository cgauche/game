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

describe('#223 — repli bruyant de réf. irrésoluble (réf. FOURNIE-mais-fausse uniquement)', () => {
  it('réf. absente (ni statbloc) → PNJ générique SILENCIEUX (comportement historique, pas un repli bruyant)', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const c = spawnEnemy(undefined, undefined, 'x1', POS);
    expect(c.name).not.toContain('RÉF ?');
    expect(err).not.toHaveBeenCalled();
  });

  it('réf. bidon → le nom porte la réf. littérale (visible au token/frise) + console.error', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const c = spawnEnemy('creature-fantome-xyz', undefined, 'x2', POS);
    expect(c.name).toBe('RÉF ? « creature-fantome-xyz »');
    expect(err).toHaveBeenCalledWith(expect.stringContaining('irrésoluble'));
  });

  it('réf. VALIDE → aucun repli bruyant (contrôle)', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const c = spawnEnemy('humain', undefined, 'x3', POS);
    expect(c.name).not.toContain('RÉF ?');
    expect(err).not.toHaveBeenCalled();
  });
});

describe('#223/#258 — arme d’authoring (trappingId) hors catalogue', () => {
  it('trappingId inconnu → console.warn (l’arme de rendu reste, générique)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    spawnEnemy(undefined, { name: 'PNJ', char: { B: 10 } }, 'w1', POS, { weapon: 'hache-inconnue' });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('« hache-inconnue »'));
  });

  it('trappingId de catalogue → aucun warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    spawnEnemy(undefined, { name: 'PNJ', char: { B: 10 } }, 'w2', POS, { weapon: 'dague' });
    expect(warn).not.toHaveBeenCalled();
  });

  it('#258 régression Olg (loup-et-saumure) — « hache-d-armes » résout SANS warn au spawn de combat (même voie que le rendu enemyRigProfile)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    spawnEnemy(undefined, { name: 'Olg Blóðsalt', char: { B: 12 } }, 'olg', POS, { weapon: 'hache-d-armes' });
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
