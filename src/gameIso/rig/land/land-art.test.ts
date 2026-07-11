import { describe, it, expect } from 'vitest';
import { LAND_ARTS } from './_registry.generated';
import { landPlan, landArtOf } from './composeLand';
import { declaredViews } from '../viewArt';
import { findVehicleById } from '../../../data';

/**
 * Vague A4 (machinerie) — le gabarit terrestre a désormais son PROPRE registre d'art par id
 * (`LAND_ARTS`, patron `ENGIN_ARTS`/`SHIP_ARTS`) : un véhicule terrestre (`vehicles.json`,
 * `hull.propulsion === 'terrestre'`) SANS def dédiée retombe sur `attelage-generique`. La liste
 * d'ids n'est PAS figée ici (une future def par véhicule ne doit pas casser ce test) — seule la
 * FORME du registre est vérifiée.
 */
describe('arts de véhicule terrestre par id (LAND_ARTS, patron ENGIN_ARTS)', () => {
  it('registre auto-chargé, non vide, ids uniques ; porte au moins le repli `attelage-generique`', () => {
    const ids = LAND_ARTS.map((a) => a.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('attelage-generique');
  });

  it('chaque id du registre AUTRE que le repli générique est un véhicule terrestre réel (FK vers vehicles.json)', () => {
    // LDB p.306 : la table de voyage ne donne aucun profil de coque (E/B) pour certains véhicules
    // (ex. `chariot`) — l'art par id reste légitime (affichage hub/marché/scène) sans `hull`, mais
    // l'entrée ne doit alors pas porter de facette `ship` (ce n'est pas un bateau).
    for (const a of LAND_ARTS) {
      if (a.id === 'attelage-generique') continue;
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

  it('un id de véhicule terrestre INCONNU du registre retombe sur l’attelage générique (jamais un throw)', () => {
    expect(landArtOf('espece-inconnue-xyz')).toBe(landArtOf('attelage-generique'));
  });

  it.each(['charrette', 'diligence', 'chariot'])(
    "resolve('%s') rend une silhouette non vide, palette entièrement résolue (repli honnête si art absent)",
    (id) => {
      const svg = landPlan.resolve(id, 'profile', {})[0].parts[0].svg;
      expect(svg.length).toBeGreaterThan(0);
      expect(svg).not.toContain('@');
    },
  );

  it('mono-vue déclarée : face/dos REPLIENT sur le profil pour le repli générique (art identique)', () => {
    const front = landPlan.resolve('attelage-generique', 'front', {})[0].parts[0].svg;
    const profile = landPlan.resolve('attelage-generique', 'profile', {})[0].parts[0].svg;
    const back = landPlan.resolve('attelage-generique', 'back', {})[0].parts[0].svg;
    expect(front).toBe(profile);
    expect(back).toBe(profile);
  });
});
