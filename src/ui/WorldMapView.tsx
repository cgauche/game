import { useMemo, useState } from 'react';
import { useGame } from '../state/store';
import { placeOfScene, placeById, routesFrom, otherEnd, declutterPositions, MapRoute, MapPlace } from '../state/worldMap';
import { baseHoursPerDay, maxHoursPerDay } from '../state/travelFlow';
import {
  TravelMode, TRAVEL_MODE_LABEL, vehicleTravel, travelModeIcon, travelSpeed, travelPlanCalc, transportCost,
  routeDistanceLabel,
} from '../engine/travel';
import {
  type Allure, ALLURE_LABEL, availableAllures, partyFullyMounted, partyMounts,
} from '../engine/mountTravel';
import { rationCount, provisioningManifest } from '../engine/provisions';
import { cargoOverload, cargoTotalEnc } from '../engine/seaVoyage';
import { findVehicleById } from '../data';
import { formatMoney, canAfford } from '../engine/money';
import { Coins } from './Coins';
import { rule } from '../engine/policy';
import { forcePaceDifficulty } from '../engine/seaNavigation';
import { shipHasNavalTrait } from '../engine/navalTraits';
import { vesselPropulsion } from '../engine/shipBuild';
import { DIFFICULTY_LABELS } from '../engine/types';
import { TravelRolesPanel } from './TravelRolesPanel';
import { ShipRolesPanel } from './ShipRolesPanel';
import { OptionChooser } from './OptionChooser';
import { Icon, IconG } from './Icon';
import { ScreenShell } from './ScreenShell';
import { formatImperial } from '../engine/clock';
import { VB_W, VB_H, fitViewport, type Viewport } from './worldMapViewport';
import { MapCanvas, type MapMarker, type MapPath } from './MapCanvas';
import { CompassRose } from './PlanChrome';

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

// ── Cadre logique de la carte (unités du viewBox) ────────────────────────────────────────────
/** Écart mini visé entre deux médaillons (unités viewBox) — un médaillon fait r≈2.9 + cartouche,
 *  ~8 les sépare confortablement sans les coller. */
const DECLUTTER_MIN = 8;

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
  const gameTime = useGame((s) => s.gameTime);
  const travelPlan = useGame((s) => s.travelPlan);
  const close = useGame((s) => s.closeWorldMap);
  const startTravel = useGame((s) => s.startTravel);
  const resumeTravel = useGame((s) => s.resumeTravel);
  // Porte d'heure de départ (maison, #340) : départ terrestre/fluvial de nuit → attendre l'aube / annuler.
  const pendingDeparture = useGame((s) => s.pendingDeparture);
  const departWaitDawn = useGame((s) => s.departWaitDawn);
  const departCancel = useGame((s) => s.departCancel);
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
  /** Traversée RAPIDE (MDG 15 l.21-37) : tout le trajet en UN Test de Rude épreuve, sinon jour par jour. */
  const [seaFast, setSeaFast] = useState(false);
  /** CADENCE de la traversée détaillée (couche `voyageCadence`) : COMMANDÉE (routine auto-résolue, PV du
   *  jour — défaut) ou JOUR-PAR-JOUR (modale par jet). Ignoré en traversée rapide. */
  const [seaCadence, setSeaCadence] = useState<'commande' | 'jour-par-jour'>('commande');
  /** Lieu cliqué SANS route directe depuis ici → on l'explique au lieu de rester muet. */
  const [farId, setFarId] = useState<string | null>(null);
  /** Lieu survolé — révèle son nom sur une carte dense (les non-pertinents n'ont pas de cartouche fixe). */
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const here = placeOfScene(map, hereSceneId ?? scene?.id);
  const routes = useMemo(() => (map && here ? routesFrom(map, here.id) : []), [map, here]);

  // Anti-chevauchement : positions de RENDU décluttérées (les `pos` d'authoring restent intacts).
  // Le repère de rendu est celui du viewBox (y aplati par 0.64) → l'écartement travaille dessus.
  const layout = useMemo(() => {
    // Vraie carte de fond ⇒ les lieux restent à leurs `pos` EXACTS (l'auteur les a posés sur la carte) :
    // pas de déchevauchement, qui les décalerait de leur vraie position géographique.
    if (!map || map.background) return new Map<string, { x: number; y: number }>();
    const pts = map.places.map((p) => ({ id: p.id, x: p.pos.x, y: p.pos.y * 0.64 }));
    return declutterPositions(pts, DECLUTTER_MIN, 80, { w: VB_W, h: VB_H });
  }, [map]);
  /** Position de rendu décluttérée d'un lieu (repli sur `pos` brut si absent). */
  const posOf = (p: MapPlace) => layout.get(p.id) ?? { x: p.pos.x, y: p.pos.y * 0.64 };

  // Caméra : à l'ouverture, on part du lieu courant (le voyage démarre d'ici) à un zoom modéré —
  // MAIS cadré pour englober les routes+badges directs (#234 : sinon un badge proche du bord tombe
  // sous la bordure décorative, invisible bien que présent au DOM).
  const hereRender = here ? posOf(here) : { x: VB_W / 2, y: VB_H / 2 };
  /** Lieux/étiquettes de route à garantir visibles au cadrage (ICI + chaque destination directe + le
   *  milieu de sa courbe, où vit le badge de distance). */
  const fitPoints = (): { x: number; y: number }[] => {
    if (!map || !here) return [];
    const pts: { x: number; y: number }[] = [hereRender];
    for (const r of routes) {
      const other = placeById(map, otherEnd(r, here.id));
      if (!other) continue;
      const po = posOf(other);
      const c = routeCurve(hereRender.x, hereRender.y, po.x, po.y, r.id);
      pts.push(po, { x: c.lx, y: c.ly });
    }
    return pts;
  };
  /** Cadrage initial + cible du bouton « recentrer » de `MapCanvas` (recalculé à chaque clic). */
  const computeFit = (): Viewport => fitViewport(fitPoints(), { ...hereRender, z: 2 });

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

  // « En selle » (EDOC 7, règle `travel-allures`) : mode IMPLICITE des routes praticables à pied,
  // quand chaque héros vivant a une monture utilisable.
  const alluresOn = !!rule('travel-allures');
  const mounted = alluresOn && partyFullyMounted(party);
  const allures = mounted ? availableAllures(partyMounts(party)) : [];
  const modeChoices: TravelMode[] = selRoute
    ? [...selRoute.modes, ...(mounted && selRoute.modes.includes('pied') ? ['monture'] : [])]
    : [];

  // Traversée MARITIME (routes `sea`, MDG 13/15) : sur le navire de campagne — estimation en milles/jour.
  const vessel = useGame((s) => s.vessel);
  const vesselData = vessel ? findVehicleById(vessel.vehicleId) : undefined;
  const vesselLabel = vessel?.label ?? vesselData?.label ?? ''; // #230 — nom d'instance prioritaire
  const seaPropulsion = vesselPropulsion(vesselData?.ship);
  const seaM = (vessel?.wounds == null || vessel.wounds.current > 0) ? (seaPropulsion?.m ?? 0) : 0;
  // Forcer le rythme (MDG 13 l.95-107) : +1 M voile/avirons, +2 M avirons seulement — rien à la vapeur (ch.12 l.311).
  const seaRig: 'voile' | 'avirons' = seaPropulsion?.mode ?? 'avirons';
  const seaSteam = !!vessel && shipHasNavalTrait([...(vesselData?.ship?.traits ?? []), ...(vessel.upgrades ?? [])], 'propulsion-a-vapeur');
  const seaPaceChoices = seaSteam || !(vesselData?.ship?.sail || vesselData?.ship?.oars) ? [0] : [0, 1, 2].filter((b) => b === 0 || forcePaceDifficulty(b, seaRig) != null);
  // Surcharge de la cale (MDG 12 l.70-75) : >150 % = « Impossible de prendre la mer » → appareillage bloqué.
  const seaOverload = vessel && vesselData?.ship ? cargoOverload(cargoTotalEnc(vessel.cargo ?? []), vesselData.ship.capacity) : null;
  // Population embarquée pour le manifeste d'avitaillement (#245) : héros + effectif PNJ nominal présent.
  const seaCrewCount = vessel ? Math.max(0, (vesselData?.ship?.crew ?? 0) - (vessel.crewLost ?? 0)) : 0;

  // Estimations du trajet sélectionné (mêmes formules que le flux — RAW l.207-224).
  const base = baseHoursPerDay(map);
  const maxH = maxHoursPerDay(map);
  const passengers = party.filter((h) => !h.dead && !h.outOfRencontre).length;
  const effAllure: Allure | undefined = mode === 'monture' ? allure : forceGallop ? 'galop' : undefined;
  const kmh = selRoute ? travelSpeed(party, mode, selRoute.speed?.[mode], effAllure) : 0;
  const hours = mode === 'pied' && forced ? maxH : mode === 'monture' && forced ? 12 : base;
  const plan = selRoute && kmh > 0 ? travelPlanCalc(selRoute.km, kmh, hours) : null;
  const cost = selRoute && mode !== 'pied' && mode !== 'monture' && mode !== 'mer'
    ? transportCost(selRoute.km, mode, classKey, passengers, selRoute.prices?.[mode])
    : null;
  const affordable = !cost || canAfford(money, cost);
  const rationsOwned = party.reduce((s, h) => s + (h.dead ? 0 : rationCount(h)), 0);
  const rationsNeeded = plan ? Math.max(0, (plan.days - 1) * passengers) : 0; // les nuits en route mangent

  // Avitaillement au départ EN MER (#241) : le groupe qui appareille sans vivres/eau le SAIT.
  const seaDaysEstimated = mode === 'mer' && selRoute && seaM > 0 ? Math.max(1, Math.ceil(selRoute.km / (18 * seaM))) : 0;
  const provisions = mode === 'mer' && seaDaysEstimated > 0 ? provisioningManifest(party, vessel?.waterLitres, seaDaysEstimated, { count: seaCrewCount, provisions: vessel?.provisions }) : null;

  const fmtDuration = (p: NonNullable<typeof plan>) =>
    p.days <= 1 ? `≈ ${Math.max(1, Math.round(p.travelMinutes / 60))} h` : `${p.days} jours (${hours} h de route/jour)`;

  // Reprise d'un voyage interrompu.
  const resumeDest = travelPlan?.interrupted ? placeById(map, travelPlan.toPlaceId) : undefined;
  const resumeRoute = travelPlan ? map.routes.find((r) => r.id === travelPlan.routeId) : undefined;

  // ── Habillage + contenu data-driven de la carte (`MapCanvas`) ────────────────────────────────
  // Chrome FIXE plein-cadre (parchemin, cadre orné, `<defs>`) — jamais zoomé/cliquable.
  const chrome = (
    <>
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
        {/* Coins arrondis pour la carte de fond (mêmes rayon/cadre que le parchemin). */}
        <clipPath id="wm-frame-clip"><rect x="0" y="0" width="100" height="64" rx="2.5" /></clipPath>
      </defs>
      {/* Parchemin + grain + vignette */}
      <rect x="0" y="0" width="100" height="64" rx="2.5" fill="url(#wm-parch)" />
      <rect x="0" y="0" width="100" height="64" rx="2.5" filter="url(#wm-grain)" opacity="0.06" />
      {/* Taches d'âge (déterministes) */}
      <ellipse cx="22" cy="14" rx="6" ry="3.4" fill="var(--wm-age-spot)" opacity="0.06" />
      <ellipse cx="80" cy="50" rx="7" ry="4" fill="var(--wm-age-spot)" opacity="0.05" />
      <ellipse cx="60" cy="9" rx="4" ry="2.6" fill="var(--wm-age-spot)" opacity="0.05" />
      <rect x="0" y="0" width="100" height="64" rx="2.5" fill="url(#wm-vignette)" />
      {/* Cadre orné : filet brun épais + filet or fin + fleurons aux angles */}
      <rect x="1.4" y="1.4" width="97.2" height="61.2" rx="2" fill="none" stroke="var(--wm-frame-dark)" strokeWidth="1.3" />
      <rect x="3.1" y="3.1" width="93.8" height="57.8" rx="1.4" fill="none" stroke="var(--wm-frame-gold)" strokeWidth="0.4" />
      {[[5, 6.6], [95, 6.6], [5, 60], [95, 60]].map(([fx, fy], i) => (
        <text key={i} x={fx} y={fy} textAnchor="middle" fontSize="4" fill="var(--wm-fleuron)" opacity="0.8">⚜</text>
      ))}
    </>
  );

  // Routes (chemins courbes) — CLIQUABLES depuis le lieu courant (large zone invisible via MapCanvas).
  const mapPaths: MapPath[] = map.routes.flatMap((r) => {
    const a = placeById(map, r.a);
    const b = placeById(map, r.b);
    if (!a || !b) return [];
    const pa = posOf(a), pb = posOf(b);
    const c = routeCurve(pa.x, pa.y, pb.x, pb.y, r.id);
    const sel = r.id === selId;
    const fromHere = !!here && (r.a === here.id || r.b === here.id) && (r.from == null || r.from === here.id);
    const water = r.modes.includes('barge') && !r.modes.includes('pied');
    return [{
      id: r.id,
      d: c.d,
      onClick: fromHere ? () => selectRoute(r) : undefined,
      children: (view: Viewport) => (
        <>
          <path
            d={c.d}
            fill="none"
            stroke={sel ? 'var(--accent)' : fromHere ? '#6d4f24' : '#9b8255'}
            strokeWidth={sel ? 1.4 : 0.9}
            strokeLinecap="round"
            strokeDasharray={water ? '0.6 2.4' : '2.4 1.7'}
            opacity={sel || fromHere ? 1 : 0.7}
            pointerEvents="none"
            vectorEffect="non-scaling-stroke"
          />
          {/* Étiquette de distance — taille écran CONSTANTE (scale 1/z), et seulement pour les routes
              partant d'ICI (celles qu'on peut prendre) : les autres restent des traits propres. */}
          {fromHere && (
            <g transform={`translate(${c.lx} ${c.ly}) scale(${1 / view.z})`}>
              <rect x="-5" y="-2" width="10" height="3" rx="1.5" fill="var(--wm-badge-bg)" opacity="0.88" />
              <text y="0.15" textAnchor="middle" fontSize="2.1" fill="var(--wm-ink)">
                {routeDistanceLabel(r.km, r.sea)}
              </text>
              {/* Badge de mode : barque (voie d'eau) / compas (route carrossable). */}
              {r.modes.some((mm) => mm !== 'pied') && (
                <g style={{ color: 'var(--wm-ink)' }}>
                  <IconG id={water ? 'scenario/naval' : 'scenario/travel'} x={5.4} y={-1.35} size={2.5} />
                </g>
              )}
            </g>
          )}
        </>
      ),
    }];
  });

  // Lieux (médaillons). Affordance : destination RELIÉE = anneau accent pointillé + curseur ; lieu hors
  // d'atteinte = estompé, le clic EXPLIQUE (panneau bas). Taille écran constante (MapCanvas `scale(1/z)`).
  const mapMarkers: MapMarker[] = map.places.map((p) => {
    const isHere = here?.id === p.id;
    const isDest = dest?.id === p.id;
    const route = here ? routes.find((r) => otherEnd(r, here.id) === p.id) : undefined;
    const clickable = !!route;
    const pr = posOf(p);
    return {
      id: p.id,
      x: pr.x,
      y: pr.y,
      selected: isHere || isDest,
      onClick: clickable ? () => selectRoute(route!) : !isHere ? () => { setSelId(null); setFarId(p.id); } : undefined,
      label: p.label,
      onHover: (h: boolean) => setHoveredId((cur) => (h ? p.id : cur === p.id ? null : cur)),
      cursor: clickable ? 'pointer' : !isHere ? 'help' : undefined,
      opacity: clickable || isHere ? 1 : 0.55,
      children: (
        <>
          {/* cible de clic/survol généreuse (taille écran constante) */}
          <circle r="3.4" fill="transparent" />
          {isHere && <text y="-2.6" textAnchor="middle" fontSize="1.5" fontWeight={700} fill="var(--ok)">✦ Vous êtes ici</text>}
          {/* Sélection = anneau OR (charte-ui : `--gold` réservé aux bordures/focus, jamais `--accent`,
              action primaire) — langage UNIQUE partagé avec le plan du hub (`CityHubScreen`, #362). */}
          {(isHere || isDest) && (
            <circle r="2.1" fill="none" stroke={isHere ? 'var(--ok)' : 'var(--gold)'} strokeWidth="0.4" opacity="0.95" />
          )}
          {clickable && !isDest && (
            <circle r="2.1" fill="none" stroke="var(--accent)" strokeWidth="0.3" strokeDasharray="0.7 0.55" opacity="0.9" />
          )}
          <circle r="1.5" fill="url(#wm-medal)" stroke="var(--wm-age-spot)" strokeWidth="0.22" filter="url(#wm-drop)" />
          {/* `p.icon` = id d'icône (registre src/ui/icons) ; sans icône, drapeau de lieu. */}
          <g style={{ color: 'var(--wm-marker-icon)' }}>
            <IconG id={p.icon ?? 'nav/entry-point'} x={-1.05} y={-1.05} size={2.1} />
          </g>
        </>
      ),
    };
  });

  // Cartouches de nom — peints APRÈS les médaillons (donc AU-DESSUS de tous). Sur une carte dense,
  // seuls les lieux PERTINENTS sont nommés en permanence (position courante + destinations reliées) ;
  // les autres révèlent leur nom au SURVOL. `pointer-events:none` : ne vole pas le survol du médaillon.
  const mapOverlay = (view: Viewport) => (
    <>
      {map.places.map((p) => {
        const isHere = here?.id === p.id;
        const clickable = here ? routes.some((r) => otherEnd(r, here.id) === p.id) : false;
        const hovered = hoveredId === p.id;
        if (!isHere && !clickable && !hovered) return null;
        const w = Math.max(8, p.label.length * 1.15 + 3);
        const pr = posOf(p);
        return (
          <g key={`lbl-${p.id}`} transform={`translate(${pr.x} ${pr.y}) scale(${1 / view.z})`} style={{ pointerEvents: 'none' }}>
            <g transform="translate(0 3.6)">
              <rect x={-w / 2} y="-1.9" width={w} height="3" rx="1.5" fill="var(--wm-cartouche-bg)" opacity={0.9} stroke={hovered && !isHere && !clickable ? 'var(--gold2)' : 'none'} strokeWidth="0.2" />
              <text y="0.25" textAnchor="middle" fontSize="2.1" fontWeight={isHere ? 700 : 500} fill="var(--wm-cartouche-fg)">{p.label}</text>
            </g>
          </g>
        );
      })}
      <CompassRose x={13} y={52} />
    </>
  );

  return (
    <ScreenShell title={<><Icon id="nav/campaign" size="sm" /> {map.nom}</>} onClose={close} meta={{ time: gameTime, money }}>
      <div className="layout-sidebar worldmap-layout">
      <div className="worldmap-canvas">
        <MapCanvas
          className="wm-map"
          ariaLabel={map.nom}
          computeFit={computeFit}
          background={map.background}
          chrome={chrome}
          paths={mapPaths}
          markers={mapMarkers}
          overlay={mapOverlay}
        />
      </div>

      <aside className="worldmap-side">
      {/* Voyage interrompu : reprise */}
      {travelPlan?.interrupted && resumeDest && (
        <div className="worldmap-panel">
          <p>
            Voyage vers <b>{resumeDest.label}</b> interrompu —{' '}
            {Math.round(travelPlan.km - travelPlan.kmDone) > 0
              ? `${routeDistanceLabel(travelPlan.km - travelPlan.kmDone, resumeRoute?.sea)} restants.`
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
            <span className="wm-trip-route"><b>{here.label}</b> <span className="wm-arrow">→</span> <b>{dest.label}</b> · {routeDistanceLabel(selRoute.km, selRoute.sea)}</span>
            {/* Choix du MODE de voyage = un état, pas une action — segmented control (#362 : « En mer »
                stylé `.btn-primary` concurrençait visuellement « Partir »). */}
            <OptionChooser
              layout="seg"
              options={modeChoices.map((m) => ({
                key: m,
                label: TRAVEL_MODE_LABEL[m],
                selected: mode === m,
                content: <><Icon id={travelModeIcon(m)} /> {TRAVEL_MODE_LABEL[m]}</>,
                onSelect: () => pickMode(m),
              }))}
            />
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
          {mode === 'mer' && vessel && seaM > 0 && (
            <div className="wm-modes">
              <button
                type="button"
                className={`btn small ${!seaFast && seaCadence === 'commande' ? 'btn-primary' : ''}`}
                onClick={() => { setSeaFast(false); setSeaCadence('commande'); }}
                title="Traversée COMMANDÉE : vous fixez l'allure et les ordres permanents ; les Tests d'équipage de routine (progression, orientation, entretien…) s'auto-résolvent et défilent au procès-verbal du jour. Seules les crises, les événements à choix, les embuscades et les urgences interrompent."
              >
                Traversée commandée
              </button>
              <button
                type="button"
                className={`btn small ${!seaFast && seaCadence === 'jour-par-jour' ? 'btn-primary' : ''}`}
                onClick={() => { setSeaFast(false); setSeaCadence('jour-par-jour'); }}
                title="Cadence MANUELLE : chaque Test d'équipage de Navigation ouvre sa modale (jour par jour)."
              >
                Jour par jour
              </button>
              <button
                type="button"
                className={`btn small ${seaFast ? 'btn-primary' : ''}`}
                onClick={() => { setSeaFast(true); setSeaPace(0); }}
                title="Tout le trajet se résout en UN Test d'équipage de Rude épreuve, modulé par l'Humeur de Manann et la durée."
              >
                Traversée rapide (un Test)
              </button>
            </div>
          )}
          {mode === 'mer' && vessel && seaM > 0 && !seaFast && seaPaceChoices.length > 1 && (
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
                      ? `Test de ${seaRig === 'voile' ? 'Voile' : 'Ramer'} ${DIFFICULTY_LABELS[diff]} chaque jour — réussi : +${b} M ; le soir, Test de Résistance Complexe (−10) sous peine d'Exténué.`
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
                // 18 milles/jour par point de M (MDG 15 l.57-70) — le vent et les Tests d'équipage
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
          {mode === 'mer' && provisions && (
            <div className="wm-provision">
              <span className={`wm-provision-item ${provisions.rationsDispo < provisions.rationsRequises ? 'short' : ''}`}>
                <Icon id="scenario/port" size="sm" /> Vivres {provisions.rationsDispo}/{provisions.rationsRequises}
              </span>
              <span className={`wm-provision-item ${provisions.eauDispoLitres != null && provisions.eauDispoLitres < provisions.eauRequiseLitres ? 'short' : ''}`}>
                Eau {provisions.eauDispoLitres != null ? `${provisions.eauDispoLitres} L` : '—'}/{provisions.eauRequiseLitres} L
              </span>
              {!provisions.suffisant && <span className="wm-provision-item short">Avitaillement insuffisant pour {provisions.joursEstimes} jour(s) estimé(s) ({provisions.souls} à bord).</span>}
              {seaOverload?.palierId && <span className="wm-provision-item short">Cale surchargée à {seaOverload.ratioPct} % : {seaOverload.label}{seaOverload.canSail ? ` (${seaOverload.mMod} M, ${seaOverload.manoeuvreDR} DR Manœuvre)` : ' — impossible de prendre la mer'}.</span>}
            </div>
          )}
          {mode === 'mer' && vessel ? <ShipRolesPanel /> : rule('travel-etapes') && <TravelRolesPanel />}
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setSelId(null)}>Annuler</button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={(mode === 'mer' ? !vessel || seaM <= 0 || (seaOverload != null && !seaOverload.canSail) : kmh <= 0 || !affordable) || isGuest}
              title={isGuest ? 'L’hôte décide des départs.'
                : mode === 'mer' && (!vessel || seaM <= 0) ? 'Aucun navire de campagne en état de prendre la mer.'
                : mode === 'mer' && seaOverload != null && !seaOverload.canSail ? `Cale surchargée à ${seaOverload.ratioPct} % — impossible de prendre la mer. Allégez la cale.`
                : mode === 'mer' && provisions && !provisions.suffisant ? 'Le navire appareille sans provisions suffisantes.'
                : mode !== 'mer' && kmh <= 0 ? 'Le groupe est trop chargé pour avancer — allégez les sacs.'
                : mode !== 'mer' && !affordable ? `Bourse insuffisante (${cost ? formatMoney(cost) : ''})`
                : undefined}
              onClick={() => startTravel(selRoute.id, mode, {
                classKey: classKey || undefined,
                hoursPerDay: forced ? (mode === 'pied' ? maxH : mode === 'monture' ? 12 : undefined) : undefined,
                allure: effAllure,
                seaPace: mode === 'mer' && !seaFast && seaPace > 0 ? seaPace : undefined,
                fast: mode === 'mer' && seaFast ? true : undefined,
                cadence: mode === 'mer' && !seaFast ? seaCadence : undefined,
              })}
            >
              <Icon id="scenario/travel" size="sm" /> {mode === 'mer' && provisions && !provisions.suffisant ? 'Appareiller quand même' : 'Partir'}
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

      {pendingDeparture && !isGuest && (
        <div className="worldmap-panel" role="alertdialog" aria-label="Départ de nuit">
          <p>
            La nuit est tombée — un voyage {pendingDeparture.mode === 'monture' ? 'en selle' : pendingDeparture.mode === 'pied' ? 'à pied' : 'sur le fleuve'} ne
            s'ébranle qu'au grand jour. Prochain départ possible à l'aube ({formatImperial(pendingDeparture.dawnAt)}).
          </p>
          <div className="bar">
            <button className="btn btn-primary" onClick={departWaitDawn}>Attendre l'aube</button>
            <button className="btn" onClick={departCancel}>Annuler</button>
          </div>
        </div>
      )}
      </aside>
      </div>
    </ScreenShell>
  );
}
