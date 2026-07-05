import { useState } from 'react';
import type { Combatant } from '../engine/types';
import type { Poste } from '../state/poste';
import { OptionChooser, type RollOption } from './OptionChooser';

/**
 * Décision d'épinglage au clic d'un poste (PUR, testable sans DOM) : re-cliquer le poste ÉPINGLÉ le
 * détache (→ `null`, retour au poste inféré « auto ») ; cliquer un autre poste l'épingle. Source unique
 * de la sémantique clic→`onSet` du roster.
 */
export function nextPinned(pinned: string | undefined, clickedPosteId: string): string | null {
  return pinned === clickedPosteId ? null : clickedPosteId;
}

/**
 * ROSTER héros-first UNIQUE (« chaque héros tient un poste ») — surface partagée du Voyage par Étapes
 * (EDOC ch.5) ET des Postes d'équipage (MDG ch.14). Remplace les deux `*View` jumeaux dupliqués
 * (`TravelRolesPanel`/`ShipRolesPanel`) : mêmes primitives, seule la SOURCE (`postes`) et le câblage
 * store changent, injectés par le wrapper.
 *
 * Progressive disclosure : par héros, une PUCE repliée = son poste courant ; clic = déplie la grille
 * `OptionChooser` des postes en dessous — fini le mur de N options × M héros affichées en permanence.
 * Composition PURE de primitives existantes (`OptionChooser`), aucun nouveau widget d'assignation.
 */
export function PostesRoster({
  title, heroes, postes, currentOf, pinnedOf, onSet, initialOpen = null,
}: {
  title: string;
  heroes: Combatant[];
  postes: Poste[];
  /** Poste EFFECTIF affiché (épinglé, sinon inféré « auto ») — `null` si aucun. */
  currentOf: (h: Combatant) => string | null;
  /** Poste ÉPINGLÉ par le joueur (absent = poste inféré, badge « auto »). */
  pinnedOf: (h: Combatant) => string | undefined;
  /** Épingle (`posteId`) ou détache (`null`) le poste d'un héros. */
  onSet: (heroId: string, posteId: string | null) => void;
  /** Seam de test (rendu statique) : id du héros dont la grille d'options est DÉPLIÉE d'emblée. */
  initialOpen?: string | null;
}) {
  const [open, setOpen] = useState<string | null>(initialOpen);
  if (!heroes.length) return null;
  const posteById = new Map(postes.map((p) => [p.id, p]));

  return (
    <div className="wm-roles">
      <span className="mini-title">{title}</span>
      {heroes.map((h) => {
        const pinned = pinnedOf(h);
        const current = pinned ?? currentOf(h) ?? undefined;
        const curLabel = (current && posteById.get(current)?.label) || '— choisir —';
        const expanded = open === h.id;
        const options: RollOption[] = postes.map((p) => ({
          key: p.id,
          label: p.label,
          primary: p.id === current,
          title: p.desc ?? p.label,
          // Décision d'épinglage PURE (testée) ; puis on replie.
          onSelect: () => { onSet(h.id, nextPinned(pinned, p.id)); setOpen(null); },
        }));
        return (
          <div className="wm-role-item" key={h.id}>
            <div className="wm-role-row">
              <span className="wm-role-name">
                {h.name}
                {!pinned && current && <span className="wm-opt-hint"> (auto)</span>}
              </span>
              <button
                className="btn small"
                aria-expanded={expanded}
                title={expanded ? 'Replier' : 'Changer de poste'}
                onClick={() => setOpen(expanded ? null : h.id)}
              >
                {curLabel}
              </button>
            </div>
            {expanded && <OptionChooser options={options} layout="grid" />}
          </div>
        );
      })}
    </div>
  );
}
