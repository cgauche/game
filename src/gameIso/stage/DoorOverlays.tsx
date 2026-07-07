/**
 * Portes dynamiques : cliquer une porte VISIBLE et ADJACENTE l'ouvre/ferme (exploration : le groupe ;
 * combat : le héros actif, à son tour). Une porte fermée bloque vue ET passage. INTERACTION → reste un
 * overlay du stage (hors builders).
 */
import { useGame } from '../../state/store';
import { Scene, doorIsOpen, toggleDoorIn } from '../../state/scene';
import { bus, EVT } from '../../state/bus';
import { Dims, tileEdge } from '../../geometry/iso';
import type { Pt } from '../../state/path';

export function DoorOverlays({ scene, dims, activeZ, visible, ctrls }: { scene: Scene; dims: Dims; activeZ: number; visible: ReadonlySet<string>; ctrls: Pt[] }) {
  if (!ctrls.length) return null;
  const adj = (p: Pt, c: Pt) => Math.max(Math.abs(p.x - c.x), Math.abs(p.y - c.y)) <= 1;
  return (
    <>
      {(scene.walls ?? [])
        .filter((w) => w.door && (w.z ?? 0) === activeZ && (w.side === 'N' || w.side === 'E'))
        .map((w) => {
          const z = w.z ?? 0;
          const c1 = { x: w.x, y: w.y };
          const c2 = w.side === 'E' ? { x: w.x + 1, y: w.y } : { x: w.x, y: w.y - 1 };
          if (!visible.has(`${c1.x},${c1.y},${z}`) && !visible.has(`${c2.x},${c2.y},${z}`)) return null;
          if (!ctrls.some((p) => adj(p, c1) || adj(p, c2))) return null;
          const [a, b] = tileEdge(w.x, w.y, w.side as 'N' | 'E', dims, z);
          const open = doorIsOpen(scene, w);
          return (
            <line key={`door-${w.x}-${w.y}-${w.side}-${z}`} x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy}
              stroke={open ? 'var(--iso-door-open)' : 'var(--iso-door-closed)'} strokeWidth={11} strokeLinecap="round" opacity={0.45}
              className="door-toggle" style={{ cursor: 'pointer' }}
              onPointerDown={(ev) => {
                ev.stopPropagation();
                useGame.setState((s) => (s.scene ? { scene: toggleDoorIn(s.scene, w.x, w.y, w.side, z) } : {}));
                bus.emit(EVT.SCENE_DIRTY);
              }}
            >
              <title>{open ? 'Fermer la porte' : 'Ouvrir la porte'}</title>
            </line>
          );
        })}
    </>
  );
}
