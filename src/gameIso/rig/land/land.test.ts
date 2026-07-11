import { describe, it, expect } from 'vitest';
import { planById, resolveRender } from '../bodyPlan';
import { landPlan } from './composeLand';

const svgOf = (view: 'front' | 'profile' | 'back') =>
  landPlan.resolve('chariot', view, landPlan.restPose()).map((b) => b.parts.map((p) => p.svg).join('')).join('');

describe('Gabarit TERRESTRE — chariot/attelage via le système de plans (réutilisé)', () => {
  it('enregistré dans le registre des plans (auto-découverte plans/defs/)', () => {
    expect(planById('terrestre')).toBe(landPlan);
    expect(landPlan.id).toBe('terrestre');
  });

  it('silhouette procédurale : roues + caisse + timon ; palette à jetons entièrement résolue', () => {
    const svg = svgOf('profile');
    expect(svg).toContain('<circle'); // roues (wheelFace)
    expect(svg).not.toContain('@'); // aucun jeton @bois/@fer/@bache résiduel
  });

  it('mono-vue déclarée (broadside) : face/dos REPLIENT sur le profil pour un id SANS art dédié (art identique)', () => {
    // `chariot` a désormais un art 3-vues dédié (vague A4, land/defs/chariot.ts) : ce n'est plus lui
    // qui illustre le repli. Le repli honnête reste porté par `attelage-generique` (mono-vue par
    // nature, land/defs/attelage-generique.ts) — c'est LUI qui verrouille pickView/foldView.
    const genericSvgOf = (view: 'front' | 'profile' | 'back') =>
      landPlan.resolve('attelage-generique', view, landPlan.restPose()).map((b) => b.parts.map((p) => p.svg).join('')).join('');
    expect(genericSvgOf('front')).toBe(genericSvgOf('profile'));
    expect(genericSvgOf('back')).toBe(genericSvgOf('profile'));
  });

  it('chariot (art 3-vues dédié) : face/dos NE REPLIENT PLUS sur le profil', () => {
    expect(svgOf('front')).not.toBe(svgOf('profile'));
    expect(svgOf('back')).not.toBe(svgOf('profile'));
  });

  it('poses : cahot au roulage, versé à la mort', () => {
    expect(landPlan.deathPose().cahot).toBe(20);
    expect(landPlan.walkPose(0.25).cahot).toBeGreaterThan(0);
  });
});

describe('routage : un véhicule TERRESTRE → gabarit terrestre, JAMAIS la coque de navire', () => {
  it('diligence & charrette (hull.propulsion=terrestre) → plan « terrestre », pas « navire »', () => {
    for (const id of ['diligence', 'charrette']) {
      const r = resolveRender(undefined, undefined, id);
      expect(r.kind).toBe('plan');
      expect(r.plan).toBe('terrestre');
      expect(r.plan).not.toBe('navire'); // le repli accidentel vers le bateau est mort
    }
  });

  it('un véhicule maritime/fluvial reste routé vers la coque de navire (aiguillage par propulsion)', () => {
    expect(resolveRender(undefined, undefined, 'cogue').plan).toBe('navire'); // maritime
    expect(resolveRender(undefined, undefined, 'barge-fluviale').plan).toBe('navire'); // fluvial
  });
});
