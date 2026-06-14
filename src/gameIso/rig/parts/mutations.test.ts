import { describe, it, expect } from 'vitest';
import { LABELS_PHYSIQUES, LABELS_MENTALES } from '../../../data/mutations';
import { MUTATION_VISUALS, mutKey, mutationOverlaysFor, mutationAppearance } from './mutations';
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

  it('chaque physique a un visuel (calques, morpho ou peau) ; Choix du MJ = null', () => {
    for (const label of LABELS_PHYSIQUES) {
      const k = mutKey(label);
      const v = MUTATION_VISUALS[k];
      if (k === mutKey('Choix du MJ')) { expect(v).toBeNull(); continue; }
      expect(!!(v?.overlays?.length || v?.build || v?.legs || v?.skin || v?.faceFlip || v?.eyeG), label).toBe(true);
    }
    expect(MUTATION_VISUALS[mutKey('Corpulent')]?.build).toBeGreaterThan(0);
    expect(MUTATION_VISUALS[mutKey('Émacié')]?.build).toBeLessThan(0);
    expect(MUTATION_VISUALS[mutKey('Court sur pattes')]?.legs).toBeLessThan(1);
    // Peaux CORPS ENTIER = recolorisation palette, pas un patch de torse.
    expect(MUTATION_VISUALS[mutKey('Peau d’acier')]?.skin).toBeTruthy();
    expect(MUTATION_VISUALS[mutKey('Écailles épineuses')]?.skin).toBeTruthy();
    expect(MUTATION_VISUALS[mutKey('Peau brillante')]?.skin).toBeTruthy();
  });

  it('les détails de visage sont limités à la vue de face ; Visage inversé/Œil énorme = vrai visage', () => {
    for (const label of ['Bouche supplémentaire', 'Langue pendante', 'Groin poilu']) {
      for (const ov of MUTATION_VISUALS[mutKey(label)]!.overlays!) expect(ov.view, label).toBe('front');
    }
    expect(MUTATION_VISUALS[mutKey('Visage inversé')]?.faceFlip).toBe(true);
    // Œil énorme remplace l'œil peint EN PLACE (système d'yeux), pas un calque plaqué.
    expect(MUTATION_VISUALS[mutKey('Œil énorme')]?.eyeG).toContain('data-mut="oeil-enorme"');
    expect(mutationAppearance(APP, [mut('Œil énorme')]).eyes?.G).toContain('oeil-enorme');
  });

  it('les mutations mentales ne produisent aucun calque', () => {
    expect(mutationOverlaysFor(LABELS_MENTALES.map((l) => mut(l, 'mentale')))).toEqual([]);
  });

  it('mutationOverlaysFor : physiques → calques ; label inconnu → rien', () => {
    const ovs = mutationOverlaysFor([mut('Tentacule épais'), mut('Groin poilu'), mut('Mutation homebrew')]);
    // Tentacule = MEMBRE REMPLACÉ : bras gauche substitué + poing effacé.
    expect(ovs.some((o) => o.svg.includes('data-mut="tentacule-epais"') && o.bone === 'epauleG' && o.replace)).toBe(true);
    expect(ovs.some((o) => o.bone === 'mainG' && o.replace && o.svg === '')).toBe(true);
    expect(ovs.some((o) => o.svg.includes('data-mut="groin-poilu"') && o.bone === 'tete')).toBe(true);
    expect(ovs.length).toBe(3);
  });

  it('mutationAppearance : morpho + peau appliquées (clamp), même référence sans rien', () => {
    expect(mutationAppearance(APP, [mut('Corpulent')]).build).toBeCloseTo(0.7);
    expect(mutationAppearance({ ...APP, build: 0.9 }, [mut('Corpulent')]).build).toBe(1);
    expect(mutationAppearance(APP, [mut('Émacié')]).build).toBeCloseTo(0.3);
    expect(mutationAppearance(APP, [mut('Court sur pattes')]).legs).toBeCloseTo(0.78);
    // Peau corps entier : la palette @peau est surchargée (prime sur la couleur choisie).
    expect(mutationAppearance(APP, [mut('Peau d’acier')]).colors?.peau).toBe('#8a93a0');
    expect(mutationAppearance({ ...APP, colors: { peau: '#112233' } }, [mut('Écailles épineuses')]).colors?.peau).not.toBe('#112233');
    // Visage inversé : le vrai visage est retourné (flip du slot visage).
    expect(mutationAppearance(APP, [mut('Visage inversé')]).faceFlip).toBe(true);
    expect(mutationAppearance(APP, [mut('Tentacule épais')])).toBe(APP);
    expect(mutationAppearance(APP, undefined)).toBe(APP);
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

  it('Visage inversé : le slot visage est rendu retourné (flip), pas les cheveux', () => {
    const parts = (a: Appearance) =>
      resolveRig(a, NO_EQUIP, {}, undefined, 'front', []).find((b) => b.id === 'tete')!.parts;
    const flipped = parts(mutationAppearance(APP, [mut('Visage inversé')]));
    expect(flipped.filter((p) => p.svg.includes('translate(0,14) scale(1,-1)')).length).toBe(1);
    expect(parts(APP).some((p) => p.svg.includes('scale(1,-1)'))).toBe(false);
  });
});
