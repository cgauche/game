import { describe, it, expect } from 'vitest';
import { buildOperaFloorplan } from './floorplan';
import { tileAt, elevAt } from '../../state/scene';
import { groundTile } from '../../gameIso/ground';
import type { Dims } from '../../gameIso/iso';

/**
 * Le plan de l'Opéra (Théâtre Staatsoper) est de la DONNÉE de géométrie produite par un générateur
 * (précédent de l'arène). Ces tests verrouillent la STRUCTURE attendue du plan : deux étages, scène
 * surélevée + fosse en contrebas, parterre en éventail à pans obliques, puits central vide à l'étage,
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

  it('SCÈNE surélevée (élévation > 0) et FOSSE d’orchestre en contrebas (< 0)', () => {
    expect(elevAt(s, 11, 2, 0)).toBeGreaterThan(0); // planches de scène
    expect(tileAt(s, 11, 2, 0)).toBe('planches');
    expect(elevAt(s, 11, 5, 0)).toBeLessThan(0); // fosse
  });

  it('PARTERRE en ÉVENTAIL : plus étroit près de la scène que vers le fond', () => {
    const widthAt = (y: number) => s.levels[0].tiles.filter((t, i) => Math.floor(i / d.w) === y && t === 'plancher').length;
    expect(widthAt(17)).toBeGreaterThan(widthAt(7)); // le fond est plus large que l'avant
  });

  it('pans obliques (murs diagonaux) sur les côtés de l’éventail', () => {
    expect((s.walls ?? []).some((w) => w.side === '\\' || w.side === '/')).toBe(true);
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

  it('l’élévation PRODUIT des jupes au rendu (scène surélevée vue en relief)', () => {
    // la rangée juste devant la scène (parterre au ras) borde la scène surélevée → jupe rendue
    const svg = groundTile(s, 11, 4, d, 0); // dernière rangée de scène, bord avant
    expect(svg).toContain('elev-skirt');
  });
});
