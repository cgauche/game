import { describe, it, expect } from 'vitest';
import { buildOperaFloorplan } from './floorplan';
import { tileAt, heightAt, isWalkable, wallBetween } from '../../state/scene';
import { reachable, type Pt } from '../../state/path';

/**
 * Le plan de l'Opéra (Théâtre Staatsoper) est de la DONNÉE de géométrie produite par un générateur
 * (précédent de l'arène), reconstruite sur le RELIEF MÉTRIQUE : deux COUCHES (`layers`), scène surélevée
 * (+1 m) et fosse en contrebas (−1 m) portées par `Layer.height`, parterre en ÉVENTAIL bloquant, salles
 * latérales desservies par des portes, puits central OVALE vide à l'étage, loges en anneau + loge royale
 * dans l'axe. L'étage (loges à 4 m) se rejoint par DEUX RAMPES d'angle (cases de hauteur croissante) —
 * AUCUN escalier explicite : la connectivité verticale s'auto-dérive du dénivelé (`surfaceLink`).
 */
describe('plan de l’Opéra — géométrie (relief unifié)', () => {
  const s = buildOperaFloorplan();
  const W = s.dimensions.w, H = s.dimensions.h;
  const AX = Math.round((W - 1) / 2); // axe de symétrie (22)
  const tilesOf = (z: number) => s.layers.find((l) => l.z === z)!.tiles;

  it('grille DÉRIVÉE du plan : 44×60, nettement plus haute que large', () => {
    expect(W).toBe(44);
    expect(H).toBe(60);
    expect(H).toBeGreaterThan(W);
  });

  it('deux COUCHES (rez z0 + étage z1) partageant les dimensions', () => {
    expect(s.layers.map((l) => l.z)).toEqual([0, 1]);
    expect(tilesOf(0)).toHaveLength(W * H);
    expect(tilesOf(1)).toHaveLength(W * H);
  });

  it('SCÈNE surélevée (hauteur > 0) et FOSSE en contrebas (< 0), portées par Layer.height', () => {
    expect(tileAt(s, AX, 8, 0)).toBe('planches'); // scène
    expect(heightAt(s, AX, 8, 0)).toBeGreaterThan(0);
    expect(tileAt(s, AX, 17, 0)).toBe('planches'); // fosse d'orchestre
    expect(heightAt(s, AX, 17, 0)).toBeLessThan(0);
  });

  it('l’ÉTAGE (galerie de loges) est une couche surélevée (hauteur = un plein niveau, 4 m)', () => {
    expect(heightAt(s, AX, 2, 1)).toBe(4); // loge royale, z1
  });

  it('PARTERRE en ÉVENTAIL : plus étroit près de la scène que vers le fond', () => {
    const widthAt = (y: number) => tilesOf(0).filter((t, i) => Math.floor(i / W) === y && t === 'plancher').length;
    expect(widthAt(42)).toBeGreaterThan(widthAt(18)); // le fond est plus large que l'avant
  });

  it('éventail : la cloison parterre↔salles latérales BLOQUE (pas de mur fantôme à traverser)', () => {
    const doorRow = Math.floor((20 + 43) / 2); // porte parterre↔côtés à mi-hauteur
    for (let y = 21; y <= 42; y++) {
      if (y === doorRow) continue;
      const row = tilesOf(0).slice(y * W, y * W + W);
      const lp = row.indexOf('plancher');
      const rp = row.lastIndexOf('plancher');
      expect(wallBetween(s, lp, y, lp - 1, y)).toBe(true); // on ne sort pas à gauche
      expect(wallBetween(s, rp, y, rp + 1, y)).toBe(true); // ni à droite
    }
  });

  it('PUITS CENTRAL OVALE : le cœur du parterre est VIDE au premier étage (ouvert sur le rez)', () => {
    expect(tileAt(s, AX, 28, 1)).toBe('vide');     // centre du puits ovale
    expect(tileAt(s, AX, 28, 0)).toBe('plancher'); // parterre en dessous
  });

  it('LOGE ROYALE (marbre) à l’étage, dans l’axe de la scène', () => {
    expect(tileAt(s, AX, 2, 1)).toBe('marbre');
  });

  it('ENTRÉES : portes d’honneur (façade) + entrée des artistes, débouchant à l’intérieur', () => {
    expect(s.entryPoints?.['entree-principale']).toBeDefined();
    expect(s.entryPoints?.['entree-artistes']).toBeDefined();
    const dx = 17, dy = 58; // Porte des Dames (façade sud)
    expect(wallBetween(s, dx, dy, dx, dy + 1)).toBe(false); // arête sud = porte (franchissable)
    expect(isWalkable(s, dx, dy, 0)).toBe(true);            // le seuil est marchable
  });

  it('CONNEXE par RAMPE : depuis le foyer on gagne la GALERIE (z1) — toute loge est atteignable, sans escalier', () => {
    // Départ : le seuil d'honneur (foyer, z0). `reachable` traverse portes ET rampes (surfaceLink), donc
    // change de couche là où une rampe rejoint la galerie à hauteur ÉGALE — plus aucun escalier explicite.
    const start: Pt = { ...s.entryPoints!['entree-principale'], z: 0 };
    expect(isWalkable(s, start.x, start.y, 0), 'le seuil de départ est marchable').toBe(true);
    const R = reachable(s, start, 99999, { blocked: new Set<string>() });
    const key = (x: number, y: number, z: number) => (z ? `${x},${y},${z}` : `${x},${y}`);
    // témoins z0 : scène (surélevée +1 m, rejointe par rampe douce) et parterre (sol).
    expect(R.has(key(AX, 8, 0)), 'scène atteignable').toBe(true);
    expect(R.has(key(AX, 28, 0)), 'parterre atteignable').toBe(true);
    // LOGES : la galerie (z1) est jointe DEPUIS LE REZ par les rampes — aucune loge scellée.
    let sealedUpper = 0;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (isWalkable(s, x, y, 1) && !R.has(key(x, y, 1))) sealedUpper++;
    expect(sealedUpper, 'toute case de l’étage (loges) est atteignable depuis le foyer par la rampe').toBe(0);
  });
});
