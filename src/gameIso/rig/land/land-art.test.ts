import { describe, it, expect } from 'vitest';
import { LAND_ARTS } from './_registry.generated';
import { landPlan, landArtOf } from './composeLand';
import { declaredViews, MISSING_ART } from '../viewArt';
import { findVehicleById } from '../../../data';

/**
 * Le gabarit terrestre a son PROPRE registre d'art par id (`LAND_ARTS`, patron `ENGIN_ARTS`/`SHIP_ARTS`) :
 * chaque véhicule terrestre (`vehicles.json`) est dessiné. Un id sans def tombe sur le REPLI VISIBLE (#223) —
 * jamais sur un attelage générique silencieux. La liste d'ids n'est PAS figée ici (une future def par
 * véhicule ne doit pas casser ce test) — seule la FORME du registre est vérifiée.
 */
describe('arts de véhicule terrestre par id (LAND_ARTS, patron ENGIN_ARTS)', () => {
  it('registre auto-chargé, non vide, ids uniques', () => {
    const ids = LAND_ARTS.map((a) => a.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('chaque id du registre est un véhicule réel (FK vers vehicles.json) ; aucun repli générique en donnée', () => {
    // LDB 70 p.306 : la table de voyage ne donne aucun profil de coque (E/B) pour certains véhicules
    // (ex. `chariot`) — l'art par id reste légitime (affichage hub/marché/scène) sans `hull`, mais
    // l'entrée ne doit alors pas porter de facette `ship` (ce n'est pas un bateau).
    for (const a of LAND_ARTS) {
      const vehicle = findVehicleById(a.id);
      expect(vehicle, a.id).toBeDefined();
      if (vehicle?.hull) {
        expect(vehicle.hull.propulsion, a.id).toBe('terrestre');
      } else {
        expect(vehicle?.ship, a.id).toBeUndefined();
      }
    }
  });

  it('couverture DÉCLARÉE : chaque def porte au moins la vue profile, non vide', () => {
    for (const a of LAND_ARTS) {
      expect(declaredViews(a), a.id).toContain('profile');
      expect(a.profile!().length, a.id).toBeGreaterThan(0);
    }
  });

  it('un id de véhicule terrestre INCONNU du registre → REPLI VISIBLE (#223), jamais un throw', () => {
    expect(landArtOf('espece-inconnue-xyz')).toBe(MISSING_ART);
  });

  it.each(['charrette', 'diligence', 'chariot-leger', 'chariot-moyen', 'chariot-lourd'])(
    "resolve('%s') rend une silhouette non vide, palette entièrement résolue",
    (id) => {
      const svg = landPlan.resolve(id, 'profile', {})[0].parts[0].svg;
      expect(svg.length).toBeGreaterThan(0);
      expect(svg).not.toContain('@');
    },
  );

  it('REPLI VISIBLE mono-vue : face/dos REPLIENT sur le profil (silhouette d’erreur identique)', () => {
    const front = landPlan.resolve('id-inconnu-xyz', 'front', {})[0].parts[0].svg;
    const profile = landPlan.resolve('id-inconnu-xyz', 'profile', {})[0].parts[0].svg;
    const back = landPlan.resolve('id-inconnu-xyz', 'back', {})[0].parts[0].svg;
    expect(profile).toContain('#ff2fb0'); // magenta d'alarme du repli
    expect(front).toBe(profile);
    expect(back).toBe(profile);
  });
});
