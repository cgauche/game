/**
 * `naval-ports.json` — Index des ports de la Mer des Griffes (#217, MDG ch.15 l.439-506). Catalogue
 * chargé par référence (`MapPlace.port.ref`, `state/worldMap.ts`).
 */
import { describe, it, expect } from 'vitest';
import { navalPorts, findNavalPortById } from './index';
import { CARGOES } from '../engine/seaVoyage';

describe('naval-ports.json — catalogue de l’Index des ports (#217)', () => {
  it('charge et porte au moins les entrées connues', () => {
    expect(navalPorts.length).toBeGreaterThan(0);
    expect(findNavalPortById('salzenmund')).toBeTruthy();
    expect(findNavalPortById('erengrad')).toBeTruthy();
  });

  it('ids uniques', () => {
    const ids = navalPorts.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('chaque id de production/surplus/demande résout dans le vocabulaire de marchandise (sea-cargo.json)', () => {
    const cargoIds = new Set(CARGOES.map((c) => c.id));
    const specials = new Set(['commerce', 'minimum-vital']);
    for (const p of navalPorts) {
      for (const id of p.production ?? []) {
        expect(cargoIds.has(id) || specials.has(id), `${p.id} : production id inconnu "${id}"`).toBe(true);
      }
      for (const id of Object.keys(p.surplus ?? {})) {
        expect(cargoIds.has(id), `${p.id} : surplus id inconnu "${id}"`).toBe(true);
      }
      for (const id of Object.keys(p.demande ?? {})) {
        expect(cargoIds.has(id), `${p.id} : demande id inconnu "${id}"`).toBe(true);
      }
    }
  });

  it('Salzenmund : Taille 4, Richesse 4 (MDG 15 l.452, folio 138)', () => {
    const salzenmund = findNavalPortById('salzenmund')!;
    expect(salzenmund.taille).toBe(4);
    expect(salzenmund.richesse).toBe(4);
  });

  it('Erengrad : Taille 4, Richesse 4 (MDG 15 l.461-462, folio 138)', () => {
    const erengrad = findNavalPortById('erengrad')!;
    expect(erengrad.taille).toBe(4);
    expect(erengrad.richesse).toBe(4);
  });

  it('Marienburg et Lothern : cosmopolite (MDG 15 l.343-349) ; les autres ports commerce ordinaires ne le sont pas', () => {
    expect(findNavalPortById('marienburg')!.cosmopolite).toBe(true);
    expect(findNavalPortById('lothern')!.cosmopolite).toBe(true);
    expect(findNavalPortById('altdorf-port')!.cosmopolite).toBeFalsy();
  });

  it('chaque entrée porte une source { book, page } avec le livre mer-des-griffes', () => {
    for (const p of navalPorts) {
      expect(p.source.book).toBe('mer-des-griffes');
      expect(typeof p.source.page).toBe('number');
    }
  });
});
