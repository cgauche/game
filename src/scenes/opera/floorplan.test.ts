import { describe, it, expect } from 'vitest';
import { buildOperaFloorplan } from './floorplan';
import { tileAt, elevAt, wallBetween } from '../../state/scene';
import type { Dims } from '../../gameIso/iso';

/**
 * Le plan de l'Opéra (Théâtre Staatsoper) est de la DONNÉE de géométrie produite par un générateur
 * (précédent de l'arène). Ces tests verrouillent la STRUCTURE attendue : deux étages, scène/fosse (à plat
 * — l'élévation désaxait le jeton de sa case), parterre en éventail BLOQUANT, puits central vide à l'étage,
 * loge royale, escaliers. (La logique/contenu du scénario viendra séparément, en donnée d'éditeur.)
 */
describe('plan de l’Opéra — géométrie', () => {
  const s = buildOperaFloorplan();
  const d: Dims = { w: s.dimensions.w, h: s.dimensions.h };

  it('deux étages (rez + premier) partageant les dimensions', () => {
    expect(s.levels.map((l) => l.z)).toEqual([0, 1]);
    expect(s.levels[0].tiles).toHaveLength(s.dimensions.w * s.dimensions.h);
    expect(s.levels[1].tiles).toHaveLength(s.dimensions.w * s.dimensions.h);
  });

  it('SCÈNE surélevée (élévation > 0) et FOSSE en contrebas (< 0) — relief restauré', () => {
    expect(tileAt(s, 11, 2, 0)).toBe('planches'); // scène
    expect(elevAt(s, 11, 2, 0)).toBeGreaterThan(0); // surélevée
    expect(tileAt(s, 11, 5, 0)).toBe('planches'); // fosse
    expect(elevAt(s, 11, 5, 0)).toBeLessThan(0); // en contrebas
  });

  it('PARTERRE en ÉVENTAIL : plus étroit près de la scène que vers le fond', () => {
    const widthAt = (y: number) => s.levels[0].tiles.filter((t, i) => Math.floor(i / d.w) === y && t === 'plancher').length;
    expect(widthAt(17)).toBeGreaterThan(widthAt(7)); // le fond est plus large que l'avant
  });

  it('éventail : la cloison parterre↔salles latérales BLOQUE (pas de mur fantôme à traverser)', () => {
    const w = s.dimensions.w;
    for (let y = 8; y <= 16; y++) {
      const row = s.levels[0].tiles.slice(y * w, y * w + w);
      const lp = row.indexOf('plancher'); // bord gauche du parterre
      const rp = row.lastIndexOf('plancher'); // bord droit
      expect(wallBetween(s, lp, y, lp - 1, y)).toBe(true); // on ne sort pas à gauche
      expect(wallBetween(s, rp, y, rp + 1, y)).toBe(true); // ni à droite
    }
  });

  it('PUITS CENTRAL : le cœur du parterre est VIDE au premier étage (ouvert sur le rez)', () => {
    expect(tileAt(s, 11, 12, 1)).toBe('vide'); // centre du puits
    expect(tileAt(s, 11, 12, 0)).toBe('plancher'); // parterre en dessous
  });

  it('LOGE ROYALE (marbre) à l’étage, dans l’axe, + escaliers reliant les deux niveaux', () => {
    expect(tileAt(s, 11, 20, 1)).toBe('marbre');
    expect(s.stairs ?? []).toHaveLength(2);
    expect((s.stairs ?? [])[0]).toMatchObject({ from: { z: 0 }, to: { z: 1 } });
  });
});
