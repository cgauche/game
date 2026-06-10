import { describe, it, expect } from 'vitest';
import { moveReachFor } from './path';
import type { Scene } from './scene';
import { grantTrait, removeGrantedTrait } from '../engine/grantedTraits';
import { applyOps } from '../engine/ops';
import { endOfRound } from '../engine/conditions';
import { hasTrait } from '../engine/traits/dispatch';
import type { Combatant } from '../engine/types';

/**
 * Jalon 2.6 — Traits temporisés accordés par un sort (op `grantTrait`) : Envol (Vol héros),
 * Effrayant (Peur + échelle DR), Vaincre les impies (Haine ciblée)… Le trait est posé dans
 * `c.traits` (vu par les consommateurs existants), la psy dérivée re-synchronisée, et tout
 * est retiré à l'expiration de l'ActiveEffect porteur (fin de Round OU purge d'horloge).
 */
const dummy = (p: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'x', name: 'X', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 35, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 20, max: 20 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as Combatant);

const scene = (w: number, h: number, walls: string[] = []): Scene => {
  const tiles = new Array(w * h).fill('herbe');
  for (const k of walls) {
    const [x, y] = k.split(',').map(Number);
    tiles[y * w + x] = 'mur';
  }
  return {
    id: 's', name: 's', dimensions: { w, h }, ambiance: 'jour',
    tiles, entities: [], buildings: [], dialogues: [], triggers: [], encounters: [],
  } as unknown as Scene;
};

describe('grantTrait / removeGrantedTrait (engine/grantedTraits)', () => {
  it('pose le trait, le retrait n’enlève qu’UNE instance (jamais le natif)', () => {
    const c = dummy({ traits: ['Vol 60'] }); // Vol NATIF
    grantTrait(c, 'Vol 35'); // Envol par-dessus
    expect(c.traits).toEqual(['Vol 60', 'Vol 35']);
    removeGrantedTrait(c, 'Vol 35');
    expect(c.traits).toEqual(['Vol 60']); // le natif survit
    removeGrantedTrait(c, 'Vol 35'); // déjà retiré → no-op
    expect(c.traits).toEqual(['Vol 60']);
  });

  it('Peur accordée → causesPeur dérivé ; retirée → champ nettoyé ; psychTraits de MUTATION préservés', () => {
    const c = dummy({ psychTraits: [{ type: 'frenesie' }] }); // « Colère impie » (mutation)
    grantTrait(c, 'Peur 2');
    expect(c.causesPeur).toBe(2);
    removeGrantedTrait(c, 'Peur 2');
    expect(c.causesPeur).toBeUndefined();
    expect(c.psychTraits).toEqual([{ type: 'frenesie' }]); // la mutation n'est PAS perdue
  });

  it('Haine accordée (Vaincre les impies) → psychTrait ciblé, retiré proprement', () => {
    const c = dummy({});
    grantTrait(c, 'Haine (Morts-vivants)');
    expect(c.psychTraits?.some((t) => t.type === 'haine')).toBe(true);
    removeGrantedTrait(c, 'Haine (Morts-vivants)');
    expect(c.psychTraits?.some((t) => t.type === 'haine') ?? false).toBe(false);
  });
});

describe('op grantTrait (ops) + expiration de fin de Round', () => {
  it('Effrayant : Peur 1 (+1 par +3 DR) — Indice échelonné au DR du jet', () => {
    const c = dummy({});
    applyOps(c, [{ op: 'grantTrait', trait: 'Peur', indice: 1, indicePerSL: { every: 3, amount: 1 } }], {
      label: 'Effrayant', defaultDurationRounds: 4, sl: 6,
    });
    expect(c.traits).toContain('Peur 3'); // 1 + ⌊6/3⌋
    expect(c.causesPeur).toBe(3);
    expect(c.activeEffects?.[0]?.grantedTrait).toBe('Peur 3');
  });

  it('Envol : Vol (Agilité) — l’Indice est l’Agilité du lanceur ; expire en fin de Round', () => {
    const c = dummy({}); // Ag 35
    applyOps(c, [{ op: 'grantTrait', trait: 'Vol', indice: { charOf: 'Ag' } }], {
      label: 'Envol', defaultDurationRounds: 1,
    });
    expect(hasTrait(c.traits, 'Vol')).toBe(true);
    expect(c.traits).toContain('Vol 35');
    endOfRound(c); // 1 Round écoulé → l'effet expire et retire le trait
    expect(hasTrait(c.traits, 'Vol')).toBe(false);
    expect(c.activeEffects ?? []).toHaveLength(0);
  });
});

describe('moveReachFor — Vol héros (Envol, Jalon 2.6)', () => {
  it('au sol, un mur infranchissable bloque ; en Vol, on le survole (atterrissage libre)', () => {
    // mur vertical complet en x=2 : aucune case au-delà n'est atteignable au sol.
    const s = scene(6, 3, ['2,0', '2,1', '2,2']);
    const walker = dummy({});
    const flyer = dummy({ traits: ['Vol 35'] });
    const ground = moveReachFor(walker, s, { x: 0, y: 1 }, 4, new Set());
    expect(ground.has('4,1')).toBe(false);
    const air = moveReachFor(flyer, s, { x: 0, y: 1 }, 4, new Set());
    expect(air.has('4,1')).toBe(true); // survole le mur
    expect(air.has('2,1')).toBe(false); // mais n'ATTERRIT pas sur le mur
  });
});
