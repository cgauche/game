/**
 * Op `light` — DOUBLE NATURE (objet PASSIF gaté sur le port / sort temporisé), lue au MÊME point
 * (`combatantLights`, vision). Vérifie :
 *  (a) une lanterne PORTÉE (equipped) émet une LightSource ; RANGÉE/non portée → AUCUNE (gate RAW : on
 *      s'éclaire avec une lanterne en main, pas au fond du sac).
 *  (b) un `ActiveEffect.light` (posé par un sort) émet de la lumière par le même canal.
 *  (c) le sort `lumiere` porte une op `light` et l'appliquer pousse un `ActiveEffect.light`.
 */
import { describe, it, expect } from 'vitest';
import { combatantLights } from './vision';
import { spellEffectOps } from './flow';
import { itemFromTrappingById } from '../engine/items';
import { applyOps } from '../engine/ops';
import { findSpellById } from '../data';
import type { Combatant } from '../engine/types';

const pos = { x: 3, y: 3 };
const target = (): Combatant => ({ id: 't', name: 'Cible', activeEffects: [] }) as unknown as Combatant;

describe('op light — OBJET passif gaté sur le port', () => {
  it('lanterne PORTÉE (equipped) → émet une LightSource (rayon du passive)', () => {
    const lant = itemFromTrappingById('lanterne')!;
    lant.equipped = true;
    const sources = combatantLights({ pos, items: [lant] });
    expect(sources).toHaveLength(1);
    expect(sources[0].radiusTiles).toBe(10); // passive op light du catalogue (= 20 m)
    expect(sources[0].pos).toEqual(pos);
  });

  it('lanterne NON portée (rangée dans le sac) → AUCUNE lumière (gate)', () => {
    const lant = itemFromTrappingById('lanterne')!; // equipped:false par défaut, hors loadout
    expect(combatantLights({ pos, items: [lant] })).toEqual([]);
  });

  it('bougie PORTÉE éclaire moins (rayon 5) ; le MAX des émetteurs gagne', () => {
    const bougie = itemFromTrappingById('bougie')!; bougie.equipped = true;
    const lant = itemFromTrappingById('lanterne')!; lant.equipped = true;
    expect(combatantLights({ pos, items: [bougie] })[0].radiusTiles).toBe(5);
    expect(combatantLights({ pos, items: [bougie, lant] })[0].radiusTiles).toBe(10); // max
  });
});

describe('op light — SORT (ActiveEffect.light)', () => {
  it('un ActiveEffect.light émet de la lumière par le même canal', () => {
    const sources = combatantLights({ pos, activeEffects: [{ light: { radiusTiles: 8 } }] });
    expect(sources).toHaveLength(1);
    expect(sources[0].radiusTiles).toBe(8);
  });
});

describe('sort « lumiere » — parité d\'émission', () => {
  it('porte une op `light` (donnée du Flow éditable)', () => {
    const ops = spellEffectOps(findSpellById('lumiere')!.effects);
    const light = ops.find((o) => o.op === 'light') as { op: 'light'; radiusTiles: number } | undefined;
    expect(light, 'le sort Lumière doit porter une op light').toBeTruthy();
    expect(light!.radiusTiles).toBe(10); // cohérent avec une lanterne
  });

  it('appliquer les ops du sort pousse un ActiveEffect.light (temporisé)', () => {
    const c = target();
    const ops = spellEffectOps(findSpellById('lumiere')!.effects);
    applyOps(c, ops, { label: 'Lumière' });
    const eff = (c.activeEffects ?? []).find((e) => e.light);
    expect(eff, 'un ActiveEffect.light doit être posé').toBeTruthy();
    expect(eff!.light!.radiusTiles).toBe(10);
    // ⇒ ce porteur éclaire ensuite via combatantLights (même point que la lanterne portée).
    expect(combatantLights({ pos, activeEffects: c.activeEffects })[0].radiusTiles).toBe(10);
  });
});
