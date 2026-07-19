import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { emptyScene, type WallSeg } from '../../state/scene';
import { setRevealAll, computeStateVisible, sceneLightField } from '../../state/visionState';
import { makeCamera } from './camera';
import { buildPovDrawList } from './geometry';
import { useGame } from '../../state/store';
import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';

/**
 * POV — test d'INTÉGRATION du pipeline que `PovStage` assemble (store → visionState → camera → geometry).
 * `PovStage` lui-même n'est que le mapping draw-list → <polygon> (trivial, vérifié en navigateur) ; ici on
 * vérifie que l'ÉTAT RÉEL (scène, groupe, brouillard/lumière du store) produit bien de la géométrie. La
 * visibilité est forcée (`setRevealAll`) pour un résultat déterministe (brouillard/lumière testés à part).
 */
describe('POV — pipeline intégration (état réel → draw list)', () => {
  beforeEach(() => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', rng: makeRNG(1) });
    const scene = emptyScene(9, 9);
    scene.walls = [{ x: 4, y: 2, side: 'N' }, { x: 4, y: 2, side: 'E' }] as WallSeg[];
    useGame.setState({
      screen: 'campaign', mode: 'exploration', party: [hero], scene,
      partyPos: { x: 4, y: 4 }, facing: { [hero.id]: 'N' },
      dialogue: null, battle: null, povActive: true, lightLevel: 1,
    });
    setRevealAll(true);
  });
  afterEach(() => setRevealAll(false));

  it('produit une draw list non vide (sols + murs) depuis l’état du store', () => {
    const s = useGame.getState();
    const cam = makeCamera(s.scene!, s.partyPos, s.facing[s.party[0].id]);
    const input = { scene: s.scene, battle: null, party: s.party, partyPos: s.partyPos, gameTime: s.gameTime, lightLevel: s.lightLevel };
    const visible = computeStateVisible(input);
    const { light } = sceneLightField(input);
    const draw = buildPovDrawList(s.scene!, cam, visible, light);
    expect(draw.length).toBeGreaterThan(0);
    expect(draw.some((d) => d.kind === 'floor')).toBe(true);
    expect(draw.some((d) => d.kind === 'wall')).toBe(true);
  });
});
