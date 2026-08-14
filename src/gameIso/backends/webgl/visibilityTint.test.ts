import { describe, expect, it } from 'vitest';
import { tintFor, tintOf } from './visibilityTint';
import { AMBIANCE } from '../../catalog/ambiance';

/**
 * ORACLE FIGÉ (#1176 P3-4, commit C5a). Ce banc confrontait la teinte volumique au VOILE SVG de
 * production (`gameIso/FogLayer.fogFilterFor`), mort avec la voie affine. La donnée qui les liait, elle,
 * survit : `AMBIANCE.fogTint` (`src/data/ambiance.json`), la seule table de la politique de visibilité.
 * Le second terme est donc devenu le TEXTE du voile disparu, mesuré sur l'arbre d'avant la suppression :
 *   - mémorisé : `brightness(0.42) saturate(.45) opacity(.82)` — le `brightness` valait exactement
 *     `AMBIANCE.fogTint.explored`, ce que la première assertion garde vrai ;
 *   - inconnu : `brightness(0) opacity(.38)` — la voie SVG ÉTEIGNAIT la case sur le fond de carte, là
 *     où le monde volumique en garde un facteur bas NON NUL (aucune carte dessous : à zéro, la case
 *     disparaîtrait au lieu de s'assombrir) ;
 *   - en vue : aucun filtre, facteur plein.
 */
/** Le `brightness` que le voile SVG appliquait à une case MÉMORISÉE (mesuré avant retrait, C5a). */
const BRIGHTNESS_MEMORISE_SVG = 0.42;

describe('les teintes sont ANCRÉES sur la donnée de visibilité (`AMBIANCE.fogTint`)', () => {
  it('exploré = le terme `brightness` que le voile de production appliquait (une seule donnée)', () => {
    expect(tintOf('explored')).toBe(AMBIANCE.fogTint.explored);
    expect(tintOf('explored')).toBe(BRIGHTNESS_MEMORISE_SVG);
  });

  it('inconnu : facteur bas mais NON NUL — le volumique assombrit là où le SVG éteignait', () => {
    expect(tintOf('unknown')).toBeGreaterThan(0);
    expect(tintOf('unknown')).toBeLessThan(tintOf('explored'));
  });

  it('vue : facteur plein', () => {
    expect(tintOf('visible')).toBe(1);
  });
});

/** La TABLE DE VÉRITÉ de `visibilityOf` vit dans sa couche (`src/state/visibility.test.ts`) : ici on ne
 *  teste que l'APPLICATION — le mappage état → teinte. */
describe('tintFor — l’APPLICATION : la politique, puis le mappage état → teinte', () => {
  const visible = new Set(['1,2,0']);
  const explored = new Set(['1,2,0', '3,4,0']);

  it('chaque case rend la teinte de SON état', () => {
    expect(tintFor('1,2,0', visible, explored)).toBe(tintOf('visible'));
    expect(tintFor('3,4,0', visible, explored)).toBe(tintOf('explored'));
    expect(tintFor('9,9,1', visible, explored)).toBe(tintOf('unknown'));
  });

  it('les trois teintes se rangent dans l’ordre de la politique', () => {
    expect(tintOf('visible')).toBeGreaterThan(tintOf('explored'));
    expect(tintOf('explored')).toBeGreaterThan(tintOf('unknown'));
  });
});
