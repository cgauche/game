import { describe, it, expect } from 'vitest';
import { buildOperaFloorplan } from './floorplan';
import { tileAt, elevAt, isWalkable, wallBetween } from '../../state/scene';
import type { Dims } from '../../gameIso/iso';

/**
 * Le plan de l'Opéra (Théâtre Staatsoper) est de la DONNÉE de géométrie produite par un générateur
 * (précédent de l'arène). Ces tests verrouillent la STRUCTURE attendue, reconstruite des plans officiels
 * (rez-de-chaussée p.40, premier étage p.41) : deux étages, scène surélevée + fosse en contrebas, parterre
 * en ÉVENTAIL BLOQUANT, salles latérales DESSERVIES PAR DES PORTES (aucune pièce scellée), puits central
 * vide à l'étage, loges en anneau, loge royale dans l'axe, escaliers reliant les deux niveaux.
 * (La logique/contenu du scénario viendra séparément, en donnée d'éditeur.)
 */
describe('plan de l’Opéra — géométrie', () => {
  const s = buildOperaFloorplan();
  const d: Dims = { w: s.dimensions.w, h: s.dimensions.h };
  const W = s.dimensions.w, H = s.dimensions.h;

  /** Flood-fill 4-voisinage à travers les portes (un mur sans `door` bloque). */
  function flood(z: number, sx: number, sy: number): Set<string> {
    const seen = new Set<string>();
    const stack: [number, number][] = [[sx, sy]];
    while (stack.length) {
      const [x, y] = stack.pop()!;
      const k = `${x},${y}`;
      if (seen.has(k) || x < 0 || y < 0 || x >= W || y >= H || !isWalkable(s, x, y, z)) continue;
      seen.add(k);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
        if (!wallBetween(s, x, y, x + dx, y + dy, z)) stack.push([x + dx, y + dy]);
    }
    return seen;
  }

  it('deux étages (rez + premier) partageant les dimensions', () => {
    expect(s.levels.map((l) => l.z)).toEqual([0, 1]);
    expect(s.levels[0].tiles).toHaveLength(W * H);
    expect(s.levels[1].tiles).toHaveLength(W * H);
  });

  it('SCÈNE surélevée (élévation > 0) et FOSSE en contrebas (< 0)', () => {
    expect(tileAt(s, 11, 3, 0)).toBe('planches'); // scène (rangées 2-4)
    expect(elevAt(s, 11, 3, 0)).toBeGreaterThan(0); // surélevée
    expect(tileAt(s, 11, 5, 0)).toBe('planches'); // fosse d'orchestre (rangée 5)
    expect(elevAt(s, 11, 5, 0)).toBeLessThan(0); // en contrebas
  });

  it('PARTERRE en ÉVENTAIL : plus étroit près de la scène que vers le fond', () => {
    const widthAt = (y: number) => s.levels[0].tiles.filter((t, i) => Math.floor(i / W) === y && t === 'plancher').length;
    expect(widthAt(16)).toBeGreaterThan(widthAt(7)); // le fond (vers le foyer) est plus large que l'avant
  });

  it('éventail : la cloison parterre↔salles latérales BLOQUE (pas de mur fantôme à traverser)', () => {
    for (let y = 8; y <= 16; y++) {
      const row = s.levels[0].tiles.slice(y * W, y * W + W);
      const lp = row.indexOf('plancher'); // bord gauche du parterre
      const rp = row.lastIndexOf('plancher'); // bord droit
      // les bords du parterre bloquent (sauf la rangée porte au milieu de la hauteur).
      const doorRow = Math.floor((6 + 17) / 2);
      if (y !== doorRow) {
        expect(wallBetween(s, lp, y, lp - 1, y)).toBe(true); // on ne sort pas à gauche
        expect(wallBetween(s, rp, y, rp + 1, y)).toBe(true); // ni à droite
      }
    }
  });

  it('PUITS CENTRAL : le cœur du parterre est VIDE au premier étage (ouvert sur le rez)', () => {
    expect(tileAt(s, 11, 12, 1)).toBe('vide'); // centre du puits
    expect(tileAt(s, 11, 12, 0)).toBe('plancher'); // parterre en dessous
  });

  it('LOGE ROYALE (marbre) à l’étage, dans l’axe de la scène, + escaliers reliant les deux niveaux', () => {
    expect(tileAt(s, 11, 4, 1)).toBe('marbre'); // loge royale au fond, axe scène (rangées 3-5)
    expect(s.stairs ?? []).toHaveLength(2);
    expect((s.stairs ?? [])[0]).toMatchObject({ from: { z: 0 }, to: { z: 1 } });
  });

  it('ESCALIERS : les deux volées tombent sur des cases marchables aux DEUX niveaux', () => {
    for (const st of s.stairs ?? []) {
      expect(isWalkable(s, st.from.x, st.from.y, st.from.z)).toBe(true); // foyer (marbre)
      expect(isWalkable(s, st.to.x, st.to.y, st.to.z)).toBe(true); // galerie (plancher)
    }
  });

  it('AUCUNE PIÈCE SCELLÉE au rez : tout l’intérieur est joignable depuis le foyer (portes)', () => {
    const reached = flood(0, 11, 23); // départ : foyer, près des entrées
    let unreachable = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      if (isWalkable(s, x, y, 0) && !reached.has(`${x},${y}`)) unreachable++;
    expect(unreachable).toBe(0);
    // témoins explicites : une salle latérale gauche et une salle droite sont atteintes.
    expect(reached.has('2,3')).toBe(true);   // salle de service gauche (près de la scène)
    expect(reached.has('20,15')).toBe(true); // salle de service droite (vers le foyer)
  });

  it('AUCUNE PIÈCE SCELLÉE à l’étage : toutes les loges + loge royale joignables depuis l’escalier', () => {
    const reached = flood(1, 6, 19); // départ : palier d’arrivée de l’escalier (galerie)
    let unreachable = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      if (isWalkable(s, x, y, 1) && !reached.has(`${x},${y}`)) unreachable++;
    expect(unreachable).toBe(0);
    expect(reached.has('11,4')).toBe(true); // loge royale (marbre) joignable
  });

  it('ENTRÉES : portes d’honneur (façade) + entrée des artistes, débouchant à l’intérieur', () => {
    expect(s.entryPoints?.['entree-principale']).toBeDefined();
    expect(s.entryPoints?.['entree-artistes']).toBeDefined();
    // une porte non-pleine relie l’extérieur de la façade au seuil (8,24) — Porte des Dames.
    expect(wallBetween(s, 8, 24, 8, 25)).toBe(false); // arête sud = porte (franchissable)
    expect(isWalkable(s, 8, 24, 0)).toBe(true); // le seuil est marchable
  });
});
