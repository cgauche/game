import { describe, it, expect } from 'vitest';
import { resolveRig } from './composeRig';
import type { Appearance } from './appearance';
import type { EquipCtx } from './parts/equipment';

const app: Appearance = { species: 'Humain', sex: 'M', build: 0.5, seed: 7 };
const equip: EquipCtx = { weapons: [], armour: [] };

describe('resolveRig', () => {
  it('produit des os triés par z croissant', () => {
    const bones = resolveRig(app, equip, {});
    for (let i = 1; i < bones.length; i++) expect(bones[i].z).toBeGreaterThanOrEqual(bones[i - 1].z);
  });
  it('attache la tenue de torse à l’os torse', () => {
    const bones = resolveRig(app, equip, {});
    const torse = bones.find((b) => b.id === 'torse');
    expect(torse?.parts.some((p) => p.svg.includes('<'))).toBe(true);
  });
  it('marque en miroir les parts du côté droit (slots symétriques)', () => {
    const bones = resolveRig(app, equip, {});
    const epauleD = bones.find((b) => b.id === 'epauleD');
    expect(epauleD?.parts.some((p) => p.mirror)).toBe(true);
  });
  it('déterministe : mêmes entrées → même sortie', () => {
    expect(JSON.stringify(resolveRig(app, equip, {}))).toBe(JSON.stringify(resolveRig(app, equip, {})));
  });
});
