import { useRef, useState } from 'react';
import { Scene } from '../../state/scene';
import { WorldMap, MapPlace, MapRoute, emptyWorldMap, placeById } from '../../state/worldMap';
import { TravelMode, TRAVEL_DEFAULTS, TRANSPORTS } from '../../engine/travel';
import { EffectList } from './EffectList';

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
  };
  const ambushScene = selRoute?.ambush?.scene ? scenes.find((s) => s.id === selRoute.ambush!.scene) : undefined;

  const toggleMode = (r: MapRoute, mode: TravelMode) => {
    const modes = r.modes.includes(mode) ? r.modes.filter((x) => x !== mode) : [...r.modes, mode];
    updRoute(r.id, { modes: modes.length ? modes : ['pied'] });
  };

  return (
    <div className="wme-overlay">
      <header className="bar">
        <h3>🗺️ Carte du monde — {m.nom}</h3>
        <div className="editor-toolbar">
          <button className="btn small" onClick={() => addPlace({ x: 50, y: 50 })}>+ Lieu</button>
          <button
            className={`btn small ${linkFrom ? 'btn-primary' : ''}`}
            onClick={() => setLinkFrom(linkFrom ? null : selPlace?.id ?? m.places[0]?.id ?? null)}
            disabled={m.places.length < 2}
            title="Cliquez un 1ᵉʳ lieu (sélection), activez, puis cliquez le 2ᵉ lieu"
          >
            {linkFrom ? `Lier depuis « ${placeById(m, linkFrom)?.label} »… (cliquer le 2ᵉ lieu)` : '🔗 Lier deux lieux'}
          </button>
          <button className="btn small" onClick={deleteSelected} disabled={!sel}>🗑 Supprimer la sélection</button>
          <button className="btn small" onClick={() => { setMap(null); onClose(); }} title="Le projet n'offrira plus de voyage">
            Retirer la carte du projet
          </button>
          <button className="btn small btn-primary" onClick={() => { setMap(m); onClose(); }}>✓ Fermer</button>
        </div>
      </header>

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
                <text y="1.3" textAnchor="middle" fontSize="3.8">{p.icon ?? '📍'}</text>
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
              <label className="ed-field">Icône (emoji)
                <input value={selPlace.icon ?? ''} placeholder="📍" onChange={(e) => updPlace(selPlace.id, { icon: e.target.value || undefined })} />
              </label>
              <label className="ed-field">Scène liée
                <select value={selPlace.scene} onChange={(e) => updPlace(selPlace.id, { scene: e.target.value })}>
                  {scenes.map((s) => <option key={s.id} value={s.id}>{s.nom} ({s.id})</option>)}
                </select>
              </label>
              <label className="ed-field">Point d'entrée (entryPoints de la scène, optionnel)
                <input value={selPlace.entry ?? ''} onChange={(e) => updPlace(selPlace.id, { entry: e.target.value || undefined })} />
              </label>
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
              <div className="mini-title">Modes de voyage</div>
              {(['pied', 'diligence', 'barge'] as TravelMode[]).map((mode) => (
                <label key={mode} className="ed-check">
                  <input type="checkbox" checked={selRoute.modes.includes(mode)} onChange={() => toggleMode(selRoute, mode)} />
                  {mode === 'pied' ? '🦶 À pied' : mode === 'diligence' ? '🚌 Diligence' : '🛶 Barge'}
                </label>
              ))}
              {(['diligence', 'barge'] as const).filter((mode) => selRoute.modes.includes(mode)).map((mode) => (
                <div key={mode}>
                  <label className="ed-field">{mode === 'diligence' ? 'Diligence' : 'Barge'} — prix (sous/km/passager, RAW : {TRANSPORTS[mode].classes.map((c) => `${c.label} ${c.brassPerKm}`).join(' / ')})
                    <input
                      type="number" min={0} placeholder="défaut RAW par classe"
                      value={selRoute.prices?.[mode] ?? ''}
                      onChange={(e) => updRoute(selRoute.id, { prices: { ...selRoute.prices, [mode]: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) } })}
                    />
                  </label>
                  <label className="ed-field">{mode === 'diligence' ? 'Diligence' : 'Barge'} — Déplacement (km/h, RAW : {TRANSPORTS[mode].movement} ; ±1 modèle rapide/lent)
                    <input
                      type="number" min={1} placeholder={String(TRANSPORTS[mode].movement)}
                      value={selRoute.speed?.[mode] ?? ''}
                      onChange={(e) => updRoute(selRoute.id, { speed: { ...selRoute.speed, [mode]: e.target.value === '' ? undefined : Math.max(1, Number(e.target.value)) } })}
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
                    🗑 Retirer cette péripétie
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
    </div>
  );
}
