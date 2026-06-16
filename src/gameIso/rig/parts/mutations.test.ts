import { describe, it, expect } from 'vitest';
import { LABELS_PHYSIQUES, LABELS_MENTALES, mutationByLabel } from '../../../data/mutations';
import { combatantOverlays, combatantAppearance } from './combatantVisuals';
import { APPEARANCE_ELEMENTS } from './elements';
import { resolveRig } from '../composeRig';
import type { Combatant } from '../../../engine/types';
import type { Appearance } from '../appearance';

const APP: Appearance = { species: 'Humain', sex: 'M', build: 0.5, seed: 3 };
const NO_EQUIP = { weapons: [], armour: [] };
/** Combatant minimal porteur de mutations (les autres champs lus — traits/traumas — sont undefined). */
const cm = (...labels: string[]): Combatant =>
  ({ mutations: labels.map((l) => mutationByLabel(l)).filter(Boolean) } as unknown as Combatant);

describe('apparence data-driven des mutations (LDB 19)', () => {
  it('chaque mutation physique déclare son apparence (sauf Choix du MJ) ; clés de catalogue valides', () => {
    for (const label of LABELS_PHYSIQUES) {
      const m = mutationByLabel(label)!;
      if (label === 'Choix du MJ') { expect(m.appearance).toBeUndefined(); continue; }
      expect(m.appearance, label).toBeTruthy();
      for (const k of m.appearance!.features ?? []) expect(APPEARANCE_ELEMENTS[k], `${label} → ${k}`).toBeTruthy();
    }
  });

  it('combatantOverlays : difformités → calques du catalogue (membre remplacé inclus)', () => {
    const ov = combatantOverlays(cm('Tentacule épais', 'Groin poilu'));
    // Tentacule = MEMBRE REMPLACÉ : bras gauche substitué + poing effacé.
    expect(ov.some((o) => o.svg.includes('data-mut="tentacule-epais"') && o.bone === 'epauleG' && o.replace)).toBe(true);
    expect(ov.some((o) => o.bone === 'mainG' && o.replace && o.svg === '')).toBe(true);
    expect(ov.some((o) => o.svg.includes('data-mut="groin-poilu"') && o.bone === 'tete')).toBe(true);
  });

  it('les mutations mentales ne produisent aucun calque', () => {
    expect(combatantOverlays(cm(...LABELS_MENTALES))).toEqual([]);
  });

  it('combatantAppearance : morpho cumulée (carrure/jambes) + clamp', () => {
    expect(combatantAppearance(APP, cm('Corpulent')).build).toBeCloseTo(0.7);
    expect(combatantAppearance({ ...APP, build: 0.9 }, cm('Corpulent')).build).toBe(1);
    expect(combatantAppearance(APP, cm('Émacié')).build).toBeCloseTo(0.3);
    expect(combatantAppearance(APP, cm('Court sur pattes')).legs).toBeCloseTo(0.78);
  });

  it('combatantAppearance : peau corps entier (prime), œil remplacé, visage inversé', () => {
    // Peau corps entier : la palette @peau est surchargée (prime sur la couleur choisie).
    expect(combatantAppearance(APP, cm("Peau d'acier")).colors?.peau).toBe('#8a93a0');
    expect(combatantAppearance({ ...APP, colors: { peau: '#112233' } }, cm('Écailles épineuses')).colors?.peau).not.toBe('#112233');
    // Œil énorme remplace l'œil peint EN PLACE (clé d'œil → art résolu).
    expect(combatantAppearance(APP, cm('Œil énorme')).eyes?.G).toContain('oeil-enorme');
    expect(combatantAppearance(APP, cm('Visage inversé')).faceFlip).toBe(true);
  });

  it('combatantAppearance : même référence si aucune mutation visuelle (stabilité des props)', () => {
    expect(combatantAppearance(APP, cm())).toBe(APP);
    expect(combatantAppearance(APP, cm('Bête intérieure'))).toBe(APP); // mentale = pas de visuel
  });
});

describe('rendu rig des mutations (resolveRig)', () => {
  const partsOf = (view: 'front' | 'back' | 'profile', c: Combatant) =>
    resolveRig(combatantAppearance(APP, c), NO_EQUIP, {}, undefined, view, combatantOverlays(c)).flatMap((b) => b.parts);

  it('détail de visage : visible de face, absent de dos', () => {
    expect(partsOf('front', cm('Groin poilu')).some((p) => p.svg.includes('data-mut="groin-poilu"'))).toBe(true);
    expect(partsOf('back', cm('Groin poilu')).some((p) => p.svg.includes('data-mut="groin-poilu"'))).toBe(false);
  });

  it('cornes : toutes vues, rendues DERRIÈRE la part de tête (behind → layer -2)', () => {
    for (const view of ['front', 'back', 'profile'] as const) {
      const corne = partsOf(view, cm('Cornes asymétriques')).find((p) => p.svg.includes('data-mut="cornes-asymetriques"'));
      expect(corne, view).toBeTruthy();
      expect(corne!.layer).toBe(-2);
    }
  });

  it('Court sur pattes raccourcit les jambes (os cuisse plus court)', () => {
    const cuisse = (c: Combatant) =>
      resolveRig(combatantAppearance(APP, c), NO_EQUIP, {}, undefined, 'front', []).find((b) => b.id === 'cuisseG')!.scale[1];
    expect(cuisse(cm('Court sur pattes'))).toBeLessThan(cuisse(cm()));
  });

  it('Visage inversé : le slot visage est rendu retourné (flip), pas les cheveux', () => {
    const tete = (c: Combatant) =>
      resolveRig(combatantAppearance(APP, c), NO_EQUIP, {}, undefined, 'front', []).find((b) => b.id === 'tete')!.parts;
    expect(tete(cm('Visage inversé')).filter((p) => p.svg.includes('translate(0,14) scale(1,-1)')).length).toBe(1);
    expect(tete(cm()).some((p) => p.svg.includes('scale(1,-1)'))).toBe(false);
  });
});
