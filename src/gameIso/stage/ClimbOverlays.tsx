/**
 * Arêtes ESCALADABLES (LDB 15 l.52-57) : marqueur SOBRE sur une arête `WallSeg.climb` bordant la case du
 * mobile (exploration : le groupe ; combat : le héros actif). Cliquer grimpe vers la case d'en face —
 * `store.climbAcross` résout la grimpe (échelle sans Test, surface = Test d'Escalade influençable, échec →
 * chute). MÊME FAMILLE d'interaction que les PORTES (`DoorOverlays`) : un overlay d'arête cliquable, hors
 * builders (aucun impact sur les goldens iso).
 */
import { useGame } from '../../state/store';
import { Scene, heightAt } from '../../state/scene';
import { bus, EVT } from '../../state/bus';
import { Dims, tileEdge } from '../../geometry/iso';
import type { Pt } from '../../state/path';

export function ClimbOverlays({ scene, dims, activeZ, visible, ctrls }: { scene: Scene; dims: Dims; activeZ: number; visible: ReadonlySet<string>; ctrls: Pt[] }) {
  if (!ctrls.length) return null;
  const same = (a: Pt, b: { x: number; y: number }) => a.x === b.x && a.y === b.y && (a.z ?? 0) === activeZ;
  return (
    <>
      {(scene.walls ?? [])
        .filter((w) => w.climb && (w.z ?? 0) === activeZ && (w.side === 'N' || w.side === 'E'))
        .map((w) => {
          const z = w.z ?? 0;
          const c1 = { x: w.x, y: w.y };
          const c2 = w.side === 'E' ? { x: w.x + 1, y: w.y } : { x: w.x, y: w.y - 1 };
          if (!visible.has(`${c1.x},${c1.y},${z}`) && !visible.has(`${c2.x},${c2.y},${z}`)) return null;
          // Le mobile doit être SUR l'une des deux cases (on grimpe depuis là où l'on se tient) ; on grimpe
          // vers la case d'en face.
          const mover = ctrls.find((p) => same(p, c1) || same(p, c2));
          if (!mover) return null;
          const from = same(mover, c1) ? c1 : c2;
          const to = same(mover, c1) ? c2 : c1;
          const [a, b] = tileEdge(w.x, w.y, w.side as 'N' | 'E', dims, z);
          const up = heightAt(scene, to.x, to.y, z) > heightAt(scene, from.x, from.y, z);
          return (
            <line key={`climb-${w.x}-${w.y}-${w.side}-${z}`} x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy}
              stroke="var(--iso-climb)" strokeWidth={9} strokeLinecap="round" strokeDasharray="3 5" opacity={0.5}
              className="climb-edge" style={{ cursor: 'pointer' }}
              onPointerDown={(ev) => {
                ev.stopPropagation();
                useGame.getState().climbAcross({ x: from.x, y: from.y, z }, { x: to.x, y: to.y, z });
                bus.emit(EVT.SCENE_DIRTY);
              }}
            >
              <title>{up ? 'Escalader' : 'Descendre en escalade'}</title>
            </line>
          );
        })}
    </>
  );
}
