import { useMemo, useState } from 'react';
import { useGame } from '../state/store';
import { placeOfScene, placeById, routesFrom, otherEnd, MapRoute, MapPlace } from '../state/worldMap';
import { baseHoursPerDay, maxHoursPerDay } from '../state/travelFlow';
import {
  TravelMode, TRAVEL_MODE_LABEL, TRANSPORTS, travelSpeed, travelPlanCalc, transportCost,
} from '../engine/travel';
import { rationCount } from '../engine/provisions';
import { formatMoney, canAfford } from '../engine/money';

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
  const [selId, setSelId] = useState<string | null>(initialRouteId ?? null);
  const [mode, setMode] = useState<TravelMode>('pied');
  const [classKey, setClassKey] = useState('');
  const [forced, setForced] = useState(false);
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
    setClassKey(m !== 'pied' ? TRANSPORTS[m].classes[0].key : '');
    setForced(false);
  };
  const pickMode = (m: TravelMode) => {
    setMode(m);
    setClassKey(m !== 'pied' ? TRANSPORTS[m].classes[0].key : '');
  };

  // Estimations du trajet sélectionné (mêmes formules que le flux — RAW l.207-224).
  const base = baseHoursPerDay(map);
  const maxH = maxHoursPerDay(map);
  const passengers = party.filter((h) => !h.dead && !h.outOfRencontre).length;
  const kmh = selRoute ? travelSpeed(party, mode, selRoute.speed?.[mode]) : 0;
  const hours = mode === 'pied' && forced ? maxH : base;
  const plan = selRoute && kmh > 0 ? travelPlanCalc(selRoute.km, kmh, hours) : null;
  const cost = selRoute && mode !== 'pied'
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
                    {r.km} km{r.modes.some((m) => m !== 'pied') ? (water ? ' 🛶' : ' 🚌') : ''}
                  </text>
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
                <text y="1.05" textAnchor="middle" fontSize="3.1">{p.icon ?? '📍'}</text>
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
            Voyage vers <b>{resumeDest.label}</b> interrompu — {Math.max(0, Math.round(travelPlan.km - travelPlan.kmDone))} km restants.
          </p>
          <div className="modal-actions">
            <button type="button" className="btn btn-primary" onClick={resumeTravel}>▶ Reprendre le voyage</button>
          </div>
        </div>
      )}

      {/* Panneau de départ */}
      {!travelPlan?.interrupted && selRoute && dest && here && (
        <div className="worldmap-panel">
          <div className="wm-trip">
            <span className="wm-trip-route"><b>{here.label}</b> <span className="wm-arrow">→</span> <b>{dest.label}</b> · {selRoute.km} km</span>
            <div className="wm-modes">
              {selRoute.modes.map((m) => (
                <button key={m} type="button" className={`btn small ${mode === m ? 'btn-primary' : ''}`} onClick={() => pickMode(m)}>
                  {m === 'pied' ? '🦶' : m === 'diligence' ? '🚌' : '🛶'} {TRAVEL_MODE_LABEL[m]}
                </button>
              ))}
            </div>
          </div>
          {mode === 'pied' && (
            <label className="wm-opt" title={`${maxH} h de route par jour au lieu de ${base} — Test de Résistance en fin de journée, ou État Exténué (LDB)`}>
              <input type="checkbox" checked={forced} onChange={(e) => setForced(e.target.checked)} />
              <span>Marche forcée <span className="wm-opt-hint">({maxH} h/jour)</span></span>
            </label>
          )}
          {mode !== 'pied' && (
            <label className="wm-opt">
              Classe{' '}
              <select value={classKey} onChange={(e) => setClassKey(e.target.value)}>
                {TRANSPORTS[mode].classes.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label} ({selRoute.prices?.[mode] ?? c.brassPerKm} sou(s)/km/passager)
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="wm-est">
            {kmh > 0 ? (
              <>
                Allure {kmh} km/h · Durée {plan ? fmtDuration(plan) : '—'}
                {cost && <> · Prix {formatMoney(cost)}{!affordable && ' (bourse insuffisante)'}</>}
                {mode === 'pied' && plan && plan.days > 1 && (
                  <> · Rations pour les nuits : {rationsNeeded} (le groupe en porte {rationsOwned})</>
                )}
              </>
            ) : (
              <>Le groupe ne peut pas avancer (surcharge) — allégez les sacs.</>
            )}
          </p>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setSelId(null)}>Annuler</button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={kmh <= 0 || !affordable}
              onClick={() => startTravel(selRoute.id, mode, { classKey: classKey || undefined, hoursPerDay: mode === 'pied' && forced ? maxH : undefined })}
            >
              🧭 Partir
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
