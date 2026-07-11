import { describe, it, expect } from 'vitest';
import { SHIP_ARTS } from './_registry.generated';
import { shipPlan, shipArtOf, shipArt } from './composeShip';
import { declaredViews } from '../viewArt';
import { findVehicleById } from '../../../data';

/**
 * Vague A1 du front art naval — chaque type de navire (`vehicles.json`, `hull` maritime/fluvial)
 * a son PROPRE art de coque (`defs/<id>.ts`), routé par ID via SHIP_ARTS ; le procédural par
 * gréement n'est plus qu'un REPLI pour les ids sans def.
 */
describe('arts de coque par id (SHIP_ARTS, patron ENGIN_ARTS)', () => {
  it('registre auto-chargé : les 20 coques de vehicles.json sont dessinées', () => {
    expect(SHIP_ARTS.map((a) => a.id).sort()).toEqual([
      'barge',
      'barge-fluviale',
      'barque-fluviale',
      'bateau-de-patrouille',
      'bateau-tresor-cathayen',
      'boutre-d-inja',
      'caraque',
      'caravelle-tileenne',
      'chaloupe',
      'chebec-arabien',
      'cogue',
      'coracle',
      'croiseur',
      'esquif',
      'galere-de-guerre',
      'galion-bretonnien',
      'grande-barge',
      'knarr',
      'langskip',
      'loup-imperial',
    ]);
  });

  it('chaque id du registre est un véhicule à coque réel (FK vers vehicles.json)', () => {
    for (const a of SHIP_ARTS) expect(findVehicleById(a.id)?.hull, a.id).toBeTruthy();
  });

  it('couverture DÉCLARÉE : chaque def porte au moins la vue profile, non vide', () => {
    for (const a of SHIP_ARTS) {
      expect(declaredViews(a), a.id).toContain('profile');
      expect(a.profile!().length, a.id).toBeGreaterThan(0);
    }
  });

  it('les 20 silhouettes sont toutes DISTINCTES entre elles (pas de coque recyclée)', () => {
    expect(new Set(SHIP_ARTS.map((a) => a.profile!())).size).toBe(SHIP_ARTS.length);
  });

  it('routage par id : resolve(id) sert l’art dédié, pas le procédural du gréement', () => {
    const svgOf = (sp: string) => shipPlan.resolve(sp, 'profile', {}).map((b) => b.parts.map((p) => p.svg).join('')).join('');
    // la cogue (voile) ne rend PLUS la silhouette procédurale 'voile'
    expect(svgOf('cogue')).not.toBe(svgOf('voile'));
    expect(svgOf('cogue')).not.toBe(svgOf('croiseur'));
    // un id de navire INCONNU du registre retombe sur le procédural de son gréement (donnée)
    expect(shipArtOf('id-de-navire-inconnu-xyz').profile!()).toBe(shipArt('mixte').profile!());
    // palette à jetons entièrement résolue après composition (recolorable, aucun @token résiduel)
    expect(svgOf('galion-bretonnien')).not.toContain('@');
  });

  it('toise relative crédible : le coracle (3 m) est minuscule devant le croiseur (60 m)', () => {
    const widthOf = (id: string) => {
      const xs = [...shipArtOf(id).profile!().matchAll(/M(-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(widthOf('coracle')).toBeLessThan(widthOf('chaloupe'));
    expect(widthOf('chaloupe')).toBeLessThan(widthOf('cogue'));
    expect(widthOf('cogue')).toBeLessThan(widthOf('croiseur'));
  });
});
