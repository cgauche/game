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

  it('mono-vue déclarée (broadside) : face/dos REPLIENT sur le profil (art identique)', () => {
    // Couverture honnête : une seule silhouette dessinée → les 3 vues rendent le même art (repli pickView).
    expect(svgOf('front')).toBe(svgOf('profile'));
    expect(svgOf('back')).toBe(svgOf('profile'));
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
