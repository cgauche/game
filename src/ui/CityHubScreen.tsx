import { useState } from 'react';
import { useGame } from '../state/store';
import { placeServices, type ResolvedPlaceService, type MapPlace } from '../state/worldMap';
import type { Scene } from '../state/scene';
import { restServicePrice, type RestPlaces } from '../state/restFlow';
import { findLandCargoById } from '../engine/landCargo';
import { ScreenShell } from './ScreenShell';
import { MasterDetail } from './MasterDetail';
import { Prose } from './Prose';
import { Coins } from './Coins';
import { GameDate } from './GameDate';
import { Icon } from './Icon';

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
  const openLandMarket = useGame((s) => s.openLandMarket);

  const base = cityHubServices(place, scene);
  // Couchage sur place SANS auberge déclarée (camp/maison) : un service « Repos » de repli, pour que le
  // repli des boutons flottants (#343) n'ampute jamais le Dormir d'un lieu qui l'offrait.
  const services = rest && !base.some((s) => s.category === 'auberge')
    ? [...base, { id: 'repos', category: 'auberge', label: 'Repos', icon: 'nav/rest', rest: rest.places } as ResolvedPlaceService]
    : base;
  const [selId, setSelId] = useState<string | null>(services[0]?.id ?? null);
  const sel = services.find((s) => s.id === selId) ?? services[0];

  // « Entrer » un écran plein-champ existant : on FERME le hub d'abord (pas de ScreenShell imbriqué).
  const enter = (open: () => void) => { onClose(); open(); };

  let detail: React.ReactNode = null;
  if (!sel) {
    detail = <p className="city-hub-empty">Ce lieu n’offre encore aucun service.</p>;
  } else if (sel.category === 'auberge') {
    detail = (
      <div className="city-hub-panel">
        {sel.desc && <div className="city-hub-desc"><Prose md={sel.desc} /></div>}
        <ul className="city-hub-prices">
          <li><span>Chambre privée / nuit</span><b><Coins money={restServicePrice('privee')} /></b></li>
          <li><span>Chambre commune / nuit</span><b><Coins money={restServicePrice('commune')} /></b></li>
          <li><span>Repas</span><b><Coins money={restServicePrice('repas')} /></b></li>
        </ul>
        <div className="bar city-hub-actions">
          {sel.rest && <button type="button" className="btn btn-primary" onClick={() => openRest({ places: sel.rest, quality: rest?.quality })}>Dormir</button>}
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
  } else if (sel.category === 'port' && sel.port) {
    detail = (
      <div className="city-hub-panel">
        <ProfileSynth taille={sel.port.taille} richesse={sel.port.richesse} production={sel.port.production} />
        <div className="bar city-hub-actions">
          <button type="button" className="btn btn-primary" onClick={() => enter(openPort)}>Entrer au port</button>
        </div>
      </div>
    );
  } else if (sel.category === 'marche' && sel.market) {
    detail = (
      <div className="city-hub-panel">
        <ProfileSynth taille={sel.market.taille} richesse={sel.market.richesse} production={sel.market.produits} />
        <div className="bar city-hub-actions">
          <button type="button" className="btn btn-primary" onClick={() => enter(openLandMarket)}>Entrer au marché</button>
        </div>
      </div>
    );
  } else {
    // Service de catalogue sans écran dédié (temple/forgeron/guilde) : desc si le catalogue la porte,
    // sinon un constat FACTUEL (aucune promesse « à venir » non fondée par la donnée, cf. règle 1/7).
    detail = (
      <div className="city-hub-panel">
        {sel.desc ? <div className="city-hub-desc"><Prose md={sel.desc} /></div> : <p className="city-hub-empty">Ce service n’a pas encore d’écran dédié.</p>}
      </div>
    );
  }

  return (
    <ScreenShell
      className="city-hub"
      title={<><Icon id={place.icon ?? 'nav/entry-point'} size="sm" /> {place.label}</>}
      onClose={onClose}
      closeLabel="Quitter"
      actions={<>
        <span className="hud-clock" title="Date et heure de la campagne"><GameDate time={gameTime} /></span>
        {scene?.weather && <span className="city-hub-weather">· {SCENE_WEATHER_LABEL[scene.weather]}</span>}
        <span className="port-purse">Bourse : <b><Coins money={money} /></b></span>
      </>}
    >
      <div className="city-hub-body">
        <MasterDetail
          className="city-hub-master"
          listLabel="Services du lieu"
          list={
            <div className="city-hub-services" role="listbox" aria-label="Services du lieu">
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
            <div className="city-hub-detail">
              {sel && <h3 className="city-hub-detail-head"><Icon id={serviceIcon(sel)} size="sm" /> {sel.label}</h3>}
              {detail}
            </div>
          }
        />
      </div>
    </ScreenShell>
  );
}
