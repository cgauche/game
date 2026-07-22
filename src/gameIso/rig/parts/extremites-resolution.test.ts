import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolveParts } from './resolve';
import { pickView } from './types';
import { ARMOUR } from './armour';
import { FOOT, CLAWFOOT, PLAINFOOT, HAND, NECK } from './bodies/extremites';
import type { EquipCtx } from './equipment';
import type { ItemInstance } from '../../../engine/types';

const empty: EquipCtx = { weapons: [], armour: [] };

// LOT 0 (#633/#736) — pied/main/cou résolus par la MÊME table de priorité que tete/torse/jambes.

describe('extrémités — résolution uniforme (structure)', () => {
  const src = readFileSync(new URL('./resolve.ts', import.meta.url), 'utf8');

  it("pied/main/cou passent par la chaîne priorisée equipWinner (contrat positif)", () => {
    expect(src).toContain("equipWinner('pied'");
    expect(src).toContain("equipWinner('main'");
    expect(src).toContain("equipWinner('cou'");
  });

  it("plus aucune affectation directe d'un CONST à out.pied/main/cou", () => {
    // Le repli n'est plus branché en dur : ni P(FOOT/CLAWFOOT/PLAINFOOT) ni P(HAND) ni P(NECK)
    // en affectation directe — tout transite par equipWinner + repli d'espèce.
    expect(src).not.toMatch(/out\.pied\s*=\s*P\(\s*footStyle/);
    expect(src).not.toMatch(/out\.main\s*=\s*P\(\s*HAND\s*\)/);
    expect(src).not.toMatch(/out\.cou\s*=\s*P\(\s*NECK\s*\)/);
  });

  it('NECK reste la sous-couche garantie du cou (surcouche)', () => {
    expect(src).toContain('pickView(NECK, view) +');
  });
});

describe('extrémités — pilotables par une armure (chair ≠ repli)', () => {
  const MARK = { pied: '<g id="test-soleret"/>', main: '<g id="test-gantelet"/>', cou: '<g id="test-gorgerin"/>' };
  afterEach(() => {
    // Restaure ARMOUR.plaque à son état d'origine (aucun de ces slots n'y était déclaré).
    delete (ARMOUR.plaque as Record<string, unknown>).pied;
    delete (ARMOUR.plaque as Record<string, unknown>).main;
    delete (ARMOUR.plaque as Record<string, unknown>).cou;
  });

  it('une armure de plaque couvrant pied/main/cou pilote ces zones', () => {
    (ARMOUR.plaque as Record<string, unknown>).pied = MARK.pied;
    (ARMOUR.plaque as Record<string, unknown>).main = MARK.main;
    (ARMOUR.plaque as Record<string, unknown>).cou = MARK.cou;
    const item: ItemInstance = {
      uid: 'a', label: 'Harnois de plaque', kind: 'armor', qualities: [], pa: 5,
      locs: ['corps', 'brasG', 'brasD', 'jambeG', 'jambeD'], enc: 3, equipped: true,
    };
    const r = resolveParts('Humain', 'M', 'soldat', { weapons: [], armour: [item] }, {}, 1);

    expect(r.pied?.svg).toContain('test-soleret');
    expect(r.pied?.svg).not.toBe(pickView(FOOT, 'front'));
    expect(r.main?.svg).toContain('test-gantelet');
    expect(r.main?.svg).not.toBe(pickView(HAND, 'front'));
    // Cou = surcouche : NECK garanti DESSOUS + gorgerin par-dessus.
    expect(r.cou?.svg).toContain('test-gorgerin');
    expect(r.cou?.svg).toContain(pickView(NECK, 'front'));
    expect(r.cou?.svg).not.toBe(pickView(NECK, 'front'));
  });
});

describe('extrémités — sans équipement ni tenue : repli d\'espèce exact', () => {
  it('soldat (chaussé) → botte FOOT, poing HAND, cou = NECK seul', () => {
    const r = resolveParts('Humain', 'M', 'soldat', empty, {}, 1);
    expect(r.pied?.svg).toBe(pickView(FOOT, 'front'));
    expect(r.main?.svg).toBe(pickView(HAND, 'front'));
    expect(r.cou?.svg).toBe(pickView(NECK, 'front'));
  });

  it('squelette (bareFoot monstre) → pied griffu CLAWFOOT', () => {
    const r = resolveParts('Mort-vivant', 'M', 'squelette', empty, {}, 1);
    expect(r.pied?.svg).toBe(pickView(CLAWFOOT, 'front'));
  });

  it('nu (civilisé va-nu-pieds) → pied lisse PLAINFOOT', () => {
    const r = resolveParts('Humain', 'M', 'nu', empty, {}, 1);
    expect(r.pied?.svg).toBe(pickView(PLAINFOOT, 'front'));
  });
});
