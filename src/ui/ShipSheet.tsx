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
import { TopoScene } from '../gameIso/TopoScene';
import { postesToStations } from '../state/stations';
import { posteAnchor } from '../state/shipPostes';
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

type Poste = NonNullable<Combatant['postes']>[number];

/** Bande de sélection RTS : une puce par pièce d'artillerie (MDG ch.12) — bord + nom + badge d'effectif + point
 *  « servi ». Sélecteur secondaire du plan (`TopoScene`), synchronisé par `selectedUid`. */
function PosteChips({ ship, combatants, selectedUid, onSelect }: { ship: Combatant; combatants: Combatant[]; selectedUid: string | null; onSelect: (uid: string) => void }) {
  if (!ship.postes?.length) return null;
  return (
    <div className="poste-chips">
      {ship.postes.map((p) => {
        const count = (p.crewIds ?? []).filter((id) => combatants.some((c) => c.id === id)).length;
        const selected = selectedUid === p.item.uid;
        return (
          <button
            key={p.item.uid}
            className={`poste-chip${selected ? ' selected' : ''}`}
            onClick={() => onSelect(p.item.uid)}
            title={`${p.side ? SIDE_LABEL[p.side] ?? p.side : 'Omni'} · ${p.item.name}`}
          >
            <span className={`poste-dot${count ? ' manned' : ''}`} aria-hidden />
            <span className="poste-chip-side">{p.side ? SIDE_LABEL[p.side] ?? p.side : 'Omni'}</span>
            <span className="poste-chip-name">{p.item.name}</span>
            <span className="poste-chip-badge">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Détail du poste SÉLECTIONNÉ (MDG ch.12) : son bord, son STOCK DE MUNITIONS (l.410-424, sélecteur qui persiste
 *  `ShipPoste.ammoUid`) et son équipage de pièce (PLUSIEURS servants possibles, ch.14 l.9) en portraits. */
export function PosteDetail({ hull, poste, combatants }: { hull: Combatant; poste: Poste; combatants: Combatant[] }) {
  const setPosteAmmo = useGame((s) => s.setPosteAmmo);
  const gun = (poste.crewIds ?? []).map((id) => combatants.find((c) => c.id === id)).filter((c): c is Combatant => !!c);
  const stock = (poste.ammo ?? []).filter((a) => (a.qty ?? 0) > 0);
  return (
    <div className="ship-poste selected">
      <span className="ship-poste-name">🎯 {poste.side ? SIDE_LABEL[poste.side] ?? poste.side : 'Omni'} · {poste.item.name}</span>
      {stock.length > 0 && (
        <label className="ship-poste-ammo">
          <span aria-hidden>🧨</span>
          <select
            value={poste.ammoUid ?? stock[0].uid}
            onChange={(e) => setPosteAmmo(hull.id, poste.item.uid, e.target.value)}
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
 * FICHE D'UNE COQUE À POSTES (couche Mer / siège) — ouverte en cliquant le portrait de la coque, comme une fiche héros.
 * KIND-AGNOSTIQUE : navire (`bodyShape:'vehicule'`) OU emplacement de siège (`bodyShape:'engin'`). Réutilise la
 * coquille modale `sheet-*` + `useModalA11y` : aside = portrait + ÉTAT ; main = MAÎTRE-DÉTAIL piloté par le plan
 * (FTL/RTS) : le plan TOP-DOWN (`TopoScene`) + la bande de puces sélectionnent LE MÊME poste, dont le `PosteDetail`
 * s'affiche seul. Les Rôles de manœuvre passent dans un onglet, UNIQUEMENT pour un navire (la manœuvre est navale).
 * Sélection BIDIRECTIONNELLE : plan ⇄ puces ⇄ détail via `selectedPosteUid`.
 */
export function PosteSheet({ combatantId, onClose }: { combatantId: string; onClose: () => void }) {
  const battle = useGame((s) => s.battle);
  const scene = useGame((s) => s.scene);
  const setShipRole = useGame((s) => s.setShipRole);
  const facing = useGame((s) => s.facing);
  const [pickedPosteUid, setSelectedPosteUid] = useState<string | null>(null);
  const [tab, setTab] = useState<'postes' | 'manoeuvre'>('postes');
  const boxRef = useRef<HTMLDivElement>(null);
  useModalA11y(boxRef, onClose);
  const hull = battle?.combatants.find((c) => c.id === combatantId);
  if (!battle || !hull) return null;
  // Sélection effective : le choix explicite (plan/puces), sinon le PREMIER poste de CETTE coque par défaut.
  const selectedPosteUid = pickedPosteUid ?? hull.postes?.[0]?.item.uid ?? null;
  const crew = (hull.crewIds ?? []).map((id) => battle.combatants.find((c) => c.id === id)).filter((c): c is Combatant => !!c);
  const cap = facing[hull.id];
  // Les servants de pièce sont montrés sous « Armes · postes » → hors de la manœuvre (un marin tient UN poste).
  const posteCrewIds = new Set((hull.postes ?? []).flatMap((p) => p.crewIds ?? []));
  const maneuverCrew = crew.filter((c) => !posteCrewIds.has(c.id));
  const isVehicle = hull.bodyShape === 'vehicule';
  // Postes de CETTE coque seulement, ancrés au cap du navire (posteAnchor). Un poste par pièce d'artillerie.
  const stations = scene
    ? postesToStations(battle.combatants, (h, p) => posteAnchor(h, p, { heading: facing[h.id] })).filter(
        (s) => s.ref.kind === 'poste' && s.ref.hullId === hull.id,
      )
    : [];
  const selectedStationId = selectedPosteUid ? `poste:${hull.id}:${selectedPosteUid}` : undefined;
  const selectedPoste = (hull.postes ?? []).find((p) => p.item.uid === selectedPosteUid);
  return (
    <div className="modal-overlay sheet-overlay" onClick={onClose}>
      <div ref={boxRef} role="dialog" aria-modal="true" className="modal sheet-modal" onClick={(e) => e.stopPropagation()}>
        <button className="btn small sheet-close" onClick={onClose} aria-label="Fermer">✕</button>
        <div className="sheet-layout">
          <aside className="sheet-aside">
            <div className="sheet-portrait">
              <PortraitTile c={hull} ring="var(--gold)" variant="full" size="xl" />
              <h3>{hull.name}</h3>
              <span className="char-sub">{isVehicle ? 'Navire' : 'Coque'}{cap ? ` · cap ${DIR_LABEL[cap]}` : ''}</span>
            </div>
            <ShipStateBlock ship={hull} cap={cap} morale={shipMoraleScore(useGame.getState, hull)} crew={crew} />
          </aside>
          <div className="sheet-main">
            {isVehicle && (
              <div className="seg" role="tablist">
                <button role="tab" aria-selected={tab === 'postes'} className={tab === 'postes' ? 'on' : ''} onClick={() => setTab('postes')}>Postes</button>
                <button role="tab" aria-selected={tab === 'manoeuvre'} className={tab === 'manoeuvre' ? 'on' : ''} onClick={() => setTab('manoeuvre')}>Manœuvre</button>
              </div>
            )}
            {tab === 'postes' ? (
              <div className="poste-layout">
                {scene && (
                  <div className="ship-section topo-panel">
                    <TopoScene
                      scene={scene}
                      stations={stations}
                      selectedStationId={selectedStationId}
                      onSelectStation={(s) => setSelectedPosteUid(s.ref.kind === 'poste' ? s.ref.posteUid : null)}
                    />
                  </div>
                )}
                <div className="poste-detail-col">
                  <div className="mini-title">Armes · postes</div>
                  <PosteChips ship={hull} combatants={battle.combatants} selectedUid={selectedPosteUid} onSelect={setSelectedPosteUid} />
                  {selectedPoste && <PosteDetail hull={hull} poste={selectedPoste} combatants={battle.combatants} />}
                </div>
              </div>
            ) : (
              <ShipCrewByRole crew={maneuverCrew} onSet={setShipRole} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Alias fin conservé pour les importeurs existants (CampaignView) — une coque de navire est une `PosteSheet`. */
export function ShipSheet({ shipId, onClose }: { shipId: string; onClose: () => void }) {
  return <PosteSheet combatantId={shipId} onClose={onClose} />;
}
