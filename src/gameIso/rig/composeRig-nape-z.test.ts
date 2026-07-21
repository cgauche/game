import { describe, it, expect } from 'vitest';
import { resolveRig } from './composeRig';
import type { Appearance, RigSpeciesId } from './appearance';

const NO_EQUIP = { weapons: [], armour: [] };
const HUMAN: Appearance = { species: 'Humain' as RigSpeciesId, sex: 'M', build: 0.5, seed: 3 };
// début du path de la nuque (`BACK_NAPE`, cf. parts/cosmetic.ts) — motif stable, non partagé par
// d'autres parts.
const BACK_NAPE = 'M-3.6 11.2 Q0 13.2 3.6 11.2';
const TORSE_Z = 5; // skeletons.ts : torse.z
const TETE_Z = 7; // skeletons.ts : tete.z

describe('composeRig — la nuque de dos se peint SOUS le torse (pas par-dessus, #633 F1)', () => {
  it("vue 'back' : la part de nuque vit dans une entrée bones id='tete' à z=torse.z-0.5 (< torse)", () => {
    const bones = resolveRig(HUMAN, NO_EQUIP, {}, 'Nu', 'back');
    const napeBones = bones.filter((b) => b.id === 'tete' && b.parts.some((p) => p.svg.includes(BACK_NAPE)));
    expect(napeBones.length, 'aucune entrée bones ne porte la nuque de dos').toBeGreaterThan(0);
    for (const b of napeBones) {
      expect(b.z).toBe(TORSE_Z - 0.5);
      expect(b.z).toBeLessThan(TORSE_Z);
    }
    // aucune entrée `tete` au z=7 (l'ancien emplacement, PAR-DESSUS le torse) ne porte la nuque.
    const staleNape = bones.filter((b) => b.id === 'tete' && b.z === TETE_Z && b.parts.some((p) => p.svg.includes(BACK_NAPE)));
    expect(staleNape).toHaveLength(0);
  });

  it("vue 'front' : la part de visage reste sur l'entrée tete à z=7 (anti-régression)", () => {
    const bones = resolveRig(HUMAN, NO_EQUIP, {}, 'Nu', 'front');
    const teteBones = bones.filter((b) => b.id === 'tete' && b.z === TETE_Z);
    expect(teteBones.length, "aucune entrée bones 'tete' à z=7 en vue front").toBeGreaterThan(0);
    // la nuque de dos n'apparaît jamais en vue front.
    const napeInFront = bones.some((b) => b.parts.some((p) => p.svg.includes(BACK_NAPE)));
    expect(napeInFront).toBe(false);
  });
});
