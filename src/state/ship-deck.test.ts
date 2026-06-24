import { describe, it, expect } from 'vitest';
import { parseDeck, deckTileAt } from './shipDeck';
import { findVehicleById } from '../data';
import type { FireArc } from '../engine/types';

/**
 * Facette PONT (§1bis du modèle naval) : chaque TYPE de navire porte le plan person-scale de SON pont
 * (`VehicleData.deck`), authoré une fois et lu en tuiles/murs par `parseDeck` (réutilise `parseWalledAscii`).
 * Foundation de la couche Pont (abordage) : on prouve ici que le gabarit de la cogue se lit en une grille
 * cohérente (bastingage périmétrique, pont en planches) + emplacements de postes (hints de rendu).
 */
const ARCS: FireArc[] = ['proue', 'tribord', 'poupe', 'babord'];

describe('parseDeck — gabarit de pont d’un type de navire (cogue)', () => {
  const deck = findVehicleById('cogue')!.deck!;

  it('le type cogue PORTE une facette deck (authorée une fois, réutilisable en scénario)', () => {
    expect(deck).toBeTruthy();
    expect(deck.ascii.length).toBeGreaterThan(0);
  });

  it('se lit en une grille person-scale 5×9, tout en planches (pont)', () => {
    const p = parseDeck(deck);
    expect(p.w).toBe(5);
    expect(p.h).toBe(9);
    expect(p.tiles).toHaveLength(45);
    expect(p.tiles.every((t) => t === 'planches')).toBe(true);
  });

  it('bastingage = murs périmétriques (28), aucun mur intérieur (pont dégagé)', () => {
    const p = parseDeck(deck);
    // 5 (N, y=0) + 5 (S, y=9) + 9 (E, x=4) + 9 (W → x=-1, 'E') = 28 arêtes de coque, rien à l'intérieur.
    expect(p.walls).toHaveLength(28);
    expect(p.walls.some((w) => w.x === 0 && w.y === 0 && w.side === 'N')).toBe(true); // proue, bâbord-avant
    expect(p.walls.some((w) => w.x === 4 && w.y === 0 && w.side === 'E')).toBe(true); // tribord
    expect(p.walls.some((w) => w.x === -1 && w.y === 0 && w.side === 'E')).toBe(true); // bâbord (bord gauche)
    expect(p.walls.some((w) => w.x === 0 && w.y === 9 && w.side === 'N')).toBe(true); // poupe
  });

  it('emplacements de postes = mount points valides (in-bounds, arc connu) — hints de rendu, pas de slot fixe', () => {
    const p = parseDeck(deck);
    expect(p.postes).toHaveLength(3);
    for (const slot of p.postes) {
      expect(ARCS).toContain(slot.side);
      expect(slot.pos.x).toBeGreaterThanOrEqual(0);
      expect(slot.pos.x).toBeLessThan(p.w);
      expect(slot.pos.y).toBeGreaterThanOrEqual(0);
      expect(slot.pos.y).toBeLessThan(p.h);
      expect(deckTileAt(p, slot.pos.x, slot.pos.y)).toBe('planches'); // un poste se rend sur une case de pont
    }
    // une bordée de chaque + un chasseur de proue.
    expect(p.postes.map((s) => s.side).sort()).toEqual(['babord', 'proue', 'tribord']);
  });

  it('deckTileAt borne la grille (case valide → tuile ; hors grille → undefined)', () => {
    const p = parseDeck(deck);
    expect(deckTileAt(p, 2, 4)).toBe('planches');
    expect(deckTileAt(p, -1, 0)).toBeUndefined();
    expect(deckTileAt(p, 5, 0)).toBeUndefined();
    expect(deckTileAt(p, 0, 9)).toBeUndefined();
  });

  it('garde-fou d’authoring : un plan mal aligné lève (lignes de largeurs inégales)', () => {
    expect(() => parseDeck({ ascii: ['+-+-+', '|. .|', '+-+'] })).toThrow();
  });
});
