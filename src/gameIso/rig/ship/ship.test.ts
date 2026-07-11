import { describe, it, expect } from 'vitest';
import { planById } from '../bodyPlan';
import { shipPlan } from './composeShip';

const svgOf = (rig: string) =>
  shipPlan.resolve(rig, 'profile', shipPlan.restPose()).map((b) => b.parts.map((p) => p.svg).join('')).join('');

describe('Gabarit NAVIRE — rendu via le système de plans (réutilisé, pas dupliqué)', () => {
  it('enregistré dans le registre des plans (auto-découverte plans/defs/)', () => {
    expect(planById('navire')).toBe(shipPlan);
    expect(shipPlan.id).toBe('navire');
  });

  it('le gréement (donnée hull.rig) pilote la silhouette : voile vs avirons vs mixte', () => {
    const voile = svgOf('voile');
    const avirons = svgOf('avirons');
    const mixte = svgOf('mixte');
    // Voile : mât (ligne jusqu'à y=-68) + voile, PAS de rames.
    expect(voile).toContain('y2="-68"');
    expect(voile).not.toContain('x1="-24" y1="-5"');
    // Avirons : rames, PAS de mât.
    expect(avirons).toContain('x1="-24" y1="-5"');
    expect(avirons).not.toContain('y2="-68"');
    // Mixte : les deux.
    expect(mixte).toContain('y2="-68"');
    expect(mixte).toContain('x1="-24" y1="-5"');
  });

  it('coque toujours présente ; palette à jetons entièrement résolue (aucun @token résiduel)', () => {
    const svg = svgOf('voile');
    expect(svg).toContain('<path d="M-38 -2'); // coque
    expect(svg).not.toContain('@'); // tous les jetons @corps/@vet1/@cuir substitués par la palette
  });

  it('poses réutilisées : roulis au repos, gîte à la mort (delta sur l’os « coque »)', () => {
    expect(shipPlan.idlePose!(0.25).coque).toBeGreaterThan(0); // roule
    expect(shipPlan.deathPose().coque).toBe(22); // sombre/chavire
    expect(shipPlan.hasView('navire', 'profile')).toBe(true);
  });
});

describe('routage : un véhicule à coque → gabarit navire (resolveRender, data-driven)', () => {
  it('résout par ID SEUL vers le plan navire + ID comme espèce (route l’art de coque SHIP_ARTS)', async () => {
    const { resolveRender } = await import('../bodyPlan');
    const byId = resolveRender(undefined, undefined, 'cogue'); // voile, 25 m
    expect(byId.kind).toBe('plan');
    expect(byId.plan).toBe('navire');
    expect(byId.species).toBe('cogue'); // id → art de coque dédié (repli gréement dans composeShip)
    expect(byId.scale).toBeGreaterThan(1); // 25 m → > 1
    const byId2 = resolveRender(undefined, undefined, 'langskip'); // mixte
    expect(byId2.plan).toBe('navire');
    expect(byId2.species).toBe('langskip');
    // un véhicule TERRESTRE (diligence) n'est PAS un navire → gabarit terrestre (cf. land.test.ts).
    expect(resolveRender(undefined, undefined, 'diligence').plan).not.toBe('navire');
  });

  it('un LABEL de véhicule (ids stables uniquement, doctrine ids) ne résout PAS le plan navire', async () => {
    const { resolveRender } = await import('../bodyPlan');
    // « Langskip » est le LABEL (affichage) de l'id `langskip` — passer le label ne doit PAS
    // matcher la coque (jumelle du garde `pickBackend.tsx:161-162` : la ref doit être un id stable).
    expect(resolveRender(undefined, undefined, 'Langskip').plan).not.toBe('navire');
  });
});
