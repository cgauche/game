/**
 * LdV de combat & vision CROSS-Z (Phase 1) : un défenseur sur un rempart (z=1) voit et tire un
 * assaillant au sol (z=0), et réciproquement la vision révèle le contrebas — sans casser le
 * comportement même-étage (byte-identique). Modèle Phase 1 : les murs d'ARÊTE fins (créneaux/parapet)
 * ne coupent PAS un tir/une vue inter-niveau ; seules les TUILES opaques (bâtiment/terrain) coupent.
 */
import { describe, it, expect } from 'vitest';
import { lineOfSightCover } from './lineOfSight';
import { computeVisible, type LightField } from './vision';
import { Scene, SceneEntity, WallSeg } from './scene';

function scene(w: number, h: number, tiles?: Record<string, string>, walls?: WallSeg[], entities: SceneEntity[] = []): Scene {
  const grid = new Array(w * h).fill('herbe');
  if (tiles)
    for (const [k, v] of Object.entries(tiles)) {
      const [x, y] = k.split(',').map(Number);
      grid[y * w + x] = v;
    }
  return {
    id: 's',
    name: 's',
    dimensions: { w, h },
    ambiance: 'jour',
    levels: [{ z: 0, tiles: grid }],
    entities,
    buildings: [],
    dialogues: [],
    triggers: [],
    encounters: [],
    walls,
  } as unknown as Scene;
}

/** Champ de lumière constant (tout éclairé) pour isoler la géométrie. */
const BRIGHT: LightField = { at: () => 1 };

describe('lineOfSightCover — LdV de combat CROSS-Z', () => {
  it('défenseur (z=1) → assaillant (z=0) en terrain ouvert : LdV dégagée', () => {
    const def = { x: 0, y: 0, z: 1 };
    const ass = { x: 4, y: 0 }; // z=0 (omis)
    expect(lineOfSightCover(scene(6, 1), def, ass, [])).toEqual({ blocked: false, cover: 'none' });
    // réciproque : assaillant au sol vers le défenseur sur le rempart
    expect(lineOfSightCover(scene(6, 1), ass, def, []).blocked).toBe(false);
  });

  it('un mur d\'ARÊTE entre eux ne bloque PAS en cross-z (on tire par-dessus le parapet)', () => {
    const s = scene(6, 1, {}, [{ x: 2, y: 0, side: 'E' }]); // arête (2,0)|(3,0)
    const def = { x: 0, y: 0, z: 1 };
    const ass = { x: 4, y: 0 };
    expect(lineOfSightCover(s, def, ass, []).blocked).toBe(false);
    expect(lineOfSightCover(s, ass, def, []).blocked).toBe(false);
  });

  it('une TUILE opaque (terrain `mur`) à distance entre eux BLOQUE même en cross-z', () => {
    const s = scene(6, 1, { '2,0': 'mur' }); // tuile opaque NON adjacente à la cible (4,0)
    const def = { x: 0, y: 0, z: 1 };
    const ass = { x: 4, y: 0 };
    expect(lineOfSightCover(s, def, ass, []).blocked).toBe(true);
  });
});

describe('lineOfSightCover — TÉMOIN même étage (byte-identique)', () => {
  it('mur d\'arête entre deux combattants z=0 → bloqué (inchangé)', () => {
    const s = scene(6, 1, {}, [{ x: 2, y: 0, side: 'E' }]);
    expect(lineOfSightCover(s, { x: 0, y: 0 }, { x: 4, y: 0 }, []).blocked).toBe(true);
  });
  it('sans mur entre deux combattants z=0 → dégagé', () => {
    expect(lineOfSightCover(scene(6, 1), { x: 0, y: 0 }, { x: 4, y: 0 }, [])).toEqual({ blocked: false, cover: 'none' });
  });
});

describe('computeVisible — vision inter-niveau (vers le bas seulement)', () => {
  it('un viewer z=1 révèle une case z=0 dans sa LdV (et sa propre case z=1)', () => {
    const v = computeVisible(scene(6, 1), [{ pos: { x: 0, y: 0 }, z: 1, radiusTiles: 5, darkTiles: 0 }], BRIGHT);
    expect(v.has('3,0,0')).toBe(true); // contrebas révélé
    expect(v.has('3,0,1')).toBe(true); // son propre étage révélé
  });
  it('un viewer z=0 ne révèle PAS l\'étage z=1 (pas de vision vers le haut)', () => {
    const v = computeVisible(scene(6, 1), [{ pos: { x: 0, y: 0 }, radiusTiles: 5, darkTiles: 0 }], BRIGHT);
    expect(v.has('3,0,1')).toBe(false);
  });
  it('mono-étage : viewer z=0 révèle z=0 dans son rayon, pas au-delà (inchangé)', () => {
    const v = computeVisible(scene(8, 1), [{ pos: { x: 0, y: 0 }, radiusTiles: 3, darkTiles: 0 }], BRIGHT);
    expect(v.has('3,0,0')).toBe(true);
    expect(v.has('4,0,0')).toBe(false); // hors rayon (Chebyshev 4 > 3)
  });
});
