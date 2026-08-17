import { describe, expect, it, beforeEach } from 'vitest';
import { accordsPan, accorderPan, getStagePan, poserPan, resetStagePan } from './stagePan';
import { DUREE_FOCALE_MS, adoucirFocal } from '../gameIso/stage/useStageCamera';

/**
 * LE DÉCALAGE VIVANT ET LE COMMIS — deux valeurs, une seule loi de passage (`accorderPan`), et le
 * COMPTEUR d'accords par lequel un geste en vol sait qu'un recentrage lui est passé dessus.
 *
 * L'adoucissement de focale se mesure ici aussi : c'est une fonction PURE de l'instant, et c'est ce qui
 * autorise les deux clients de la caméra (overlays SVG, caméra three) à la demander chacun de leur côté
 * dans la même image sans jamais diverger.
 */
describe('stagePan — vivant, commis, accords', () => {
  beforeEach(() => resetStagePan());

  it('le geste POSE, le commis inchangé ne reprend RIEN', () => {
    poserPan(120, -40);
    accorderPan({ x: 0, y: 0 }); // le rendu qui suit lit le MÊME commis qu'au début du geste
    expect(getStagePan()).toEqual({ x: 120, y: -40 });
  });

  it('un commis qui CHANGE reprend la main (recentrage, chargement de save) et compte un accord', () => {
    poserPan(120, -40);
    const avant = accordsPan();
    accorderPan({ x: 7, y: 3 });
    expect(getStagePan()).toEqual({ x: 7, y: 3 });
    expect(accordsPan()).toBe(avant + 1);
  });

  it('le recentrage à ZÉRO en plein geste est un accord comme un autre — plus de pan orphelin', () => {
    accorderPan({ x: 50, y: 0 }); // décalage commis d'un geste précédent
    poserPan(80, 0); // geste en cours
    const avant = accordsPan();
    accorderPan({ x: 0, y: 0 }); // `resetCamPan` : touche de recentrage / nouvelle unité active
    expect(getStagePan()).toEqual({ x: 0, y: 0 });
    expect(accordsPan()).toBe(avant + 1);
  });

  it('`resetStagePan` (entrée de scène) remet vivant ET commis à zéro, et compte un accord', () => {
    accorderPan({ x: 50, y: 0 });
    poserPan(200, 100);
    const avant = accordsPan();
    resetStagePan();
    expect(getStagePan()).toEqual({ x: 0, y: 0 });
    expect(accordsPan()).toBe(avant + 1);
    // Et le commis est bien reparti de zéro : un store à {0,0} ne « rejoue » pas l'ancien décalage.
    accorderPan({ x: 0, y: 0 });
    expect(getStagePan()).toEqual({ x: 0, y: 0 });
  });
});

describe('adoucirFocal — pur en `now`, arrivée EXACTE sur la cible', () => {
  const depart = { x: 0, y: 0 };
  const cible = { x: 300, y: -100 };
  const lissage = { depart, t0: 1000 };

  it('sans lissage : la cible telle quelle (un panoramique manuel reste 1:1)', () => {
    expect(adoucirFocal(null, cible, 1234)).toEqual(cible);
  });

  it('au départ : le point QUITTÉ ; à l’échéance : la cible, au pixel près', () => {
    expect(adoucirFocal(lissage, cible, 1000)).toEqual(depart);
    expect(adoucirFocal(lissage, cible, 1000 + DUREE_FOCALE_MS)).toEqual(cible);
    expect(adoucirFocal(lissage, cible, 9999)).toEqual(cible); // au-delà, plus rien ne bouge
  });

  it('PURE en `now` : deux appels au même instant rendent la même valeur, l’ordre n’y change rien', () => {
    const a = adoucirFocal(lissage, cible, 1150);
    const b = adoucirFocal(lissage, cible, 1150);
    expect(b).toEqual(a);
    // …et elle progresse dans le temps, sans jamais dépasser la cible (ease-out).
    const t1 = adoucirFocal(lissage, cible, 1050).x;
    const t2 = adoucirFocal(lissage, cible, 1200).x;
    expect(t1).toBeGreaterThan(0);
    expect(t2).toBeGreaterThan(t1);
    expect(t2).toBeLessThan(cible.x);
  });
});
