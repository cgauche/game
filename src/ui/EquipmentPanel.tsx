import { useGame } from '../state/store';
import type { Combatant, HitLocation, ItemInstance } from '../engine/types';
import { armourLayer, isCapeItem, weaponHands, compatibleAmmo, WEAPON_SET_NAMES, type ArmourLayer } from '../engine/items';
import { RigSprite } from '../gameIso/rig/composeRig';
import { DEFS } from '../gameIso/sprites';
import { defaultAppearance } from '../gameIso/rig/appearance';
import { equipFromCombatant } from '../gameIso/rig/parts/equipment';
import { combatantAppearance, combatantOverlays } from '../gameIso/rig/parts/combatantVisuals';
import { CodexRef } from './compendium/CodexRef';

/**
 * Écran d'EMPLACEMENTS d'équipement (onglet Combat de la fiche) — façon jeu vidéo : mannequin
 * (rig live) au centre, zones d'armure Tête/Bras/Corps/Jambes à 3 COUCHES (LDB 63 : cuir souple
 * sous tout ; Flexible sous la couche rigide — les PA des couches rigide+Flexible se cumulent),
 * emplacement Cape (cosmétique) et DEUX sets d'armes fixes (Set I / Set II). Équiper une pièce
 * retire automatiquement celle de même couche au même endroit (échange, journalisé par le store).
 */

/** Zones de la fiche → localisations WFRP4. `apLoc` = localisation représentative pour le PA affiché. */
const ZONES: { label: string; locs: HitLocation[]; apLoc: HitLocation }[] = [
  { label: 'Tête', locs: ['tete'], apLoc: 'tete' },
  { label: 'Bras', locs: ['brasG', 'brasD'], apLoc: 'brasG' },
  { label: 'Corps', locs: ['corps'], apLoc: 'corps' },
  { label: 'Jambes', locs: ['jambeG', 'jambeD'], apLoc: 'jambeG' },
];
const ZONE_OF_LOC: Partial<Record<HitLocation, string>> = { tete: 'Tête', brasG: 'Bras', brasD: 'Bras', corps: 'Corps', jambeG: 'Jambes', jambeD: 'Jambes' };

/** Couches affichées de HAUT en BAS (extérieure d'abord — c'est elle qu'on voit sur le mannequin). */
const LAYERS: { key: ArmourLayer; label: string; hint: string }[] = [
  { key: 'rigide', label: 'Extérieure', hint: 'Couche rigide (cuir bouilli, plate…) — une seule pièce par zone.' },
  { key: 'flexible', label: 'Flexible', hint: 'Mailles (Flexible) : portée sous une couche non Flexible, les PA des deux se cumulent (LDB 63).' },
  { key: 'souple', label: 'Souple', hint: 'Cuir souple : porté sans pénalité sous n’importe quelle autre armure (LDB 63) — PA non cumulés sous une autre couche.' },
];

/** Zones couvertes par une pièce, pour l'indicateur multi-zones (« 🔗 Bras+Corps »). */
function zonesOf(it: ItemInstance): string[] {
  const seen: string[] = [];
  for (const l of it.locs ?? []) {
    const z = ZONE_OF_LOC[l];
    if (z && !seen.includes(z)) seen.push(z);
  }
  return seen;
}

function pieceTitle(it: ItemInstance): string {
  return [
    `PA ${it.pa ?? 0}`,
    `couche ${armourLayer(it)}`,
    zonesOf(it).join(' + '),
    ...(it.qualities.length ? [it.qualities.join(', ')] : []),
  ].join(' · ');
}

/** Sélecteur « + Équiper » d'une couche : pièces du sac (non portées) de cette couche couvrant la zone. */
function LayerPicker({ candidates, disabled, title, onEquip }: {
  candidates: ItemInstance[];
  disabled: boolean;
  title?: string;
  onEquip: (uid: string) => void;
}) {
  return (
    <select className="eq-pick" value="" disabled={disabled} title={title} onChange={(e) => e.target.value && onEquip(e.target.value)}>
      <option value="">+ Équiper…</option>
      {candidates.map((it) => (
        <option key={it.uid} value={it.uid}>
          {it.name} · PA {it.pa ?? 0}{(it.locs?.length ?? 0) > 1 ? ` · ${zonesOf(it).join('+')}` : ''}
        </option>
      ))}
    </select>
  );
}

export function EquipmentPanel({ hero }: { hero: Combatant }) {
  const toggleEquip = useGame((s) => s.toggleEquip);
  const setWeaponSetSlot = useGame((s) => s.setWeaponSetSlot);
  const activateWeaponSet = useGame((s) => s.activateWeaponSet);
  const setActiveLoadout = useGame((s) => s.setActiveLoadout);
  const deleteLoadout = useGame((s) => s.deleteLoadout);
  const inBattle = useGame((s) => !!s.battle);
  const lockTitle = inBattle ? 'Équipement verrouillé en combat (changez de set depuis la barre d’action)' : undefined;

  const items = hero.items ?? [];
  const armours = items.filter((i) => i.kind === 'armor' && (i.locs?.length ?? 0) > 0);
  const capes = items.filter(isCapeItem);
  const wornCape = capes.find((i) => i.equipped);
  const weapons = items.filter((i) => (i.kind === 'melee' || i.kind === 'ranged') && !i.destroyed);
  const oneHanded = weapons.filter((w) => weaponHands(w) === 1);

  // Mannequin : MÊME recette que le token de jeu (pickBackend) — apparence enrichie des
  // mutations/blessures + équipement dérivé (couche visible déjà triée par equipFromCombatant).
  const appearance = combatantAppearance(hero.appearance ?? defaultAppearance(hero), hero);
  const equip = equipFromCombatant(hero);

  const activeWeapons = hero.weapons.filter((w) => w.name !== 'Mains nues');

  return (
    <div className="equip-panel">
      <div className="equip-doll" title="Aperçu du héros avec l’équipement porté (la couche du dessus s’affiche : plate sur maille sur cuir)">
        <svg viewBox="0 0 120 150" className="equip-figure">
          <defs dangerouslySetInnerHTML={{ __html: DEFS }} />
          <rect x={0} y={0} width={120} height={150} fill="#1d2230" rx={6} />
          <RigSprite appearance={appearance} equip={equip} career={hero.career} overlays={combatantOverlays(hero)} />
        </svg>
        {/* Emplacement Cape sous le mannequin (cosmétique — l'aperçu est juste au-dessus) */}
        <div className="equip-zone equip-cape">
          <div className="eq-zone-head">
            <span className="eq-zone-name">Cape</span>
            <span className="eq-ap" title="Purement cosmétique — aucun effet de règles">✨</span>
          </div>
          {wornCape ? (
            <div className="eq-piece" title="Cape portée (visible dans le dos du héros)">
              <span className="eq-piece-name"><CodexRef category="trappings" label={wornCape.name}>{wornCape.name}</CodexRef></span>
              <button className="btn small" disabled={inBattle} title={lockTitle ?? 'Retirer'} onClick={() => toggleEquip(hero.id, wornCape.uid)}>✕</button>
            </div>
          ) : capes.length ? (
            <LayerPicker candidates={capes} disabled={inBattle} title={lockTitle} onEquip={(uid) => toggleEquip(hero.id, uid)} />
          ) : (
            <span className="muted">— aucune cape dans le sac —</span>
          )}
        </div>
      </div>

      <div className="equip-zones">
        {ZONES.map((z) => {
          const covering = armours.filter((i) => (i.locs ?? []).some((l) => z.locs.includes(l)));
          const ap = hero.armour[z.apLoc];
          return (
            <div className="equip-zone" key={z.label}>
              <div className="eq-zone-head">
                <span className="eq-zone-name">{z.label}</span>
                <span className={`eq-ap ${ap > 0 ? 'on' : ''}`} title="Points d'Armure de la zone (couches rigide + Flexible cumulées, mutations comprises)">PA {ap}</span>
              </div>
              {covering.length === 0 ? (
                <span className="muted">— rien à porter —</span>
              ) : (
                LAYERS.map((layer) => {
                  const worn = covering.find((i) => i.equipped && armourLayer(i) === layer.key);
                  const candidates = covering.filter((i) => !i.equipped && armourLayer(i) === layer.key);
                  if (!worn && !candidates.length) return null;
                  return (
                    <div className="eq-layer" key={layer.key} title={layer.hint}>
                      <span className="eq-layer-name">{layer.label}</span>
                      {worn ? (
                        <div className="eq-piece" title={pieceTitle(worn)}>
                          <span className="eq-piece-name">
                            <CodexRef category="trappings" label={worn.name}>{worn.name}</CodexRef>
                            {zonesOf(worn).length > 1 && <em className="eq-multi" title={`Cette pièce couvre : ${zonesOf(worn).join(' + ')}`}> 🔗</em>}
                          </span>
                          <span className="eq-piece-pa">PA {Math.max(0, (worn.pa ?? 0) - (worn.damageTaken ?? 0))}</span>
                          <button className="btn small" disabled={inBattle} title={lockTitle ?? 'Retirer'} onClick={() => toggleEquip(hero.id, worn.uid)}>✕</button>
                        </div>
                      ) : (
                        <LayerPicker candidates={candidates} disabled={inBattle} title={lockTitle} onEquip={(uid) => toggleEquip(hero.id, uid)} />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>

      <div className="equip-sets">
        <div className="mini-title">Sets d'armes</div>
        {WEAPON_SET_NAMES.map((name, idx) => {
          const lo = hero.loadouts?.[idx];
          const active = !!lo && hero.activeLoadoutId === lo.id;
          const mainItem = weapons.find((w) => w.uid === lo?.main);
          const mainTwoHanded = mainItem ? weaponHands(mainItem) === 2 : false;
          return (
            <div key={name} className={`loadout-row ${active ? 'active' : ''}`}>
              <button
                className={`btn small ${active ? 'btn-primary' : ''}`}
                disabled={inBattle}
                title={lockTitle ?? 'Rendre ce set actif (armes en main)'}
                onClick={() => activateWeaponSet(hero.id, idx)}
              >
                {active ? '● Actif' : 'Activer'}
              </button>
              <span className="lo-name">{lo?.name ?? name}</span>
              <label className="lo-slot">Main
                <select value={lo?.main ?? ''} disabled={inBattle} title={lockTitle} onChange={(e) => setWeaponSetSlot(hero.id, idx, 'main', e.target.value || null)}>
                  <option value="">— vide —</option>
                  {weapons.map((w) => (
                    <option key={w.uid} value={w.uid}>{w.name}{weaponHands(w) === 2 ? ' (2M)' : ''}</option>
                  ))}
                </select>
              </label>
              <label className="lo-slot">2nde
                <select value={lo?.off ?? ''} disabled={inBattle || mainTwoHanded} title={lockTitle} onChange={(e) => setWeaponSetSlot(hero.id, idx, 'off', e.target.value || null)}>
                  <option value="">{mainTwoHanded ? '— (2 mains) —' : '— vide —'}</option>
                  {oneHanded.filter((w) => w.uid !== lo?.main).map((w) => (
                    <option key={w.uid} value={w.uid}>{w.name}</option>
                  ))}
                </select>
              </label>
            </div>
          );
        })}
        {/* Sets au-delà des 2 fixes : soit une ARME INVOQUÉE (op conjureWeapon) — auto-gérée (créée à
            l'incantation, retirée à l'expiration), NON supprimable ; soit un set personnalisé supprimable. */}
        {(hero.loadouts ?? []).slice(WEAPON_SET_NAMES.length).map((lo) => {
          const active = hero.activeLoadoutId === lo.id;
          const conjured = !!(hero.items ?? []).find((it) => it.uid === lo.main)?.conjured;
          return (
            <div key={lo.id} className={`loadout-row ${conjured ? 'conjured' : 'extra'} ${active ? 'active' : ''}`}>
              <button className={`btn small ${active ? 'btn-primary' : ''}`} disabled={inBattle} title={lockTitle} onClick={() => setActiveLoadout(hero.id, lo.id)}>
                {active ? '● Actif' : 'Activer'}
              </button>
              <span className="lo-name">{conjured ? <>✦ {lo.name} <em className="muted">(invoquée)</em></> : lo.name}</span>
              {!conjured && (
                <button className="btn small" disabled={inBattle} title={lockTitle ?? 'Supprimer ce set'} onClick={() => deleteLoadout(hero.id, lo.id)}>🗑</button>
              )}
            </div>
          );
        })}
        <div className="eq-active-weapons">
          <span className="mini-title">En main</span>
          {activeWeapons.length === 0 ? (
            <span className="muted">Mains nues</span>
          ) : (
            activeWeapons.map((w, i) => {
              const ammo = w.type === 'ranged' ? compatibleAmmo(hero, w).reduce((s, a) => s + (a.qty ?? 0), 0) : null;
              return (
                <span className="weap" key={i}>
                  <CodexRef category="trappings" label={w.name}>{w.name}</CodexRef> <em>({w.damage})</em>
                  {ammo != null && <span className="eq-ammo" title="Munitions compatibles dans le sac"> · 🏹 {ammo}</span>}
                </span>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
