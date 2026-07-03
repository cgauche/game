import { useMemo, useState } from 'react';
import { useGame } from '../state/store';
import { placeOfScene, placeById, routesFrom, otherEnd, MapRoute, MapPlace } from '../state/worldMap';
import { baseHoursPerDay, maxHoursPerDay } from '../state/travelFlow';
import {
  TravelMode, TRAVEL_MODE_LABEL, vehicleTravel, travelModeIcon, travelSpeed, travelPlanCalc, transportCost,
} from '../engine/travel';
import {
  type Allure, ALLURE_LABEL, availableAllures, partyFullyMounted, partyMounts,
} from '../engine/mountTravel';
import { rationCount } from '../engine/provisions';
import { findVehicleById } from '../data';
import { formatMoney, canAfford } from '../engine/money';
import { Coins } from './Coins';
import { rule } from '../engine/policy';
import { forcePaceDifficulty } from '../engine/seaNavigation';
import { shipHasNavalTrait } from '../engine/navalTraits';
import { DIFFICULTY_LABELS } from '../engine/types';
import { TravelRolesPanel } from './TravelRolesPanel';
import { ShipRolesPanel } from './ShipRolesPanel';
import { Icon, IconG } from './Icon';

/** Hash déterministe d'un id → sens de courbure stable d'une route (pas de Math.random). */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
/** Chemin courbe (quadratique) entre deux points + son milieu (pour poser le label). Le sens de
 *  la courbure est fixé par l'id → la carte ne « bouge » pas d'un rendu à l'autre. */
function routeCurve(ax: number, ay: number, bx: number, by: number, id: string) {
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const bend = (hashStr(id) % 2 ? 1 : -1) * Math.min(7, len * 0.14);
  const cx = mx + (-dy / len) * bend, cy = my + (dx / len) * bend;
  // milieu de la Bézier quadratique (t=0,5)
  const lx = 0.25 * ax + 0.5 * cx + 0.25 * bx;
  const ly = 0.25 * ay + 0.5 * cy + 0.25 * by;
  return { d: `M ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}`, lx, ly };
}

/** Rose des vents décorative (carte ancienne) — 4 branches cardinales bicolores + N. */
function CompassRose({ x, y }: { x: number; y: number }) {
  const ink = '#5d4520', faint = '#8a6c3e';
  const ray = (rot: number, long: boolean) => {
    const r = long ? 5.4 : 3.2;
    return (
      <g key={rot} transform={`rotate(${rot})`}>
        <path d={`M 0 0 L 0.9 -${r * 0.5} L 0 -${r} Z`} fill={ink} />
        <path d={`M 0 0 L -0.9 -${r * 0.5} L 0 -${r} Z`} fill={faint} />
      </g>
    );
  };
  return (
    <g transform={`translate(${x} ${y})`} opacity="0.85" aria-hidden>
      <circle r="6" fill="none" stroke={faint} strokeWidth="0.25" />
      <circle r="4.4" fill="none" stroke={faint} strokeWidth="0.2" />
      {[45, 135, 225, 315].map((d) => ray(d, false))}
      {[0, 90, 180, 270].map((d) => ray(d, true))}
      <circle r="0.7" fill={ink} />
      <text y="-6.6" textAnchor="middle" fontSize="2.4" fill={ink} fontWeight={700}>N</text>
    </g>
  );
}

/**
 * Carte du monde (#T2 Voyage) — overlay plein écran en exploration : carte au PARCHEMIN dessinée
 * (texture vieillie, cadre orné, routes en chemins, lieux en médaillons, rose des vents), lieux et
 * routes (donnée `WorldMap` du projet, éditable dans l'onglet « Monde » de l'éditeur), départ de
 * voyage depuis le lieu courant (mode, classe, allure — RAW section « Voyage » du LDB) et reprise
 * d'un voyage interrompu par une péripétie. Mobile-first : panneau en bas, carte au-dessus.
 */
/** `hereSceneId`/`initialRouteId` : seams de test (rendu statique : le store SSR sert l'état initial). */
export function WorldMapView({ initialRouteId, hereSceneId }: { initialRouteId?: string; hereSceneId?: string } = {}) {
  const map = useGame((s) => s.worldMap);
  const scene = useGame((s) => s.scene);
  const party = useGame((s) => s.party);
  const money = useGame((s) => s.money);
  const travelPlan = useGame((s) => s.travelPlan);
  const close = useGame((s) => s.closeWorldMap);
  const startTravel = useGame((s) => s.startTravel);
  const resumeTravel = useGame((s) => s.resumeTravel);
  // Coop : l'invité consulte la carte mais l'HÔTE décide des départs (le voyage déplace tout le
  // groupe et résout des journées entières — audit Lot 4, arbitrage V1 « exploration = miroir »).
  const isGuest = useGame((s) => s.net.mode) === 'guest';
  const [selId, setSelId] = useState<string | null>(initialRouteId ?? null);
  const [mode, setMode] = useState<TravelMode>('pied');
  const [classKey, setClassKey] = useState('');
  const [forced, setForced] = useState(false);
  /** Allure en selle (EDOC 07 l.140) — règle optionnelle `travel-allures`. */
  const [allure, setAllure] = useState<Allure>('pas');
  /** Attelage forcé au pas de course (EDOC 07 l.229). */
  const [forceGallop, setForceGallop] = useState(false);
  /** Forcer le rythme en mer (MDG 13 l.95-107) : bonus de M demandé (0 = allure de conception). */
  const [seaPace, setSeaPace] = useState(0);
  /** Lieu cliqué SANS route directe depuis ici → on l'explique au lieu de rester muet. */
  const [farId, setFarId] = useState<string | null>(null);

  const here = placeOfScene(map, hereSceneId ?? scene?.id);
  const routes = useMemo(() => (map && here ? routesFrom(map, here.id) : []), [map, here]);
  if (!map) return null;
  const selRoute: MapRoute | null = routes.find((r) => r.id === selId) ?? null;
  const dest: MapPlace | undefined = selRoute && here ? placeById(map, otherEnd(selRoute, here.id)) : undefined;
  const farPlace: MapPlace | undefined = farId ? placeById(map, farId) : undefined;

  const selectRoute = (r: MapRoute) => {
    setSelId(r.id);
    setFarId(null);
    const m = r.modes[0] ?? 'pied';
    setMode(m);
    setClassKey(vehicleTravel(m)?.classes[0].key ?? '');
    setForced(false);
    setAllure('pas');
    setForceGallop(false);
    setSeaPace(0);
  };
  const pickMode = (m: TravelMode) => {
    setMode(m);
    setClassKey(vehicleTravel(m)?.classes[0].key ?? '');
    setAllure('pas');
    setForceGallop(false);
    setSeaPace(0);
  };

  // « En selle » (EDOC ch.4, règle `travel-allures`) : mode IMPLICITE des routes praticables à pied,
  // quand chaque héros vivant a une monture utilisable.
  const alluresOn = !!rule('travel-allures');
  const mounted = alluresOn && partyFullyMounted(party);
  const allures = mounted ? availableAllures(partyMounts(party)) : [];
  const modeChoices: TravelMode[] = selRoute
    ? [...selRoute.modes, ...(mounted && selRoute.modes.includes('pied') ? ['monture'] : [])]
    : [];

  // Traversée MARITIME (routes `sea`, MDG ch.13/15) : sur le navire de campagne — estimation en milles/jour.
  const vessel = useGame((s) => s.vessel);
  const vesselData = vessel ? findVehicleById(vessel.vehicleId) : undefined;
  const vesselLabel = vesselData?.label ?? '';
  const seaM = (vessel?.wounds == null || vessel.wounds.current > 0) ? (vesselData?.ship?.sail?.m ?? vesselData?.ship?.oars?.m ?? 0) : 0;
  // Forcer le rythme (MDG 13 l.95-107) : +1 M voile/avirons, +2 M avirons seulement — rien à la vapeur (ch.12 l.311).
  const seaRig: 'voile' | 'avirons' = vesselData?.ship?.sail ? 'voile' : 'avirons';
  const seaSteam = !!vessel && shipHasNavalTrait([...(vesselData?.ship?.traits ?? []), ...(vessel.upgrades ?? [])], 'propulsion-a-vapeur');
  const seaPaceChoices = seaSteam || !(vesselData?.ship?.sail || vesselData?.ship?.oars) ? [0] : [0, 1, 2].filter((b) => b === 0 || forcePaceDifficulty(b, seaRig) != null);

  // Estimations du trajet sélectionné (mêmes formules que le flux — RAW l.207-224).
  const base = baseHoursPerDay(map);
  const maxH = maxHoursPerDay(map);
  const passengers = party.filter((h) => !h.dead && !h.outOfRencontre).length;
  const effAllure: Allure | undefined = mode === 'monture' ? allure : forceGallop ? 'galop' : undefined;
  const kmh = selRoute ? travelSpeed(party, mode, selRoute.speed?.[mode], effAllure) : 0;
  const hours = mode === 'pied' && forced ? maxH : mode === 'monture' && forced ? 12 : base;
  const plan = selRoute && kmh > 0 ? travelPlanCalc(selRoute.km, kmh, hours) : null;
  const cost = selRoute && mode !== 'pied' && mode !== 'monture'
    ? transportCost(selRoute.km, mode, classKey, passengers, selRoute.prices?.[mode])
    : null;
  const affordable = !cost || canAfford(money, cost);
  const rationsOwned = party.reduce((s, h) => s + (h.dead ? 0 : rationCount(h)), 0);
  const rationsNeeded = plan ? Math.max(0, (plan.days - 1) * passengers) : 0; // les nuits en route mangent

  const fmtDuration = (p: NonNullable<typeof plan>) =>
    p.days <= 1 ? `≈ ${Math.max(1, Math.round(p.travelMinutes / 60))} h` : `${p.days} jours (${hours} h de route/jour)`;

  // Reprise d'un voyage interrompu.
  const resumeDest = travelPlan?.interrupted ? placeById(map, travelPlan.toPlaceId) : undefined;

  return (
    <div className="worldmap-overlay">
      <div className="worldmap-head">
        <h2>🗺️ {map.nom}</h2>
        <button type="button" className="btn small" onClick={close}>✕ Fermer</button>
      </div>

      <div className="worldmap-canvas">
        <svg viewBox="0 0 100 64" preserveAspectRatio="xMidYMid meet" className="wm-map">
          <defs>
            <radialGradient id="wm-parch" cx="50%" cy="40%" r="78%">
              <stop offset="0%" stopColor="#efe1bb" />
              <stop offset="70%" stopColor="#dcc78f" />
              <stop offset="100%" stopColor="#c2a466" />
            </radialGradient>
            {/* Vignettage : bords ombrés (vieillissement) */}
            <radialGradient id="wm-vignette" cx="50%" cy="48%" r="62%">
              <stop offset="55%" stopColor="#000000" stopOpacity="0" />
              <stop offset="100%" stopColor="#3a2a12" stopOpacity="0.42" />
            </radialGradient>
            {/* Grain papier */}
            <filter id="wm-grain" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11" stitchTiles="stitch" result="n" />
              <feColorMatrix in="n" type="saturate" values="0" />
            </filter>
            {/* Ombre douce des médaillons */}
            <filter id="wm-drop" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="0.5" stdDeviation="0.5" floodColor="#000" floodOpacity="0.35" />
            </filter>
            <radialGradient id="wm-medal" cx="50%" cy="38%" r="70%">
              <stop offset="0%" stopColor="#f4e8c6" />
              <stop offset="100%" stopColor="#d2b87e" />
            </radialGradient>
          </defs>

          {/* Parchemin + grain + vignette */}
          <rect x="0" y="0" width="100" height="64" rx="2.5" fill="url(#wm-parch)" />
          <rect x="0" y="0" width="100" height="64" rx="2.5" filter="url(#wm-grain)" opacity="0.06" />
          {/* Taches d'âge (déterministes) */}
          <ellipse cx="22" cy="14" rx="6" ry="3.4" fill="#7a5f38" opacity="0.06" />
          <ellipse cx="80" cy="50" rx="7" ry="4" fill="#7a5f38" opacity="0.05" />
          <ellipse cx="60" cy="9" rx="4" ry="2.6" fill="#7a5f38" opacity="0.05" />
          <rect x="0" y="0" width="100" height="64" rx="2.5" fill="url(#wm-vignette)" />

          {/* Cadre orné : filet brun épais + filet or fin + fleurons aux angles */}
          <rect x="1.4" y="1.4" width="97.2" height="61.2" rx="2" fill="none" stroke="#5a4327" strokeWidth="1.3" />
          <rect x="3.1" y="3.1" width="93.8" height="57.8" rx="1.4" fill="none" stroke="#a9842f" strokeWidth="0.4" />
          {[[5, 6.6], [95, 6.6], [5, 60], [95, 60]].map(([fx, fy], i) => (
            <text key={i} x={fx} y={fy} textAnchor="middle" fontSize="4" fill="#8a6c2f" opacity="0.8">⚜</text>
          ))}

          {/* Routes (chemins courbes) — CLIQUABLES depuis le lieu courant (large zone invisible) */}
          {map.routes.map((r) => {
            const a = placeById(map, r.a);
            const b = placeById(map, r.b);
            if (!a || !b) return null;
            const c = routeCurve(a.pos.x, a.pos.y * 0.64, b.pos.x, b.pos.y * 0.64, r.id);
            const sel = r.id === selId;
            const fromHere = !!here && (r.a === here.id || r.b === here.id);
            const water = r.modes.includes('barge') && !r.modes.includes('pied');
            return (
              <g
                key={r.id}
                onClick={fromHere ? () => selectRoute(r) : undefined}
                style={fromHere ? { cursor: 'pointer' } : undefined}
              >
                {/* zone de clic généreuse (trait invisible épais) */}
                {fromHere && <path d={c.d} fill="none" stroke="#000" strokeOpacity="0" strokeWidth={5} pointerEvents="stroke" />}
                <path
                  d={c.d}
                  fill="none"
                  stroke={sel ? 'var(--accent)' : fromHere ? '#6d4f24' : '#9b8255'}
                  strokeWidth={sel ? 1.1 : 0.65}
                  strokeLinecap="round"
                  strokeDasharray={water ? '0.4 1.7' : '1.7 1.2'}
                  opacity={sel || fromHere ? 1 : 0.7}
                  pointerEvents="none"
                />
                <g transform={`translate(${c.lx} ${c.ly})`}>
                  <rect x="-5.4" y="-2.2" width="10.8" height="3.2" rx="1.6" fill="#efe2bd" opacity="0.82" />
                  <text y="0.2" textAnchor="middle" fontSize="2.3" fill="#5d4520">
                    {r.km} km
                  </text>
                  {/* Badge de mode (véhicule possible) : barque (voie d'eau) / compas (route carrossable). */}
                  {r.modes.some((m) => m !== 'pied') && (
                    <g style={{ color: '#5d4520' }}>
                      <IconG id={water ? 'scenario/naval' : 'scenario/travel'} x={5.8} y={-1.5} size={2.8} />
                    </g>
                  )}
                </g>
              </g>
            );
          })}

          {/* Lieux (médaillons + cartouche de nom). Affordance : destination RELIÉE = anneau accent
              pointillé + curseur ; lieu hors d'atteinte = estompé, le clic EXPLIQUE (panneau bas). */}
          {map.places.map((p) => {
            const isHere = here?.id === p.id;
            const isDest = dest?.id === p.id;
            const route = here ? routes.find((r) => otherEnd(r, here.id) === p.id) : undefined;
            const clickable = !!route;
            const w = Math.max(11, p.label.length * 1.35 + 4);
            return (
              <g
                key={p.id}
                transform={`translate(${p.pos.x} ${p.pos.y * 0.64})`}
                onClick={clickable ? () => selectRoute(route!) : !isHere ? () => { setSelId(null); setFarId(p.id); } : undefined}
                style={clickable || !isHere ? { cursor: clickable ? 'pointer' : 'help' } : undefined}
                opacity={clickable || isHere ? 1 : 0.55}
              >
                {/* cible de clic généreuse (médaillon + cartouche) */}
                <circle r="6.5" fill="#000" fillOpacity="0" />
                {isHere && <text y="-4.4" textAnchor="middle" fontSize="2.2" fontWeight={700} fill="var(--ok)">✦ Vous êtes ici</text>}
                {(isHere || isDest) && (
                  <circle r="3.7" fill="none" stroke={isHere ? 'var(--ok)' : 'var(--accent)'} strokeWidth="0.55" opacity="0.9" />
                )}
                {clickable && !isDest && (
                  <circle r="3.7" fill="none" stroke="var(--accent)" strokeWidth="0.4" strokeDasharray="0.9 0.7" opacity="0.85" />
                )}
                <circle r="2.9" fill="url(#wm-medal)" stroke="#7a5f38" strokeWidth="0.35" filter="url(#wm-drop)" />
                {/* `p.icon` = id d'icône (registre src/ui/icons) ; sans icône, drapeau de lieu. */}
                <g style={{ color: '#4a3517' }}>
                  <IconG id={p.icon ?? 'nav/entry-point'} x={-1.8} y={-1.8} size={3.6} />
                </g>
                {/* cartouche de nom */}
                <g transform="translate(0 6.2)">
                  <rect x={-w / 2} y="-2.3" width={w} height="3.6" rx="1.8" fill="#33240f" opacity={isHere ? 0.9 : 0.72} />
                  <text y="0.3" textAnchor="middle" fontSize="2.5" fontWeight={isHere ? 700 : 500} fill="#f1e2bb">{p.label}</text>
                </g>
              </g>
            );
          })}

          <CompassRose x={13} y={52} />
        </svg>
      </div>

      {/* Voyage interrompu : reprise */}
      {travelPlan?.interrupted && resumeDest && (
        <div className="worldmap-panel">
          <p>
            Voyage vers <b>{resumeDest.label}</b> interrompu —{' '}
            {Math.round(travelPlan.km - travelPlan.kmDone) > 0
              ? `${Math.round(travelPlan.km - travelPlan.kmDone)} km restants.`
              : `le groupe est aux portes de ${resumeDest.label}.`}
          </p>
          <div className="modal-actions">
            <button type="button" className="btn btn-primary" disabled={isGuest} title={isGuest ? 'L’hôte décide des départs.' : undefined} onClick={resumeTravel}>▶ Reprendre le voyage</button>
          </div>
        </div>
      )}

      {/* Panneau de départ */}
      {!travelPlan?.interrupted && selRoute && dest && here && (
        <div className="worldmap-panel">
          <div className="wm-trip">
            <span className="wm-trip-route"><b>{here.label}</b> <span className="wm-arrow">→</span> <b>{dest.label}</b> · {selRoute.km} {selRoute.sea ? 'milles' : 'km'}</span>
            <div className="wm-modes">
              {modeChoices.map((m) => (
                <button key={m} type="button" className={`btn small ${mode === m ? 'btn-primary' : ''}`} onClick={() => pickMode(m)}>
                  <Icon id={travelModeIcon(m)} /> {TRAVEL_MODE_LABEL[m]}
                </button>
              ))}
            </div>
          </div>
          {mode === 'pied' && (
            <label className="wm-opt" title={`${maxH} h de route par jour au lieu de ${base} — Test de Résistance en fin de journée, ou État Exténué`}>
              <input type="checkbox" checked={forced} onChange={(e) => setForced(e.target.checked)} />
              <span>Marche forcée <span className="wm-opt-hint">({maxH} h/jour)</span></span>
            </label>
          )}
          {mode === 'monture' && (
            <>
              {/* Allure (EDOC 07 l.140-144) : vitesse ET endurance des bêtes en dépendent. */}
              <div className="wm-modes">
                {allures.map((a) => (
                  <button key={a} type="button" className={`btn small ${allure === a ? 'btn-primary' : ''}`} onClick={() => setAllure(a)}>
                    {ALLURE_LABEL[a]}
                  </button>
                ))}
              </div>
              <label className="wm-opt" title="Une monture voyage au pas jusqu'à 12 h sans repos ; au-delà de l'endurance de son allure (trot : Bonus d'Endurance en heures, galop : la moitié), la bête s'épuise — Incidents de monte.">
                <input type="checkbox" checked={forced} onChange={(e) => setForced(e.target.checked)} />
                <span>Longue journée <span className="wm-opt-hint">(12 h/jour)</span></span>
              </label>
            </>
          )}
          {vehicleTravel(mode) && (
            <label className="wm-opt">
              Classe{' '}
              <select value={classKey} onChange={(e) => setClassKey(e.target.value)}>
                {(vehicleTravel(mode)?.classes ?? []).map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label} ({selRoute.prices?.[mode] ?? c.brassPerKm} sou(s)/km/passager)
                  </option>
                ))}
              </select>
            </label>
          )}
          {mode === 'mer' && vessel && seaM > 0 && seaPaceChoices.length > 1 && (
            <div className="wm-modes">
              {seaPaceChoices.map((b) => {
                const diff = b ? forcePaceDifficulty(b, seaRig) : null;
                return (
                  <button
                    key={b}
                    type="button"
                    className={`btn small ${seaPace === b ? 'btn-primary' : ''}`}
                    onClick={() => setSeaPace(b)}
                    title={b && diff
                      ? `Test de ${seaRig === 'voile' ? 'Voile' : 'Ramer'} ${DIFFICULTY_LABELS[diff]} chaque jour — réussi : +${b} M ; le soir, Test de Résistance Complexe (−10) sous peine d'Exténué (MDG ch.13).`
                      : 'Allure de conception du navire.'}
                  >
                    {b === 0 ? 'Rythme normal' : `Forcer +${b} M`}
                  </button>
                );
              })}
            </div>
          )}
          {alluresOn && vehicleTravel(mode)?.draft && (
            <label className="wm-opt" title="Forcer l'attelage au pas de course : Test de Conduite d'attelage par kilomètre (-10 par km déjà au galop) — un Échec Stupéfiant provoque un Problème de véhicule.">
              <input type="checkbox" checked={forceGallop} onChange={(e) => setForceGallop(e.target.checked)} />
              <span>Forcer l’allure <span className="wm-opt-hint">(pas de course)</span></span>
            </label>
          )}
          <p className="wm-est">
            {mode === 'mer' ? (
              vessel && seaM > 0 ? (
                // 18 milles/jour par point de M (MDG ch.15 l.57-70) — le vent et les Tests d'équipage
                // de Progression (±10 %/DR) modulent chaque journée.
                <><Icon id="scenario/port" size="sm" /> {vesselLabel} · ≈ {18 * seaM} milles/jour (M {seaM}, hors vent{seaPace ? ` · ${18 * (seaM + seaPace)} si le rythme est tenu` : ''}) · ~{Math.max(1, Math.ceil(selRoute.km / (18 * seaM)))} jour(s)</>
              ) : (
                <>Aucun navire de campagne en état de prendre la mer.</>
              )
            ) : kmh > 0 ? (
              <>
                Allure {kmh} km/h · Durée {plan ? fmtDuration(plan) : '—'}
                {cost && <> · Prix <Coins money={cost} />{!affordable && ' (bourse insuffisante)'}</>}
                {mode === 'pied' && plan && plan.days > 1 && (
                  <> · Rations pour les nuits : {rationsNeeded} (le groupe en porte {rationsOwned})</>
                )}
              </>
            ) : (
              <>Le groupe ne peut pas avancer (surcharge) — allégez les sacs.</>
            )}
          </p>
          {mode === 'mer' && vessel ? <ShipRolesPanel /> : rule('travel-etapes') && <TravelRolesPanel />}
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setSelId(null)}>Annuler</button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={(mode === 'mer' ? !vessel || seaM <= 0 : kmh <= 0 || !affordable) || isGuest}
              title={isGuest ? 'L’hôte décide des départs.'
                : mode === 'mer' && (!vessel || seaM <= 0) ? 'Aucun navire de campagne en état de prendre la mer.'
                : mode !== 'mer' && kmh <= 0 ? 'Le groupe est trop chargé pour avancer — allégez les sacs.'
                : mode !== 'mer' && !affordable ? `Bourse insuffisante (${cost ? formatMoney(cost) : ''})`
                : undefined}
              onClick={() => startTravel(selRoute.id, mode, {
                classKey: classKey || undefined,
                hoursPerDay: forced ? (mode === 'pied' ? maxH : mode === 'monture' ? 12 : undefined) : undefined,
                allure: effAllure,
                seaPace: mode === 'mer' && seaPace > 0 ? seaPace : undefined,
              })}
            >
              <Icon id="scenario/travel" size="sm" /> Partir
            </button>
          </div>
        </div>
      )}

      {!travelPlan?.interrupted && !selRoute && (
        <div className="worldmap-panel muted-panel">
          <p>
            {farPlace && here
              ? `Aucune route directe vers ${farPlace.label} depuis ${here.label} — voyagez d'étape en étape (lieux cerclés).`
              : here
                ? routes.length
                  ? 'Cliquez une destination CERCLÉE (ou sa route) pour préparer le voyage.'
                  : 'Aucune route ne part de ce lieu.'
                : 'Ce lieu ne figure pas sur la carte — rejoignez un lieu connu pour voyager.'}
          </p>
        </div>
      )}
    </div>
  );
}
