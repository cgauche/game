import { describe, it, expect } from 'vitest';
import { emptyScene, wallBetween, isWalkable, wallIsOpen, doorIsOpen, doorAt, type Roof, type WallSeg } from './scene';
import { roofHidden } from './buildings';
import { addBuilding } from './sceneEdit';

/**
 * Modèle « relief unifié » : un bâtiment n'est plus une entité monolithique (périmètre implicite +
 * porte + reveal). Il est COMPOSÉ — des `WallSeg` d'arête (destructibles) sur un sol de terrain, coiffés
 * d'un `Roof` de rendu. Le blocage d'intérieur passe donc par `wallBetween` (+ marchabilité du terrain),
 * et le cutaway du toit par `roofHidden(Roof.foot)` — plus aucune fonction `buildingBlockedAt`/`defaultDoor`.
 */

/** Maison 3×3 en (2,2) : cloisons `mur-en-bois` tout autour, une PORTE au sud (arête N de (3,5)). */
function houseScene() {
  const s = emptyScene(8, 8);
  const foot = { x: 2, y: 2, w: 3, h: 3 };
  const walls: WallSeg[] = [];
  for (let x = foot.x; x < foot.x + foot.w; x++) {
    walls.push({ x, y: foot.y, side: 'N', structure: 'mur-en-bois' });                 // cloison nord
    if (x === 3) walls.push({ x, y: foot.y + foot.h, side: 'N', door: true });          // PORTE au sud
    else walls.push({ x, y: foot.y + foot.h, side: 'N', structure: 'mur-en-bois' });    // cloison sud
  }
  for (let y = foot.y; y < foot.y + foot.h; y++) {
    walls.push({ x: foot.x - 1, y, side: 'E', structure: 'mur-en-bois' });              // cloison ouest
    walls.push({ x: foot.x + foot.w - 1, y, side: 'E', structure: 'mur-en-bois' });     // cloison est
  }
  s.walls = walls;
  return s;
}

describe('bâtiment COMPOSÉ — cloisons d’arête (wallBetween) + terrain', () => {
  it('l’intérieur reste MARCHABLE (terrain), mais les cloisons le SÉPARENT du dehors', () => {
    const s = houseScene();
    expect(isWalkable(s, 3, 3)).toBe(true);                 // le sol de l'intérieur est praticable
    expect(wallBetween(s, 3, 2, 3, 1)).toBe(true);         // cloison nord (intérieur ↔ dehors)
    expect(wallBetween(s, 2, 3, 1, 3)).toBe(true);         // cloison ouest
    expect(wallBetween(s, 4, 3, 5, 3)).toBe(true);         // cloison est
    expect(wallBetween(s, 2, 4, 2, 5)).toBe(true);         // cloison sud pleine (hors porte)
  });

  it('la PORTE de l’arête est franchissable (ouverte par défaut) — l’intérieur n’est pas scellé', () => {
    const s = houseScene();
    const door = doorAt(s, 3, 5, 'N')!;
    expect(door).toBeTruthy();
    expect(doorIsOpen(s, door)).toBe(true);                // porte non `closed` → ouverte
    expect(wallBetween(s, 3, 4, 3, 5)).toBe(false);        // on entre/sort par la porte
  });
});

describe('addBuilding — fenêtres décoratives du périmètre (espacées, hors coins ET porte)', () => {
  const foot = { x: 3, y: 3, w: 15, h: 10 };
  const { scene: s } = addBuilding(emptyScene(30, 20), 'taverne', foot, {
    door: { x: 10, y: 12, side: 'S' }, wallStructure: 'mur-en-bois',
  });
  const windows = (s.walls ?? []).filter((w) => w.window);
  const corners = new Set(['3,3', '17,3', '3,12', '17,12']); // les 4 cellules d'angle du foot

  it('pose des fenêtres (mur PLEIN + window:true), régulièrement espacées (golden 15 pour 15×10)', () => {
    expect(windows).toHaveLength(15); // N=5, S=4 (porte sautée), O=3, E=3
    for (const w of windows) {
      expect(w.door).toBeFalsy(); // une fenêtre n'est jamais une porte
      expect(w.structure).toBe('mur-en-bois'); // reste un mur DESTRUCTIBLE plein
    }
  });
  it('jamais sur la case-porte (canonisée S→N de (10,13))', () => {
    expect(windows.some((w) => w.x === 10 && w.y === 13 && w.side === 'N')).toBe(false);
  });
  it('jamais sur une cellule d’ANGLE (deux murs s’y croisent)', () => {
    for (const w of windows) expect(corners.has(`${w.x},${w.y}`)).toBe(false);
  });
  it('un PETIT bâtiment en a moins qu’un grand (data-driven par la taille)', () => {
    const small = addBuilding(emptyScene(12, 12), 'maison', { x: 2, y: 2, w: 5, h: 5 }, {}).scene;
    const nSmall = (small.walls ?? []).filter((w) => w.window).length;
    expect(nSmall).toBe(4); // 1 fenêtre par pan (interne unique)
    expect(nSmall).toBeLessThan(windows.length);
  });
  it('windows:false → aucune fenêtre (opt data-driven)', () => {
    const none = addBuilding(emptyScene(30, 20), 'taverne', foot, { windows: false }).scene;
    expect((none.walls ?? []).some((w) => w.window)).toBe(false);
  });
});

describe('INVARIANT COMBAT — une fenêtre est DÉCORATIVE (bloque EXACTEMENT comme un mur plein)', () => {
  it('window n’est lu par AUCUNE règle : wallIsOpen + wallBetween identiques à un mur nu', () => {
    const plain = emptyScene(6, 6); plain.walls = [{ x: 2, y: 2, side: 'N' }];
    const win = emptyScene(6, 6); win.walls = [{ x: 2, y: 2, side: 'N', window: true }];
    // wallIsOpen (LdV/vision) : false = bloque, identique.
    expect(wallIsOpen(win, win.walls![0])).toBe(false);
    expect(wallIsOpen(win, win.walls![0])).toBe(wallIsOpen(plain, plain.walls![0]));
    // wallBetween (passage/marchabilité) : identique de part et d'autre de l'arête.
    expect(wallBetween(win, 2, 2, 2, 1)).toBe(true);
    expect(wallBetween(win, 2, 2, 2, 1)).toBe(wallBetween(plain, 2, 2, 2, 1));
    expect(isWalkable(win, 2, 2)).toBe(isWalkable(plain, 2, 2));
  });
});

describe('roofHidden — cutaway du toit (Roof.foot)', () => {
  const roof: Roof = { id: 'b1', foot: { x: 2, y: 2, w: 3, h: 3 }, style: 'maison', label: 'Maison' };
  it('masque le toit dès qu’un allié se tient dans l’empreinte', () => {
    expect(roofHidden(roof, [{ x: 3, y: 3 }])).toBe(true);  // au cœur du bâti
    expect(roofHidden(roof, [{ x: 2, y: 2 }])).toBe(true);  // coin NO inclus (borne basse)
    expect(roofHidden(roof, [{ x: 4, y: 4 }])).toBe(true);  // coin SE inclus (borne haute)
  });
  it('laisse le toit posé si aucun allié n’est sous l’empreinte', () => {
    expect(roofHidden(roof, [{ x: 0, y: 0 }])).toBe(false);
    expect(roofHidden(roof, [{ x: 5, y: 5 }])).toBe(false); // juste hors empreinte (x/y = foot+ w/h)
    expect(roofHidden(roof, [])).toBe(false);
  });
});
