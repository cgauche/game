import { describe, it, expect, vi } from 'vitest';
import { SLOT_LAYER, LAYER_COL } from './bones';
import type { Appearance, RigSpeciesId } from './appearance';

const NO_EQUIP = { weapons: [], armour: [] };
const HUMAN: Appearance = { species: 'Humain' as RigSpeciesId, sex: 'M', build: 0.5, seed: 3 };
const COL_MARK = 'M-9 3 Q0 -1 9 3'; // art de col synthétique — n'existe dans aucun art réel

describe('composeRig — canal `col` de tenue (#633, socle SANS adoption)', () => {
  it('une tenue avec `col` empile sa part sur l\'os `tete`, entre visage (0) et cheveux (1)', async () => {
    vi.resetModules();
    vi.doMock('./parts/career', async () => {
      const actual = await vi.importActual<typeof import('./parts/career')>('./parts/career');
      return { ...actual, colFor: () => COL_MARK };
    });
    const { resolveRig } = await import('./composeRig');
    const bones = resolveRig(HUMAN, NO_EQUIP, {}, 'Nu', 'back');
    const tete = bones.find((b) => b.id === 'tete');
    expect(tete, 'os `tete` doit être présent').toBeTruthy();
    const colPart = tete!.parts.find((p) => p.svg.includes(COL_MARK));
    expect(colPart, 'la part de col doit apparaître sur l\'os `tete`').toBeTruthy();
    expect(colPart!.layer).toBe(LAYER_COL);
    expect(colPart!.layer).toBeGreaterThan(SLOT_LAYER.visage);
    expect(colPart!.layer).toBeLessThan(SLOT_LAYER.cheveux);
    vi.doUnmock('./parts/career');
    vi.resetModules();
  });

  it('sans `col` déclaré (défaut réel — aucune tenue n\'adopte le canal) : sortie INCHANGÉE', async () => {
    vi.resetModules();
    const { resolveRig } = await import('./composeRig');
    const bones = resolveRig(HUMAN, NO_EQUIP, {}, 'Nu', 'back');
    const tete = bones.find((b) => b.id === 'tete');
    expect(tete, 'os `tete` doit être présent').toBeTruthy();
    for (const p of tete!.parts) expect(p.layer).not.toBe(LAYER_COL);
  });
});
