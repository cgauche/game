import type { Combatant } from '../engine/types';
import { useGame } from '../state/store';
import { activitiesFor, defaultTravelRole } from '../engine/activities';
import { OptionChooser, type RollOption } from './OptionChooser';

/**
 * Rôles de marche PERSISTANTS (Voyage par Étapes, EDOC ch.5) — « les mêmes tiennent toujours le même
 * poste ». Pour chaque héros vivant, on épingle UNE Activité de voyage (`travelRole`) ; le départ d'un
 * trajet en initialise l'assignation (0 ré-assignation par jour). Quand le joueur n'a rien épinglé, le
 * rôle est INFÉRÉ de ses compétences (`defaultTravelRole`, marqué « auto »). Réutilise `OptionChooser`
 * (grille de boutons) — aucune modale par poste, aucune dette `InterludeScreen`.
 *
 * N'est rendu QUE sous la règle « Voyage par Étapes » (gating au point d'appel) — le voyage jour-par-jour
 * du LDB n'a pas de postes. Présentation PURE (props), à la `PartyScreenView` ; le wrapper relie le store.
 */
export function TravelRolesPanelView({
  heroes, onSet,
}: {
  heroes: Combatant[];
  /** Épingle (`role`) ou détache (`null`) le rôle de marche persistant d'un héros. */
  onSet: (heroId: string, role: string | null) => void;
}) {
  const acts = activitiesFor('voyage');
  if (!heroes.length) return null;

  return (
    <div className="wm-roles">
      <span className="mini-title">Rôles de marche</span>
      {heroes.map((h) => {
        const pinned = h.travelRole;
        const current = pinned ?? defaultTravelRole(h) ?? undefined;
        const options: RollOption[] = acts.map((a) => ({
          key: a.id,
          label: a.label,
          primary: a.id === current,
          title: a.id === current && !pinned ? 'Rôle déduit des compétences (« auto ») — cliquez pour l’épingler' : a.label,
          // Re-cliquer le rôle ÉPINGLÉ le détache (retour au rôle inféré) ; sinon on l'épingle.
          onSelect: () => onSet(h.id, pinned === a.id ? null : a.id),
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

/** Wrapper relié au store : héros vivants du groupe + `setTravelRole`. */
export function TravelRolesPanel() {
  const party = useGame((s) => s.party);
  const setTravelRole = useGame((s) => s.setTravelRole);
  const heroes = party.filter((h) => !h.dead && !h.outOfRencontre && h.kind === 'hero');
  return <TravelRolesPanelView heroes={heroes} onSet={setTravelRole} />;
}
