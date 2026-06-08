import { describe, it, expect } from 'vitest';
import { PROPS, propSvg } from './decor';

describe('catalogue décors', () => {
  it('contient les placeables de base', () => {
    for (const id of [
      'tonneau',
      'caisse',
      'charrette',
      'puits',
      'fontaine',
      'etal-marche',
      'statue',
      'lampadaire',
      'panneau',
      'cloture',
      'tas-foin',
      'feu-camp',
      'arbre',
      'cadavre',
      'mare-sang',
      'cheval-mort',
      'epave-carrosse',
    ])
      expect(PROPS[id], id).toBeDefined();
  });
  it('id inconnu → fallback (tonneau), pas d exception', () => {
    expect(propSvg('zzz').length).toBeGreaterThan(0);
  });
  it('rend un SVG non vide pour les décors d ambush', () => {
    for (const id of ['cadavre', 'mare-sang', 'cheval-mort', 'epave-carrosse'])
      expect(propSvg(id).length, id).toBeGreaterThan(40);
  });
});

describe('SP2 — décors fouillables', () => {
  const NEW = ['lettre', 'coffre', 'cle', 'bourse', 'etagere'];
  it('les 5 nouveaux décors sont enregistrés, searchable, et rendus non vides', () => {
    for (const id of NEW) {
      expect(PROPS[id], id).toBeDefined();
      expect(PROPS[id].searchable, id).toBe(true);
      expect(propSvg(id).length, id).toBeGreaterThan(40);
    }
  });
  it('un décor pur n’est pas searchable', () => {
    expect(PROPS.tonneau.searchable).toBeFalsy();
    expect(PROPS.cadavre.searchable).toBeFalsy();
  });
});
