import { describe, expect, it, vi } from 'vitest';
import { tileEdge, type Dims } from '../../geometry/iso';
import { emptyScene, heightAt, isWalkable, type Scene } from '../../state/scene';
import { metricToLift } from '../../state/relief';
import { roomPortals } from '../../state/roomPortals';
import { scenario as diligence } from '../../scenes/test-scenarios/diligence';
import type { Combatant } from '../../engine/types';
import type { BattleState } from '../../state/store';
import { poseFromDims } from './projection';
import { resoudrePixel, type CadreDePick, type EtatDePick } from './pickResolve';

/**
 * QUI GAGNE LE PIXEL D'UNE ARÊTE ? (#1687, lot 1b-0) — deux verdicts se superposent sur le même
 * pixel, et ce banc mesure les deux moitiés :
 *
 *  1. HORS OVERLAY, la chaîne de picking (`resoudrePixel`) donne la priorité au RAYON : dès que la
 *     voie de rendu NOMME un combattant, le verdict est cet acteur — le pixel n'est même pas inversé
 *     (le thunk `pointStage` n'est pas appelé), donc aucune arête n'est consultée ;
 *  2. AU-DESSUS, la hit-area SVG de l'overlay prend l'événement AVANT que la chaîne ne soit
 *     interrogée, et le retient (`stopPropagation`) — mesuré par `DoorOverlays.test.tsx` (« fournit
 *     directement le portail ciblé au survol et au clic ») et par les bancs frères des trois autres
 *     overlays d'arête (`ClimbOverlays`/`FallOverlays`/`SiegeHitAreas`).
 *
 * La POPULATION en jeu est le second volet : où tombe, une fois inversé par la chaîne, le pixel du
 * CENTRE de chaque arête de portail — c'est l'effectif dont le verdict changerait si l'étage SVG
 * passait APRÈS le rayon. La propriété asserée est PAR PORTAIL, sans cardinal : chacun rend l'une de
 * ses DEUX cases (jamais une troisième, jamais rien), et cette case est marchable — donc un acteur
 * peut s'y tenir, donc le rayon aurait quelqu'un à nommer là. La mesure du jour sur `la-diligence` :
 * 89 portails, 89 résolus par l'étage `sol` sur `from`/`to`, 0 hors monde (le chiffre vit au ticket,
 * pas dans une assertion : la carte est une scène JOUÉE, l'éditer ne doit pas rougir un test).
 */

const dimsDe = (scene: Scene): Dims => ({ w: scene.dimensions.w, h: scene.dimensions.h, rot: 0, view: 'iso' });

/** Le lift que l'overlay de portes passe à `tileEdge` (`SurcoucheIso.tsx:148` `liftOf` →
 *  `MondeDeCampagne.tsx:181` `liftAt`) : hauteur MÉTRIQUE de la case de départ, 0 au rez. */
const liftDePortail = (scene: Scene, p: { x: number; y: number; z?: number }): number =>
  (p.z ? metricToLift(heightAt(scene, p.x, p.y, p.z)) : 0);

const milieu = (a: { cx: number; cy: number }, b: { cx: number; cy: number }) =>
  ({ x: (a.cx + b.cx) / 2, y: (a.cy + b.cy) / 2 });

describe('priorité du pixel d’arête — ce que la chaîne fait AUJOURD’HUI', () => {
  it('sur le pixel MÊME d’une porte, le rayon nomme l’acteur et le pixel n’est jamais inversé', () => {
    const scene = emptyScene(6, 6);
    scene.walls = [{ x: 2, y: 2, side: 'E', door: true }];
    const dims = dimsDe(scene);
    const acteur = { id: 'e1', pos: { x: 2, y: 2, z: 0 } } as unknown as Combatant;
    const st: EtatDePick = {
      scene,
      mode: 'battle',
      battle: { combatants: [acteur], order: ['e1'], turn: 0 } as unknown as BattleState,
      partyPos: { x: 0, y: 0 },
    };
    const [a, b] = tileEdge(2, 2, 'E', dims, 0);
    const surLArete = vi.fn(() => milieu(a, b));
    const cadre: CadreDePick = { pose: poseFromDims(dims), dims, activeZ: 0 };

    const verdict = resoudrePixel(st, { kind: 'combatant', id: 'e1' }, surLArete, cadre);

    expect(verdict).toEqual({ tile: { x: 2, y: 2, z: 0 }, cid: 'e1', via: 'sprite', nature: 'combattant' });
    expect(surLArete, 'le rayon tranche avant tout étage de surface').not.toHaveBeenCalled();
  });

  it('chaque pixel de seuil rend une case DU portail, où un acteur peut se tenir', () => {
    const scene = diligence.scene as Scene;
    const dims = dimsDe(scene);
    const cadre = (z: number): CadreDePick => ({ pose: poseFromDims(dims), dims, activeZ: z });
    const portails = roomPortals(scene);

    const derives: string[] = [];
    for (const p of portails) {
      const [a, b] = tileEdge(p.edge.x, p.edge.y, p.edge.side, dims, liftDePortail(scene, p.from));
      const g = milieu(a, b);
      const st: EtatDePick = { scene, mode: 'exploration', battle: null, partyPos: p.from };
      const { tile } = resoudrePixel(st, null, () => g, cadre(p.z));
      const est = (q: { x: number; y: number; z?: number }) => !!tile && tile.x === q.x && tile.y === q.y && tile.z === (q.z ?? 0);
      if (!tile) derives.push(`${p.id} → hors monde`);
      else if (!est(p.from) && !est(p.to)) derives.push(`${p.id} → ${tile.x},${tile.y},z${tile.z} (ni from ni to)`);
      else if (!isWalkable(scene, tile.x, tile.y, tile.z)) derives.push(`${p.id} → ${tile.x},${tile.y},z${tile.z} non marchable`);
    }

    expect(portails.length, 'la carte porte des portails à mesurer').toBeGreaterThan(0);
    expect(derives).toEqual([]);
  });
});
