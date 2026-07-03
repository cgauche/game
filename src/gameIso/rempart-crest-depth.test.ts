import { describe, it, expect } from 'vitest';
import { scenario } from '../scenes/test-scenarios/siege-explore';
import { buildWalls } from './builders/walls';
import { wallDepth } from './backends/affineWalls';
import { FIGURANT_LIFT } from './stage/tokens';
import { depth } from './iso';

// Les crêtes sont sur des arêtes CARDINALES canonisées N/E (WallSide) → voisin de l'arête.
const NB: Record<string, [number, number]> = { N: [0, -1], E: [1, 0] };

describe('rempart — la crête ne masque pas le défenseur (figurant) posé sur sa case', () => {
  it('FIGURANT_LIFT dépasse l’offset de MUR de toute crête du chemin de ronde (jeton > mur)', () => {
    const scene = scenario.scene;
    const dims = { ...scene.dimensions, rot: 0 as const, view: 'iso' as const };
    const crests = buildWalls(scene).filter((e) => e.key.startsWith('crest:') && e.cell.z === 1);
    expect(crests.length).toBeGreaterThan(0);
    for (const c of crests) {
      const nb = NB[c.side];
      if (!nb) continue; // (aucune crête diagonale attendue)
      // offset de tri du mur = wallDepth − base MAX de ses 2 cases bordantes (cf. affineWalls) ; le
      // défenseur est sur la case crénelée (base MAX) → il trie au-dessus ssi FIGURANT_LIFT > cet offset.
      const maxBase = Math.max(
        depth(c.cell.x, c.cell.y, dims, c.cell.z),
        depth(c.cell.x + nb[0], c.cell.y + nb[1], dims, c.cell.z),
      );
      const wallLift = wallDepth(c, dims) - maxBase;
      expect(FIGURANT_LIFT).toBeGreaterThan(wallLift);
    }
  });
});
