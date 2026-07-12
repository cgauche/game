import { useState } from 'react';
import { useGame } from '../state/store';
import { placeServices, type ResolvedPlaceService, type MapPlace } from '../state/worldMap';
import type { Scene } from '../state/scene';
import { restServicePrice, type RestPlaces } from '../state/restFlow';
import { findLandCargoById } from '../engine/landCargo';
import { innGatherInfoMinutes } from '../state/innFlow';
import { ScreenShell } from './ScreenShell';
import { MasterDetail } from './MasterDetail';
import { Tabs, type TabItem } from './Tabs';
import { MapCanvas, type MapMarker } from './MapCanvas';
import { planChrome } from './PlanChrome';
import { VB_H } from './worldMapViewport';
import { Prose } from './Prose';
import { Coins } from './Coins';
import { Icon, IconG } from './Icon';
import { SpeakerBanner } from './SpeakerBanner';
import { SceneBackdrop } from './SceneBackdrop';

/**
 * HUB DE VILLE (#343) — l'écran UNIQUE d'un LIEU de la carte : on n'empile plus des boutons flottants
 * (Port/Marché/Dormir), on ENTRE dans le lieu. Coquille plein-champ (`ScreenShell`) + `MasterDetail` :
 * GAUCHE la liste des SERVICES du lieu (`placeServices` — port, marché, auberge, services de catalogue),
 * CENTRE le service sélectionné. Assemblage PUR de primitives ; les payloads métier (port/marché/repos)
 * RÉFÉRENCENT la donnée du lieu, jamais recopiée.
 *
 * Port/Marché ont leur propre écran plein-champ (`PortView`/`LandMarketView`) : leur carte de synthèse
 * porte une action « Entrer » qui FERME le hub puis ouvre cet écran (on n'incruste pas un ScreenShell
 * dans un ScreenShell). L'auberge est le panneau RICHE : prix RÉELS du catalogue (source unique
 * `restServicePrice`), action Dormir (flux de repos existant), rumeurs déjà glanées.
 */

/** Libellé d'affichage de la météo de scène (id → français) — pur AFFICHAGE, keyé par id stable. */
const SCENE_WEATHER_LABEL: Record<NonNullable<Scene['weather']>, string> = {
  clair: 'Ciel clair',
  pluie: 'Pluie',
  brouillard: 'Brouillard',
  neige: 'Neige',
  tempete: 'Tempête',
};

/** Services d'un lieu tels que listés par le hub (délégué à `placeServices`, source unique) — surface
 *  PURE testable (composition + ordre : port, marché, puis services de catalogue dont l'auberge). */
export function cityHubServices(place: MapPlace, scene?: Scene): ResolvedPlaceService[] {
  return placeServices(place, scene);
}

/** Porte de l'onglet Plan (#345 phase 5) — surface PURE testable : le lieu doit porter au moins un
 *  POI, sinon l'onglet n'a rien à montrer et reste absent (source unique de la condition d'affichage,
 *  partagée par `CityHubScreen` et son test). */
export function cityHubHasPlan(place: MapPlace): boolean {
  return (place.poi ?? []).length > 0;
}

/** Porte du bouton « Entrer au port » — surface PURE testable : `openPort` (`portFlow.ts`) est un
 *  no-op silencieux sans navire de campagne (`!get().vessel`). Sans cette porte le bouton resterait
 *  une affordance MORTE (clic muet) — source unique de la condition, partagée par `CityHubScreen`
 *  (désactive le bouton avec sa raison) et son test. */
export function cityHubCanEnterPort(vessel: unknown): boolean {
  return vessel != null;
}

/** Icône de repli d'un service (le catalogue fournit la sienne ; défauts par catégorie). */
function serviceIcon(s: ResolvedPlaceService): string {
  return s.icon ?? (s.category === 'port' ? 'travel/anchor' : s.category === 'marche' ? 'merchant/cart' : s.category === 'auberge' ? 'rest/bed' : 'nav/entry-point');
}

/** Carte de synthèse d'un profil commercial (port/marché) : Taille/Richesse + colonne Produits. */
function ProfileSynth({ taille, richesse, production }: { taille: number; richesse: number; production?: string[] }) {
  const goods = (production ?? []).filter((p) => p !== 'commerce' && p !== 'subsistance' && p !== 'minimum-vital');
  const commerce = (production ?? []).includes('commerce');
  return (
    <ul className="city-hub-synth">
      <li><span className="city-hub-synth-k">Taille</span><span className="city-hub-synth-v">{taille}</span></li>
      <li><span className="city-hub-synth-k">Richesse</span><span className="city-hub-synth-v">{richesse}</span></li>
      {(goods.length > 0 || commerce) && (
        <li>
          <span className="city-hub-synth-k">Produits</span>
          <span className="city-hub-synth-v">{[commerce ? 'Commerce' : null, ...goods.map((id) => findLandCargoById(id)?.label ?? id)].filter(Boolean).join(', ')}</span>
        </li>
      )}
    </ul>
  );
}

/** Coquille store-connectée : lit le lieu courant, liste ses services et rend le service sélectionné.
 *  `rest` = offre de couchage À LA POSITION du groupe (`restPlacesHere`) : sert le panneau d'auberge, et
 *  fonde un service « Repos » de repli si le lieu offre un couchage sans auberge déclarée (camp/maison).
 *  `onClose` = fermer le hub (rendu par `CampaignView`). */
export function CityHubScreen({
  place, scene, rest, onClose,
}: {
  place: MapPlace;
  scene?: Scene;
  rest?: { places: RestPlaces; quality: 'normale' | 'pietre' } | null;
  onClose: () => void;
}) {
  const money = useGame((s) => s.money);
  const gameTime = useGame((s) => s.gameTime);
  const worldMap = useGame((s) => s.worldMap);
  const tradeRumours = useGame((s) => s.tradeRumours);
  const openRest = useGame((s) => s.openRest);
  const openPort = useGame((s) => s.openPort);
  const vessel = useGame((s) => s.vessel);
  const openLandMarket = useGame((s) => s.openLandMarket);
  const gatherInnInfo = useGame((s) => s.gatherInnInfo);
  const transitionTo = useGame((s) => s.transitionTo);

  const base = cityHubServices(place, scene);
  // Couchage sur place SANS auberge déclarée (camp/maison) : un service « Repos » de repli, pour que le
  // repli des boutons flottants (#343) n'ampute jamais le Dormir d'un lieu qui l'offrait.
  const services = rest && !base.some((s) => s.category === 'auberge')
    ? [...base, { id: 'repos', category: 'auberge', label: 'Repos', icon: 'nav/rest', rest: rest.places } as ResolvedPlaceService]
    : base;
  const [selId, setSelId] = useState<string | null>(services[0]?.id ?? null);
  const sel = services.find((s) => s.id === selId) ?? services[0];

  const poi = place.poi ?? [];
  const [screenTab, setScreenTab] = useState<'services' | 'plan'>('services');
  const [poiSelId, setPoiSelId] = useState<string | null>(null);
  const poiSel = poi.find((p) => p.id === poiSelId) ?? poi[0];

  // « Entrer » un écran plein-champ existant : on FERME le hub d'abord (pas de ScreenShell imbriqué).
  const enter = (open: () => void) => { onClose(); open(); };

  /** Panneau de détail d'un SERVICE résolu — source UNIQUE, appelée pour la sélection de l'onglet
   *  Services ET pour un POI de plan ciblant un `serviceKind` (#345 : zéro copie du renderer). */
  const renderServiceDetail = (svc: ResolvedPlaceService | undefined): React.ReactNode => {
    if (!svc) return <p className="city-hub-empty">Ce lieu n’offre encore aucun service.</p>;
    if (svc.category === 'auberge') {
      return (
        <div className="city-hub-panel">
          <SceneBackdrop backdropId={place.backdrop ?? svc.backdrop} />
          <SpeakerBanner name="L’aubergiste" variant="boniment">{svc.hostLine}</SpeakerBanner>
          {svc.desc && <div className="city-hub-desc"><Prose md={svc.desc} /></div>}
          {/* Jamais une promesse d'action impossible (cf. `cityHubCanEnterPort`) : sans offre de
              couchage effective (`svc.rest`), les prix de chambre/repas ne s'affichent pas — ils ne
              mènent nulle part ici (recette 2026-07-12). */}
          {svc.rest
            ? (
              <ul className="city-hub-prices">
                <li><span>Chambre privée / nuit</span><b><Coins money={restServicePrice('privee')} /></b></li>
                <li><span>Chambre commune / nuit</span><b><Coins money={restServicePrice('commune')} /></b></li>
                <li><span>Repas</span><b><Coins money={restServicePrice('repas')} /></b></li>
              </ul>
            )
            : <p className="city-hub-empty">Aucun couchage proposé ici pour l’instant.</p>}
          <div className="bar city-hub-actions">
            {svc.rest && <button type="button" className="btn btn-primary" onClick={() => openRest({ places: svc.rest, quality: rest?.quality })}>Dormir</button>}
            <button type="button" className="btn btn-primary" onClick={gatherInnInfo}>
              Recueillir des informations (≈{Math.round(innGatherInfoMinutes() / 60)} h)
            </button>
          </div>
          <section className="city-hub-rumours">
            <h4>Rumeurs déjà glanées</h4>
            {tradeRumours.length === 0
              ? <p className="city-hub-empty">Aucune rumeur pour l’instant.</p>
              : <ul className="city-hub-hint">{tradeRumours.map((r, i) => {
                  const target = worldMap?.places.find((p) => p.id === r.placeId)?.label ?? r.placeId;
                  const biens = r.biens.map((id) => findLandCargoById(id)?.label ?? id).join(', ');
                  return <li key={i}>{biens} — recherchés à {target}.</li>;
                })}</ul>}
          </section>
        </div>
      );
    }
    if (svc.category === 'port' && svc.port) {
      return (
        <div className="city-hub-panel">
          <ProfileSynth taille={svc.port.taille} richesse={svc.port.richesse} production={svc.port.production} />
          <div className="bar city-hub-actions">
            <button
              type="button" className="btn btn-primary" disabled={!cityHubCanEnterPort(vessel)}
              title={cityHubCanEnterPort(vessel) ? undefined : 'Aucun navire de campagne'}
              onClick={() => enter(openPort)}
            >
              Entrer au port
            </button>
          </div>
        </div>
      );
    }
    if (svc.category === 'marche' && svc.market) {
      return (
        <div className="city-hub-panel">
          <ProfileSynth taille={svc.market.taille} richesse={svc.market.richesse} production={svc.market.produits} />
          <div className="bar city-hub-actions">
            <button type="button" className="btn btn-primary" onClick={() => enter(openLandMarket)}>Entrer au marché</button>
          </div>
        </div>
      );
    }
    // Service de catalogue sans écran dédié (temple/forgeron/guilde) : desc si le catalogue la porte,
    // sinon un constat FACTUEL (aucune promesse « à venir » non fondée par la donnée, cf. règle 1/7).
    return (
      <div className="city-hub-panel">
        {svc.desc ? <div className="city-hub-desc"><Prose md={svc.desc} /></div> : <p className="city-hub-empty">Ce service n’a pas encore d’écran dédié.</p>}
      </div>
    );
  };

  const detail = renderServiceDetail(sel);

  // Tailles de marqueur du plan : hit-circle ≥44px de cible tactile (le plan rend le viewBox 100×64 sur
  // ~320-340px à 360 → r=6 en unités écran-constantes ≈ 41-44px de diamètre, pointer coarse #360).
  // Cartouche du libellé au patron worldmap (`wm-cartouche-bg`/`fg`) mais TOUJOURS visible (pas
  // seulement au survol : un plan de ville dense reste petit, ses POI restent peu nombreux).
  const poiMarkers: MapMarker[] = poi.map((p) => {
    const w = Math.max(9, p.label.length * 1.3 + 3.4);
    return {
      id: p.id,
      x: p.pos.x,
      y: p.pos.y * (VB_H / 100),
      selected: poiSel?.id === p.id,
      onClick: () => setPoiSelId(p.id),
      cursor: 'pointer',
      label: p.label,
      children: (
        <>
          <circle r="6" fill="transparent" />
          {/* Sélection = anneau OR (charte-ui : `--gold` réservé aux bordures/focus, jamais `--accent`,
              action primaire) — langage UNIQUE partagé avec la carte du monde (`WorldMapView`, #362). */}
          {poiSel?.id === p.id && <circle r="3" fill="none" stroke="var(--gold)" strokeWidth="0.45" opacity="0.95" />}
          <circle r="2.2" fill="var(--wm-badge-bg)" stroke="var(--wm-age-spot)" strokeWidth="0.28" />
          <g style={{ color: 'var(--wm-marker-icon)' }}>
            <IconG id={p.icon ?? 'nav/entry-point'} x={-1.4} y={-1.4} size={2.8} />
          </g>
          <g transform="translate(0 4.7)">
            <rect x={-w / 2} y="-2.1" width={w} height="3.4" rx="1.6" fill="var(--wm-cartouche-bg)" opacity="0.9" />
            <text y="0.25" textAnchor="middle" fontSize="2.3" fontWeight={poiSel?.id === p.id ? 700 : 500} fill="var(--wm-cartouche-fg)">{p.label}</text>
          </g>
        </>
      ),
    };
  });

  const poiServiceTarget = poiSel?.serviceKind ? services.find((s) => s.id === poiSel.serviceKind) : undefined;
  let poiDetail: React.ReactNode = null;
  if (!poiSel) {
    poiDetail = <p className="city-hub-empty">Ce lieu n’a aucun point d’intérêt.</p>;
  } else if (poiSel.sceneId) {
    poiDetail = (
      <div className="city-hub-panel">
        <p className="city-hub-desc">Ce point mène à un autre endroit.</p>
        <div className="bar city-hub-actions">
          <button type="button" className="btn btn-primary" onClick={() => enter(() => transitionTo(poiSel.sceneId!))}>Entrer</button>
        </div>
      </div>
    );
  } else {
    poiDetail = renderServiceDetail(poiServiceTarget);
  }

  const screenTabs: TabItem<'services' | 'plan'>[] = [
    { key: 'services', label: 'Services' },
    ...(cityHubHasPlan(place) ? [{ key: 'plan' as const, label: 'Plan' }] : []),
  ];

  return (
    <ScreenShell
      className="city-hub"
      title={<><Icon id={place.icon ?? 'nav/entry-point'} size="sm" /> {place.label}</>}
      onClose={onClose}
      meta={{ time: gameTime, money }}
      actions={scene?.weather && <span className="city-hub-weather">· {SCENE_WEATHER_LABEL[scene.weather]}</span>}
      tabs={screenTabs.length > 1 ? <Tabs tabs={screenTabs} active={screenTab} onChange={setScreenTab} label={`Onglets de ${place.label}`} /> : undefined}
    >
      <div className="city-hub-body">
        {screenTab === 'plan' && poi.length > 0 ? (
          <MasterDetail
            className="city-hub-master city-hub-plan"
            listLabel={`Plan de ${place.label}`}
            list={
              <div className="worldmap-canvas city-hub-plan-canvas">
                <MapCanvas
                  ariaLabel={`Plan de ${place.label}`}
                  computeFit={() => ({ z: 1, panX: 0, panY: 0 })}
                  chrome={planChrome()}
                  markers={poiMarkers}
                />
              </div>
            }
            detail={
              <div className="city-hub-detail panel">
                {poiSel && <h3 className="city-hub-detail-head"><Icon id={poiSel.icon ?? 'nav/entry-point'} size="sm" /> {poiSel.label}</h3>}
                {poiDetail}
              </div>
            }
          />
        ) : (
          <MasterDetail
            className="city-hub-master"
            listLabel="Services du lieu"
            list={
              <div className="city-hub-services panel flush" role="listbox" aria-label="Services du lieu">
                {services.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="option"
                    aria-selected={sel?.id === s.id}
                    className={`city-hub-service${sel?.id === s.id ? ' active' : ''}`}
                    onClick={() => setSelId(s.id)}
                  >
                    <Icon id={serviceIcon(s)} size="sm" />
                    <span className="city-hub-service-label">{s.label}</span>
                  </button>
                ))}
              </div>
            }
            detail={
              <div className="city-hub-detail panel">
                {sel && <h3 className="city-hub-detail-head"><Icon id={serviceIcon(sel)} size="sm" /> {sel.label}</h3>}
                {detail}
              </div>
            }
          />
        )}
      </div>
    </ScreenShell>
  );
}
