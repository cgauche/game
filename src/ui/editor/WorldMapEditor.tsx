import { useRef, useState } from 'react';
import { Scene } from '../../state/scene';
import { WorldMap, MapPlace, MapRoute, type PlacePoi, emptyWorldMap, placeById } from '../../state/worldMap';
import { TravelMode, TRAVEL_DEFAULTS, TRAVEL_VEHICLES, TRAVEL_MODE_LABEL, travelModeIcon } from '../../engine/travel';
import { LAND_CARGOES, LAND_RICHESSE_ROWS, type LandMarketProfile } from '../../engine/landCargo';
import { CARGOES, type PortProfile } from '../../engine/seaVoyage';
import { navalPorts, findNavalPortById, lieuxServices } from '../../data';
import { resolvePortRef } from '../../state/worldMap';
import { EffectList } from './EffectList';
import { Icon, IconG } from '../Icon';
import { ScreenShell } from '../ScreenShell';
import { Prose } from '../Prose';
import { MapCanvas } from '../MapCanvas';
import { planChrome } from '../PlanChrome';
import { VB_W, VB_H } from '../worldMapViewport';

/** Libellés des Tailles de communauté (T2C ch.11 l.44-50, indices 1-4). */
const TAILLE_LABELS = ['Hameau', 'Village', 'Ville', 'Grande ville'];
/** Produits d'un marché : les cargaisons du livre + les MARQUEURS « Commerce » / « Subsistance » (l.24-28). */
const MARKET_PRODUITS: readonly { id: string; label: string }[] = [
  ...LAND_CARGOES.map((c) => ({ id: c.id, label: c.label })),
  { id: 'commerce', label: 'Commerce (plaque tournante)' },
  { id: 'subsistance', label: 'Subsistance (rien à échanger)' },
];
/** Production d'un port (Index des ports, MDG ch.15 l.439-506) : cargaisons maritimes + les MARQUEURS
 *  « Commerce » (plaque tournante) / « Minimum vital » (rien à échanger). */
const PORT_PRODUITS: readonly { id: string; label: string }[] = [
  ...CARGOES.map((c) => ({ id: c.id, label: c.label })),
  { id: 'commerce', label: 'Commerce (plaque tournante)' },
  { id: 'minimum-vital', label: 'Minimum vital (rien à échanger)' },
];
/** Port MARITIME par défaut posé quand l'auteur coche « Port » (petit port de production côtière). */
const DEFAULT_PORT: PortProfile & { lighthouse?: boolean } = { taille: 2, richesse: 2, production: [] };

/**
 * Éditeur de la CARTE DU MONDE (#T2 Voyage) — overlay plein écran de l'éditeur de niveau.
 * Tout le voyage y est PARAMÉTRABLE (exigence) : lieux (position par glisser, scène liée, entrée,
 * icône), routes (km, modes, prix par mode, vitesse d'auteur, seuil d10 de péripétie, péripéties
 * d'auteur via EffectList, cible d'embuscade), paramètres de carte (heures/jour, marche forcée,
 * seuil d10 par défaut). Défauts = valeurs RAW citées dans `engine/travel.ts`.
 */
export function WorldMapEditor({ map, setMap, scenes, onClose }: {
  map: WorldMap | null;
  setMap: (m: WorldMap | null) => void;
  /** Toutes les scènes du projet (active + réserve) — pour lier lieux/embuscades. */
  scenes: Scene[];
  onClose: () => void;
}) {
  const m: WorldMap = map ?? emptyWorldMap();
  const [sel, setSel] = useState<{ kind: 'place' | 'route'; id: string } | null>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [poiSel, setPoiSel] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<string | null>(null); // lieu en cours de glisser (ref : voir « Pièges connus »)

  const upd = (patch: Partial<WorldMap>) => setMap({ ...m, ...patch });
  const updPlace = (id: string, patch: Partial<MapPlace>) =>
    upd({ places: m.places.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const updRoute = (id: string, patch: Partial<MapRoute>) =>
    upd({ routes: m.routes.map((r) => (r.id === id ? { ...r, ...patch } : r)) });

  /** Point écran → coordonnées carte (0-100 sur les deux axes ; rendu y × 0,64). */
  const toMapPos = (ev: React.PointerEvent | React.MouseEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const x = Math.max(2, Math.min(98, ((ev.clientX - r.left) / r.width) * 100));
    const y = Math.max(4, Math.min(96, ((ev.clientY - r.top) / r.height) * 100));
    return { x: Math.round(x), y: Math.round(y) };
  };

  const addPlace = (pos: { x: number; y: number }) => {
    // Décale les ajouts successifs au même point (bouton « + Lieu ») pour qu'ils restent saisissables.
    while (m.places.some((x) => Math.abs(x.pos.x - pos.x) < 4 && Math.abs(x.pos.y - pos.y) < 4)) {
      pos = { x: Math.min(96, pos.x + 8), y: pos.y };
    }
    const p: MapPlace = {
      id: `lieu-${Date.now().toString(36)}`,
      label: 'Nouveau lieu',
      pos,
      scene: scenes[0]?.id ?? '',
    };
    upd({ places: [...m.places, p] });
    setSel({ kind: 'place', id: p.id });
  };

  const clickPlace = (id: string) => {
    if (linkFrom && linkFrom !== id) {
      // Mode liaison : 2ᵉ lieu cliqué → route (si elle n'existe pas déjà).
      const exists = m.routes.some((r) => (r.a === linkFrom && r.b === id) || (r.a === id && r.b === linkFrom));
      if (!exists) {
        const route: MapRoute = { id: `route-${Date.now().toString(36)}`, a: linkFrom, b: id, km: 10, modes: ['pied'] };
        upd({ routes: [...m.routes, route] });
        setSel({ kind: 'route', id: route.id });
      }
      setLinkFrom(null);
      return;
    }
    setSel({ kind: 'place', id });
  };

  const deleteSelected = () => {
    if (!sel) return;
    if (sel.kind === 'place') {
      upd({
        places: m.places.filter((p) => p.id !== sel.id),
        routes: m.routes.filter((r) => r.a !== sel.id && r.b !== sel.id),
      });
    } else {
      upd({ routes: m.routes.filter((r) => r.id !== sel.id) });
    }
    setSel(null);
  };

  const selPlace = sel?.kind === 'place' ? m.places.find((p) => p.id === sel.id) : undefined;
  const selRoute = sel?.kind === 'route' ? m.routes.find((r) => r.id === sel.id) : undefined;
  // Contexte des effets de péripétie : rencontres/dialogues de TOUTES les scènes du projet.
  const effCtx = {
    encounters: scenes.flatMap((s) => s.encounters),
    dialogues: scenes.flatMap((s) => s.dialogues),
    // Selects guidés (M9) : transitions de péripétie vers les scènes du projet (le marchand,
    // lié à la scène COURANTE au moment du voyage, reste un id libre ici).
    scenes: scenes.map((sc) => ({ id: sc.id, nom: sc.nom, entries: Object.keys(sc.entryPoints ?? {}) })),
  };
  const ambushScene = selRoute?.ambush?.scene ? scenes.find((s) => s.id === selRoute.ambush!.scene) : undefined;

  const toggleMode = (r: MapRoute, mode: TravelMode) => {
    const modes = r.modes.includes(mode) ? r.modes.filter((x) => x !== mode) : [...r.modes, mode];
    updRoute(r.id, { modes: modes.length ? modes : ['pied'] });
  };

  return (
    <ScreenShell
      title={<><Icon id="nav/campaign" size="sm" /> Carte du monde — {m.nom}</>}
      onClose={() => { setMap(m); onClose(); }}
      className="wme-shell"
      actions={
        <>
          <button className="btn small" onClick={() => addPlace({ x: 50, y: 50 })}>+ Lieu</button>
          <button
            className={`btn small ${linkFrom ? 'btn-primary' : ''}`}
            onClick={() => setLinkFrom(linkFrom ? null : selPlace?.id ?? m.places[0]?.id ?? null)}
            disabled={m.places.length < 2}
            title="Cliquez un 1ᵉʳ lieu (sélection), activez, puis cliquez le 2ᵉ lieu"
          >
            {linkFrom ? `Lier depuis « ${placeById(m, linkFrom)?.label} »… (cliquer le 2ᵉ lieu)` : <><Icon id="coop/invite" size="sm" /> Lier deux lieux</>}
          </button>
          <button className="btn small" onClick={deleteSelected} disabled={!sel}><Icon id="ui/delete" size="sm" /> Supprimer la sélection</button>
          <button className="btn small" onClick={() => { setMap(null); onClose(); }} title="Le projet n'offrira plus de voyage">
            Retirer la carte du projet
          </button>
        </>
      }
    >
      <div className="wme-body">
        <div className="wme-canvas">
          <svg
            ref={svgRef}
            viewBox="0 0 100 64"
            preserveAspectRatio="xMidYMid meet"
            onDoubleClick={(ev) => addPlace(toMapPos(ev))}
            onPointerMove={(ev) => {
              if (dragRef.current) updPlace(dragRef.current, { pos: toMapPos(ev) });
            }}
            onPointerUp={() => { dragRef.current = null; }}
          >
            <rect x="0" y="0" width="100" height="64" rx="2" fill="#d9c28c" stroke="#7a5f38" strokeWidth="0.6" />
            {m.routes.map((r) => {
              const a = placeById(m, r.a);
              const b = placeById(m, r.b);
              if (!a || !b) return null;
              return (
                <g key={r.id} onClick={() => setSel({ kind: 'route', id: r.id })} style={{ cursor: 'pointer' }}>
                  {/* zone de clic large + trait visible */}
                  <line x1={a.pos.x} y1={a.pos.y * 0.64} x2={b.pos.x} y2={b.pos.y * 0.64} stroke="transparent" strokeWidth="3" />
                  <line
                    x1={a.pos.x} y1={a.pos.y * 0.64} x2={b.pos.x} y2={b.pos.y * 0.64}
                    stroke={sel?.kind === 'route' && sel.id === r.id ? '#8a2f1d' : '#6d4f24'}
                    strokeWidth={sel?.kind === 'route' && sel.id === r.id ? 1.2 : 0.7}
                    strokeDasharray="1.6 1.1"
                  />
                  <text x={(a.pos.x + b.pos.x) / 2} y={(a.pos.y + b.pos.y) / 2 * 0.64 - 1} textAnchor="middle" fontSize="2.6" fill="#5d4520">
                    {r.km} km
                  </text>
                </g>
              );
            })}
            {m.places.map((p) => (
              <g
                key={p.id}
                transform={`translate(${p.pos.x} ${p.pos.y * 0.64})`}
                style={{ cursor: 'grab' }}
                onPointerDown={(ev) => { ev.stopPropagation(); dragRef.current = p.id; clickPlace(p.id); }}
              >
                {sel?.kind === 'place' && sel.id === p.id && <circle r="3.6" fill="none" stroke="#1d6fb8" strokeWidth="0.5" />}
                {linkFrom === p.id && <circle r="3.6" fill="none" stroke="#8a2f1d" strokeWidth="0.5" strokeDasharray="1 0.7" />}
                {/* Icône LIBRE saisie par l'auteur (champ « Icône » ci-dessous, DONNÉE runtime — pas
                    un emoji en dur ici) ; à défaut, l'épingle du registre. */}
                {p.icon ? <text y="1.3" textAnchor="middle" fontSize="3.8" fill="var(--wm-ink)">{p.icon}</text> : <IconG id="map-tool/pin" x={-2} y={-1.6} size={4} />}
                <text y="5.6" textAnchor="middle" fontSize="2.6" fill="#3c2d14">{p.label}</text>
              </g>
            ))}
          </svg>
          <p className="hint">Double-clic : ajouter un lieu · glisser : déplacer · clic sur un trait : éditer la route.</p>
        </div>

        <aside className="wme-inspector">
          {/* ── Paramètres de carte (défauts RAW, tout paramétrable) ── */}
          {!sel && (
            <>
              <div className="mini-title">Carte</div>
              <label className="ed-field">Nom
                <input value={m.nom} onChange={(e) => upd({ nom: e.target.value })} />
              </label>
              <label className="ed-field">Image de fond — vraie carte (URL, chemin d'asset public, ou data URI)
                <input
                  value={m.background ?? ''}
                  placeholder="vide = parchemin + déchevauchement ; renseigné = vraie carte, lieux à leurs positions exactes"
                  onChange={(e) => upd({ background: e.target.value.trim() || undefined })}
                />
              </label>
              {m.background && (
                <img src={m.background} alt="Aperçu du fond de carte" style={{ maxWidth: '100%', maxHeight: 96, borderRadius: 6, border: '1px solid var(--border)', margin: '2px 0 6px' }} />
              )}
              <label className="ed-field">Heures de voyage/jour sans Test (RAW : 6)
                <input
                  type="number" min={1} max={24}
                  value={m.params?.hoursPerDay ?? TRAVEL_DEFAULTS.hoursPerDay}
                  onChange={(e) => upd({ params: { ...m.params, hoursPerDay: Number(e.target.value) || TRAVEL_DEFAULTS.hoursPerDay } })}
                />
              </label>
              <label className="ed-field">Plafond de marche forcée (h/jour)
                <input
                  type="number" min={1} max={24}
                  value={m.params?.forcedMaxHours ?? TRAVEL_DEFAULTS.forcedMaxHours}
                  onChange={(e) => upd({ params: { ...m.params, forcedMaxHours: Number(e.target.value) || TRAVEL_DEFAULTS.forcedMaxHours } })}
                />
              </label>
              <label className="ed-field">Péripétie : seuil du d10 quotidien (RAW : 8 ; 0 = désactivé)
                <input
                  type="number" min={0} max={10}
                  value={m.params?.perilDie ?? TRAVEL_DEFAULTS.perilDie}
                  onChange={(e) => upd({ params: { ...m.params, perilDie: Math.max(0, Math.min(10, Number(e.target.value) || 0)) } })}
                />
              </label>
            </>
          )}

          {/* ── Lieu sélectionné ── */}
          {selPlace && (
            <>
              <div className="mini-title">Lieu</div>
              <label className="ed-field">Nom
                <input value={selPlace.label} onChange={(e) => updPlace(selPlace.id, { label: e.target.value })} />
              </label>
              <label className="ed-field">Icône (emoji libre — vide = épingle par défaut)
                <input value={selPlace.icon ?? ''} placeholder="vide = épingle par défaut" onChange={(e) => updPlace(selPlace.id, { icon: e.target.value || undefined })} />
              </label>
              <label className="ed-field">Scène liée
                <select value={selPlace.scene} onChange={(e) => updPlace(selPlace.id, { scene: e.target.value })}>
                  {scenes.map((s) => <option key={s.id} value={s.id}>{s.nom} ({s.id})</option>)}
                </select>
              </label>
              <label className="ed-field">Point d'entrée (entryPoints de la scène, optionnel)
                <input value={selPlace.entry ?? ''} onChange={(e) => updPlace(selPlace.id, { entry: e.target.value || undefined })} />
              </label>

              {/* ── Marché de cargaison (Mort sur le Reik Compagnon ch.11) : Taille + Richesse + Produits ── */}
              <div className="mini-title">Marché (commerce de cargaison, T2C ch.11)</div>
              <label className="ed-check">
                <input
                  type="checkbox"
                  checked={!!selPlace.market}
                  onChange={(e) => updPlace(selPlace.id, { market: e.target.checked ? { taille: 2, richesse: 2, produits: [] } : undefined })}
                />
                <Icon id="merchant/cart" size="sm" /> Lieu de commerce (achat/vente de cargaison)
              </label>
              {selPlace.market && (() => {
                const mk = selPlace.market;
                const updMarket = (patch: Partial<LandMarketProfile>) => updPlace(selPlace.id, { market: { ...mk, ...patch } });
                return (
                  <>
                    <label className="ed-field">Taille de la communauté (l.44-50)
                      <select value={mk.taille} onChange={(e) => updMarket({ taille: Number(e.target.value) })}>
                        {TAILLE_LABELS.map((label, i) => <option key={i} value={i + 1}>{i + 1} — {label}</option>)}
                      </select>
                    </label>
                    <label className="ed-field">Richesse — Mise à prix (l.150-156)
                      <select value={mk.richesse} onChange={(e) => updMarket({ richesse: Number(e.target.value) })}>
                        {LAND_RICHESSE_ROWS.map((r) => (
                          <option key={r.richesse} value={r.richesse}>{r.richesse} — {r.label} ({r.pct >= 0 ? '+' : ''}{r.pct} %)</option>
                        ))}
                      </select>
                    </label>
                    <div className="mini-title">Produits (colonne Produits, l.24-28)</div>
                    {MARKET_PRODUITS.map((p) => (
                      <label key={p.id} className="ed-check">
                        <input
                          type="checkbox"
                          checked={mk.produits.includes(p.id)}
                          onChange={() => updMarket({ produits: mk.produits.includes(p.id) ? mk.produits.filter((x) => x !== p.id) : [...mk.produits, p.id] })}
                        />
                        {p.label}
                      </label>
                    ))}
                    <label className="ed-field">Vin supérieur : bonus de qualité (échelons, l.95 — Kemperbad : 2)
                      <input
                        type="number" min={0} max={5} placeholder="0"
                        value={mk.wineBonusEchelons ?? ''}
                        onChange={(e) => updMarket({ wineBonusEchelons: e.target.value === '' ? undefined : Math.max(0, Math.min(5, Number(e.target.value))) })}
                      />
                    </label>
                  </>
                );
              })()}

              {/* ── Port maritime (Index des ports, MDG ch.15) : Taille + Richesse + Production/Surplus/Demande ── */}
              <div className="mini-title">Port maritime (commerce d'escale, MDG ch.15)</div>
              <label className="ed-check">
                <input
                  type="checkbox"
                  checked={!!selPlace.port}
                  onChange={(e) => updPlace(selPlace.id, { port: e.target.checked ? { ...DEFAULT_PORT } : undefined })}
                />
                <Icon id="travel/anchor" size="sm" /> Port maritime (accostage, commerce, chantier)
              </label>
              {selPlace.port && (() => {
                const pt = selPlace.port;
                const updPort = (patch: Partial<PortProfile & { lighthouse?: boolean; ref?: string }>) =>
                  updPlace(selPlace.id, { port: { ...pt, ...patch } });
                // Bascule d'une clé d'un Record<id, indice> (Surplus/Demande) : cocher = indice 1, décocher = retirer la clé.
                const toggleTable = (key: 'surplus' | 'demande', id: string) => {
                  const tbl = { ...(pt[key] ?? {}) };
                  if (id in tbl) delete tbl[id]; else tbl[id] = 1;
                  updPort({ [key]: Object.keys(tbl).length ? tbl : undefined });
                };
                const setTableLevel = (key: 'surplus' | 'demande', id: string, lvl: number) =>
                  updPort({ [key]: { ...(pt[key] ?? {}), [id]: Math.max(1, lvl) } });
                return (
                  <>
                    <label className="ed-field">Port du catalogue (Index des ports, #217 — optionnel)
                      <select
                        value={pt.ref ?? ''}
                        onChange={(e) => {
                          const ref = e.target.value || undefined;
                          if (!ref) { updPort({ ref: undefined }); return; }
                          // Choisir une réf REMPLACE le profil par celui du catalogue (seul lighthouse,
                          // hors catalogue, est préservé) — pas les défauts d'auteur pré-résolution (#217).
                          const resolved = resolvePortRef({ ref, lighthouse: pt.lighthouse });
                          updPlace(selPlace.id, { port: resolved });
                        }}
                      >
                        <option value="">— aucun (port d'auteur) —</option>
                        {navalPorts.map((p) => <option key={p.id} value={p.id}>{p.label} ({p.region})</option>)}
                      </select>
                    </label>
                    {pt.ref && (() => {
                      const def = findNavalPortById(pt.ref);
                      return def ? (
                        <div className="ed-hint">
                          Résolu du catalogue : Taille {def.taille}, Richesse {def.richesse}
                          {def.dirigeant ? ` — ${def.dirigeant}` : ''}
                          {def.desc ? <> — <Prose md={def.desc} /></> : null}
                        </div>
                      ) : null;
                    })()}
                    <label className="ed-field">Taille du port (1-4, l.439-506)
                      <select value={pt.taille} onChange={(e) => updPort({ taille: Number(e.target.value) })}>
                        {TAILLE_LABELS.map((label, i) => <option key={i} value={i + 1}>{i + 1} — {label}</option>)}
                      </select>
                    </label>
                    <label className="ed-field">Richesse du port
                      <select value={pt.richesse} onChange={(e) => updPort({ richesse: Number(e.target.value) })}>
                        {LAND_RICHESSE_ROWS.map((r) => (
                          <option key={r.richesse} value={r.richesse}>{r.richesse} — {r.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="ed-check">
                      <input type="checkbox" checked={!!pt.cosmopolite} onChange={(e) => updPort({ cosmopolite: e.target.checked || undefined })} />
                      <Icon id="travel/world" size="sm" /> Grand port cosmopolite (Marienburg/Lothern, l.343 — marchands supérieurs)
                    </label>
                    <label className="ed-check">
                      <input type="checkbox" checked={!!pt.lighthouse} onChange={(e) => updPort({ lighthouse: e.target.checked || undefined })} />
                      <Icon id="travel/lighthouse" size="sm" /> Phare à l'approche (Test de Perception de vigie à l'atterrage, MDG ch.13 l.333-351)
                    </label>
                    <div className="mini-title">Production (colonne Produits de l'Index)</div>
                    {PORT_PRODUITS.map((p) => (
                      <label key={p.id} className="ed-check">
                        <input
                          type="checkbox"
                          checked={pt.production.includes(p.id)}
                          onChange={() => updPort({ production: pt.production.includes(p.id) ? pt.production.filter((x) => x !== p.id) : [...pt.production, p.id] })}
                        />
                        {p.label}
                      </label>
                    ))}
                    <div className="mini-title">Surplus (le port en regorge → vente locale facilitée)</div>
                    {CARGOES.map((c) => (
                      <label key={c.id} className="ed-check">
                        <input type="checkbox" checked={c.id in (pt.surplus ?? {})} onChange={() => toggleTable('surplus', c.id)} />
                        {c.label}
                        {c.id in (pt.surplus ?? {}) && (
                          <input
                            type="number" min={1} max={3} style={{ width: '3.2em', marginLeft: '0.4em' }}
                            value={pt.surplus![c.id]}
                            onChange={(e) => setTableLevel('surplus', c.id, Number(e.target.value) || 1)}
                          />
                        )}
                      </label>
                    ))}
                    <div className="mini-title">Demande (le port en manque → meilleur prix d'offre)</div>
                    {CARGOES.map((c) => (
                      <label key={c.id} className="ed-check">
                        <input type="checkbox" checked={c.id in (pt.demande ?? {})} onChange={() => toggleTable('demande', c.id)} />
                        {c.label}
                        {c.id in (pt.demande ?? {}) && (
                          <input
                            type="number" min={1} max={3} style={{ width: '3.2em', marginLeft: '0.4em' }}
                            value={pt.demande![c.id]}
                            onChange={(e) => setTableLevel('demande', c.id, Number(e.target.value) || 1)}
                          />
                        )}
                      </label>
                    ))}
                  </>
                );
              })()}

              {/* ── Services du lieu (auberge/temple/forgeron/guilde…, catalogue lieux-services.json #343) ── */}
              <div className="mini-title">Services du lieu (hub, #343)</div>
              {lieuxServices.map((sv) => {
                const has = (selPlace.services ?? []).some((s) => s.kind === sv.id);
                return (
                  <label key={sv.id} className="ed-check">
                    <input
                      type="checkbox"
                      checked={has}
                      onChange={() => {
                        const cur = selPlace.services ?? [];
                        const next = has ? cur.filter((s) => s.kind !== sv.id) : [...cur, { kind: sv.id }];
                        updPlace(selPlace.id, { services: next.length ? next : undefined });
                      }}
                    />
                    {sv.icon && <Icon id={sv.icon} size="sm" />} {sv.label}
                  </label>
                );
              })}
              <p className="ed-hint">L'auberge dérive aussi de l'offre de repos de la scène liée (onglet Scène) : inutile de la cocher ici si la scène l'offre déjà.</p>

              {/* ── POI du plan de ce lieu (onglet Plan du hub, #345 phase 5) ── */}
              <div className="mini-title">Points d'intérêt du plan (onglet Plan du hub)</div>
              {(() => {
                const poiList = selPlace.poi ?? [];
                const activePoiId = poiList.some((p) => p.id === poiSel) ? poiSel : null;
                const updPoi = (id: string, patch: Partial<PlacePoi>) =>
                  updPlace(selPlace.id, { poi: poiList.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
                return (
                  <>
                    {poiList.map((poi) => (
                      <div key={poi.id} className={`wme-poi${activePoiId === poi.id ? ' active' : ''}`}>
                        <label className="ed-field">Libellé
                          <input value={poi.label} onChange={(e) => updPoi(poi.id, { label: e.target.value })} />
                        </label>
                        <label className="ed-field">Icône (id du registre `src/ui/icons`, vide = épingle par défaut)
                          <input value={poi.icon ?? ''} placeholder="vide = épingle par défaut" onChange={(e) => updPoi(poi.id, { icon: e.target.value || undefined })} />
                        </label>
                        <label className="ed-field">Cible (scène OU service, exclusif)
                          <select
                            value={poi.sceneId != null ? 'scene' : poi.serviceKind != null ? 'service' : ''}
                            onChange={(e) => {
                              if (e.target.value === 'scene') updPoi(poi.id, { sceneId: scenes[0]?.id ?? '', serviceKind: undefined });
                              else if (e.target.value === 'service') updPoi(poi.id, { serviceKind: lieuxServices[0]?.id ?? '', sceneId: undefined });
                              else updPoi(poi.id, { sceneId: undefined, serviceKind: undefined });
                            }}
                          >
                            <option value="">— choisir —</option>
                            <option value="scene">Scène du projet</option>
                            <option value="service">Service (catalogue)</option>
                          </select>
                        </label>
                        {poi.sceneId != null && (
                          <label className="ed-field">Scène
                            <select value={poi.sceneId} onChange={(e) => updPoi(poi.id, { sceneId: e.target.value })}>
                              {scenes.map((s) => <option key={s.id} value={s.id}>{s.nom} ({s.id})</option>)}
                            </select>
                          </label>
                        )}
                        {poi.serviceKind != null && (
                          <label className="ed-field">Service
                            <select value={poi.serviceKind} onChange={(e) => updPoi(poi.id, { serviceKind: e.target.value })}>
                              {lieuxServices.map((sv) => <option key={sv.id} value={sv.id}>{sv.label}</option>)}
                            </select>
                          </label>
                        )}
                        <div className="bar">
                          <button
                            type="button"
                            className={`btn small${activePoiId === poi.id ? ' btn-primary' : ''}`}
                            onClick={() => setPoiSel(activePoiId === poi.id ? null : poi.id)}
                          >
                            {activePoiId === poi.id ? 'Cliquez le plan pour placer…' : 'Placer sur le plan'}
                          </button>
                          <button type="button" className="btn small" onClick={() => { const next = poiList.filter((x) => x.id !== poi.id); updPlace(selPlace.id, { poi: next.length ? next : undefined }); if (activePoiId === poi.id) setPoiSel(null); }}>
                            <Icon id="ui/delete" size="sm" /> Retirer ce POI
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => {
                        const id = `poi-${Date.now().toString(36)}`;
                        const p: PlacePoi = { id, label: 'Nouveau point', pos: { x: 50, y: 50 } };
                        updPlace(selPlace.id, { poi: [...poiList, p] });
                        setPoiSel(id);
                      }}
                    >
                      + Point d'intérêt
                    </button>
                    <div className="wme-poi-plan">
                      <MapCanvas
                        ariaLabel="Aperçu de placement des POI"
                        computeFit={() => ({ z: 1, panX: 0, panY: 0 })}
                        chrome={planChrome()}
                        markers={poiList.map((poi) => ({
                          id: poi.id,
                          x: poi.pos.x,
                          y: poi.pos.y * (VB_H / 100),
                          selected: activePoiId === poi.id,
                          cursor: 'default',
                          children: (
                            <>
                              <circle r="1.5" fill="var(--wm-badge-bg)" stroke="var(--wm-age-spot)" strokeWidth="0.22" />
                              <g style={{ color: 'var(--wm-marker-icon)' }}>
                                <IconG id={poi.icon ?? 'nav/entry-point'} x={-1.05} y={-1.05} size={2.1} />
                              </g>
                            </>
                          ),
                        }))}
                        onBackgroundClick={activePoiId ? (p) => {
                          const pos = { x: Math.round((p.x / VB_W) * 100), y: Math.round((p.y / VB_H) * 100) };
                          updPoi(activePoiId, { pos });
                        } : undefined}
                      />
                      <p className="hint">{activePoiId ? 'Cliquez le plan pour placer le POI sélectionné.' : 'Sélectionnez « Placer sur le plan » sur un POI, puis cliquez ce plan.'}</p>
                    </div>
                  </>
                );
              })()}
            </>
          )}

          {/* ── Route sélectionnée ── */}
          {selRoute && (
            <>
              <div className="mini-title">
                Route : {placeById(m, selRoute.a)?.label} ↔ {placeById(m, selRoute.b)?.label}
              </div>
              <label className="ed-field">Distance (km)
                <input type="number" min={1} value={selRoute.km} onChange={(e) => updRoute(selRoute.id, { km: Math.max(1, Number(e.target.value) || 1) })} />
              </label>
              <label className="ed-field">Sens (route à sens unique : n'est offerte que depuis ce lieu ; le retour passe par une autre route)
                <select
                  value={selRoute.from ?? ''}
                  onChange={(e) => updRoute(selRoute.id, { from: e.target.value || undefined })}
                >
                  <option value="">— les deux sens —</option>
                  <option value={selRoute.a}>Depuis {placeById(m, selRoute.a)?.label ?? selRoute.a}</option>
                  <option value={selRoute.b}>Depuis {placeById(m, selRoute.b)?.label ?? selRoute.b}</option>
                </select>
              </label>
              <div className="mini-title">Modes de voyage</div>
              {(['pied', ...TRAVEL_VEHICLES.map((v) => v.id)] as TravelMode[]).map((mode) => (
                <label key={mode} className="ed-check">
                  <input type="checkbox" checked={selRoute.modes.includes(mode)} onChange={() => toggleMode(selRoute, mode)} />
                  <Icon id={travelModeIcon(mode)} /> {TRAVEL_MODE_LABEL[mode] ?? mode}
                </label>
              ))}
              {TRAVEL_VEHICLES.filter((v) => selRoute.modes.includes(v.id)).map((v) => (
                <div key={v.id}>
                  <label className="ed-field">{v.label} — prix (sous/km/passager, RAW : {v.travel!.classes.map((c) => `${c.label} ${c.brassPerKm}`).join(' / ')})
                    <input
                      type="number" min={0} placeholder="défaut RAW par classe"
                      value={selRoute.prices?.[v.id] ?? ''}
                      onChange={(e) => updRoute(selRoute.id, { prices: { ...selRoute.prices, [v.id]: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) } })}
                    />
                  </label>
                  <label className="ed-field">{v.label} — Déplacement (km/h, RAW : {v.travel!.movement} ; ±1 modèle rapide/lent)
                    <input
                      type="number" min={1} placeholder={String(v.travel!.movement)}
                      value={selRoute.speed?.[v.id] ?? ''}
                      onChange={(e) => updRoute(selRoute.id, { speed: { ...selRoute.speed, [v.id]: e.target.value === '' ? undefined : Math.max(1, Number(e.target.value)) } })}
                    />
                  </label>
                </div>
              ))}
              <label className="ed-field">Péripétie : seuil du d10 (vide = défaut carte ; 0 = désactivé)
                <input
                  type="number" min={0} max={10} placeholder={String(m.params?.perilDie ?? TRAVEL_DEFAULTS.perilDie)}
                  value={selRoute.perilDie ?? ''}
                  onChange={(e) => updRoute(selRoute.id, { perilDie: e.target.value === '' ? undefined : Math.max(0, Math.min(10, Number(e.target.value))) })}
                />
              </label>
              <label className="ed-check">
                <input
                  type="checkbox"
                  checked={selRoute.inns ?? false}
                  onChange={(e) => updRoute(selRoute.id, { inns: e.target.checked || undefined })}
                />
                <Icon id="rest/bed" size="sm" /> Relais d'auberges (la halte de nuit propose l'auberge)
              </label>
              {/* ── Route MARITIME (MDG ch.13-15) : se voyage sur le navire de campagne (mode « mer »), km en milles ── */}
              <label className="ed-check">
                <input
                  type="checkbox"
                  checked={selRoute.sea ?? false}
                  onChange={(e) => updRoute(selRoute.id, e.target.checked
                    ? { sea: true, modes: ['mer'] }
                    : { sea: undefined, seaHeading: undefined, modes: selRoute.modes.filter((x) => x !== 'mer').length ? selRoute.modes.filter((x) => x !== 'mer') : ['pied'] })}
                />
                <Icon id="travel/anchor" size="sm" /> Route maritime (navire de campagne ; distance en milles)
              </label>
              {selRoute.sea && (
                <label className="ed-field">Cap dominant (aspect du vent, MDG ch.13 l.262-270)
                  <select
                    value={selRoute.seaHeading ?? 'ouest'}
                    onChange={(e) => updRoute(selRoute.id, { seaHeading: e.target.value as MapRoute['seaHeading'] })}
                  >
                    {(['nord', 'sud', 'est', 'ouest'] as const).map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </label>
              )}

              <div className="mini-title">Embuscade (« Attaqués ! » de la table d10)</div>
              <label className="ed-field">Scène d'embuscade (vide = narratif seul)
                <select
                  value={selRoute.ambush?.scene ?? ''}
                  onChange={(e) => updRoute(selRoute.id, {
                    ambush: e.target.value ? { scene: e.target.value, encounter: selRoute.ambush?.encounter ?? '' } : undefined,
                  })}
                >
                  <option value="">— aucune —</option>
                  {scenes.map((s) => <option key={s.id} value={s.id}>{s.nom} ({s.id})</option>)}
                </select>
              </label>
              {selRoute.ambush && (
                <>
                  <label className="ed-field">Rencontre déclenchée
                    <select
                      value={selRoute.ambush.encounter}
                      onChange={(e) => updRoute(selRoute.id, { ambush: { ...selRoute.ambush!, encounter: e.target.value } })}
                    >
                      <option value="">— choisir —</option>
                      {(ambushScene?.encounters ?? []).map((enc) => <option key={enc.id} value={enc.id}>{enc.id}</option>)}
                    </select>
                  </label>
                  <label className="ed-field">Point d'entrée (optionnel)
                    <input
                      value={selRoute.ambush.entry ?? ''}
                      onChange={(e) => updRoute(selRoute.id, { ambush: { ...selRoute.ambush!, entry: e.target.value || undefined } })}
                    />
                  </label>
                  {selRoute.sea && (
                    <label className="ed-field">Ancrage en mer (% de la route, défaut 50 %)
                      <input
                        type="number" min={0} max={100}
                        value={Math.round((selRoute.ambush.at ?? 0.5) * 100)}
                        onChange={(e) => updRoute(selRoute.id, { ambush: { ...selRoute.ambush!, at: Math.max(0, Math.min(100, Number(e.target.value) || 0)) / 100 } })}
                      />
                    </label>
                  )}
                </>
              )}

              <div className="mini-title">Péripéties d'auteur (tirées chaque jour de voyage)</div>
              {(selRoute.perils ?? []).map((peril, i) => (
                <div key={i} className="wme-peril">
                  <label className="ed-field">Libellé
                    <input
                      value={peril.label}
                      onChange={(e) => updRoute(selRoute.id, { perils: selRoute.perils!.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
                    />
                  </label>
                  <label className="ed-field">Probabilité par jour (%)
                    <input
                      type="number" min={0} max={100} value={peril.chancePct}
                      onChange={(e) => updRoute(selRoute.id, { perils: selRoute.perils!.map((x, j) => (j === i ? { ...x, chancePct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } : x)) })}
                    />
                  </label>
                  <EffectList
                    effects={peril.effects}
                    ctx={effCtx}
                    onChange={(effects) => updRoute(selRoute.id, { perils: selRoute.perils!.map((x, j) => (j === i ? { ...x, effects } : x)) })}
                  />
                  <button className="btn small" onClick={() => updRoute(selRoute.id, { perils: selRoute.perils!.filter((_, j) => j !== i) })}>
                    <Icon id="ui/delete" size="sm" /> Retirer cette péripétie
                  </button>
                </div>
              ))}
              <button
                className="btn small"
                onClick={() => updRoute(selRoute.id, { perils: [...(selRoute.perils ?? []), { label: 'Péripétie', chancePct: 10, effects: [] }] })}
              >
                + Péripétie d'auteur
              </button>
            </>
          )}
        </aside>
      </div>
    </ScreenShell>
  );
}
