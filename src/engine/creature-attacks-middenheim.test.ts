import { describe, it, expect } from 'vitest';
import { creatureAttacks } from './creatureAttacks';
import { findCreatureById } from '../data';
import type { TraitList } from './statEntry';

/** #60 — les capacités spéciales du bestiaire de Middenheim sont mécanisées en DONNÉE (un trait
 *  `grantsManeuvers` → une `ManeuverDef`), résolues par `creatureAttacks` comme toute attaque
 *  naturelle. Garde-fou : la donnée reste branchée (pas de trait descriptif mort). */
describe('#60 attaques spéciales du bestiaire de Middenheim', () => {
  it('Spectre — Frisson paralysant : attaque de mêlée (CC), 1 Sonné par DR, aucun dégât', () => {
    const spectre = findCreatureById('spectre-middenheim');
    expect(spectre).toBeDefined();
    const atk = creatureAttacks(spectre!.traits as TraitList).find((a) => a.def.id === 'frisson-paralysant');
    expect(atk).toBeDefined();
    expect(atk!.kind).toBe('etreinte');
    expect(atk!.trigger).toBe('action');
    expect(atk!.stat).toBe('capacite-de-combat');
    const ops = JSON.stringify(atk!.def.effects);
    expect(ops).toContain('"id":"sonne"');
    expect(ops).toContain('"valuePerSL"');
    expect(ops).not.toContain('"op":"wounds"'); // n'inflige jamais de dégâts
  });

  it('Prédateur sanglant — Hurlement : gratuit (1 Avantage), zone, 3 Assourdi + Test de Calme → 3 Brisé', () => {
    const pred = findCreatureById('predateur-sanglant');
    expect(pred).toBeDefined();
    const atk = creatureAttacks(pred!.traits as TraitList).find((a) => a.def.id === 'hurlement-de-la-bete-indomptable');
    expect(atk).toBeDefined();
    expect(atk!.kind).toBe('hurlement');
    expect(atk!.trigger).toBe('free');
    expect(atk!.avantage).toBe(1);
    const ops = JSON.stringify(atk!.def.effects);
    expect(ops).toContain('"id":"assourdi"');
    expect(ops).toContain('"skill":{"id":"calme"}');
    expect(ops).toContain('"id":"brise"');
  });
});
