import { useState } from 'react';
import type { Combatant } from '../engine/types';
import type { Poste } from '../state/poste';
import { OptionChooser, type RollGridOption } from './OptionChooser';
import { CharFrame } from './CharFrame';
import { Icon } from './Icon';

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
 * (EDOC 8) ET des Postes d'équipage (MDG 14). Remplace les deux `*View` jumeaux dupliqués
 * (`TravelRolesPanel`/`ShipRolesPanel`) : mêmes primitives, seule la SOURCE (`postes`) et le câblage
 * store changent, injectés par le wrapper.
 *
 * Progressive disclosure : par héros, une PUCE repliée = son poste courant ; clic = déplie la grille
 * `OptionChooser` des postes en dessous — fini le mur de N options × M héros affichées en permanence.
 * Composition PURE de primitives existantes (`OptionChooser`), aucun nouveau widget d'assignation.
 */
export function PostesRoster({
  title, heroes, postes, currentOf, pinnedOf, onSet, refusOf, initialOpen = null,
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
  /** RAISON pour laquelle ce poste n'est pas tenable ICI (une station que la coque n'a pas) — le poste
   *  reste OFFERT, éteint, et dit pourquoi au survol/focus/tap (`RollOption.refus` → `GatedAction`).
   *  Absent = aucun poste n'est fermé. Jamais un filtrage silencieux : un poste qui disparaît ne
   *  s'explique pas. */
  refusOf?: (poste: Poste) => string | undefined;
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
        const curLabel = current ? posteById.get(current)?.label : undefined;
        const expanded = open === h.id;
        const options: RollGridOption[] = postes.map((p) => {
          const refus = refusOf?.(p);
          return {
            key: p.id,
            label: p.label,
            primary: p.id === current,
            title: p.desc ?? p.label,
            ...(refus ? { refus } : {}),
            // Décision d'épinglage PURE (testée) ; puis on replie.
            onSelect: () => { onSet(h.id, nextPinned(pinned, p.id)); setOpen(null); },
          };
        });
        return (
          <div className="wm-role-item" key={h.id}>
            <div className="wm-role-row">
              <CharFrame c={h} variant="identity" size="xs" title={h.label} />
              <span className="wm-role-name">
                {h.label}
                {!pinned && current && <span className="wm-opt-hint"> (auto)</span>}
              </span>
              <button
                className="btn small"
                aria-expanded={expanded}
                title={expanded ? 'Replier' : 'Changer de poste'}
                /* CASE VIDE = AUCUN MOT (arbitrage user 2026-09-04, [[user-arbitrage-case-vide-sans-mot-libre]]
                   étendu aux rosters) : ni « — choisir — », ni « Libre ». Il reste l'affordance
                   (le glyphe d'ajout) et un NOM ACCESSIBLE — sans lui, la case serait MUETTE pour
                   qui ne voit pas l'écran ; il se DÉRIVE du titre du roster, jamais d'un texte par
                   écran (le roster ne sait pas s'il assigne une station, un poste ou une marche). */
                {...(curLabel ? null : { 'aria-label': `${title} — ${h.label} : choisir` })}
                onClick={() => setOpen(expanded ? null : h.id)}
              >
                {curLabel ?? <Icon id="ui/add" size="sm" />}
              </button>
            </div>
            {/* Les ids de RAISON sont namespacés PAR LIGNE : N héros × les mêmes postes, ce sont les
                mêmes clés d'option — un préfixe commun collerait N fois le même id dans le document. */}
            {expanded && <OptionChooser options={options} layout="grid" idPrefix={`poste-${h.id}`} />}
          </div>
        );
      })}
    </div>
  );
}
