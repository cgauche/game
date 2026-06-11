import { describe, it, expect } from 'vitest';
import { LABELS_PHYSIQUES, LABELS_MENTALES } from '../../../data/mutations';
import { MUTATION_VISUALS, mutKey, mutationOverlaysFor, mutationAppearance, randomMutationOverlays } from './mutations';
import { resolveRig } from '../composeRig';
import type { Mutation } from '../../../engine/corruption';
import type { Appearance } from '../appearance';

const mut = (label: string, kind: Mutation['kind'] = 'physique'): Mutation => ({ label, kind, roll: 1 });
const APP: Appearance = { species: 'Humain', sex: 'M', build: 0.5, seed: 3 };
const NO_EQUIP = { weapons: [], armour: [] };

describe('registre des visuels de mutation (LDB 19)', () => {
  it('couvre exactement les labels de la table physique', () => {
    for (const label of LABELS_PHYSIQUES) {
      expect(MUTATION_VISUALS, `entrée manquante : ${label}`).toHaveProperty(mutKey(label));
    }
    expect(Object.keys(MUTATION_VISUALS).length).toBe(LABELS_PHYSIQUES.length);
  });

  it('chaque physique non-morpho a des calques ; les morpho ont build/legs ; Choix du MJ = null', () => {
    const morpho: Record<string, 'build' | 'legs'> = {
      [mutKey('Corpulent')]: 'build', [mutKey('Émacié')]: 'build', [mutKey('Court sur pattes')]: 'legs',
    };
    for (const label of LABELS_PHYSIQUES) {
      const k = mutKey(label);
      const v = MUTATION_VISUALS[k];
      if (k === mutKey('Choix du MJ')) { expect(v).toBeNull(); continue; }
      if (morpho[k]) { expect(v?.[morpho[k]], label).toBeTruthy(); continue; }
      expect(v?.overlays?.length, label).toBeGreaterThan(0);
    }
  });

  it('les détails de visage sont limités à la vue de face', () => {
    for (const label of ['Œil énorme', 'Bouche supplémentaire', 'Visage inversé', 'Langue pendante', 'Groin poilu']) {
      for (const ov of MUTATION_VISUALS[mutKey(label)]!.overlays!) expect(ov.view, label).toBe('front');
    }
  });

  it('les mutations mentales ne produisent aucun calque', () => {
    expect(mutationOverlaysFor(LABELS_MENTALES.map((l) => mut(l, 'mentale')))).toEqual([]);
  });

  it('mutationOverlaysFor : physiques → calques ; label inconnu → rien', () => {
    const ovs = mutationOverlaysFor([mut('Tentacule épais'), mut('Groin poilu'), mut('Mutation homebrew')]);
    expect(ovs.some((o) => o.svg.includes('data-mut="tentacule-epais"') && o.bone === 'epauleD')).toBe(true);
    expect(ovs.some((o) => o.svg.includes('data-mut="groin-poilu"') && o.bone === 'tete')).toBe(true);
    expect(ovs.length).toBe(2);
  });

  it('mutationAppearance : morpho appliquée (clamp), même référence sans morpho', () => {
    expect(mutationAppearance(APP, [mut('Corpulent')]).build).toBeCloseTo(0.7);
    expect(mutationAppearance({ ...APP, build: 0.9 }, [mut('Corpulent')]).build).toBe(1);
    expect(mutationAppearance(APP, [mut('Émacié')]).build).toBeCloseTo(0.3);
    expect(mutationAppearance(APP, [mut('Court sur pattes')]).legs).toBeCloseTo(0.78);
    expect(mutationAppearance(APP, [mut('Tentacule épais')])).toBe(APP);
    expect(mutationAppearance(APP, undefined)).toBe(APP);
  });

  it('randomMutationOverlays : déterministe, cornes toujours présentes (tell mutant)', () => {
    expect(randomMutationOverlays(42)).toEqual(randomMutationOverlays(42));
    for (const seed of [0, 1, 7, 42, 1234]) {
      const ovs = randomMutationOverlays(seed);
      expect(ovs.some((o) => o.svg.includes('data-mut="cornes-asymetriques"'))).toBe(true);
      expect(ovs.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('rendu rig des mutations (resolveRig)', () => {
  const partsOf = (view: 'front' | 'back' | 'profile', labels: string[]) => {
    const bones = resolveRig(APP, NO_EQUIP, {}, undefined, view, mutationOverlaysFor(labels.map((l) => mut(l))));
    return bones.flatMap((b) => b.parts);
  };

  it('détail de visage : visible de face, absent de dos', () => {
    expect(partsOf('front', ['Groin poilu']).some((p) => p.svg.includes('data-mut="groin-poilu"'))).toBe(true);
    expect(partsOf('back', ['Groin poilu']).some((p) => p.svg.includes('data-mut="groin-poilu"'))).toBe(false);
  });

  it('cornes : toutes vues, rendues DERRIÈRE la part de tête (behind → layer -2)', () => {
    for (const view of ['front', 'back', 'profile'] as const) {
      const corne = partsOf(view, ['Cornes asymétriques']).find((p) => p.svg.includes('data-mut="cornes-asymetriques"'));
      expect(corne, view).toBeTruthy();
      expect(corne!.layer).toBe(-2);
    }
  });

  it('Court sur pattes raccourcit les jambes (os cuisse plus court)', () => {
    const cuisse = (a: Appearance) =>
      resolveRig(a, NO_EQUIP, {}, undefined, 'front', []).find((b) => b.id === 'cuisseG')!.scale[1];
    expect(cuisse(mutationAppearance(APP, [mut('Court sur pattes')]))).toBeLessThan(cuisse(APP));
  });
});
