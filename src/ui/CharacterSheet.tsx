import { useRef, useState, type ReactNode } from 'react';
import { useGame } from '../state/store';
import { useModalA11y } from './Modal';
import { maxEncumbrance, isWeaponActive } from '../engine/items';
import { CHAR_KEYS, CharKey, HitLocation, ItemInstance, Combatant, Weapon } from '../engine/types';
import { buildAdvancementView } from '../state/advancement';
import { hasHealSkill, hasSurgerySkill, availableHealModes, isHealable } from '../engine/healing';
import { itemUse } from '../engine/consumables';
import { isMagicMissile, isArcaneSpell } from '../engine/magic';
import { learnableSpells, canCastFromGrimoire, carriedGrimoire } from '../engine/grimoire';
import { spellSupport } from '../engine/spellspec';
import { spellSpecFor } from '../data/spellspecs';
import { careers, findSpell, spells as allSpells } from '../data';
import { ColorPalettePickers } from './ColorPalettePickers';
import { weaponPart, armourPart } from '../gameIso/rig/parts/equipment';
import { LoadoutSection } from './LoadoutSection';
import { RigPortrait } from './RigPortrait';
import { pickView } from '../gameIso/rig/parts/types';
import { DEFS } from '../gameIso/sprites';
import type { Palette } from '../gameIso/rig/palette';

/** Emplacements de couleur d'un SKIN d'OBJET légendaire (`metal/cuir/accent` = slots de palette). */
const WEAPON_SKIN_SLOTS: [label: string, slot: keyof Palette][] = [
  ['Métal (lame / canon)', 'metal'],
  ['Bois & cuir', 'cuir'],
  ['Or & détails', 'accent'],
];
const ARMOUR_SKIN_SLOTS: [label: string, slot: keyof Palette][] = [
  ['Métal (plaque / maille)', 'metal'],
  ['Cuir / rembourrage', 'cuir'],
];
const skinSlotsFor = (kind: ItemInstance['kind']) => (kind === 'armor' ? ARMOUR_SKIN_SLOTS : WEAPON_SKIN_SLOTS);

/** Aperçu LIVE d'un objet (arme ou armure) recoloré par son skin — art résolu, recoloré. */
function ItemSkinPreview({ item }: { item: ItemInstance }) {
  const armor = item.kind === 'armor';
  let art: string;
  if (armor) {
    const p = armourPart(item, 'torse'); // aperçu sur le torse
    art = p ? pickView(p, 'front') : '';
  } else {
    const w = { name: item.name, type: item.kind === 'ranged' ? 'ranged' : 'melee', damage: '+0', qualities: [], skin: item.skin } as Weapon;
    art = pickView(weaponPart(w), 'front');
  }
  const vb = armor ? '-20 -36 40 78' : '-20 -56 40 72';
  return (
    <svg viewBox={vb} width={46} height={83} style={{ background: '#222831', borderRadius: 4, flex: '0 0 auto' }}>
      <defs dangerouslySetInnerHTML={{ __html: DEFS }} />
      <g dangerouslySetInnerHTML={{ __html: art }} />
    </svg>
  );
}

const LOC_SHORT: Record<HitLocation, string> = {
  tete: 'Tête',
  brasG: 'Bras G',
  brasD: 'Bras D',
  corps: 'Corps',
  jambeG: 'Jambe G',
  jambeD: 'Jambe D',
};
const LOCS: HitLocation[] = ['tete', 'brasG', 'brasD', 'corps', 'jambeG', 'jambeD'];
const SHORT: Record<CharKey, string> = {
  CC: 'CC',
  CT: 'CT',
  F: 'F',
  E: 'E',
  I: 'I',
  Ag: 'Ag',
  Dex: 'Dex',
  Int: 'Int',
  FM: 'FM',
  Soc: 'Soc',
};

type SheetTab = 'combat' | 'competences' | 'sac' | 'sorts' | 'avancement';
const TAB_LABELS: Record<SheetTab, string> = {
  combat: 'Combat',
  competences: 'Compétences',
  sac: 'Sac',
  sorts: 'Sorts',
  avancement: 'Avancement',
};

export function CharacterSheet({ heroId, onClose }: { heroId: string; onClose: () => void }) {
  const hero = useGame((s) => s.party.find((h) => h.id === heroId));
  const [tab, setTab] = useState<SheetTab>('combat');
  const boxRef = useRef<HTMLDivElement>(null);
  useModalA11y(boxRef, onClose); // dialogue au markup spécifique (header à onglets) → hook a11y partagé
  if (!hero) return null;

  const isCaster = (hero.spells?.length ?? 0) > 0;
  const tabs: SheetTab[] = ['combat', 'competences', 'sac', ...(isCaster ? ['sorts' as const] : []), 'avancement'];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={boxRef} role="dialog" aria-modal="true" className="modal sheet-modal" onClick={(e) => e.stopPropagation()}>
        <button className="btn small sheet-close" onClick={onClose} aria-label="Fermer">✕</button>

        {/* L'ESSENTIEL à gauche (portrait + identité + vitalité + carac, toujours visible) ;
            le détail en onglets à droite. */}
        <div className="sheet-layout">
          <aside className="sheet-aside">
            <div className="sheet-portrait">
              <RigPortrait combatant={hero} size={112} ring="var(--gold)" />
              <h3>{hero.name}</h3>
              <span className="char-sub">
                {hero.species} · {hero.career}
                {hero.careerLevel ? ` (niv. ${hero.careerLevel})` : ''}
              </span>
            </div>
            <FicheBody hero={hero} section="profil" />
          </aside>
          <div className="sheet-main">
            <nav className="sheet-tabs" role="tablist">
              {tabs.map((t) => (
                <button key={t} role="tab" aria-selected={tab === t} className={`tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>
                  {TAB_LABELS[t]}
                </button>
              ))}
            </nav>
            <div className="sheet-tabbody">
              {tab === 'avancement' ? (
                <AdvancementPanel hero={hero} />
              ) : tab === 'sorts' ? (
                <SpellbookSection hero={hero} />
              ) : (
                <FicheBody hero={hero} section={tab} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Grimoire/livre de prières — incantation HORS COMBAT (couture D). Un héros lanceur cible self/allié.
 *  Les Projectiles magiques (offensifs) sont marqués « en combat » : ils exigent une cible ennemie. */
function SpellbookSection({ hero }: { hero: Combatant }) {
  const party = useGame((s) => s.party);
  const oocCastSpell = useGame((s) => s.oocCastSpell);
  const oocFocusSpell = useGame((s) => s.oocFocusSpell);
  const [targetId, setTargetId] = useState(hero.id);
  const spells = (hero.spells ?? [])
    .map((label) => findSpell(label))
    .filter((s): s is NonNullable<ReturnType<typeof findSpell>> => !!s);
  // Lecture au grimoire (LDB 47 l.34) : sorts NON mémorisés de son Domaine, lançables à
  // deux mains depuis le livre porté — au NI DOUBLÉ.
  const grimoireSpells = carriedGrimoire(hero)
    ? allSpells.filter((s) => canCastFromGrimoire(hero, s))
    : [];
  if (!spells.length && !grimoireSpells.length) return null;
  return (
    <div className="sc-block sheet-spells">
      <span className="mini-title">Sorts — incantation hors combat</span>
      {(hero.sinPoints ?? 0) > 0 && (
        <span
          className="muted"
          title="Points de Péché (LDB 40) : si le dé des unités d'un Test de Prière leur est inférieur ou égal, la Colère des dieux frappe — même sur un Test réussi. Chaque jet de Colère en expie 1."
        >
          ⚖️ Péché : {hero.sinPoints}
        </span>
      )}
      <label className="spell-target">
        Cible :{' '}
        <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
          {party.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id === hero.id ? `${m.name} (soi)` : m.name}
            </option>
          ))}
        </select>
      </label>
      <div className="spell-list">
        {spells.map((sp) => {
          const offensive = isMagicMissile(sp);
          const support = spellSupport(spellSpecFor(sp), offensive);
          return (
            <div className="spell-row" key={sp.label} title={sp.desc + (support !== 'mecanique' ? '\n\n📜 Tout ou partie de l’effet est journalisé (« arbitrage MJ ») — pas encore mécanisé (cf. docs/sorts-implementation.md).' : '')}>
              <span className="spell-name">
                {sp.label}
                {sp.cn != null ? ` · NI ${sp.cn}` : ''}
                {support === 'narratif' ? ' 📜' : support === 'partiel' ? ' 🟡' : ''}
              </span>
              {offensive ? (
                <span className="muted" title="Projectile magique : nécessite une cible ennemie (en combat)">
                  en combat
                </span>
              ) : (
                <span className="spell-actions">
                  {isArcaneSpell(sp) && (
                    <button
                      className="btn small"
                      title="Test étendu de Focalisation : accumule du DR pour lancer au NI 0"
                      onClick={() => oocFocusSpell(hero.id, sp.label)}
                    >
                      ✨ Focaliser
                    </button>
                  )}
                  <button className="btn small" onClick={() => oocCastSpell(hero.id, sp.label, targetId)}>
                    🎲 Lancer
                  </button>
                </span>
              )}
            </div>
          );
        })}
        {grimoireSpells.map((sp) => (
          <div className="spell-row" key={`g-${sp.label}`} title={`${sp.desc}\n\nLecture au grimoire (LDB 47) : sort non mémorisé de votre Domaine — NI doublé, deux mains.`}>
            <span className="spell-name">
              📖 {sp.label}
              {sp.cn != null ? ` · NI ${sp.cn}→${sp.cn * 2}` : ''}
            </span>
            {isMagicMissile(sp) ? (
              <span className="muted">en combat</span>
            ) : (
              <span className="spell-actions">
                <button className="btn small" onClick={() => oocCastSpell(hero.id, sp.label, targetId, true)}>
                  📖 Lancer (grimoire)
                </button>
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FicheBody({ hero, section }: { hero: Combatant; section: 'profil' | 'combat' | 'competences' | 'sac' }) {
  const toggleEquip = useGame((s) => s.toggleEquip);
  const createLoadout = useGame((s) => s.createLoadout);
  const renameLoadout = useGame((s) => s.renameLoadout);
  const deleteLoadout = useGame((s) => s.deleteLoadout);
  const setActiveLoadout = useGame((s) => s.setActiveLoadout);
  const setLoadoutSlot = useGame((s) => s.setLoadoutSlot);
  const transferItem = useGame((s) => s.transferItem);
  const setItemSkin = useGame((s) => s.setItemSkin);
  const usePartyItem = useGame((s) => s.usePartyItem);
  const trainProsthesis = useGame((s) => s.trainProsthesis);
  const inBattleNow = useGame((s) => !!s.battle);
  const [skinFor, setSkinFor] = useState<string | null>(null);
  const items = hero.items ?? [];
  const enc = hero.encumbrance ?? 0;
  const maxEnc = maxEncumbrance(hero);
  const over = enc > maxEnc;
  const activeWeapons = hero.weapons.filter((w) => w.name !== 'Mains nues');
  const party = useGame((s) => s.party);
  const healAlly = useGame((s) => s.healAlly);
  const inBattle = useGame((s) => !!s.battle);
  // Guérison hors-combat : un soigneur du groupe peut panser ce héros (sans avancer le temps,
  // pour stopper une hémorragie AVANT que l'horloge ne la fasse ticker — LDB 09-Compétences).
  const canSoigner = !inBattle && isHealable(hero) && party.some(hasHealSkill);
  const hasSurgeon = party.some((c) => hasHealSkill(c) && hasSurgerySkill(c)); // Chirurgie : un opérateur disponible

  const itemStats = (it: ItemInstance): string => {
    // Objet non identifié : ses qualités sont MASQUÉES à l'affichage (elles restent actives au combat).
    const quals = it.identified === false ? '' : it.qualities.join(', ');
    if (it.kind === 'melee' || it.kind === 'ranged')
      return [it.damage && `Dégâts ${it.damage}`, it.reach && `Allonge ${it.reach}`, it.range && `Portée ${it.range} m`, quals]
        .filter(Boolean)
        .join(' · ');
    if (it.kind === 'armor') return [it.pa != null && `PA ${it.pa}`, (it.locs ?? []).map((l) => LOC_SHORT[l]).join(', ')].filter(Boolean).join(' · ');
    return quals;
  };

  return (
    <>
      {section === 'profil' && (<>
        <div className="sheet-vitals">
          <div className="vital pv">
            <span className="vital-lbl">Blessures</span>
            <b>{hero.wounds.current}/{hero.wounds.max}</b>
          </div>
          <div className="vital">
            <span className="vital-lbl">Mouvement</span>
            <b>{hero.movement}</b>
          </div>
          <div className={`vital ${over ? 'enc-over' : ''}`}>
            <span className="vital-lbl">Encombrement</span>
            <b>{enc}/{maxEnc}{over ? ' ⚠' : ''}</b>
          </div>
        </div>
        {canSoigner && (
          <div className="sheet-heal">
            {availableHealModes(hero).filter((m) => m !== 'surgery' || hasSurgeon).map((m) => (
              <button key={m} className="btn small" onClick={() => healAlly(hero.id, m)}
                title="Test de Guérison (Intermédiaire +0) par le meilleur soigneur du groupe (LDB 09-Compétences)">
                {m === 'wounds' ? '🩹 Soigner' : m === 'bleed' ? '🩸 Stopper hémorragie' : m === 'trauma' ? '🦵 Soigner déchirure' : '🔪 Opérer'}
              </button>
            ))}
          </div>
        )}
        {hero.fate != null && (
          <div className="sheet-resources">
            <div className="res" title="Points de Destin (permanents) / Chance (par session)"><span>🎲 Destin</span><b>{hero.fate}{hero.fortune != null ? ` · ${hero.fortune}` : ''}</b></div>
            <div className="res" title="Résilience (permanente) / Détermination (par session)"><span>🛡 Résilience</span><b>{hero.resilience ?? 0}{hero.resolve != null ? ` · ${hero.resolve}` : ''}</b></div>
          </div>
        )}
        <div className="mini-title">Caractéristiques</div>
        <div className="char-stats sheet-stats">
          {CHAR_KEYS.map((k) => (
            <div className="stat" key={k}>
              <span className="stat-label">{SHORT[k]}</span>
              <span className="stat-val">{hero.characteristics[k]}</span>
            </div>
          ))}
        </div>
      </>)}

      {section === 'combat' && (<>
      <div className="sheet-combat">
        <div className="sc-block">
          <span className="mini-title">Défense — Points d'Armure</span>
          <div className="ap-row">
            {LOCS.map((l) => (
              <div className="ap-cell" key={l}>
                <span>{LOC_SHORT[l]}</span>
                <b className={hero.armour[l] > 0 ? 'on' : ''}>{hero.armour[l]}</b>
              </div>
            ))}
          </div>
        </div>
        <div className="sc-weapons">
          <span className="mini-title">Armes actives</span>
          {activeWeapons.length === 0 ? (
            <span className="muted">Mains nues</span>
          ) : (
            activeWeapons.map((w, i) => (
              <span className="weap" key={i}>
                {w.name} <em>({w.damage})</em>
              </span>
            ))
          )}
        </div>
      </div>

      {!inBattle && (
        <LoadoutSection
          hero={hero}
          onCreate={(name) => createLoadout(hero.id, name)}
          onRename={(id, name) => renameLoadout(hero.id, id, name)}
          onDelete={(id) => deleteLoadout(hero.id, id)}
          onSetActive={(id) => setActiveLoadout(hero.id, id)}
          onSetSlot={(id, slot, uid) => setLoadoutSlot(hero.id, id, slot, uid)}
        />
      )}
      </>)}

      {section === 'competences' && (
      <div className="sheet-skills">
        <div className="mini-title">Compétences</div>
        <div className="skill-grid">
          {hero.skills.length === 0 && <span className="muted">Aucune.</span>}
          {hero.skills.map((s, i) => {
            const val = (hero.characteristics[s.characteristic] ?? 0) + s.advances;
            return (
              <div className="skill-line" key={i} title={`${s.characteristic} ${hero.characteristics[s.characteristic]} + ${s.advances}`}>
                <span className="sk-name">
                  {s.name}
                  {s.spec ? ` (${s.spec})` : ''}
                </span>
                <span className="sk-val">{val}</span>
                <span className="sk-adv">+{s.advances}</span>
              </div>
            );
          })}
        </div>
        {hero.talents.length > 0 && (
          <>
            <div className="mini-title">Talents</div>
            <div className="skill-tags">
              {hero.talents.map((t, i) => (
                <span className="tag talent" key={i}>
                  {t.name}
                  {t.times > 1 ? ` ×${t.times}` : ''}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
      )}

      {section === 'profil' && ((hero.diseases?.length ?? 0) > 0 || (hero.traumas?.length ?? 0) > 0 || (hero.corruption ?? 0) > 0 || (hero.mutations?.length ?? 0) > 0) && (
        <div className="sheet-afflictions">
          <div className="mini-title">Afflictions</div>
          <div className="inv-rows">
            {(hero.corruption ?? 0) > 0 && (
              <div className="inv-row" style={{ alignItems: 'center' }} title="Points de Corruption (LDB 19) : au-delà de BFM + BE, chaque gain impose un Test de Résistance ou MUTATION.">
                <span className="ir-name">🕯️ Corruption</span>
                <span className="ir-stats" style={{ marginLeft: 'auto', opacity: 0.85 }}>
                  {hero.corruption} point{(hero.corruption ?? 0) > 1 ? 's' : ''}{hero.damned ? ' — DAMNÉ' : ''}
                </span>
              </div>
            )}
            {(hero.mutations ?? []).map((m, i) => (
              <div key={`m${i}`} className="inv-row" title={m.note} style={{ alignItems: 'center' }}>
                <span className="ir-name">🧬 {m.label}</span>
                <span className="ir-stats" style={{ marginLeft: 'auto', opacity: 0.85 }}>
                  mutation {m.kind === 'physique' ? 'physique' : 'mentale'}
                </span>
              </div>
            ))}
            {(hero.traumas ?? []).map((t, i) => (
              <div key={`t${i}`} className="inv-row" title={t.note} style={{ alignItems: 'center' }}>
                <span className="ir-name">🩼 {t.label}{t.count != null && t.count > 1 ? ` ×${t.count}` : ''}</span>
                <span className="ir-stats" style={{ marginLeft: 'auto', opacity: 0.85 }}>
                  {t.recoveryDays != null
                    ? `convalescence ${t.recoveryDays} j`
                    : t.needsSurgery
                    ? 'Chirurgie requise'
                    : 'permanent'}
                </span>
              </div>
            ))}
            {(hero.diseases ?? []).map((d, i) => (
              <div key={`d${i}`} className="inv-row" title={d.symptoms.map((s) => s.kind).join(' · ')} style={{ alignItems: 'center' }}>
                <span className="ir-name">🦠 {d.name}</span>
                <span className="ir-stats" style={{ marginLeft: 'auto', opacity: 0.85 }}>
                  {d.phase === 'incubation' ? `incubation : ${d.daysLeft} j` : `${d.daysLeft} j restants`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {section === 'sac' && (
      <div className="sheet-inventory">
        <div className="mini-title">Inventaire & équipement ({items.length})</div>
        <div className="inv-rows">
          {items.length === 0 && <p className="muted">Aucun objet.</p>}
          {items.map((it) => {
            const isProsthesis = it.subType === 'Prothèses'; // prothèse (LDB 73) : se PORTE pour annuler un malus d'amputation
            const equipable = it.kind === 'armor' || isProsthesis; // armes = via les loadouts (cf. LoadoutSection)
            const isWeaponItem = it.kind === 'melee' || it.kind === 'ranged';
            const inLoadout = isWeaponItem && (hero.loadouts ?? []).some((l) => l.main === it.uid || l.off === it.uid);
            // Surbrillance « équipé » : arme tenue dans le set ACTIF (plus de flag `equipped` d'arme) ; sinon armure portée.
            const highlighted = isWeaponItem ? isWeaponActive(hero, it.uid) : it.equipped;
            const isSkinnable = it.kind === 'melee' || it.kind === 'ranged' || it.kind === 'armor';
            const consumable = itemUse(it, hero) != null; // bandages / potion : utilisable depuis la fiche
            const skinned = !!it.skin && Object.keys(it.skin).length > 0;
            const open = isSkinnable && skinFor === it.uid;
            return (
              <div key={it.uid}>
                <div className={`inv-row kind-${it.kind} ${highlighted ? 'equipped' : ''}`}>
                  <div className="ir-main">
                    <span className="ir-name">
                      {it.name}{skinned && ' ✨'}
                      {it.identified === false && (
                        <span className="ir-unid" title="Objet non identifié — faites-le Évaluer chez un marchand pour révéler ses qualités" style={{ marginLeft: 6, fontSize: '0.78em', color: '#b388ff' }}>🔮 Non identifié</span>
                      )}
                    </span>
                    <span className="ir-stats">{itemStats(it)}</span>
                  </div>
                  <span className="ir-enc">Enc {it.enc}</span>
                  {isSkinnable && (
                    <button
                      className={`btn small ${open ? 'btn-primary' : ''}`}
                      title="Skin légendaire (recoloriser cet objet)"
                      onClick={() => setSkinFor(open ? null : it.uid)}
                    >
                      ✨
                    </button>
                  )}
                  {isProsthesis && it.equipped && !it.prosthesisTrained && (it.name === 'Fausse jambe' || it.name === 'Crochet') && (() => {
                    const px = it.name === 'Crochet' ? 400 : 200;
                    return (
                      <button
                        className="btn small"
                        title={it.name === 'Crochet' ? 'Maîtriser le crochet : armes à deux mains de nouveau possibles (400 PX) — LDB 73' : 'Réapprendre l’Esquive avec la fausse jambe (200 PX) — LDB 73'}
                        disabled={(hero.xp ?? 0) < px}
                        onClick={() => trainProsthesis(hero.id, it.uid)}
                      >
                        {it.name === 'Crochet' ? `2 mains (${px} PX)` : `Esquive (${px} PX)`}
                      </button>
                    );
                  })()}
                  {(it.kind === 'melee' || it.kind === 'ranged') && (
                    <span className={`ir-loadout ${inLoadout ? 'on' : ''}`} title="Géré via les sets d'armes (loadouts)">
                      {inLoadout ? '🗡 en set' : '—'}
                    </span>
                  )}
                  {equipable ? (
                    <button
                      className={`btn small ${it.equipped ? 'btn-primary' : ''}`}
                      disabled={inBattleNow}
                      title={inBattleNow ? 'Équipement verrouillé en combat (seul le changement de set d’armes est permis)' : isProsthesis ? 'Porter la prothèse (annule le malus d’amputation correspondant — LDB 73)' : undefined}
                      onClick={() => toggleEquip(hero.id, it.uid)}
                    >
                      {isProsthesis ? (it.equipped ? 'Portée' : 'Porter') : it.equipped ? 'Équipé' : 'Équiper'}
                    </button>
                  ) : consumable ? (
                    <button
                      className="btn small"
                      title={inBattleNow ? 'En combat, utilisez l’objet depuis la barre d’action (coûte l’Action).' : 'Utiliser ce consommable (bandages, potion)'}
                      disabled={inBattleNow}
                      onClick={() => usePartyItem(hero.id, it.uid)}
                    >
                      Utiliser
                    </button>
                  ) : (
                    <span className="ir-kind">{it.kind}</span>
                  )}
                  {party.length > 1 && (
                    <select
                      className="give-sel"
                      value=""
                      disabled={inBattleNow}
                      title={inBattleNow ? 'Transfert verrouillé en combat' : 'Donner cet objet à un autre héros'}
                      onChange={(e) => {
                        if (e.target.value) transferItem(it.uid, hero.id, e.target.value);
                      }}
                    >
                      <option value="">Donner à…</option>
                      {party.filter((p) => p.id !== hero.id).map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                {open && (
                  <div className="inv-skin" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '6px 8px', background: 'rgba(0,0,0,0.18)', borderRadius: 4 }}>
                    <ItemSkinPreview item={it} />
                    <div style={{ flex: 1 }}>
                      <ColorPalettePickers
                        colors={it.skin as Palette | undefined}
                        slots={skinSlotsFor(it.kind)}
                        onColors={(patch) => setItemSkin(hero.id, it.uid, patch)}
                      />
                      {skinned && (
                        <button className="btn small" style={{ marginTop: '4px' }} onClick={() => setItemSkin(hero.id, it.uid, Object.fromEntries(skinSlotsFor(it.kind).map(([, s]) => [s, undefined])))}>
                          Retirer le skin
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      )}
    </>
  );
}

/** Ligne d'un emplacement à choix (compétence ou talent) : sélecteur d'option + Désigner/Acquérir.
 *  Une option DÉJÀ possédée (via l'espèce…) se DÉSIGNE gratuitement — elle devient le choix de
 *  carrière de l'emplacement et donc montable en PX ; une nouvelle option s'achète. */
function SlotChoiceRow({
  entry,
  options,
  acquireCost,
  afford,
  onPick,
}: {
  entry: string;
  options: { label: string; owned: boolean; hint?: string }[];
  acquireCost: number;
  afford: (c: number) => boolean;
  onPick: (label: string, owned: boolean) => void;
}) {
  const [choice, setChoice] = useState('');
  const opt = options.find((o) => o.label === choice);
  const cost = opt?.owned ? 0 : acquireCost;
  return (
    <div className="adv-row acquire">
      <span className="adv-name">
        {entry} <span className="acquire-tag">au choix</span>
      </span>
      <select value={choice} onChange={(e) => setChoice(e.target.value)}>
        <option value="">— choisir —</option>
        {options.map((o) => (
          <option key={o.label} value={o.label}>
            {o.label}
            {o.hint ? ` ${o.hint}` : ''}
            {o.owned ? ' (possédé)' : ''}
          </option>
        ))}
      </select>
      <button className="btn small" disabled={!opt || !afford(cost)} onClick={() => opt && onPick(opt.label, opt.owned)}>
        {opt?.owned ? 'Désigner · 0 PX' : `Acquérir · ${acquireCost} PX`}
      </button>
    </div>
  );
}

/** Catégorie repliable de l'Avancement : titre + compteur, dépliée par défaut. */
function AdvSection({ title, count, badge, children }: { title: string; count?: number; badge?: ReactNode; children: ReactNode }) {
  return (
    <details className="adv-section" open>
      <summary className="adv-summary">
        <span className="adv-summary-title">{title}</span>
        {count != null && <span className="adv-count">{count}</span>}
        {badge}
        <span className="adv-chevron" aria-hidden>▾</span>
      </summary>
      <div className="adv-section-body">{children}</div>
    </details>
  );
}

export function AdvancementPanel({ hero }: { hero: Combatant }) {
  const buyCharAdvance = useGame((s) => s.buyCharAdvance);
  const buySkillAdvance = useGame((s) => s.buySkillAdvance);
  const buyTalent = useGame((s) => s.buyTalent);
  const designateCareerSlot = useGame((s) => s.designateCareerSlot);
  const buySpell = useGame((s) => s.buySpell);
  const changeCareer = useGame((s) => s.changeCareer);
  const [target, setTarget] = useState('');

  const v = buildAdvancementView(hero);
  const afford = (c: number) => v.xp >= c;
  const pill = (inC: boolean) => <span className={`career-pill ${inC ? 'in' : 'out'}`}>{inC ? 'carrière' : '×2'}</span>;
  const skillLabel = (name: string, spec?: string) => (spec ? `${name} (${spec})` : name);

  return (
    <div className="adv-panel">
      {/* Total PX en tête, collant — toujours visible en scrollant les catégories.
          Pas de bouton « Octroyer +PX » : les PX viennent du JEU (Effet `giveXp`). */}
      <div className="adv-px-bar">
        <span>Points d'Expérience disponibles</span>
        <b>{v.xp}</b>
      </div>

      <AdvSection title="Caractéristiques" count={v.chars.length}>
      <div className="adv-grid">
        {v.chars.map((c) => (
          <div className="adv-row" key={c.key}>
            <span className="adv-name">
              {c.label} <em>{c.value}</em> {pill(c.inCareer)}
            </span>
            <span className="adv-meta">×{c.advances}</span>
            <button className="btn small" disabled={!afford(c.nextCost)} onClick={() => buyCharAdvance(hero.id, c.key)}>
              +1 · {c.nextCost} PX
            </button>
          </div>
        ))}
      </div>
      </AdvSection>

      <AdvSection title="Compétences" count={v.skills.length + v.skillSlotsOpen.length}>
      <div className="adv-grid">
        {v.skills.map((s) => (
          <div className={`adv-row ${s.known ? '' : 'acquire'}`} key={skillLabel(s.name, s.spec)}>
            <span className="adv-name">
              {skillLabel(s.name, s.spec)} <em>{(hero.characteristics[s.characteristic] ?? 0) + s.advances}</em> {pill(s.inCareer)}
              {s.known ? '' : <span className="acquire-tag">à apprendre</span>}
            </span>
            <span className="adv-meta">+{s.advances}</span>
            <button className="btn small" disabled={!afford(s.nextCost)} onClick={() => buySkillAdvance(hero.id, s.name, s.spec)}>
              {s.known ? '+1' : 'Apprendre'} · {s.nextCost} PX
            </button>
          </div>
        ))}
        {/* Emplacements de Compétence « (Au choix) » non désignés (LDB 09 l.38) */}
        {v.skillSlotsOpen.map((slot) => (
          <SlotChoiceRow
            key={slot.slotKey}
            entry={slot.entry}
            acquireCost={slot.nextCost}
            afford={afford}
            options={slot.options.map((o) => ({
              label: `${slot.group} (${o.spec})`,
              owned: o.ownedAdvances > 0,
              hint: o.ownedAdvances > 0 ? `+${o.ownedAdvances}` : undefined,
            }))}
            onPick={(label, owned) => {
              if (owned) designateCareerSlot(hero.id, slot.slotKey, label);
              else {
                // Acheter la 1re Augmentation désigne l'emplacement (LDB 09 l.38).
                const spec = label.slice(slot.group.length).replace(/^\s*\(/, '').replace(/\)\s*$/, '');
                buySkillAdvance(hero.id, slot.group, spec);
              }
            }}
          />
        ))}
      </div>
      </AdvSection>

      <AdvSection title={`Talents du niveau ${v.careerLevel}`} count={v.talents.length}>
      <div className="adv-grid">
        {v.talents.length === 0 && <span className="muted">Aucun Talent de carrière disponible.</span>}
        {v.talents.map((t) =>
          t.label ? (
            <div className={`adv-row ${t.times > 0 ? '' : 'acquire'}`} key={t.slotKey}>
              <span className="adv-name">
                {t.label}
                {t.times > 0 ? ` ×${t.times}` : ''} {pill(true)}
              </span>
              <span className="adv-meta">{t.maxReached ? 'Maxi atteint' : ''}</span>
              <button className="btn small" disabled={t.maxReached || !afford(t.nextCost)} onClick={() => buyTalent(hero.id, t.label!)}>
                {t.times > 0 ? '+1' : 'Acquérir'} · {t.nextCost} PX
              </button>
            </div>
          ) : (
            <SlotChoiceRow
              key={t.slotKey}
              entry={t.entry}
              acquireCost={t.nextCost}
              afford={afford}
              options={t.options ?? []}
              onPick={(label, owned) => {
                if (owned) designateCareerSlot(hero.id, t.slotKey, label);
                else buyTalent(hero.id, label);
              }}
            />
          ),
        )}
      </div>
      </AdvSection>

      {(() => {
        // Sorts apprenables (LDB 46 « Mémoriser des Sorts » + Talents LDB 10) : visibles dès
        // qu'un Talent de lanceur est possédé. Bénédictions du culte = incluses (0 PX) ;
        // un sort du Chaos coûte AUSSI 1 Point de Corruption (l'achat l'applique).
        const learnable = learnableSpells(hero);
        if (!learnable.length) return null;
        return (
          <AdvSection title="Sorts — mémorisation" count={learnable.length}>
            <div className="adv-grid">
              {learnable.map(({ spell, cost }) => {
                const support = spellSupport(spellSpecFor(spell), isMagicMissile(spell));
                return (
                <div className="adv-row acquire" key={spell.label} title={spell.desc + (support !== 'mecanique' ? '\n\n📜 Tout ou partie de l’effet est journalisé (« arbitrage MJ ») — pas encore mécanisé.' : '')}>
                  <span className="adv-name">
                    {spell.label}{support === 'narratif' ? ' 📜' : support === 'partiel' ? ' 🟡' : ''}
                    <span className="muted"> · {spell.type}{spell.subType ? ` (${spell.subType})` : ''}{spell.cn != null ? ` · NI ${spell.cn}` : ''}</span>
                  </span>
                  <span className="adv-meta" />
                  <button className="btn small" disabled={cost > 0 && !afford(cost)} onClick={() => buySpell(hero.id, spell.label)}>
                    {cost > 0 ? `Mémoriser · ${cost} PX` : 'Inclus au Talent'}
                    {spell.type === 'Magie du Chaos' ? ' · +1 Corruption' : ''}
                  </button>
                </div>
                );
              })}
            </div>
          </AdvSection>
        );
      })()}

      <AdvSection title="Carrière">
      <div className="adv-career">
        <div className="adv-career-cur">
          <b>{v.levelLabel}</b> <span className="muted">niv. {v.careerLevel} · {v.status}</span>
          <span className={`career-status ${v.completed ? 'done' : ''}`}>{v.completed ? '✓ niveau complété' : 'niveau en cours'}</span>
        </div>
        {v.targets.map((t) => (
          <button
            key={t.level}
            className="btn small"
            disabled={!t.ok || !afford(t.cost)}
            title={t.reason}
            onClick={() => changeCareer(hero.id, t.career, t.level)}
          >
            {t.level > v.careerLevel ? 'Monter' : 'Redescendre'} : {t.label} (niv. {t.level}) · {t.cost} PX
            {!t.ok && t.reason ? ` — ${t.reason}` : ''}
          </button>
        ))}
        <div className="adv-change">
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">— changer de carrière (niv. 1) —</option>
            {careers
              .filter((c) => c.label !== v.career)
              .map((c) => (
                <option key={c.label} value={c.label}>
                  {c.label} ({c.class}) · {v.changeCostFor(c.label)} PX
                </option>
              ))}
          </select>
          <button
            className="btn small"
            disabled={!target || !afford(target ? v.changeCostFor(target) : v.changeCost)}
            onClick={() => {
              if (target) changeCareer(hero.id, target, 1);
              setTarget('');
            }}
          >
            Changer{target ? ` · ${v.changeCostFor(target)} PX` : ''}
          </button>
        </div>
      </div>
      </AdvSection>
    </div>
  );
}
