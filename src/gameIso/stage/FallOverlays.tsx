/**
 * Chute VOLONTAIRE (LDB 15 l.82) : arêtes de dénivelé `cliff` DESCENDANTES bordant la case du mobile
 * (exploration : le groupe ; combat : le héros actif) — MIROIR de `ClimbOverlays` (arêtes grimpables),
 * pour le geste OPPOSÉ : sauter d'une falaise SANS arête `climb` (Athlétisme, `state/fallMove.planFall`).
 * Cliquer ouvre le choix pré-jet (Sauter / Tenter) — `store.fallAcross` résout via la modale `FallModal`.
 * MÊME FAMILLE d'interaction que les PORTES/ARÊTES GRIMPABLES : un overlay d'arête cliquable, hors
 * builders (aucun impact sur les goldens iso).
 */
import { useGame } from '../../state/store';
import { Scene, edgeOf } from '../../state/scene';
import { planFall } from '../../state/fallMove';
import { bus, EVT } from '../../state/bus';
import { Dims, tileEdge } from '../../geometry/iso';
import type { Pt } from '../../state/path';

const CARDINALS: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function FallOverlays({ scene, dims, activeZ, visible, ctrls }: { scene: Scene; dims: Dims; activeZ: number; visible: ReadonlySet<string>; ctrls: Pt[] }) {
  if (!ctrls.length) return null;
  const mover = ctrls.find((p) => (p.z ?? 0) === activeZ);
  if (!mover) return null;
  return (
    <>
      {CARDINALS.map(([dx, dy]) => {
        const to: Pt = { x: mover.x + dx, y: mover.y + dy, z: mover.z };
        const plan = planFall(scene, mover, to);
        if (plan.kind !== 'fall') return null;
        if (!visible.has(`${mover.x},${mover.y},${activeZ}`) && !visible.has(`${to.x},${to.y},${activeZ}`)) return null;
        const e = edgeOf(mover.x, mover.y, to.x, to.y);
        if (!e) return null;
        const [a, b] = tileEdge(e.x, e.y, e.side, dims, activeZ);
        return (
          <line key={`fall-${e.x}-${e.y}-${e.side}-${activeZ}`} x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy}
            stroke="var(--iso-climb)" strokeWidth={9} strokeLinecap="round" strokeDasharray="3 5" opacity={0.5}
            className="fall-edge" style={{ cursor: 'pointer' }}
            onPointerDown={(ev) => {
              ev.stopPropagation();
              useGame.getState().fallAcross(mover, to);
              bus.emit(EVT.SCENE_DIRTY);
            }}
          >
            <title>{`Sauter en bas (${Math.round(plan.metres)} m)`}</title>
          </line>
        );
      })}
    </>
  );
}
