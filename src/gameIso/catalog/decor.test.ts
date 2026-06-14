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

describe('Opéra — props de théâtre', () => {
  const OPERA = ['rangee-sieges', 'rideau-scene', 'balustrade-loge', 'lustre-opera'];
  it('les props d’opéra sont enregistrés et rendus non vides', () => {
    for (const id of OPERA) {
      expect(PROPS[id], id).toBeDefined();
      expect(propSvg(id).length, id).toBeGreaterThan(120);
    }
  });
  it('le mobilier de salle porte une empreinte 3×1 ; le lustre est en surplomb (sans empreinte)', () => {
    expect(PROPS['rangee-sieges'].foot).toEqual({ w: 3, h: 1 });
    expect(PROPS['rideau-scene'].foot).toEqual({ w: 3, h: 1 });
    expect(PROPS['balustrade-loge'].foot).toEqual({ w: 3, h: 1 });
    expect(PROPS['lustre-opera'].foot).toBeUndefined();
  });
  it('le mobilier d’ambiance d’opéra est enregistré et rendu (applique, pupitre, fauteuil)', () => {
    for (const id of ['applique-murale', 'pupitre-chef', 'fauteuil-loge']) {
      expect(PROPS[id], id).toBeDefined();
      expect(propSvg(id).length, id).toBeGreaterThan(120);
    }
  });
});
