/**
 * Lecture du gabarit de PONT d'un TYPE de navire (§1bis du modèle naval) — couche STATE, car elle produit
 * des `Terrain`/`WallSeg` de scène. Le moteur reste PUR : le TYPE `ShipDeck` vit en `engine/types` (pour que
 * `VehicleData` le porte sans dépendance engine→state), l'INTERPRÉTATION en tuiles/murs vit ici (comme
 * `asciiMap`). Réutilise STRICTEMENT `parseWalledAscii` (la méthode d'authoring canon) — aucun parseur
 * parallèle. Le pont est person-scale : à l'abordage on l'instancie + coud depuis ce gabarit (Phase 6).
 *
 * RAW : le placement des pièces d'artillerie reste LIBRE (par bord + poids vs Contenance, cf. `shipPostes.ts`) ;
 * `deck.postes` n'est donc PAS une contrainte de règle mais un hint de RENDU (où dessiner une pièce montée sur
 * un bord et poster son servant), réutilisé tel quel à la composition du Pont.
 */
import { parseWalledAscii } from './asciiMap';
import type { Terrain, WallSeg } from './scene';
import type { ShipDeck, DeckPosteSlot } from '../engine/types';

/** Pont LU : grille de tuiles + murs d'arête (person-scale) + emplacements de postes (hints de rendu). */
export interface ParsedDeck {
  w: number;
  h: number;
  tiles: Terrain[];
  walls: WallSeg[];
  postes: DeckPosteSlot[];
}

/** Lit le gabarit `deck` d'un type de navire → grille de pont (tuiles + murs) via `parseWalledAscii`. Tuile
 *  de base = planches (un pont est en planches). PUR. Lève si l'ASCII est mal formé (garde-fou d'authoring :
 *  lignes inégales / char inconnu). */
export function parseDeck(deck: ShipDeck, base: Terrain = 'planches'): ParsedDeck {
  const { w, h, tiles, walls } = parseWalledAscii(deck.ascii, base);
  return { w, h, tiles, walls, postes: deck.postes ?? [] };
}

/** La tuile (`Terrain`) du pont à la case (x,y) d'un pont LU — `undefined` hors grille. PUR. */
export function deckTileAt(parsed: ParsedDeck, x: number, y: number): Terrain | undefined {
  if (x < 0 || y < 0 || x >= parsed.w || y >= parsed.h) return undefined;
  return parsed.tiles[y * parsed.w + x];
}
