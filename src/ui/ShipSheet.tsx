import { useRef, useState } from 'react';
import { useGame } from '../state/store';
import { crewRoles, findCrewRoleById, findCrewTestTypeById } from '../data';
import { moraleBand, crewRoleValue } from '../engine/crewMorale';
import { exposedCrew } from '../engine/shipCritical';
import { shipMoraleScore, shipDefaultRoles, BENCHED } from '../state/shipCrew';
import { useModalA11y } from './Modal';
import { PortraitTile } from './PortraitTile';
import { CharFrame } from './CharFrame';
import { PortraitPicker } from './PortraitPicker';
import type { Combatant } from '../engine/types';
import type { Dir8 } from '../state/dir8';

const DIR_LABEL: Record<Dir8, string> = { N: 'Nord', NE: 'Nord-Est', E: 'Est', SE: 'Sud-Est', S: 'Sud', SO: 'Sud-Ouest', O: 'Ouest', NO: 'Nord-Ouest' };
const SIDE_LABEL: Record<string, string> = { proue: 'Proue', tribord: 'Tribord', poupe: 'Poupe', babord: 'Bâbord' };
const MANOEUVRE = 'manoeuvre';

/** Marqueur « au repos » : un marin RETIRÉ d'un poste (clic sur le ✕) — il revient à l'équipage disponible et ne
 *  ré-infère PAS de rôle (sinon « retirer » serait sans effet pour un rôle déduit). */

/** État du navire (lecture seule, dérivé) — mêmes `stat-chip` que les vitaux d'une fiche héros. PUR. */
export function ShipStateBlock({ ship, cap, morale, crew }: { ship: Combatant; cap?: Dir8; morale: number; crew: Combatant[] }) {
  const band = moraleBand(morale);
  const apte = exposedCrew(crew);
  return (
    <div className="sheet-vitals">
      <div className="stat-chip pv"><span className="sc-label">Coque</span><span className="sc-value">{ship.wounds.current}/{ship.wounds.max}</span></div>
      {cap && <div className="stat-chip"><span className="sc-label">Cap</span><span className="sc-value">{DIR_LABEL[cap]}</span></div>}
      <div className="stat-chip"><span className="sc-label">Moral</span><span className="sc-value">{morale}{band.crewTestDR ? ` (${band.crewTestDR > 0 ? '+' : ''}${band.crewTestDR})` : ''}</span></div>
      <div className="stat-chip"><span className="sc-label">Effectif</span><span className="sc-value">{apte.length}/{crew.length}</span></div>
    </div>
  );
}

/** Bloc « Armes / Postes » : par pièce d'artillerie (MDG ch.12), son bord + son équipage de pièce (PLUSIEURS servants
 *  possibles, MDG ch.14 l.9) en portraits, et son STOCK DE MUNITIONS (l.410-424) — un sélecteur persiste le choix
 *  de la pièce (`ShipPoste.ammoUid` : boulet ou mitraille ?) avec la quantité restante par munition. */
export function ShipPostes({ ship, combatants }: { ship: Combatant; combatants: Combatant[] }) {
  const setPosteAmmo = useGame((s) => s.setPosteAmmo);
  if (!ship.postes?.length) return null;
  return (
    <div className="ship-section">
      <div className="mini-title">Armes · postes</div>
      {ship.postes.map((p, i) => {
        const gun = (p.crewIds ?? []).map((id) => combatants.find((c) => c.id === id)).filter((c): c is Combatant => !!c);
        const stock = (p.ammo ?? []).filter((a) => (a.qty ?? 0) > 0);
        return (
          <div className="ship-poste" key={i}>
            <span className="ship-poste-name">🎯 {p.side ? SIDE_LABEL[p.side] ?? p.side : 'Omni'} · {p.item.name}</span>
            {stock.length > 0 && (
              <label className="ship-poste-ammo">
                <span aria-hidden>🧨</span>
                <select
                  value={p.ammoUid ?? stock[0].uid}
                  onChange={(e) => setPosteAmmo(ship.id, p.item.uid, e.target.value)}
                  title="Munition chargée par la pièce (MDG ch.12) — stock du poste"
                >
                  {stock.map((a) => <option key={a.uid} value={a.uid}>{a.name} × {a.qty ?? 0}</option>)}
                </select>
              </label>
            )}
            <div className="ship-crew-row">
              {gun.length ? gun.map((c) => <CharFrame key={c.id} c={c} variant="identity" size="xs" title={c.name} />) : <span className="muted">— sans servant —</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Bloc « Rôles · manœuvre » (MDG ch.14) : par RÔLE, l'équipage qui le tient (PLUSIEURS possible, l.9 « plusieurs
 *  Personnages peuvent contribuer ») en portraits ; bouton « Assigner » → `PortraitPicker` (réutilisé) pour mettre
 *  un marin à ce poste (épingle son `shipRole`). Le rôle ESSENTIEL (DR ×2, l.19) est marqué d'une étoile. */
export function ShipCrewByRole({ crew, onSet }: { crew: Combatant[]; onSet: (crewId: string, role: string | null) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const testType = findCrewTestTypeById(MANOEUVRE);
  const apte = exposedCrew(crew);
  if (!testType) return null;
  // Défaut GLOBAL (essentiel rempli + PJ étalés) PARTAGÉ avec le Test d'équipage — la fiche et la manœuvre s'accordent.
  const roles = shipDefaultRoles(crew, MANOEUVRE);
  const roleOf = (c: Combatant): string | undefined => { const r = roles.get(c.id); return r === BENCHED ? undefined : r; };
  const byRole = new Map<string, Combatant[]>();
  const pool: Combatant[] = [];
  for (const c of apte) {
    const roleId = roleOf(c);
    if (roleId && testType.roles.includes(roleId)) (byRole.get(roleId) ?? byRole.set(roleId, []).get(roleId)!).push(c);
    else pool.push(c); // pas de rôle de manœuvre (héros non-marin, ou rôle d'un autre Test) → équipage disponible
  }
  return (
    <div className="ship-section">
      <div className="mini-title">Rôles · manœuvre</div>
      {testType.roles.map((roleId) => {
        const role = findCrewRoleById(roleId);
        if (!role) return null;
        const holders = byRole.get(roleId) ?? [];
        const essential = testType.essential === roleId;
        const open = editing === roleId;
        return (
          <div className="ship-role" key={roleId}>
            <div className="ship-role-head">
              <span className="ship-role-name">{role.label}{essential && <span className="ess" title="Rôle essentiel — son DR compte double (MDG ch.14)"> ★</span>}</span>
              <button className="btn small" onClick={() => setEditing(open ? null : roleId)}>{open ? 'Fermer' : '+ assigner'}</button>
            </div>
            <div className="ship-crew-row">
              {holders.length
                ? holders.map((c) => (
                    <span key={c.id} className="crew-remove" title={`${c.name} — retirer du poste`}>
                      <CharFrame c={c} variant="identity" size="xs" onClick={() => onSet(c.id, BENCHED)} />
                    </span>
                  ))
                : <span className="muted">— vacant —</span>}
            </div>
            {open && (
              <PortraitPicker
                choices={apte.filter((c) => roleOf(c) !== roleId).map((c) => ({ c, caption: crewRoleValue(c, role).value, title: `Mettre ${c.name} à ${role.label}` }))}
                onPick={(id) => onSet(id, roleId)}
              />
            )}
          </div>
        );
      })}
      {pool.length > 0 && (
        <div className="ship-role ship-pool">
          <div className="ship-role-head"><span className="ship-role-name">Équipage disponible</span></div>
          <div className="ship-crew-row">
            {pool.map((c) => <CharFrame key={c.id} c={c} variant="identity" size="xs" title={`${c.name} — l'assigner à un poste ci-dessus`} />)}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * FICHE DU NAVIRE (couche Mer) — ouverte en cliquant le portrait du navire (dock), comme une fiche héros. Réutilise la
 * coquille modale `sheet-*` + `useModalA11y` : aside = portrait + ÉTAT ; main = HUB du navire → Armes/postes puis
 * Rôles de manœuvre, chacun avec son équipage en PORTRAITS (plusieurs par poste, MDG ch.14 l.9), assignables via le
 * `PortraitPicker` partagé. Remplace l'ancien volet de droite (gestion éparpillée).
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
  // Les servants de pièce sont montrés sous « Armes · postes » → hors de la manœuvre (un marin tient UN poste).
  const posteCrewIds = new Set((ship.postes ?? []).flatMap((p) => p.crewIds ?? []));
  const maneuverCrew = crew.filter((c) => !posteCrewIds.has(c.id));
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
            <ShipPostes ship={ship} combatants={battle.combatants} />
            <ShipCrewByRole crew={maneuverCrew} onSet={setShipRole} />
          </div>
        </div>
      </div>
    </div>
  );
}
