import { useGame } from '../state/store';
import type { Combatant, HitLocation, ItemInstance } from '../engine/types';
import { armourLayer, isCapeItem, weaponHands, compatibleAmmo, WEAPON_SET_NAMES, isUnarmed, damageString, type ArmourLayer } from '../engine/items';
import { RigSprite } from '../gameIso/rig/composeRig';
import { DEFS } from '../gameIso/sprites';
import { defaultAppearance } from '../gameIso/rig/appearance';
import { equipFromCombatant } from '../gameIso/rig/parts/equipment';
import { combatantAppearance, combatantOverlays } from '../gameIso/rig/parts/combatantVisuals';
import { CodexRef } from './compendium/CodexRef';
import { ItemIcon } from './ItemIcon';
import { MediaSelect, type MediaOption } from './MediaSelect';
import { effectiveWeaponDamage } from '../engine/weaponDamage';
import { charBonus } from '../engine/characteristics';
import { refLabel } from '../data';

/**
 * Écran d'EMPLACEMENTS d'équipement (onglet Combat de la fiche) — façon jeu vidéo : colonne
 * d'emplacements d'armure en CELLULES-ICÔNES à gauche (une ligne par localisation Tête/Bras/
 * Corps/Jambes + Cape, trois cellules = les 3 COUCHES Ext./Flex./Soupl., LDB 63 : cuir souple
 * sous tout ; Flexible sous la couche rigide — les PA rigide+Flexible se cumulent), mannequin
 * (rig live) au CENTRE, et les sets d'armes en cellules à DROITE. Le PA cumulé est affiché EN
 * FACE de chaque localisation. Survol d'une cellule → POPOVER (Codex de l'objet réel, ou stats +
 * qualités pour une arme invoquée via `fallback`) ; le CLIC sur la cellule ouvre le picker
 * changer/retirer (sauf cellule verrouillée : arme invoquée / combat).
 */

/** Zones de la fiche → localisations WFRP4. `apLoc` = localisation représentative pour le PA affiché. */
const ZONES: { label: string; locs: HitLocation[]; apLoc: HitLocation }[] = [
  { label: 'Tête', locs: ['tete'], apLoc: 'tete' },
  { label: 'Bras', locs: ['brasG', 'brasD'], apLoc: 'brasG' },
  { label: 'Corps', locs: ['corps'], apLoc: 'corps' },
  { label: 'Jambes', locs: ['jambeG', 'jambeD'], apLoc: 'jambeG' },
];
const ZONE_OF_LOC: Partial<Record<HitLocation, string>> = { tete: 'Tête', brasG: 'Bras', brasD: 'Bras', corps: 'Corps', jambeG: 'Jambes', jambeD: 'Jambes' };

/** Couches : `label` plein (tooltip), `short` pour l'en-tête de colonne (cellules étroites). De gauche
 *  (extérieure, visible) à droite (intime). */
const LAYERS: { key: ArmourLayer; label: string; short: string; hint: string }[] = [
  { key: 'rigide', label: 'Extérieure', short: 'Ext.', hint: 'Couche rigide (cuir bouilli, plate…) — une seule pièce par zone.' },
  { key: 'flexible', label: 'Flexible', short: 'Flex.', hint: 'Mailles (Flexible) : portée sous une couche non Flexible, les PA des deux se cumulent (LDB 63).' },
  { key: 'souple', label: 'Souple', short: 'Soupl.', hint: 'Cuir souple : porté sans pénalité sous n’importe quelle autre armure (LDB 63) — PA non cumulés sous une autre couche.' },
];

/** Zones couvertes par une pièce, pour l'indicateur multi-zones (« Bras+Corps »). */
function zonesOf(it: ItemInstance): string[] {
  const seen: string[] = [];
  for (const l of it.locs ?? []) {
    const z = ZONE_OF_LOC[l];
    if (z && !seen.includes(z)) seen.push(z);
  }
  return seen;
}

/** Qualités/atouts d'une arme en libellés lisibles (ids runtime → libellés via `refLabel`). */
function weaponQualities(qualities?: string[]): string {
  return (qualities ?? []).map((q) => refLabel('qualities', { id: q })).filter(Boolean).join(', ');
}

/** Option « objet » (ItemIcon + libellé) d'un MediaSelect. Libellé d'armure = UN seul nœud
 *  (`nom · PA n[· zones]`) — lisible et indexable. */
const armourOpt = (it: ItemInstance): MediaOption => ({
  key: it.uid,
  media: <ItemIcon item={it} size="sm" />,
  label: `${it.name} · PA ${it.pa ?? 0}${(it.locs?.length ?? 0) > 1 ? ` · ${zonesOf(it).join('+')}` : ''}`,
});
const weaponOpt = (w: ItemInstance): MediaOption => ({
  key: w.uid,
  media: <ItemIcon item={w} size="sm" />,
  label: `${w.name}${weaponHands(w) === 2 ? ' (2M)' : ''}`,
});
const capeOpt = (c: ItemInstance): MediaOption => ({ key: c.uid, media: <ItemIcon item={c} size="sm" />, label: c.name });

/** Corps du popover de stats (arme invoquée / hors-catalogue) : Dégâts effectifs + portée + qualités. */
function weaponStatsBody(it: ItemInstance, strBonus: number): string {
  const reach = it.range != null ? `Portée ${it.range}` : it.reach ?? '';
  return [`Dégâts ${effectiveWeaponDamage(it as never, strBonus)}`, reach, weaponQualities(it.qualities)].filter(Boolean).join(' · ');
}

/**
 * Cellule-emplacement. Survol de l'icône → POPOVER : le Codex de l'objet (catalogue) ou, à défaut
 * (arme invoquée/enchantée), un `fallback` (stats + qualités) — toujours un popover, jamais de title
 * natif, et jamais d'ouverture de fiche au clic. Le CLIC ouvre le picker changer/retirer (sauf
 * `disabled` : arme invoquée / combat → cellule statique). Vide : « + » (picker) ou « · » muet.
 */
function SlotCell({ item, pa, fallback, options, value, onSelect, disabled, emptyTitle }: {
  item?: ItemInstance;
  pa?: number;
  fallback?: { sub?: string; body?: string };
  options: MediaOption[];
  value: string;
  onSelect: (v: string) => void;
  disabled?: boolean;
  emptyTitle?: string;
}) {
  if (!item) {
    const pickable = !disabled && options.some((o) => o.key);
    if (!pickable) return <span className="eq-slot disabled" aria-hidden title={emptyTitle}>·</span>;
    return (
      <MediaSelect
        options={options} value={value} onSelect={onSelect} title={emptyTitle}
        trigger={<span className="eq-slot-plus" aria-hidden>+</span>} triggerClassName="eq-slot empty"
      />
    );
  }
  const trigger = (
    <>
      <CodexRef category="trappings" label={item.name} className="eq-slot-icon" tooltipOnly fallback={fallback}>
        <ItemIcon item={item} size="md" />
      </CodexRef>
      {pa != null && <span className="eq-slot-pa">{pa}</span>}
      {item.enchants?.length ? <span className="eq-slot-ench" title="Arme enchantée (effets actifs)">✦</span> : null}
    </>
  );
  // Verrouillée (invoquée / combat) : cellule STATIQUE — le survol garde le popover, pas de picker.
  if (disabled) return <span className="eq-slot filled locked">{trigger}</span>;
  return (
    <MediaSelect
      options={options} value={value} onSelect={onSelect} title="Changer / retirer"
      trigger={trigger} triggerClassName="eq-slot filled"
    />
  );
}

export function EquipmentPanel({ hero }: { hero: Combatant }) {
  const toggleEquip = useGame((s) => s.toggleEquip);
  const setWeaponSetSlot = useGame((s) => s.setWeaponSetSlot);
  const setLoadoutSlot = useGame((s) => s.setLoadoutSlot);
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
  const strBonus = charBonus(hero.characteristics, 'F');

  // Mannequin : MÊME recette que le token de jeu (pickBackend) — apparence enrichie des
  // mutations/blessures + équipement dérivé (couche visible déjà triée par equipFromCombatant).
  const appearance = combatantAppearance(hero.appearance ?? defaultAppearance(hero), hero);
  const equip = equipFromCombatant(hero);

  const activeWeapons = hero.weapons.filter((w) => !isUnarmed(w));

  /** `fallback` popover d'une arme (stats + qualités) — sert l'invoquée/enchantée hors catalogue. */
  const weaponFallback = (it?: ItemInstance, conjured?: boolean) =>
    it ? { sub: conjured ? 'Arme invoquée' : undefined, body: weaponStatsBody(it, strBonus) } : undefined;

  return (
    <div className="equip-panel">
      {/* COLONNE GAUCHE — emplacements d'armure en cellules, PA cumulé en face de chaque localisation */}
      <div className="equip-slots">
        <div className="eq-layers-head">
          <span className="eq-loc-spacer">Couche</span>
          {LAYERS.map((l) => <span key={l.key} className="eq-layer-col" title={`${l.label} — ${l.hint}`}>{l.short}</span>)}
        </div>

        {ZONES.map((z) => {
          const covering = armours.filter((i) => (i.locs ?? []).some((l) => z.locs.includes(l)));
          const ap = hero.armour[z.apLoc];
          return (
            <div className="eq-loc-row" key={z.label}>
              <span className="eq-loc-head">
                <span className="eq-loc-name">{z.label}</span>
                <span className={`eq-loc-pa ${ap > 0 ? 'on' : ''}`} title="Points d'Armure de la zone (couches rigide + Flexible cumulées, mutations comprises)">PA {ap}</span>
              </span>
              {LAYERS.map((layer) => {
                const worn = covering.find((i) => i.equipped && armourLayer(i) === layer.key);
                const candidates = covering.filter((i) => !i.equipped && armourLayer(i) === layer.key);
                const netPa = worn ? Math.max(0, (worn.pa ?? 0) - (worn.damageTaken ?? 0)) : undefined;
                return (
                  <SlotCell
                    key={layer.key}
                    item={worn}
                    pa={netPa}
                    value={worn?.uid ?? ''}
                    disabled={inBattle}
                    emptyTitle={lockTitle ?? (candidates.length ? `${layer.label} — équiper` : `${layer.label} — rien à porter`)}
                    options={[{ key: '', label: '— retirer —', disabled: !worn }, ...candidates.map(armourOpt)]}
                    onSelect={(v) => toggleEquip(hero.id, v || worn!.uid)}
                  />
                );
              })}
            </div>
          );
        })}

        {/* Ligne Cape (cosmétique — rendue dans le dos du mannequin) */}
        <div className="eq-loc-row eq-loc-cape">
          <span className="eq-loc-head">
            <span className="eq-loc-name">Cape</span>
            <span className="eq-loc-pa" title="Purement cosmétique — aucun effet de règles">✨</span>
          </span>
          <SlotCell
            item={wornCape}
            value={wornCape?.uid ?? ''}
            disabled={inBattle}
            emptyTitle={lockTitle ?? (capes.length ? 'Équiper une cape' : 'Aucune cape dans le sac')}
            options={[{ key: '', label: '— retirer —', disabled: !wornCape }, ...capes.filter((c) => !c.equipped).map(capeOpt)]}
            onSelect={(v) => toggleEquip(hero.id, v || wornCape!.uid)}
          />
        </div>
      </div>

      {/* COLONNE CENTRE — mannequin (rig live, porte l'armure visible + les armes du set actif) */}
      <div className="equip-doll" title="Aperçu du héros avec l’équipement porté (la couche du dessus s’affiche : plate sur maille sur cuir)">
        <svg viewBox="0 0 120 150" className="equip-figure">
          <defs dangerouslySetInnerHTML={{ __html: DEFS }} />
          <rect x={0} y={0} width={120} height={150} fill="#1d2230" rx={6} />
          <RigSprite appearance={appearance} equip={equip} career={hero.career} overlays={combatantOverlays(hero)} />
        </svg>
      </div>

      {/* COLONNE DROITE — sets d'armes en cartes compactes (Set I/II fixes + perso/invoquée) + récap */}
      <div className="equip-sets">
        {(hero.loadouts ?? []).map((lo, idx) => {
          const fixed = idx < WEAPON_SET_NAMES.length;
          const conjured = !!(hero.items ?? []).find((it) => it.uid === lo.main)?.conjured;
          const setActive = hero.activeLoadoutId === lo.id;
          const mainItem = weapons.find((w) => w.uid === lo.main);
          const offItem = weapons.find((w) => w.uid === lo.off);
          const mainTwoHanded = mainItem ? weaponHands(mainItem) === 2 : false;
          const editable = !conjured && !inBattle; // arme invoquée = lecture seule (auto-gérée)
          const onMain = (v: string) => fixed ? setWeaponSetSlot(hero.id, idx, 'main', v || null) : setLoadoutSlot(hero.id, lo.id, 'main', v || null);
          const onOff = (v: string) => fixed ? setWeaponSetSlot(hero.id, idx, 'off', v || null) : setLoadoutSlot(hero.id, lo.id, 'off', v || null);
          return (
            <div key={lo.id} className={`set-card ${setActive ? 'active' : ''} ${conjured ? 'conjured' : ''}`}>
              <div className="set-card-slots">
                <SlotCell
                  item={mainItem}
                  fallback={weaponFallback(mainItem, conjured)}
                  disabled={!editable}
                  value={lo.main ?? ''}
                  emptyTitle={lockTitle ?? 'Main — choisir une arme'}
                  options={[{ key: '', label: '— mains nues —' }, ...weapons.map(weaponOpt)]}
                  onSelect={onMain}
                />
                <SlotCell
                  item={offItem}
                  fallback={weaponFallback(offItem, conjured)}
                  disabled={!editable || mainTwoHanded}
                  value={lo.off ?? ''}
                  emptyTitle={mainTwoHanded ? 'Arme à deux mains — pas de seconde main' : (lockTitle ?? '2nde — arme à une main / bouclier')}
                  options={[{ key: '', label: mainTwoHanded ? '— (2 mains) —' : '— vide —' }, ...oneHanded.filter((w) => w.uid !== lo.main).map(weaponOpt)]}
                  onSelect={onOff}
                />
              </div>
              <span className="set-card-actions">
                {conjured && <span className="lo-name" title="Arme invoquée (auto-gérée)">✦</span>}
                <button
                  className={`btn small ${setActive ? 'btn-primary' : ''}`}
                  disabled={inBattle}
                  title={lockTitle ?? 'Rendre ce set actif (armes en main)'}
                  onClick={() => (fixed ? activateWeaponSet(hero.id, idx) : setActiveLoadout(hero.id, lo.id))}
                >
                  {setActive ? '● Actif' : 'Activer'}
                </button>
                {!fixed && !conjured && (
                  <button className="btn small" disabled={inBattle} title={lockTitle ?? 'Supprimer ce set'} onClick={() => deleteLoadout(hero.id, lo.id)}>🗑</button>
                )}
              </span>
            </div>
          );
        })}

        {/* Récap des armes EN MAIN du set actif (Dégâts effectifs, qualités/effets, munitions) */}
        <div className="eq-active-weapons">
          <span className="mini-title">En main</span>
          {activeWeapons.length === 0 ? (
            <span className="muted">Mains nues</span>
          ) : (
            activeWeapons.map((w, i) => {
              const ammo = w.type === 'ranged' ? compatibleAmmo(hero, w).reduce((s, a) => s + (a.qty ?? 0), 0) : null;
              const quals = weaponQualities(w.qualities);
              return (
                <div className="weap" key={i}>
                  <ItemIcon item={w} size="sm" />
                  <span className="weap-text">
                    <CodexRef category="trappings" label={w.name}>{w.name}</CodexRef>{' '}
                    <em>{damageString(w.damage)} = {effectiveWeaponDamage(w, strBonus)}</em>
                    {quals && <span className="weap-quals"> · {quals}</span>}
                    {ammo != null && <span className="eq-ammo" title="Munitions compatibles dans le sac"> · 🏹 {ammo}</span>}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
