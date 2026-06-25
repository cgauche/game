import { useGame, activeCombatant } from '../state/store';
import { crewRoles } from '../data';
import { defaultCrewRole, moraleBand } from '../engine/crewMorale';
import { exposedCrew } from '../engine/shipCritical';
import { shipMoraleScore } from '../state/shipCrew';
import { shipOfCrew } from '../state/shipPostes';
import { isVehicle } from '../engine/vehicle';
import { OptionChooser, type RollOption } from './OptionChooser';
import type { Combatant } from '../engine/types';
import type { Dir8 } from '../state/dir8';

const DIR_LABEL: Record<Dir8, string> = { N: 'Nord', NE: 'Nord-Est', E: 'Est', SE: 'Sud-Est', S: 'Sud', SO: 'Sud-Ouest', O: 'Ouest', NO: 'Nord-Ouest' };
const SIDE_LABEL: Record<string, string> = { proue: 'Proue', tribord: 'Tribord', poupe: 'Poupe', babord: 'Bâbord' };

/**
 * Interface de GESTION DU NAVIRE (MDG ch.14) — assigne chaque marin APTE à un rôle naval (Capitaine/Timonier/
 * Artilleur/Mousse/…) + affiche l'état de la coque. Calquée EXACTEMENT sur `TravelRolesPanel` (rôle ÉPINGLÉ
 * `shipRole` vs INFÉRÉ `defaultCrewRole` marqué « auto », re-clic détache), via `OptionChooser` (grille). Les Tests
 * d'équipage (manœuvre/bordée) lisent ensuite ces rôles via `shipCrewAssignments`. Présentation PURE (props).
 */
export function ShipRolesPanelView({ ship, crew, cap, morale, onSet }: {
  ship: Combatant;
  crew: Combatant[];
  cap?: Dir8;
  morale: number;
  onSet: (crewId: string, role: string | null) => void;
}) {
  const apte = exposedCrew(crew);
  const band = moraleBand(morale);
  const byside = new Map<string, number>();
  for (const p of ship.postes ?? []) byside.set(p.side, (byside.get(p.side) ?? 0) + 1);
  return (
    <details className="ship-roles" open>
      <summary className="mini-title">⚓ {ship.name} — Coque {ship.wounds.current}/{ship.wounds.max} · Moral {morale} · Effectif {apte.length}/{crew.length}</summary>
      {/* État du navire (lecture seule, dérivé) — `.bar` s'enroule ≤700px. */}
      <div className="bar ship-state">
        <span>🛡️ Coque {ship.wounds.current}/{ship.wounds.max}</span>
        {cap && <span>🧭 Cap {DIR_LABEL[cap]}</span>}
        <span>⚓ Moral {morale}{band.crewTestDR ? ` (${band.crewTestDR > 0 ? '+' : ''}${band.crewTestDR} DR aux Tests)` : ''}</span>
        <span>👥 Effectif {apte.length}/{crew.length}</span>
        {[...byside].map(([side, n]) => <span key={side}>🎯 {SIDE_LABEL[side] ?? side} ×{n}</span>)}
      </div>
      <div className="wm-roles">
        {apte.map((c) => {
          const pinned = c.shipRole;
          const current = pinned ?? defaultCrewRole(c) ?? undefined;
          const options: RollOption[] = crewRoles.map((r) => ({
            key: r.id,
            label: r.label,
            primary: r.id === current,
            title: r.id === current && !pinned ? 'Rôle déduit des compétences (« auto ») — cliquez pour l’épingler' : r.desc,
            onSelect: () => onSet(c.id, pinned === r.id ? null : r.id),
          }));
          return (
            <div key={c.id} className="wm-role-row">
              <span className="wm-role-name">{c.name}{!pinned && current && <span className="wm-opt-hint"> (auto)</span>}</span>
              <OptionChooser options={options} layout="grid" />
            </div>
          );
        })}
      </div>
    </details>
  );
}

/** Wrapper relié au store : le navire ACTIF (coque active, ou navire du marin actif), son équipage, son Moral. */
export function ShipRolesPanel() {
  const battle = useGame((s) => s.battle);
  const setShipRole = useGame((s) => s.setShipRole);
  const facing = useGame((s) => s.facing);
  if (!battle) return null;
  const active = activeCombatant(battle);
  const ship = active && isVehicle(active) ? active : active ? shipOfCrew(battle.combatants, active.id) : undefined;
  if (!ship) return null;
  const crew = (ship.crewIds ?? []).map((id) => battle.combatants.find((c) => c.id === id)).filter((c): c is Combatant => !!c);
  return <ShipRolesPanelView ship={ship} crew={crew} cap={facing[ship.id]} morale={shipMoraleScore(useGame.getState, ship)} onSet={setShipRole} />;
}
