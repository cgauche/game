import { describe, it, expect } from 'vitest';
import { buildOperaFloorplan } from './floorplan';
import { tileAt, elevAt, isWalkable, wallBetween } from '../../state/scene';
import type { Dims } from '../../gameIso/iso';

/**
 * Le plan de l'Opéra (Théâtre Staatsoper) est de la DONNÉE de géométrie produite par un générateur
 * (précédent de l'arène). Ces tests verrouillent la STRUCTURE attendue, reconstruite des plans officiels
 * à leur ÉCHELLE (rez-de-chaussée p.40, premier étage p.41 → grille 44×60 dérivée des proportions) :
 * deux étages, scène surélevée + fosse en contrebas, parterre en ÉVENTAIL BLOQUANT, salles latérales
 * DESSERVIES PAR DES PORTES (aucune pièce scellée), puits central OVALE vide à l'étage, loges en anneau,
 * loge royale dans l'axe, escaliers reliant les deux niveaux.
 * (La logique/contenu du scénario viendra séparément, en donnée d'éditeur.)
 */
describe('plan de l’Opéra — géométrie', () => {
  const s = buildOperaFloorplan();
  const d: Dims = { w: s.dimensions.w, h: s.dimensions.h };
  const W = s.dimensions.w, H = s.dimensions.h;
  const AX = Math.round((W - 1) / 2); // axe de symétrie (21)

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

  it('grille DÉRIVÉE du plan : nettement plus haute que large (ratio proche du plan)', () => {
    expect(W).toBe(44);
    expect(H).toBe(60);
    expect(H).toBeGreaterThan(W); // bâtiment plus haut que large (proportions du plan officiel)
  });

  it('deux étages (rez + premier) partageant les dimensions', () => {
    expect(s.levels.map((l) => l.z)).toEqual([0, 1]);
    expect(s.levels[0].tiles).toHaveLength(W * H);
    expect(s.levels[1].tiles).toHaveLength(W * H);
  });

  it('SCÈNE surélevée (élévation > 0) et FOSSE en contrebas (< 0)', () => {
    expect(tileAt(s, AX, 8, 0)).toBe('planches'); // scène (rangées 5-13)
    expect(elevAt(s, AX, 8, 0)).toBeGreaterThan(0); // surélevée
    expect(tileAt(s, AX, 15, 0)).toBe('planches'); // fosse d'orchestre (rangées 14-16)
    expect(elevAt(s, AX, 15, 0)).toBeLessThan(0); // en contrebas
  });

  it('PARTERRE en ÉVENTAIL : plus étroit près de la scène que vers le fond', () => {
    const widthAt = (y: number) => s.levels[0].tiles.filter((t, i) => Math.floor(i / W) === y && t === 'plancher').length;
    expect(widthAt(42)).toBeGreaterThan(widthAt(18)); // le fond (vers le foyer) est plus large que l'avant
  });

  it('éventail : la cloison parterre↔salles latérales BLOQUE (pas de mur fantôme à traverser)', () => {
    const doorRow = Math.floor((17 + 44) / 2); // PY0=17, PY1=44
    for (let y = 20; y <= 42; y++) {
      if (y === doorRow) continue;
      const row = s.levels[0].tiles.slice(y * W, y * W + W);
      const lp = row.indexOf('plancher'); // bord gauche du parterre
      const rp = row.lastIndexOf('plancher'); // bord droit
      expect(wallBetween(s, lp, y, lp - 1, y)).toBe(true); // on ne sort pas à gauche
      expect(wallBetween(s, rp, y, rp + 1, y)).toBe(true); // ni à droite
    }
  });

  it('PUITS CENTRAL OVALE : le cœur du parterre est VIDE au premier étage (ouvert sur le rez)', () => {
    expect(tileAt(s, AX, 28, 1)).toBe('vide'); // centre du puits ovale
    expect(tileAt(s, AX, 28, 0)).toBe('plancher'); // parterre en dessous
  });

  it('LOGE ROYALE (marbre) à l’étage, dans l’axe de la scène, + escaliers reliant les deux niveaux', () => {
    expect(tileAt(s, AX, 2, 1)).toBe('marbre'); // loge royale au fond, axe scène (rangées 1-4)
    expect((s.stairs ?? []).length).toBeGreaterThanOrEqual(2);
    expect((s.stairs ?? [])[0]).toMatchObject({ from: { z: 0 }, to: { z: 1 } });
  });

  it('ESCALIERS : les deux volées tombent sur des cases marchables aux DEUX niveaux', () => {
    for (const st of s.stairs ?? []) {
      expect(isWalkable(s, st.from.x, st.from.y, st.from.z)).toBe(true); // foyer (marbre)
      expect(isWalkable(s, st.to.x, st.to.y, st.to.z)).toBe(true); // galerie (plancher)
    }
  });

  it('AUCUNE PIÈCE SCELLÉE au rez : tout l’intérieur est joignable depuis le foyer (portes)', () => {
    const reached = flood(0, AX, 50); // départ : foyer (rangées 46-52)
    let unreachable = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      if (isWalkable(s, x, y, 0) && !reached.has(`${x},${y}`)) unreachable++;
    expect(unreachable).toBe(0);
    // témoins explicites : une salle latérale gauche (près de la scène) et une salle droite sont atteintes.
    expect(reached.has('2,5')).toBe(true);   // salle de service gauche (Salle verte, près de la scène)
    expect(reached.has('41,32')).toBe(true); // salle de service droite (vers le foyer)
  });

  it('AUCUNE PIÈCE SCELLÉE à l’étage : toutes les loges + loge royale joignables depuis l’escalier', () => {
    const st = (s.stairs ?? [])[0];
    const reached = flood(1, st.to.x, st.to.y); // départ : palier d’arrivée de l’escalier (galerie)
    let unreachable = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      if (isWalkable(s, x, y, 1) && !reached.has(`${x},${y}`)) unreachable++;
    expect(unreachable).toBe(0);
    expect(reached.has(`${AX},2`)).toBe(true); // loge royale (marbre) joignable
  });

  it('ENTRÉES : portes d’honneur (façade) + entrée des artistes, débouchant à l’intérieur', () => {
    expect(s.entryPoints?.['entree-principale']).toBeDefined();
    expect(s.entryPoints?.['entree-artistes']).toBeDefined();
    // une porte non-pleine relie l’extérieur de la façade au seuil (Math.round(21.5-5)=17, 58) — Porte des Dames.
    const dx = 17, dy = 58; // FACY=58 ; Math.round(AX-5) avec AX=21.5
    expect(wallBetween(s, dx, dy, dx, dy + 1)).toBe(false); // arête sud = porte (franchissable)
    expect(isWalkable(s, dx, dy, 0)).toBe(true); // le seuil est marchable
  });
});
