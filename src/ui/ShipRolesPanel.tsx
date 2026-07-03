import type { Combatant } from '../engine/types';
import { useGame } from '../state/store';
import { crewRoles } from '../data';
import { defaultCrewRole } from '../engine/crewMorale';
import { OptionChooser, type RollOption } from './OptionChooser';

/**
 * Postes d'ÉQUIPAGE naval PERSISTANTS (MDG ch.14) — pendant maritime de `TravelRolesPanel`. Pour chaque
 * héros vivant, on épingle UN rôle de navire (`shipRole` : capitaine/timonier/vigie/navigateur/…) ; les
 * Tests d'équipage du voyage maritime lisent ce poste (`shipDefaultRoles`). Quand le joueur n'a rien
 * épinglé, le rôle est INFÉRÉ des Compétences (`defaultCrewRole`, marqué « auto »). Réutilise
 * `OptionChooser` (grille de boutons) — aucune modale, aucun id tapé.
 *
 * N'est rendu QU'À l'appareillage (route maritime + navire de campagne présent) — gating au point d'appel.
 * Présentation PURE (props), à la `TravelRolesPanelView` ; le wrapper relie le store.
 */
export function ShipRolesPanelView({
  heroes, onSet,
}: {
  heroes: Combatant[];
  /** Épingle (`role`) ou détache (`null`) le poste naval persistant d'un héros. */
  onSet: (heroId: string, role: string | null) => void;
}) {
  if (!heroes.length) return null;

  return (
    <div className="wm-roles">
      <span className="mini-title">Postes d’équipage</span>
      {heroes.map((h) => {
        const pinned = h.shipRole;
        const current = pinned ?? defaultCrewRole(h) ?? undefined;
        const options: RollOption[] = crewRoles.map((r) => ({
          key: r.id,
          label: r.label,
          primary: r.id === current,
          title: r.id === current && !pinned ? 'Poste déduit des Compétences (« auto ») — cliquez pour l’épingler' : r.desc,
          // Re-cliquer le poste ÉPINGLÉ le détache (retour au poste inféré) ; sinon on l'épingle.
          onSelect: () => onSet(h.id, pinned === r.id ? null : r.id),
        }));
        return (
          <div key={h.id} className="wm-role-row">
            <span className="wm-role-name">
              {h.name}
              {!pinned && current && <span className="wm-opt-hint"> (auto)</span>}
            </span>
            <OptionChooser options={options} layout="grid" />
          </div>
        );
      })}
    </div>
  );
}

/** Wrapper relié au store : héros vivants du groupe + `setShipRole`. */
export function ShipRolesPanel() {
  const party = useGame((s) => s.party);
  const setShipRole = useGame((s) => s.setShipRole);
  const heroes = party.filter((h) => !h.dead && !h.outOfRencontre && h.kind === 'hero');
  return <ShipRolesPanelView heroes={heroes} onSet={setShipRole} />;
}
