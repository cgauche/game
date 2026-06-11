import { useMemo, useState } from 'react';
import { useGame } from '../state/store';
import { placeOfScene, placeById, routesFrom, otherEnd, MapRoute, MapPlace } from '../state/worldMap';
import { baseHoursPerDay, maxHoursPerDay } from '../state/travelFlow';
import {
  TravelMode, TRAVEL_MODE_LABEL, TRANSPORTS, travelSpeed, travelPlanCalc, transportCost,
} from '../engine/travel';
import { rationCount } from '../engine/provisions';
import { formatMoney, canAfford } from '../engine/money';

/**
 * Carte du monde (#T2 Voyage) — overlay plein écran en exploration : parchemin SVG, lieux et
 * routes (donnée `WorldMap` du projet, éditable dans l'onglet « Monde » de l'éditeur), départ de
 * voyage depuis le lieu courant (mode, classe, allure — RAW section « Voyage » du LDB) et reprise
 * d'un voyage interrompu par une péripétie. Mobile-first : panneau en bas, carte au-dessus.
 */
export function WorldMapView() {
  const map = useGame((s) => s.worldMap);
  const scene = useGame((s) => s.scene);
  const party = useGame((s) => s.party);
  const money = useGame((s) => s.money);
  const travelPlan = useGame((s) => s.travelPlan);
  const close = useGame((s) => s.closeWorldMap);
  const startTravel = useGame((s) => s.startTravel);
  const resumeTravel = useGame((s) => s.resumeTravel);
  const [selId, setSelId] = useState<string | null>(null);
  const [mode, setMode] = useState<TravelMode>('pied');
  const [classKey, setClassKey] = useState('');
  const [forced, setForced] = useState(false);

  const here = placeOfScene(map, scene?.id);
  const routes = useMemo(() => (map && here ? routesFrom(map, here.id) : []), [map, here]);
  if (!map) return null;
  const selRoute: MapRoute | null = routes.find((r) => r.id === selId) ?? null;
  const dest: MapPlace | undefined = selRoute && here ? placeById(map, otherEnd(selRoute, here.id)) : undefined;

  const selectRoute = (r: MapRoute) => {
    setSelId(r.id);
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
        <svg viewBox="0 0 100 64" preserveAspectRatio="xMidYMid meet">
          {/* Parchemin */}
          <defs>
            <radialGradient id="wm-parch" cx="50%" cy="42%" r="75%">
              <stop offset="0%" stopColor="#e8d9b0" />
              <stop offset="78%" stopColor="#d9c28c" />
              <stop offset="100%" stopColor="#b89a63" />
            </radialGradient>
          </defs>
          <rect x="0" y="0" width="100" height="64" rx="2" fill="url(#wm-parch)" stroke="#7a5f38" strokeWidth="0.6" />
          {/* Routes */}
          {map.routes.map((r) => {
            const a = placeById(map, r.a);
            const b = placeById(map, r.b);
            if (!a || !b) return null;
            const ax = a.pos.x, ay = a.pos.y * 0.64, bx = b.pos.x, by = b.pos.y * 0.64;
            const fromHere = here && (r.a === here.id || r.b === here.id);
            return (
              <g key={r.id}>
                <line
                  x1={ax} y1={ay} x2={bx} y2={by}
                  stroke={r.id === selId ? '#8a2f1d' : fromHere ? '#6d4f24' : '#9b8255'}
                  strokeWidth={r.id === selId ? 1.1 : 0.7}
                  strokeDasharray={r.modes.includes('barge') && !r.modes.includes('pied') ? '2 1.2' : '1.6 1.1'}
                />
                <text x={(ax + bx) / 2} y={(ay + by) / 2 - 1} textAnchor="middle" fontSize="2.6" fill="#5d4520">
                  {r.km} km{r.modes.some((m) => m !== 'pied') ? ' 🚌' : ''}
                </text>
              </g>
            );
          })}
          {/* Lieux */}
          {map.places.map((p) => {
            const isHere = here?.id === p.id;
            const route = here ? routes.find((r) => otherEnd(r, here.id) === p.id) : undefined;
            const clickable = !!route;
            return (
              <g
                key={p.id}
                transform={`translate(${p.pos.x} ${p.pos.y * 0.64})`}
                onClick={clickable ? () => selectRoute(route!) : undefined}
                style={clickable ? { cursor: 'pointer' } : undefined}
              >
                {isHere && <circle r="3.4" fill="none" stroke="var(--ok)" strokeWidth="0.6" />}
                {dest?.id === p.id && <circle r="3.4" fill="none" stroke="var(--accent)" strokeWidth="0.6" />}
                <text y="1.3" textAnchor="middle" fontSize="3.8">{p.icon ?? '📍'}</text>
                <text y="5.6" textAnchor="middle" fontSize="2.6" fontWeight={isHere ? 700 : 400} fill="#3c2d14">
                  {p.label}
                </text>
                {isHere && <text y="-4" textAnchor="middle" fontSize="2.2" fontWeight={700} fill="var(--ok)">Vous êtes ici</text>}
              </g>
            );
          })}
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
          <p>
            <b>{here.label}</b> → <b>{dest.label}</b> · {selRoute.km} km
          </p>
          <div className="bar wm-modes">
            {selRoute.modes.map((m) => (
              <button key={m} type="button" className={`btn small ${mode === m ? 'btn-primary' : ''}`} onClick={() => pickMode(m)}>
                {m === 'pied' ? '🦶' : m === 'diligence' ? '🚌' : '🛶'} {TRAVEL_MODE_LABEL[m]}
              </button>
            ))}
          </div>
          {mode === 'pied' && (
            <label className="wm-opt">
              <input type="checkbox" checked={forced} onChange={(e) => setForced(e.target.checked)} />
              Marche forcée ({maxH} h/jour — Test de Résistance ou Exténué, LDB)
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
            {here
              ? routes.length
                ? 'Choisissez une destination reliée par une route.'
                : 'Aucune route ne part de ce lieu.'
              : 'Ce lieu ne figure pas sur la carte — rejoignez un lieu connu pour voyager.'}
          </p>
        </div>
      )}
    </div>
  );
}
