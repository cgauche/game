/**
 * Structures de siège (AA p.120) : la fortification d'arête est une CIBLE de combat. Hit-area
 * TRANSPARENTE posée sur l'arête, portant le `data-cid` du Combattant-structure → survol (réticule de
 * visée) + clic-attaque (`battleClickEntity`, comme un token ; `stopPropagation` court-circuite le
 * clic-sol du SVG, comme l'overlay porte). Présente tant que la structure TIENT (Combattant présent)
 * et qu'une de ses deux cases est visible — PAS de garde d'adjacence : on la pilonne à distance. À la
 * BRÈCHE, `collapseStructure` retire le Combattant et pose le flag → l'overlay disparaît, l'arête
 * reste en gravats. INTERACTION (picking data-cid) → reste un overlay du stage, hors builders.
 */
import { useGame, type BattleState } from '../../state/store';
import { Scene, structureIsDown } from '../../state/scene';
import { controlsActive } from '../../state/netOwnership';
import { hoverClickCommits } from '../../ui/pointerCaps';
import { Dims, tileEdge } from '../iso';

export function SiegeHitAreas({ scene, battle, dims, activeZ, visible }: { scene: Scene; battle: BattleState; dims: Dims; activeZ: number; visible: ReadonlySet<string> }) {
  return (
    <>
      {(scene.walls ?? [])
        .filter((w) => !!w.structure && (w.z ?? 0) === activeZ && (w.side === 'N' || w.side === 'E') && !structureIsDown(scene, w))
        .map((w) => {
          const z = w.z ?? 0;
          const id = `structure-${w.x}-${w.y}-${w.side}-${z}`;
          const sc = battle.combatants.find((c) => c.id === id);
          if (!sc) return null; // abattue / pas (encore) enrôlée
          const c1 = { x: w.x, y: w.y };
          const c2 = w.side === 'E' ? { x: w.x + 1, y: w.y } : { x: w.x, y: w.y - 1 };
          if (!visible.has(`${c1.x},${c1.y},${z}`) && !visible.has(`${c2.x},${c2.y},${z}`)) return null;
          const [a, b] = tileEdge(w.x, w.y, w.side as 'N' | 'E', dims, z);
          return (
            <line key={`struct-${w.x}-${w.y}-${w.side}-${z}`} data-cid={id} x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy}
              stroke="transparent" strokeWidth={16} strokeLinecap="round" style={{ pointerEvents: 'stroke', cursor: 'crosshair' }}
              onPointerDown={(ev) => {
                const st = useGame.getState();
                if (!controlsActive(st)) return;
                // Aperçu-puis-commit (parité token, targetingModes) : un 1er clic ARME seulement la
                // structure et LAISSE l'événement remonter → le clic-sol résout un MOVE (s'approcher,
                // passer le long du mur). Seul un 2e clic sur la structure DÉJÀ armée la frappe — frapper
                // une enceinte est une action DÉLIBÉRÉE, pas le réflexe d'un clic.
                const prev = st.battle?.preview;
                const armed = !!prev && 'targetId' in prev && prev.targetId === id;
                if (armed) {
                  ev.stopPropagation();
                  st.battleClickEntity(id, { confirm: hoverClickCommits() });
                } else {
                  st.battleClickEntity(id, { confirm: false });
                }
              }}
            >
              <title>{sc.name}</title>
            </line>
          );
        })}
    </>
  );
}
