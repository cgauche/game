import { useRef } from 'react';
import { useGame } from '../state/store';
import { crewRoles } from '../data';
import { defaultCrewRole, moraleBand } from '../engine/crewMorale';
import { exposedCrew } from '../engine/shipCritical';
import { shipMoraleScore } from '../state/shipCrew';
import { useModalA11y } from './Modal';
import { PortraitTile } from './PortraitTile';
import { OptionChooser, type RollOption } from './OptionChooser';
import type { Combatant } from '../engine/types';
import type { Dir8 } from '../state/dir8';

const DIR_LABEL: Record<Dir8, string> = { N: 'Nord', NE: 'Nord-Est', E: 'Est', SE: 'Sud-Est', S: 'Sud', SO: 'Sud-Ouest', O: 'Ouest', NO: 'Nord-Ouest' };
const SIDE_LABEL: Record<string, string> = { proue: 'Proue', tribord: 'Tribord', poupe: 'Poupe', babord: 'Bâbord' };

/** État du navire (lecture seule, dérivé) — mêmes `stat-chip` que les vitaux d'une fiche héros. PUR. */
export function ShipStateBlock({ ship, cap, morale, crew }: { ship: Combatant; cap?: Dir8; morale: number; crew: Combatant[] }) {
  const band = moraleBand(morale);
  const apte = exposedCrew(crew);
  const byside = new Map<string, number>();
  for (const p of ship.postes ?? []) byside.set(p.side, (byside.get(p.side) ?? 0) + 1);
  return (
    <div className="sheet-vitals">
      <div className="stat-chip pv"><span className="sc-label">Coque</span><span className="sc-value">{ship.wounds.current}/{ship.wounds.max}</span></div>
      {cap && <div className="stat-chip"><span className="sc-label">Cap</span><span className="sc-value">{DIR_LABEL[cap]}</span></div>}
      <div className="stat-chip"><span className="sc-label">Moral</span><span className="sc-value">{morale}{band.crewTestDR ? ` (${band.crewTestDR > 0 ? '+' : ''}${band.crewTestDR})` : ''}</span></div>
      <div className="stat-chip"><span className="sc-label">Effectif</span><span className="sc-value">{apte.length}/{crew.length}</span></div>
      {[...byside].map(([side, n]) => (
        <div className="stat-chip" key={side}><span className="sc-label">{SIDE_LABEL[side] ?? side}</span><span className="sc-value">🎯 ×{n}</span></div>
      ))}
    </div>
  );
}

/** Assignation équipage→rôle (MDG ch.14) : par marin APTE, une grille `OptionChooser` des 9 rôles ; rôle ÉPINGLÉ
 *  (`shipRole`) vs INFÉRÉ (`defaultCrewRole`, marqué « auto »), re-clic détache. Calquée sur `TravelRolesPanel`. PUR. */
export function ShipCrewRoles({ crew, onSet }: { crew: Combatant[]; onSet: (crewId: string, role: string | null) => void }) {
  const apte = exposedCrew(crew);
  return (
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
  );
}

/**
 * FICHE DU NAVIRE (couche Mer) — ouverte en cliquant le portrait du navire (comme une fiche héros). Réutilise la
 * coquille modale de fiche (`sheet-*` + `useModalA11y`) : aside = portrait + identité + ÉTAT du navire (coque, cap,
 * Moral, effectif, pièces par bord) ; main = assignation des rôles d'ÉQUIPAGE (MDG ch.14). Remplace l'ancien volet
 * de droite (un panneau séparé qui ne ressemblait à rien) — la gestion du navire vit dans SA fiche.
 */
export function ShipSheet({ shipId, onClose }: { shipId: string; onClose: () => void }) {
  const battle = useGame((s) => s.battle);
  const setShipRole = useGame((s) => s.setShipRole);
  const facing = useGame((s) => s.facing);
  const boxRef = useRef<HTMLDivElement>(null);
  useModalA11y(boxRef, onClose);
  const ship = battle?.combatants.find((c) => c.id === shipId);
  if (!battle || !ship) return null;
  const crew = (ship.crewIds ?? []).map((id) => battle.combatants.find((c) => c.id === id)).filter((c): c is Combatant => !!c);
  const cap = facing[ship.id];
  return (
    <div className="modal-overlay sheet-overlay" onClick={onClose}>
      <div ref={boxRef} role="dialog" aria-modal="true" className="modal sheet-modal" onClick={(e) => e.stopPropagation()}>
        <button className="btn small sheet-close" onClick={onClose} aria-label="Fermer">✕</button>
        <div className="sheet-layout">
          <aside className="sheet-aside">
            <div className="sheet-portrait">
              <PortraitTile c={ship} ring="var(--gold)" variant="full" size="xl" />
              <h3>{ship.name}</h3>
              <span className="char-sub">Navire{cap ? ` · cap ${DIR_LABEL[cap]}` : ''}</span>
            </div>
            <ShipStateBlock ship={ship} cap={cap} morale={shipMoraleScore(useGame.getState, ship)} crew={crew} />
          </aside>
          <div className="sheet-main">
            <div className="mini-title">⚓ Équipage &amp; postes</div>
            <ShipCrewRoles crew={crew} onSet={setShipRole} />
          </div>
        </div>
      </div>
    </div>
  );
}
