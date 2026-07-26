/**
 * Panneau ROUTE de l'éditeur de carte du monde (#419) — extrait du monolithe `WorldMapEditor.tsx`
 * (règle 4 CLAUDE.md : 4 sections à plat → 2 onglets `Tabs`). « Trajet » (distance/sens/modes/prix/
 * vitesse + maritime), « Péripéties » (embuscade + péripéties d'auteur via EffectList). Zéro logique
 * métier déplacée : découpage JSX pur, coutures runtime intactes.
 */
import { useState } from 'react';
import { Tabs } from '../Tabs';
import { Icon } from '../Icon';
import { Scene } from '../../state/scene';
import { type WorldMap, type MapRoute, placeById } from '../../state/worldMap';
import { type TravelMode, TRAVEL_DEFAULTS, TRAVEL_VEHICLES, TRAVEL_MODE_LABEL, travelModeIcon } from '../../engine/travel';
import { EffectList, type Ctx } from './EffectList';
import { RefSelect } from './worldMapPickers';

export function WorldMapRoutePanel({ route, map, scenes, updRoute, effCtx, toggleMode }: {
  route: MapRoute;
  map: WorldMap;
  /** Toutes les scènes du projet (active + réserve) — pour lier embuscades/péripéties. */
  scenes: Scene[];
  updRoute: (id: string, patch: Partial<MapRoute>) => void;
  effCtx: Ctx;
  toggleMode: (r: MapRoute, mode: TravelMode) => void;
}) {
  const [routeTab, setRouteTab] = useState<'trajet' | 'peripeties'>('trajet');
  const ambushScene = route.ambush?.scene ? scenes.find((s) => s.id === route.ambush!.scene) : undefined;

  return (
    <>
      <Tabs
        tabs={[{ key: 'trajet', label: 'Trajet' }, { key: 'peripeties', label: 'Péripéties' }]}
        active={routeTab}
        onChange={setRouteTab}
        label="Onglets de la route"
      />
      {routeTab === 'trajet' && (
        <>
          <div className="mini-title">
            Route : {placeById(map, route.a)?.label} ↔ {placeById(map, route.b)?.label}
          </div>
          <label className="ed-field">Distance (km)
            <input type="number" min={1} value={route.km} onChange={(e) => updRoute(route.id, { km: Math.max(1, Number(e.target.value) || 1) })} />
          </label>
          <label className="ed-field">Sens (route à sens unique : n'est offerte que depuis ce lieu ; le retour passe par une autre route)
            <select
              value={route.from ?? ''}
              onChange={(e) => updRoute(route.id, { from: e.target.value || undefined })}
            >
              <option value="">— les deux sens —</option>
              <option value={route.a}>Depuis {placeById(map, route.a)?.label ?? route.a}</option>
              <option value={route.b}>Depuis {placeById(map, route.b)?.label ?? route.b}</option>
            </select>
          </label>
          <div className="mini-title">Modes de voyage</div>
          {(['pied', ...TRAVEL_VEHICLES.map((v) => v.id)] as TravelMode[]).map((mode) => (
            <label key={mode} className="ed-check">
              <input type="checkbox" checked={route.modes.includes(mode)} onChange={() => toggleMode(route, mode)} />
              <Icon id={travelModeIcon(mode)} /> {TRAVEL_MODE_LABEL[mode] ?? mode}
            </label>
          ))}
          {TRAVEL_VEHICLES.filter((v) => route.modes.includes(v.id)).map((v) => (
            <div key={v.id}>
              <label className="ed-field">{v.label} — prix (sous/km/passager, RAW : {v.travel!.classes.map((c) => `${c.label} ${c.brassPerKm}`).join(' / ')})
                <input
                  type="number" min={0} placeholder="défaut RAW par classe"
                  value={route.prices?.[v.id] ?? ''}
                  onChange={(e) => updRoute(route.id, { prices: { ...route.prices, [v.id]: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) } })}
                />
              </label>
              <label className="ed-field">{v.label} — Déplacement (km/h, RAW : {v.travel!.movement} ; ±1 modèle rapide/lent)
                <input
                  type="number" min={1} placeholder={String(v.travel!.movement)}
                  value={route.speed?.[v.id] ?? ''}
                  onChange={(e) => updRoute(route.id, { speed: { ...route.speed, [v.id]: e.target.value === '' ? undefined : Math.max(1, Number(e.target.value)) } })}
                />
              </label>
            </div>
          ))}
          <label className="ed-field">Péripétie : seuil du d10 (vide = défaut carte ; 0 = désactivé)
            <input
              type="number" min={0} max={10} placeholder={String(map.params?.perilDie ?? TRAVEL_DEFAULTS.perilDie)}
              value={route.perilDie ?? ''}
              onChange={(e) => updRoute(route.id, { perilDie: e.target.value === '' ? undefined : Math.max(0, Math.min(10, Number(e.target.value))) })}
            />
          </label>
          <label className="ed-check">
            <input
              type="checkbox"
              checked={route.inns ?? false}
              onChange={(e) => updRoute(route.id, { inns: e.target.checked || undefined })}
            />
            <Icon id="rest/bed" size="sm" /> Relais d'auberges (la halte de nuit propose l'auberge)
          </label>
          {/* ── Route MARITIME (MDG 13-15) : se voyage sur le navire de campagne (mode « mer »), km en milles ── */}
          <label className="ed-check">
            <input
              type="checkbox"
              checked={route.sea ?? false}
              onChange={(e) => updRoute(route.id, e.target.checked
                ? { sea: true, modes: ['mer'], seaHeading: route.seaHeading ?? 'est' }
                : { sea: undefined, seaHeading: undefined, modes: route.modes.filter((x) => x !== 'mer').length ? route.modes.filter((x) => x !== 'mer') : ['pied'] })}
            />
            <Icon id="travel/anchor" size="sm" /> Route maritime (navire de campagne ; distance en milles)
          </label>
          {route.sea && (
            <label className="ed-field">Cap dominant (aspect du vent, MDG 13 l.262-270)
              <select
                value={route.seaHeading ?? 'est'}
                onChange={(e) => updRoute(route.id, { seaHeading: e.target.value as MapRoute['seaHeading'] })}
              >
                {(['nord', 'sud', 'est', 'ouest'] as const).map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
          )}
        </>
      )}
      {routeTab === 'peripeties' && (
        <>
          <div className="mini-title">Embuscade (« Attaqués ! » de la table d10)</div>
          <RefSelect
            label="Scène d'embuscade (vide = narratif seul)"
            options={scenes}
            getId={(s) => s.id}
            getLabel={(s) => `${s.nom} (${s.id})`}
            value={route.ambush?.scene ?? ''}
            nullableLabel="— aucune —"
            onChange={(v) => updRoute(route.id, {
              ambush: v ? { scene: v, encounter: route.ambush?.encounter ?? '' } : undefined,
            })}
          />
          {route.ambush && (
            <>
              <RefSelect
                label="Rencontre déclenchée"
                options={ambushScene?.encounters ?? []}
                getId={(enc) => enc.id}
                getLabel={(enc) => enc.id}
                value={route.ambush.encounter}
                nullableLabel="— choisir —"
                onChange={(v) => updRoute(route.id, { ambush: { ...route.ambush!, encounter: v } })}
              />
              <label className="ed-field">Point d'entrée (optionnel)
                <input
                  value={route.ambush.entry ?? ''}
                  onChange={(e) => updRoute(route.id, { ambush: { ...route.ambush!, entry: e.target.value || undefined } })}
                />
              </label>
              {route.sea && (
                <label className="ed-field">Ancrage en mer (% de la route, défaut 50 %)
                  <input
                    type="number" min={0} max={100}
                    value={Math.round((route.ambush.at ?? 0.5) * 100)}
                    onChange={(e) => updRoute(route.id, { ambush: { ...route.ambush!, at: Math.max(0, Math.min(100, Number(e.target.value) || 0)) / 100 } })}
                  />
                </label>
              )}
            </>
          )}

          <div className="mini-title">Péripéties d'auteur (tirées chaque jour de voyage)</div>
          {(route.perils ?? []).map((peril, i) => (
            <div key={i} className="wme-peril">
              <label className="ed-field">Libellé
                <input
                  value={peril.label}
                  onChange={(e) => updRoute(route.id, { perils: route.perils!.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
                />
              </label>
              <label className="ed-field">Probabilité par jour (%)
                <input
                  type="number" min={0} max={100} value={peril.chancePct}
                  onChange={(e) => updRoute(route.id, { perils: route.perils!.map((x, j) => (j === i ? { ...x, chancePct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } : x)) })}
                />
              </label>
              <EffectList
                effects={peril.effects}
                ctx={effCtx}
                onChange={(effects) => updRoute(route.id, { perils: route.perils!.map((x, j) => (j === i ? { ...x, effects } : x)) })}
              />
              <button className="btn small" onClick={() => updRoute(route.id, { perils: route.perils!.filter((_, j) => j !== i) })}>
                <Icon id="ui/delete" size="sm" /> Retirer cette péripétie
              </button>
            </div>
          ))}
          <button
            className="btn small"
            onClick={() => updRoute(route.id, { perils: [...(route.perils ?? []), { label: 'Péripétie', chancePct: 10, effects: [] }] })}
          >
            + Péripétie d'auteur
          </button>
        </>
      )}
    </>
  );
}
