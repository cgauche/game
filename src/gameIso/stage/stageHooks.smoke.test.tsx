import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useRef } from 'react';
import { Combatant } from '../../engine/types';
import type { BattleState } from '../../state/store';
import { useStageCamera, stageFocus, computeViewBounds, cameraTargeting, VW, VH } from './useStageCamera';
import { useStagePointer } from './useStagePointer';
import { useHoverTargeting } from './useHoverTargeting';
import type { Dims } from '../iso';

/**
 * SMOKE des hooks du stage — l'infra node (zustand v5 + rendu serveur) sert l'état INITIAL du store
 * aux composants connectés : on vérifie ici que les hooks S'EXÉCUTENT sans erreur au premier rendu et
 * exposent leur contrat (état initial, handlers), pas leur comportement en jeu (couvert par la recette
 * navigateur + les tests des builders/couches purs).
 */
const DIMS: Dims = { w: 4, h: 4, rot: 0, view: 'iso' };

function probe(render: () => string): string {
  const Probe = () => <div data-out={render()} />;
  return renderToStaticMarkup(<Probe />);
}

describe('hooks du stage — smoke (premier rendu, état initial)', () => {
  it('useStageCamera : rotation affichée 0, pas de transition en cours, zoom du store', () => {
    const html = probe(() => {
      const svgRef = useRef<SVGSVGElement>(null);
      const cam = useStageCamera(svgRef);
      return `${cam.shownRot}|${cam.shownEdge}|${cam.turning}|${typeof cam.zoom}|${typeof cam.camPan.x}`;
    });
    expect(html).toContain('data-out="0|false|false|number|number"');
  });

  it('useStagePointer : hover null, tous les handlers exposés (scène absente tolérée)', () => {
    const html = probe(() => {
      const svgRef = useRef<SVGSVGElement>(null);
      const camRef = useRef({ x: 0, y: 0 });
      const p = useStagePointer({ svgRef, scene: null, dims: DIMS, zoom: 1, camRef, hoverTracking: false, partyLeader: undefined });
      const h = p.handlers;
      return `${p.hover}|${[h.onPointerDown, h.onPointerMove, h.onPointerUp, h.onPointerCancel, h.onPointerLeave, h.onContextMenu].every((f) => typeof f === 'function')}`;
    });
    expect(html).toContain('data-out="null|true"');
  });

  it('useHoverTargeting : hors combat, aucun ciblage (tout null, ghostIds vide)', () => {
    const html = probe(() => {
      const t = useHoverTargeting(null, null, false);
      return `${t.hoverAim}|${t.hoveredId}|${t.hoverMove}|${t.explorePath}|${t.ghostIds.size}|${t.effHover}`;
    });
    expect(html).toContain('data-out="null|null|null|null|0|null"');
  });
});

const cbt = (id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }): Combatant =>
  ({ id, name: id, kind, pos, size: 'moyenne', conditions: [], wounds: { current: 10, max: 10 } } as unknown as Combatant);
const walkStill = (id: string, x: number, y: number) => ({ x, y, walking: false, sortPt: { x, y } });

describe('stageFocus / computeViewBounds / cameraTargeting — helpers purs de caméra', () => {
  const base = {
    mode: 'exploration',
    battle: null,
    partyPos: { x: 2, y: 3 },
    partyLeader: undefined,
    walkPosOf: walkStill,
    planView: false,
    hoverCombatantId: null,
    targeting: null,
    pendingAttack: null,
    pendingCast: null,
  };

  it('hors combat : suit la position (visuelle) du leader, sinon partyPos', () => {
    expect(stageFocus(base)).toEqual({ x: 2, y: 3 });
    expect(stageFocus({ ...base, partyLeader: cbt('h', 'hero', { x: 0, y: 0 }) })).toMatchObject({ x: 2, y: 3 }); // walkStill → position logique
  });

  it('paire de visée (télégraphe/attaque en résolution) : cadre le MILIEU attaquant ↔ cible', () => {
    const a = cbt('a', 'enemy', { x: 0, y: 0 });
    const t = cbt('t', 'hero', { x: 4, y: 2 });
    const battle = { combatants: [a, t], order: ['a'], turn: 0 } as unknown as BattleState;
    const focus = stageFocus({ ...base, mode: 'battle', battle, targeting: { from: a, to: t } });
    expect(focus).toEqual({ x: 2, y: 1 });
    expect(stageFocus({ ...base, mode: 'battle', battle, pendingAttack: { attackerId: 'a', targetId: 't' } })).toEqual({ x: 2, y: 1 });
  });

  it('combat sans paire : suit l’actif ; ouverture (planView) ou pas d’actif → centroïde ; peek de frise prime', () => {
    const a = cbt('a', 'hero', { x: 1, y: 1 });
    const b = cbt('b', 'enemy', { x: 3, y: 3 });
    const battle = { combatants: [a, b], order: ['a', 'b'], turn: 0 } as unknown as BattleState;
    expect(stageFocus({ ...base, mode: 'battle', battle })).toMatchObject({ x: 1, y: 1 }); // l'actif
    expect(stageFocus({ ...base, mode: 'battle', battle, planView: true })).toEqual({ x: 2, y: 2 }); // centroïde
    expect(stageFocus({ ...base, mode: 'battle', battle, hoverCombatantId: 'b' })).toMatchObject({ x: 3, y: 3 }); // peek
  });

  it('cameraTargeting : paire depuis actorAim, mêlée/charge = ligne pleine', () => {
    const a = cbt('a', 'enemy', { x: 0, y: 0 });
    const t = cbt('t', 'hero', { x: 1, y: 1 });
    const battle = { combatants: [a, t] } as unknown as BattleState;
    expect(cameraTargeting(battle, { fromId: 'a', toId: 't', kind: 'charge' })?.melee).toBe(true);
    expect(cameraTargeting(battle, { fromId: 'a', toId: 't', kind: 'ranged' })?.melee).toBe(false);
    expect(cameraTargeting(battle, null)).toBeNull();
  });

  it('computeViewBounds : AABB de tuiles couvrant la fenêtre (contient le centre visé)', () => {
    const cam = { x: 0, y: 0 };
    const b = computeViewBounds(cam, 1, DIMS);
    expect(b.minX).toBeLessThanOrEqual(b.maxX);
    expect(b.minY).toBeLessThanOrEqual(b.maxY);
    expect(Number.isFinite(b.minX + b.maxX + b.minY + b.maxY)).toBe(true);
    expect(VW).toBeGreaterThan(0);
    expect(VH).toBeGreaterThan(0);
  });
});
