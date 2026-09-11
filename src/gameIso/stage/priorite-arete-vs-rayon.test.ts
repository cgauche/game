import { describe, expect, it, vi } from 'vitest';
import { tileEdge, type Dims } from '../../geometry/iso';
import { emptyScene, isWalkable, liftDe, type Scene } from '../../state/scene';
import { roomPortals, type RoomPortal } from '../../state/roomPortals';
import { aretesUtilisables } from '../../state/aretes';
import { scenario as diligence } from '../../scenes/test-scenarios/diligence';
import type { Combatant } from '../../engine/types';
import type { BattleState } from '../../state/store';
import { poseFromDims } from './projection';
import { projeterAretes } from './aretesProjetees';
import { resoudrePixel, type CadreDePick, type EtatDePick } from './pickResolve';

/**
 * QUI GAGNE LE PIXEL D'UN SEUIL ? (#1687) — la chaîne consulte l'étage `arete` AVANT le rayon, et ce
 * banc mesure les deux régimes qui en découlent :
 *
 *  A. AUCUNE arête offerte (hors seuil, ou contrôleur sans accès) : le rayon tranche, et le pixel
 *     n'est même pas inversé — le thunk `pointStage` n'est pas appelé ;
 *  B. l'arête OFFERTE : le même pixel, sous le même rayon nommant un acteur, rend `nature:'arete'`.
 *     C'est la PARITÉ avec le régime d'hier, où le hit-target SVG de l'overlay retenait le
 *     `pointerdown` avant que la chaîne ne soit consultée.
 *
 * Ce que cette parité vaut se mesure au troisième volet : le pixel du CENTRE de chaque seuil de la
 * Diligence tombe, une fois inversé, sur une case MARCHABLE de son portail — donc une case où un acteur
 * peut se tenir, et que le rayon nommerait. Placer l'étage APRÈS le rayon changerait chacun de ces
 * verdicts (89 portails, 89 résolus par la surface, mesure 1b-0 : le chiffre vit au ticket, pas dans
 * une assertion — la carte est une scène de TEST, l'éditer ne doit pas rougir un banc).
 */

const dimsDe = (scene: Scene): Dims => ({ w: scene.dimensions.w, h: scene.dimensions.h, rot: 0, view: 'iso' });

/** Le lift que le peintre des seuils passe à `tileEdge` : le SOCLE `state/scene.ts:liftDe`, celui que
 *  l'hôte ferme sur la scène (`MondeDeCampagne.liftOf` → `SurcoucheIso`), pas une seconde hauteur. */
const liftDePortail = (scene: Scene, p: { x: number; y: number; z?: number }): number => liftDe(scene, p);

const milieu = (a: { cx: number; cy: number }, b: { cx: number; cy: number }) =>
  ({ x: (a.cx + b.cx) / 2, y: (a.cy + b.cy) / 2 });

/** Une salle 6×6 dont l'arête (2,2,E) porte une porte, et l'accès de pièce qui va avec. */
function scèneÀUnePorte(): { scene: Scene; portail: RoomPortal } {
  const scene = emptyScene(6, 6);
  scene.walls = [{ x: 2, y: 2, side: 'E', door: true }];
  return {
    scene,
    portail: {
      id: '0:2,2:E:a:b', z: 0, edge: { x: 2, y: 2, side: 'E' },
      fromZoneId: 'a', toZoneId: 'b', kind: 'door-closed', exterior: false,
      from: { x: 2, y: 2 }, to: { x: 3, y: 2 },
    },
  };
}

describe('l’étage `arete` et le rayon : qui tranche, et à quel prix', () => {
  const { scene, portail } = scèneÀUnePorte();
  const dims = dimsDe(scene);
  const acteur = { id: 'e1', pos: { x: 2, y: 2, z: 0 } } as unknown as Combatant;
  const enCombat: EtatDePick = {
    scene,
    mode: 'battle',
    battle: { combatants: [acteur], order: ['e1'], turn: 0 } as unknown as BattleState,
    partyPos: { x: 0, y: 0 },
  };
  const [a, b] = tileEdge(2, 2, 'E', dims, 0);
  const aretes = projeterAretes(
    aretesUtilisables({ scene, visible: new Set(['2,2,0', '3,2,0']), controleur: null, activeZ: 0, portails: [portail] }),
    dims,
    () => 0,
  );

  it('SANS arête offerte : le rayon tranche, et le pixel n’est jamais inversé', () => {
    const surLeSeuil = vi.fn(() => milieu(a, b));
    const cadre: CadreDePick = { pose: poseFromDims(dims), dims, activeZ: 0, aretes: [] };

    const verdict = resoudrePixel(enCombat, { kind: 'combatant', id: 'e1' }, surLeSeuil, cadre);

    expect(verdict).toEqual({ tile: { x: 2, y: 2, z: 0 }, cid: 'e1', via: 'sprite', nature: 'combattant' });
    expect(surLeSeuil, 'aucun étage n’a besoin du point inversé').not.toHaveBeenCalled();
  });

  it('AVEC l’arête offerte : le MÊME pixel rend le seuil, l’étage précédant le rayon', () => {
    const surLeSeuil = vi.fn(() => milieu(a, b));
    const cadre: CadreDePick = { pose: poseFromDims(dims), dims, activeZ: 0, aretes };

    const verdict = resoudrePixel(enCombat, { kind: 'combatant', id: 'e1' }, surLeSeuil, cadre);

    expect(aretes, 'la porte de la scène est bien offerte au picking').toHaveLength(1);
    expect(verdict.nature).toBe('arete');
    expect(verdict.via).toBe('arete');
    if (verdict.nature === 'arete') expect(verdict.arete.portail?.id).toBe(portail.id);
    expect(surLeSeuil, 'l’étage d’arête inverse le pixel : c’est le coût de la parité').toHaveBeenCalledTimes(1);
  });

  it('chaque pixel de seuil rend une case DU portail, où un acteur peut se tenir', () => {
    const sc = diligence.scene as Scene;
    const d = dimsDe(sc);
    const cadre = (z: number): CadreDePick => ({ pose: poseFromDims(d), dims: d, activeZ: z, aretes: [] });
    const portails = roomPortals(sc);

    const derives: string[] = [];
    for (const p of portails) {
      const [pa, pb] = tileEdge(p.edge.x, p.edge.y, p.edge.side, d, liftDePortail(sc, p.from));
      const g = milieu(pa, pb);
      const st: EtatDePick = { scene: sc, mode: 'exploration', battle: null, partyPos: p.from };
      const { tile } = resoudrePixel(st, null, () => g, cadre(p.z));
      const est = (q: { x: number; y: number; z?: number }) => !!tile && tile.x === q.x && tile.y === q.y && tile.z === (q.z ?? 0);
      if (!tile) derives.push(`${p.id} → hors monde`);
      else if (!est(p.from) && !est(p.to)) derives.push(`${p.id} → ${tile.x},${tile.y},z${tile.z} (ni from ni to)`);
      else if (!isWalkable(sc, tile.x, tile.y, tile.z)) derives.push(`${p.id} → ${tile.x},${tile.y},z${tile.z} non marchable`);
    }

    expect(portails.length, 'la carte porte des portails à mesurer').toBeGreaterThan(0);
    expect(derives).toEqual([]);
  });
});
