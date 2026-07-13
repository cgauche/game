import { useRef, useState, type ReactNode } from 'react';
import { useGame } from '../state/store';
import { bestDetector } from '../state/merchantFlow';
import { MINUTES_PER_DAY } from '../engine/clock';
import type { Duration } from '../engine/duration';
import { useModalA11y } from './Modal';
import { Tabs } from './Tabs';
import { maxEncumbrance, isWeaponActive, armourLayer, isCapeItem, giveTrappingLabel, itemLabel, weaponHands, isOffHandEligible, isWearable, containerFillEnc, canStow } from '../engine/items';
import { OptionChooser } from './OptionChooser';
import { CHAR_LABELS, HitLocation, ItemInstance, Combatant } from '../engine/types';
import { locationLabel } from '../engine/combat';
import { effectiveChar, charBonus } from '../engine/characteristics';
import { baseWithTalents } from '../engine/talentEffects';
import { refKey, parseRefKey } from '../engine/careerSlots';
import { weaponStatParts } from './weaponStats';
import { buildAdvancementView } from '../state/advancement';
import { hasHealSkill, isHealable } from '../engine/healing';
import { isConsumable } from '../engine/consumables';
import { isMagicMissile, isArcaneSpell } from '../engine/magic';
import { rule } from '../engine/policy';
import { canAfford, toMoney, formatMoney } from '../engine/money';
import { learnableSpells, canCastFromGrimoire, carriedGrimoire } from '../engine/grimoire';
import { spellSupport } from '../engine/spellspec';
import { spellEffectOps } from '../state/flow';
import { careers, findSpellById, findStarById, spells as allSpells, speciesSingular, findSkillById, skillInstanceLabel, findSpeciesById, findCareerById, careerLabelFor, findClassById, talentConcrete, symptomLabel, findTrappingById } from '../data';
import { weaponFormLabel } from '../gameIso/rig/parts/weaponForms';
import { formatTrait } from '../engine/traits/dispatch';
import { formatRemaining } from '../engine/disease';
import { CodexRef } from './compendium/CodexRef';
import { CharStatsGrid } from './CharStatsGrid';
import { CharValue } from './CharValue';
import { Coins } from './Coins';
import { TalentChip, QualityChips } from './EntityChip';
import { WoundsBadge } from './WoundsBadge';
import { FateChips } from './FateChips';
import { ColorPalettePickers } from './ColorPalettePickers';
import { EquipmentPanel } from './EquipmentPanel';
import { CharFrame } from './CharFrame';
import { PortraitTile } from './PortraitTile';
import { ItemIcon } from './ItemIcon';
import { MediaSelect } from './MediaSelect';
import { BackgroundPanel } from './BackgroundPanel';
import { Icon } from './Icon';
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

const LOC_SHORT: Record<HitLocation, string> = {
  tete: 'Tête',
  brasG: 'Bras G',
  brasD: 'Bras D',
  corps: 'Corps',
  jambeG: 'Jambe G',
  jambeD: 'Jambe D',
};

/** Description courte d'un effet actif (buff de carac, Trait/Talent accordé, enchantement…). */
function describeEffect(e: NonNullable<Combatant['activeEffects']>[number]): string {
  if (e.char) return `${e.bonus >= 0 ? '+' : ''}${e.bonus} ${CHAR_LABELS[e.char]}`;
  if (e.grantedTrait) return `Trait ${formatTrait(e.grantedTrait)}`;
  if (e.conjuredSet) return `Arme invoquée (${e.label})`;
  if (e.grantedTalent) return `Talent ${talentConcrete(e.grantedTalent)}`;
  if (e.apAll) return `+${e.apAll} PA (toutes Localisations)`;
  if (e.enchantRef) return 'Arme enchantée';
  if (e.weatherImmune) return 'Immunisé aux intempéries';
  if (e.suffocates) return 'Suffoque (−1 PB/Round)';
  if (e.noBreath) return 'Respiration superflue';
  if (e.ignoreStatePenalties) return 'Ignore les pénalités d’État';
  if (e.opsPerRound?.length) {
    const cond = e.opsPerRound.find((o) => o.op === 'condition');
    if (cond && cond.op === 'condition') return `${cond.name} chaque Round`;
    const give = e.opsPerRound.find((o) => o.op === 'giveTrapping');
    if (give && give.op === 'giveTrapping') return `${giveTrappingLabel(give)} chaque Round`;
    return 'Effet récurrent chaque Round';
  }
  if (e.grantedFortune) return `+${e.grantedFortune} Chance (le temps du Sort)`;
  if (e.grantedFate) return `+${e.grantedFate} Destin (le temps du Sort)`;
  return e.label;
}

/** Panneau « Effets actifs » : buffs/débuffs de Sort, Traits accordés, contrecoups d'incantation —
 *  surface tout ce qui modifie la fiche (métamorphose, bénédictions, enchantements…). */
function ActiveEffectsPanel({ hero }: { hero: Combatant }) {
  const fx = hero.activeEffects ?? [];
  const cp = hero.castPenalties ?? [];
  if (!fx.length && !cp.length) return null;
  // ActiveEffect porte `duration` (échelle discriminée) ; CastPenalty garde `roundsLeft`/`untilTime`.
  const dur = (e: { duration?: Duration; roundsLeft?: number; untilTime?: number }) => {
    if (e.duration) return e.duration.scale === 'rounds' ? ` · ${e.duration.left} R` : e.duration.scale === 'clock' ? ' · durée' : '';
    return e.roundsLeft != null ? ` · ${e.roundsLeft} R` : e.untilTime != null ? ' · durée' : '';
  };
  return (
    <>
      <div className="mini-title">Effets actifs</div>
      <div className="sheet-effects">
        {fx.map((e, i) => (
          <div className="skill-line" key={`e${i}`}>
            <span className="sk-name">{e.label}</span>
            <span className="sk-val">{describeEffect(e)}{dur(e)}</span>
          </div>
        ))}
        {cp.map((p, i) => (
          <div className="skill-line" key={`c${i}`}>
            <span className="sk-name">{p.label}</span>
            <span className="sk-val warn-text">{p.blocked ? 'Incantation bloquée' : p.maxZeroDR ? 'Prière plafonnée à 0 DR' : `${p.mod} ${p.skill}`}{dur(p)}</span>
          </div>
        ))}
      </div>
    </>
  );
}

type SheetTab = 'combat' | 'competences' | 'sac' | 'sorts' | 'background' | 'avancement';
const TAB_LABELS: Record<SheetTab, string> = {
  combat: 'Combat',
  competences: 'Compétences',
  sac: 'Sac',
  sorts: 'Sorts',
  background: 'Background',
  avancement: 'Avancement',
};

export function CharacterSheet({ heroId, onClose }: { heroId: string; onClose: () => void }) {
  // EN COMBAT, lire la copie de bataille (qui porte les effets actifs vivants — buffs, métamorphose,
  // dégâts…) plutôt que l'original du groupe ; hors combat, le groupe. → la fiche reflète l'état réel.
  const hero = useGame((s) => s.battle?.combatants.find((h) => h.id === heroId) ?? s.party.find((h) => h.id === heroId));
  const [tab, setTab] = useState<SheetTab>('combat');
  const boxRef = useRef<HTMLDivElement>(null);
  useModalA11y(boxRef, onClose); // dialogue au markup spécifique (header à onglets) → hook a11y partagé
  if (!hero) return null;

  const isCaster = (hero.spells?.length ?? 0) > 0;
  const tabs: SheetTab[] = ['combat', 'competences', 'sac', ...(isCaster ? ['sorts' as const] : []), 'background', 'avancement'];

  return (
    <div className="modal-overlay sheet-overlay" onClick={onClose}>
      <div ref={boxRef} role="dialog" aria-modal="true" className="modal sheet-modal" onClick={(e) => e.stopPropagation()}>
        <button className="btn small sheet-close" onClick={onClose} aria-label="Fermer">✕</button>

        {/* L'ESSENTIEL à gauche (portrait + identité + vitalité + carac, toujours visible) ;
            le détail en onglets à droite. */}
        <div className="sheet-layout">
          <aside className="sheet-aside">
            <div className="sheet-portrait">
              {/* Tuile full xl : jauge + États sur la fiche aussi (anneau or « méta »). */}
              <PortraitTile c={hero} ring="var(--gold)" variant="full" size="xl" />
              <h3>{hero.name}</h3>
              <span className="char-sub">
                <CodexRef category="races" label={findSpeciesById(hero.species)?.label ?? ''}>{speciesSingular(findSpeciesById(hero.species)?.label ?? hero.species)}</CodexRef> · <CodexRef category="careers" label={findCareerById(hero.career)?.label ?? ''}>{careerLabelFor(hero)}</CodexRef>
                {hero.careerLevel ? ` (niv. ${hero.careerLevel})` : ''}
              </span>
              {hero.star && (() => {
                const s = findStarById(hero.star); // `hero.star` = id STABLE → libellé à l'affichage
                const label = s?.label ?? hero.star;
                return (
                  <span className="char-sub star-sub">
                    ★ <CodexRef category="stars" label={label}>{label}</CodexRef>
                    {s?.signe ? ` — ${s.signe}` : ''}
                  </span>
                );
              })()}
            </div>
            <FicheBody hero={hero} section="profil" />
          </aside>
          <div className="sheet-main">
            <Tabs
              className="sheet-tabnav"
              variant="pill"
              tabs={tabs.map((t) => ({ key: t, label: TAB_LABELS[t] }))}
              active={tab}
              onChange={setTab}
            />
            <div className="sheet-tabbody">
              {tab === 'avancement' ? (
                <AdvancementPanel hero={hero} />
              ) : tab === 'sorts' ? (
                <SpellbookSection hero={hero} />
              ) : tab === 'background' ? (
                <BackgroundPanel hero={hero} />
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
  const buySpellComponent = useGame((s) => s.buySpellComponent);
  const removeSpellComponent = useGame((s) => s.removeSpellComponent);
  const money = useGame((s) => s.money);
  const [targetId, setTargetId] = useState(hero.id);
  const spells = (hero.spells ?? [])
    .map((x) => findSpellById(x)) // hero.spells = ids de sort (runtime)
    .filter((s): s is NonNullable<ReturnType<typeof findSpellById>> => !!s);
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
          title="Points de Péché : si le dé des unités d'un Test de Prière leur est inférieur ou égal, la Colère des dieux frappe — même sur un Test réussi. Chaque jet de Colère en expie 1."
        >
          <Icon id="ui/balance" size="sm" /> Péché : {hero.sinPoints}
        </span>
      )}
      <div className="spell-target">
        Cible :{' '}
        <div className="frame-row">
          {party.map((m) => (
            <CharFrame
              key={m.id}
              c={m}
              variant="vital"
              size="xs"
              selected={m.id === targetId}
              onClick={() => setTargetId(m.id)}
              title={m.id === hero.id ? `${m.name} (soi)` : m.name}
            />
          ))}
        </div>
      </div>
      <div className="spell-list">
        {spells.map((sp) => {
          const offensive = isMagicMissile(sp);
          const support = spellSupport(spellEffectOps(sp.effects), sp, offensive);
          return (
            <div className="spell-row" key={sp.label} title={support !== 'mecanique' ? 'Tout ou partie de l’effet est journalisé (« arbitrage MJ ») — pas encore mécanisé (cf. docs/sorts-implementation.md).' : undefined}>
              <span className="spell-name">
                <CodexRef category="spells" label={sp.label}>{sp.label}</CodexRef>
                {sp.cn != null ? ` · NI ${sp.cn}` : ''}
                {support === 'narratif' ? (<> <Icon id="nav/rules" size="sm" /></>) : support === 'partiel' ? (<> <Icon id="ui/partial" size="sm" /></>) : ''}
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
                      onClick={() => oocFocusSpell(hero.id, sp.id)}
                    >
                      <Icon id="flag/focus" size="sm" /> Focaliser
                    </button>
                  )}
                  <button className="btn small" onClick={() => oocCastSpell(hero.id, sp.id, targetId)}>
                    <Icon id="nav/dice" size="sm" /> Lancer
                  </button>
                </span>
              )}
            </div>
          );
        })}
        {grimoireSpells.map((sp) => (
          <div className="spell-row" key={`g-${sp.label}`} title="Lecture au grimoire : sort non mémorisé de votre Domaine — NI doublé, deux mains.">
            <span className="spell-name">
              <Icon id="nav/compendium" size="sm" /> <CodexRef category="spells" label={sp.label}>{sp.label}</CodexRef>
              {sp.cn != null ? ` · NI ${sp.cn}→${sp.cn * 2}` : ''}
            </span>
            {isMagicMissile(sp) ? (
              <span className="muted">en combat</span>
            ) : (
              <span className="spell-actions">
                <button className="btn small" onClick={() => oocCastSpell(hero.id, sp.id, targetId, true)}>
                  <Icon id="nav/compendium" size="sm" /> Lancer (grimoire)
                </button>
              </span>
            )}
          </div>
        ))}
      </div>
      {rule('magic-composant') === true && (() => {
        // Composants d'incantation (LDB 46 l.158-163) : achetés PAR Sort d'Arcane/Domaine connu,
        // coût = NI pistoles d'argent ; absorbent le contrecoup (Imparfaite Majeure→Mineure,
        // Mineure→annulée) puis sont consumés à l'incantation. Visible seulement règle ON.
        const arcane = spells.filter((sp) => isArcaneSpell(sp) && sp.cn != null);
        if (!arcane.length) return null;
        const owned = hero.componentSpells ?? [];
        const countOf = (id: string) => owned.filter((x) => x === id).length;
        return (
          <div className="spell-components">
            <span className="mini-title" title="Sacrifié à l'incantation pour dégrader une Incantation Imparfaite (Majeure → Mineure, Mineure → aucun effet) — LDB 46 l.158-163. Coût = NI pistoles d'argent.">
              <Icon id="magic/component" size="sm" /> Composants d'incantation
            </span>
            <div className="spell-list">
              {arcane.map((sp) => {
                const n = countOf(sp.id);
                const cost = toMoney({ silver: sp.cn! });
                const afford = canAfford(money, cost);
                return (
                  <div className="spell-row" key={`comp-${sp.id}`}>
                    <span className="spell-name">
                      <CodexRef category="spells" label={sp.label}>{sp.label}</CodexRef>
                      {n > 0 ? <span className="muted"> · ×{n}</span> : null}
                    </span>
                    <span className="spell-actions">
                      {n > 0 && (
                        <button className="btn small" title="Jeter un composant (pas de remboursement)" onClick={() => removeSpellComponent(hero.id, sp.id)}>
                          −
                        </button>
                      )}
                      <button
                        className="btn small"
                        disabled={!afford}
                        title={afford ? `Acheter un composant pour ${sp.label} (${formatMoney(cost)})` : `Bourse insuffisante (${formatMoney(cost)})`}
                        onClick={() => buySpellComponent(hero.id, sp.id)}
                      >
                        + <Coins money={cost} />
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/** Contrôle compact « En main » d'une arme du Sac (façon Dragon Age / Pillars) : assigne l'arme à la
 *  Main principale ou secondaire du set ACTIF. Réutilise OptionChooser (seg). La main secondaire impose
 *  −20 (LDB 14 l.139) et n'accepte qu'une arme de mêlée à une main ou un pistolet (LDB 14 l.138). Cliquer
 *  l'option déjà active la retire. (Verrouillé en combat : la bascule de set passe par la barre d'action.) */
function HandPicker({ hero, it }: { hero: Combatant; it: ItemInstance }) {
  const setLoadoutSlot = useGame((s) => s.setLoadoutSlot);
  const lo = (hero.loadouts ?? []).find((l) => l.id === hero.activeLoadoutId) ?? hero.loadouts?.[0];
  if (!lo) return null;
  const isMain = lo.main === it.uid;
  const isOff = lo.off === it.uid;
  const mainItem = lo.main ? (hero.items ?? []).find((i) => i.uid === lo.main) : undefined;
  const mainTwoH = mainItem ? weaponHands(mainItem) === 2 : false;
  const offOk = isOffHandEligible(it) && !mainTwoH;
  return (
    <div className="ir-hand" title="Régler la main qui tient cette arme (set actif)">
    <OptionChooser
      layout="seg"
      options={[
        {
          key: 'main',
          label: 'Principale',
          selected: isMain,
          title: 'Tenir dans la main principale',
          onSelect: () => setLoadoutSlot(hero.id, lo.id, 'main', isMain ? null : it.uid),
        },
        {
          key: 'off',
          label: <>2nde <em className="off-malus">−20</em></>,
          selected: isOff,
          disabled: !offOk,
          title: offOk
            ? 'Main secondaire : −20 aux attaques de cette main (LDB 14)'
            : mainTwoH
              ? 'Main principale à deux mains — pas de seconde main'
              : 'Inéligible : seules une arme de mêlée à une main ou un pistolet vont en seconde main',
          onSelect: () => setLoadoutSlot(hero.id, lo.id, 'off', isOff ? null : it.uid),
        },
      ]}
    />
    </div>
  );
}

/** Sélecteur visuel de FORME d'une arme ABSTRAITE (« Arme simple » → épée/hache/masse/marteau de
 *  guerre/demi-lance) : pose `ItemInstance.shape` parmi les `formChoices` du trapping. Option courante =
 *  `item.shape ?? trapping.shape` ; chaque option = la silhouette (ItemIcon par shape) + le libellé du
 *  WeaponDef. Cosmétique RAW (stats identiques) — verrouillé en combat (le token rendu vient de la
 *  copie de bataille, pas du groupe muté). Réutilise la primitive `MediaSelect`. */
function FormPicker({ hero, it }: { hero: Combatant; it: ItemInstance }) {
  const setItemShape = useGame((s) => s.setItemShape);
  const trapping = it.trappingId ? findTrappingById(it.trappingId) : undefined;
  const choices = trapping?.formChoices;
  if (!choices || choices.length < 2) return null;
  const current = it.shape ?? trapping?.shape ?? choices[0];
  return (
    <div className="ir-form" title="Forme de l’arme (silhouette)">
      <MediaSelect
        value={current}
        title="Choisir la forme de l’arme"
        options={choices.map((slug) => ({
          key: slug,
          media: <ItemIcon item={{ ...it, shape: slug }} size="sm" />,
          label: weaponFormLabel(slug),
        }))}
        onSelect={(slug) => setItemShape(hero.id, it.uid, slug)}
      />
    </div>
  );
}

function FicheBody({ hero, section }: { hero: Combatant; section: 'profil' | 'combat' | 'competences' | 'sac' }) {
  const toggleEquip = useGame((s) => s.toggleEquip);
  const stowItem = useGame((s) => s.stowItem);
  const transferItem = useGame((s) => s.transferItem);
  const setItemSkin = useGame((s) => s.setItemSkin);
  const usePartyItem = useGame((s) => s.usePartyItem);
  const trainProsthesis = useGame((s) => s.trainProsthesis);
  const appraiseItem = useGame((s) => s.appraiseItem);
  const inBattleNow = useGame((s) => !!s.battle);
  const [skinFor, setSkinFor] = useState<string | null>(null);
  const items = hero.items ?? [];
  const enc = hero.encumbrance ?? 0;
  const maxEnc = maxEncumbrance(hero);
  const over = enc > maxEnc;
  const party = useGame((s) => s.party);
  const openMedic = useGame((s) => s.openMedic);
  const inBattle = useGame((s) => !!s.battle);
  // Guérison hors-combat : un soigneur du groupe peut panser ce héros (sans avancer le temps,
  // pour stopper une hémorragie AVANT que l'horloge ne la fasse ticker — LDB 09-Compétences).
  const canSoigner = !inBattle && isHealable(hero) && party.some(hasHealSkill);
  // Détection d'artefact (LDB 10) : visible seulement si un héros du groupe possède le Talent.
  const canDetect = !!bestDetector(party);
  // Verrou d'Évaluation : un échec bloque la re-tentative jusqu'au lendemain (LDB 12 l.120).
  const today = useGame((s) => Math.floor(s.gameTime / MINUTES_PER_DAY));

  const itemStats = (it: ItemInstance): ReactNode => {
    // Objet non identifié : ses qualités sont MASQUÉES à l'affichage (elles restent actives au combat) ;
    // une identification RATÉE de beaucoup (ADE2) peut y ancrer de FAUSSES certitudes, affichées telles.
    // Identifié : qualités = chips canoniques (`QualityChips`, popover Codex).
    const quals: ReactNode = it.identified === false
      ? (it.suspectedQualities?.length ? `soupçonné : ${it.suspectedQualities.join(', ')}` : null)
      : (it.qualities.length ? <QualityChips qualities={it.qualities} /> : null);
    if (it.kind === 'melee' || it.kind === 'ranged') {
      // Dégâts résolus (« +BF+4 (7) ») + Allonge/Portée via le composeur partagé `weaponStatParts`
      // (BF du héros injecté, comme au combat) ; les qualités restent gérées ici (masquage non-identifié).
      const mech = weaponStatParts(it, charBonus(hero.characteristics, 'force')).join(' · ');
      return <>{mech}{mech && quals ? ' · ' : ''}{quals}</>;
    }
    if (it.kind === 'armor')
      return [it.pa != null && `PA ${it.pa}`, (it.locs ?? []).map((l) => LOC_SHORT[l]).join(', '), `couche ${armourLayer(it)}`]
        .filter(Boolean)
        .join(' · ');
    return quals;
  };

  return (
    <>
      {section === 'profil' && (<>
        <div className="sheet-vitals">
          <div className="stat-chip pv">
            <span className="sc-label" title="Blessures">Blessures</span>
            <span className="sc-value"><WoundsBadge wounds={hero.wounds} /></span>
          </div>
          <div className="stat-chip">
            <span className="sc-label" title="Mouvement"><CodexRef category="characteristics" label="Mouvement">Mouvement</CodexRef></span>
            <span className="sc-value">{hero.movement}</span>
          </div>
          <div className={`stat-chip ${over ? 'enc-over' : ''}`}>
            <span className="sc-label" title="Encombrement">Encombrement</span>
            <span className="sc-value">{enc}/{maxEnc}{over ? (<> <Icon id="ui/warning" size="sm" /></>) : ''}</span>
          </div>
        </div>
        {canSoigner && (
          <div className="row-flex">
            <button className="btn small" onClick={() => openMedic({ patientId: hero.id })}
              title="Soins du groupe (Tests de Guérison) — ouvre l'infirmerie sur ce héros">
              <Icon id="journal/heal" size="sm" /> Soins
            </button>
          </div>
        )}
        {hero.fate != null && (
          <div className="sheet-resources"><FateChips c={hero} /></div>
        )}
        <div className="mini-title">Caractéristiques</div>
        <CharStatsGrid
          className="sheet-stats"
          value={(k) => effectiveChar(hero, k)}
          valClass={(k) => { const b = baseWithTalents(hero, k), e = effectiveChar(hero, k); return e > b ? 'ok-text' : e < b ? 'warn-text' : ''; }}
          note={(k) => { const b = baseWithTalents(hero, k), e = effectiveChar(hero, k); return e !== b ? `Base ${b} (${e > b ? '+' : ''}${e - b} de modificateurs actifs)` : undefined; }}
        />
        <ActiveEffectsPanel hero={hero} />
      </>)}

      {section === 'combat' && <EquipmentPanel hero={hero} />}

      {section === 'competences' && (
      <div className="sheet-skills">
        <div className="mini-title">Compétences</div>
        <div className="skill-grid">
          {hero.skills.length === 0 && <span className="muted">Aucune.</span>}
          {hero.skills.map((s, i) => {
            const val = effectiveChar(hero, s.characteristic) + s.advances;
            return (
              <div className="skill-line" key={i} title={`${s.characteristic} ${effectiveChar(hero, s.characteristic)} + ${s.advances}`}>
                <span className="sk-name">
                  <CodexRef category="skills" label={findSkillById(s.skillId)?.label ?? s.skillId}>
                    {skillInstanceLabel(s)}
                  </CodexRef>
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
                <TalentChip key={i} talent={t} />
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
              <div className="inv-row" style={{ alignItems: 'center' }} title="Points de Corruption : au-delà de BFM + BE, chaque gain impose un Test de Résistance ou MUTATION.">
                <span className="ir-name"><Icon id="nav/mutation" size="sm" /> Corruption</span>
                <span className="ir-stats" style={{ marginLeft: 'auto', opacity: 0.85 }}>
                  {hero.corruption} point{(hero.corruption ?? 0) > 1 ? 's' : ''}{hero.damned ? ' — DAMNÉ' : ''}
                </span>
              </div>
            )}
            {(hero.mutations ?? []).map((m, i) => (
              <div key={`m${i}`} className="inv-row" title={m.note} style={{ alignItems: 'center' }}>
                <span className="ir-name"><Icon id="nav/mutation" size="sm" /> {m.label}</span>
                <span className="ir-stats" style={{ marginLeft: 'auto', opacity: 0.85 }}>
                  mutation {m.kind === 'physique' ? 'physique' : 'mentale'}
                </span>
              </div>
            ))}
            {(hero.traumas ?? []).map((t, i) => (
              <div key={`t${i}`} className="inv-row" title={t.desc} style={{ alignItems: 'center' }}>
                <span className="ir-name"><Icon id="medical/crutch" size="sm" /> {t.label}{t.location ? ` (${locationLabel(t.location, hero.bodyShape)})` : ''}{t.count != null && t.count > 1 ? ` ×${t.count}` : ''}</span>
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
              <div key={`d${i}`} className="inv-row" title={d.symptoms.map((s) => `${symptomLabel(s.symptomId)}${s.spec ? ` (${s.spec})` : ''}`).join(' · ')} style={{ alignItems: 'center' }}>
                <span className="ir-name"><Icon id="medical/infection" size="sm" /> {d.name}</span>
                <span className="ir-stats" style={{ marginLeft: 'auto', opacity: 0.85 }}>
                  {d.phase === 'incubation' ? `incubation : ${formatRemaining(d.minutesLeft)}` : `${formatRemaining(d.minutesLeft)} restants`}
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
          {(() => {
          const renderRow = (it: ItemInstance) => {
            const isProsthesis = it.subType === 'protheses'; // prothèse (LDB 73, Groupe id) : se PORTE pour annuler un malus d'amputation
            const isCape = isCapeItem(it); // cape/manteau : emplacement Cape (cosmétique, onglet Combat)
            const consumable = isConsumable(it); // bandages / potion : utilisable depuis la fiche
            const equipable = isWearable(it) && !consumable; // armure/accessoire porté sur le corps (LDB 61) — pas une arme (tenue), pas un consommable
            // Rangement (LDB 64) : contenants où CET objet tient ; objet rangeable = ni contenant, ni déjà rangé, ≥1 sac dispo.
            const containers = it.container || it.inside ? [] : items.filter((i) => i.container && canStow(hero, it, i.uid));
            const isWeaponItem = it.kind === 'melee' || it.kind === 'ranged';
            // E1 : état « en main » SANS jargon « set » (les sets = fonction avancée, cf. onglet Combat) —
            // on NOMME l'arme du set ACTIF Main principale / secondaire ; les autres armes n'affichent rien.
            const activeLo = (hero.loadouts ?? []).find((l) => l.id === hero.activeLoadoutId) ?? hero.loadouts?.[0];
            const handLabel = isWeaponItem
              ? (activeLo?.main === it.uid ? 'Main principale' : activeLo?.off === it.uid ? 'Main secondaire' : null)
              : null;
            // Surbrillance « équipé » : arme tenue dans le set ACTIF (plus de flag `equipped` d'arme) ; sinon armure portée.
            const highlighted = isWeaponItem ? isWeaponActive(hero, it.uid) : it.equipped;
            const isSkinnable = it.kind === 'melee' || it.kind === 'ranged' || it.kind === 'armor';
            const skinned = !!it.skin && Object.keys(it.skin).length > 0;
            const open = isSkinnable && skinFor === it.uid;
            return (
              <div key={it.uid}>
                <div className={`inv-row kind-${it.kind} ${highlighted ? 'equipped' : ''}`}>
                  <ItemIcon item={it} size="sm" />
                  <div className="ir-main">
                    <span className="ir-name">
                      <CodexRef category="trappings" label={itemLabel(it)}>{itemLabel(it)}</CodexRef>{skinned && (<> <Icon id="action/cast" size="sm" /></>)}
                      {it.identified === false && (
                        <span className="ir-unid" title="Objet non identifié — Évaluer (ou Détecter l'artefact) pour révéler ses qualités" style={{ marginLeft: 6, fontSize: '0.78em', color: '#b388ff' }}>
                          {it.magicKnown ? (<><Icon id="action/cast" size="sm" /> Magique — non identifié</>) : (<><Icon id="nav/identify" size="sm" /> Non identifié</>)}
                        </span>
                      )}
                    </span>
                    <span className="ir-stats">{itemStats(it)}</span>
                  </div>
                  <span className="ir-enc">Enc {it.enc}</span>
                  {it.container && (
                    <span className="ir-enc" title="Contenu rangé / capacité (Enc) — LDB 64"><Icon id="item/misc" size="sm" /> {containerFillEnc(hero, it.uid)}/{it.container.capacity}</span>
                  )}
                  {it.identified === false && !inBattleNow && (
                    <>
                      {it.appraiseTriedDay !== today && (
                        <button className="btn small" title="Évaluation (Int) : révèle les qualités cachées et estime le prix — un échec verrouille jusqu'à demain" onClick={() => appraiseItem(it.uid, hero.id)}>Évaluer</button>
                      )}
                      {canDetect && !it.detectTried && (
                        <button className="btn small" title="Détection d'artefact (Intuition, au toucher) : sentir l'aura magique — une seule tentative par objet" onClick={() => appraiseItem(it.uid, hero.id, 'detect')}>Détecter</button>
                      )}
                    </>
                  )}
                  {isSkinnable && (
                    <button
                      className={`btn small ${open ? 'btn-primary' : ''}`}
                      title="Skin légendaire (recoloriser cet objet)"
                      onClick={() => setSkinFor(open ? null : it.uid)}
                    >
                      <Icon id="action/cast" size="sm" />
                    </button>
                  )}
                  {isProsthesis && it.equipped && it.trappingId === 'crochet' && !it.prosthesisTrained && (
                    <button
                      className="btn small"
                      title="Maîtriser le crochet : armes à deux mains de nouveau possibles (400 PX)"
                      disabled={(hero.xp ?? 0) < 400}
                      onClick={() => trainProsthesis(hero.id, it.uid)}
                    >
                      2 mains (400 PX)
                    </button>
                  )}
                  {isProsthesis && it.equipped && it.trappingId === 'fausse-jambe' && !it.prosthesisMoveTrained && (
                    <button
                      className="btn small"
                      title="S’entraîner à la fausse jambe : Mouvement plein retrouvé (100 PX, LDB 73)"
                      disabled={(hero.xp ?? 0) < 100}
                      onClick={() => trainProsthesis(hero.id, it.uid)}
                    >
                      Mouvement (100 PX)
                    </button>
                  )}
                  {isProsthesis && it.equipped && it.trappingId === 'fausse-jambe' && it.prosthesisMoveTrained && !it.prosthesisTrained && (
                    <button
                      className="btn small"
                      title="Réapprendre l’Esquive avec la fausse jambe (200 PX)"
                      disabled={(hero.xp ?? 0) < 200}
                      onClick={() => trainProsthesis(hero.id, it.uid)}
                    >
                      Esquive (200 PX)
                    </button>
                  )}
                  {isWeaponItem && !inBattleNow && <FormPicker hero={hero} it={it} />}
                  {isWeaponItem && (
                    inBattleNow ? (
                      handLabel && (
                        <span className="ir-loadout on" title="Arme en main (verrouillé en combat — changez de set depuis la barre d’action)">
                          <Icon id="item/weapon" size="sm" /> {handLabel}
                        </span>
                      )
                    ) : (
                      <HandPicker hero={hero} it={it} />
                    )
                  )}
                  {equipable ? (
                    <button
                      className={`btn small ${it.equipped ? 'btn-primary' : ''}`}
                      disabled={inBattleNow}
                      title={inBattleNow ? 'Équipement verrouillé en combat (seul le changement de set d’armes est permis)' : isProsthesis ? 'Porter la prothèse (annule le malus d’amputation correspondant)' : isCape ? 'Porter la cape (cosmétique — visible dans le dos du héros)' : it.kind === 'misc' ? 'Porter (−1 Enc)' : undefined}
                      onClick={() => toggleEquip(hero.id, it.uid)}
                    >
                      {it.kind === 'armor' ? (it.equipped ? 'Équipé' : 'Équiper') : it.equipped ? 'Portée' : 'Porter'}
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
                  {containers.length > 0 && !inBattleNow && (
                    <MediaSelect
                      align="right"
                      triggerClassName="btn small"
                      title="Ranger dans un contenant (LDB 64)"
                      trigger={<Icon id="item/misc" size="sm" />}
                      options={containers.map((bag) => ({
                        key: bag.uid,
                        media: <ItemIcon item={bag} size="sm" />,
                        label: itemLabel(bag),
                        sub: `${containerFillEnc(hero, bag.uid)}/${bag.container?.capacity ?? 0}`,
                      }))}
                      onSelect={(cid) => stowItem(hero.id, it.uid, cid)}
                    />
                  )}
                  {party.length > 1 && !inBattleNow && (
                    <MediaSelect
                      align="right"
                      triggerClassName="btn small"
                      title="Donner cet objet à un autre héros"
                      trigger={<Icon id="action/pick-up" size="sm" />}
                      options={party.filter((p) => p.id !== hero.id).map((p) => ({
                        key: p.id,
                        media: <CharFrame c={p} variant="identity" size="xs" />,
                        label: p.name,
                      }))}
                      onSelect={(pid) => transferItem(it.uid, hero.id, pid)}
                    />
                  )}
                </div>
                {open && (
                  <div className="inv-skin" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '6px 8px', background: 'rgba(0,0,0,0.18)', borderRadius: 4 }}>
                    <ItemIcon item={it} size="lg" />
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
                {it.container && (() => {
                  const stowed = items.filter((i) => i.inside === it.uid);
                  return stowed.length ? (
                    <div className="inv-nested">
                      {stowed.map((s) => (
                        <div key={s.uid} className={`inv-row kind-${s.kind}`}>
                          <ItemIcon item={s} size="sm" />
                          <span className="ir-name">{itemLabel(s)}</span>
                          <span className="ir-enc" style={{ marginLeft: 'auto' }}>Enc {s.enc}</span>
                          <button className="btn small" disabled={inBattleNow} title="Sortir du contenant" onClick={() => stowItem(hero.id, s.uid, null)}>Sortir</button>
                        </div>
                      ))}
                    </div>
                  ) : null;
                })()}
              </div>
            );
          };
          // E3 : sous-catégories du Sac — chaque objet dans son PREMIER groupe correspondant.
          const GROUPS: { label: string; pred: (it: ItemInstance) => boolean }[] = [
            { label: 'Armes', pred: (it) => it.kind === 'melee' || it.kind === 'ranged' },
            { label: 'Armures & protections', pred: (it) => it.kind === 'armor' || isCapeItem(it) },
            { label: 'Consommables', pred: isConsumable },
            { label: 'Divers', pred: () => true },
          ];
          const partition: ItemInstance[][] = GROUPS.map(() => []);
          // Niveau supérieur = objets NON rangés ; les objets `inside` sont rendus IMBRIQUÉS sous leur contenant.
          for (const it of items.filter((i) => !i.inside)) {
            const gi = GROUPS.findIndex((g) => g.pred(it));
            partition[gi].push(it);
          }
          return GROUPS.map((g, gi) => {
            const list = partition[gi];
            return list.length ? (
              <div key={g.label}>
                <div className="mini-title">{g.label}</div>
                {list.map(renderRow)}
              </div>
            ) : null;
          });
          })()}
        </div>
      </div>
      )}
    </>
  );
}

/** Ligne d'un emplacement à choix (compétence ou talent) : sélecteur d'option + Désigner/Acquérir.
 *  Une option DÉJÀ possédée (via l'espèce…) se DÉSIGNE gratuitement — elle devient le choix de
 *  carrière de l'emplacement et donc montable en PX ; une nouvelle option s'achète. */
/** `label` = valeur DE CÂBLAGE (concreteLabel exact, ré-utilisé tel quel par `onPick` — jamais reparsé
 *  ici) ; `display` = texte affiché si distinct (une spec de Groupe d'arme est un id, `display` porte
 *  son libellé résolu via `specLabel` — l'id ne doit jamais s'afficher brut). */
function SlotChoiceRow({
  entry,
  options,
  acquireCost,
  afford,
  onPick,
}: {
  entry: string;
  options: { label: string; display?: string; owned: boolean; hint?: string }[];
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
            {o.display ?? o.label}
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

/** Catégorie repliable de l'Avancement : compose la primitive `.fold` (section repliable). */
function AdvSection({ title, count, badge, children }: { title: string; count?: number; badge?: ReactNode; children: ReactNode }) {
  return (
    <details className="fold" open>
      <summary>
        <span className="fold-title">{title}</span>
        {count != null && <span className="count">{count}</span>}
        {badge}
      </summary>
      <div className="fold-body">{children}</div>
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
              <CharValue charKey={c.key} value={c.value} /> {pill(c.inCareer)}
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
          <div className={`adv-row ${s.known ? '' : 'acquire'}`} key={`${s.skillId}|${s.spec ?? ''}`}>
            <span className="adv-name">
              {skillLabel(s.name, s.spec)} <em>{baseWithTalents(hero, s.characteristic) + s.advances}</em> {pill(s.inCareer)}
              {s.known ? '' : <span className="acquire-tag">à apprendre</span>}
            </span>
            <span className="adv-meta">+{s.advances}</span>
            <button className="btn small" disabled={!afford(s.nextCost)} onClick={() => buySkillAdvance(hero.id, s.skillId, s.spec)}>
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
              label: refKey(slot.groupId, o.spec), // clé de câblage OPAQUE (id+spec), jamais affichée
              display: `${slot.group} (${o.display})`,
              owned: o.ownedAdvances > 0,
              hint: o.ownedAdvances > 0 ? `+${o.ownedAdvances}` : undefined,
            }))}
            onPick={(key, owned) => {
              const { id, spec } = parseRefKey(key);
              if (owned) designateCareerSlot(hero.id, slot.slotKey, id, spec);
              // Acheter la 1re Augmentation désigne l'emplacement (LDB 09 l.38).
              else buySkillAdvance(hero.id, id, spec);
            }}
          />
        ))}
      </div>
      </AdvSection>

      <AdvSection title={`Talents du niveau ${v.careerLevel}`} count={v.talents.length}>
      <div className="adv-grid">
        {v.talents.length === 0 && <span className="muted">Aucun Talent de carrière disponible.</span>}
        {v.talents.map((t) =>
          t.talentId ? (
            <div className={`adv-row ${t.times > 0 ? '' : 'acquire'}`} key={t.slotKey}>
              <span className="adv-name">
                {t.label}
                {t.times > 0 ? ` ×${t.times}` : ''} {pill(true)}
              </span>
              <span className="adv-meta">{t.maxReached ? 'Maxi atteint' : ''}</span>
              <button className="btn small" disabled={t.maxReached || !afford(t.nextCost)} onClick={() => buyTalent(hero.id, t.talentId!, t.spec)}>
                {t.times > 0 ? '+1' : 'Acquérir'} · {t.nextCost} PX
              </button>
            </div>
          ) : (
            <SlotChoiceRow
              key={t.slotKey}
              entry={t.entry}
              acquireCost={t.nextCost}
              afford={afford}
              options={(t.options ?? []).map((o) => ({ label: o.refKey, display: o.display, owned: o.owned }))}
              onPick={(key, owned) => {
                const { id, spec } = parseRefKey(key);
                if (owned) designateCareerSlot(hero.id, t.slotKey, id, spec);
                else buyTalent(hero.id, id, spec);
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
                const support = spellSupport(spellEffectOps(spell.effects), spell, isMagicMissile(spell));
                return (
                <div className="adv-row acquire" key={spell.label} title={support !== 'mecanique' ? 'Tout ou partie de l’effet est journalisé (« arbitrage MJ ») — pas encore mécanisé.' : undefined}>
                  <span className="adv-name">
                    <CodexRef category="spells" label={spell.label}>{spell.label}</CodexRef>{support === 'narratif' ? (<> <Icon id="nav/rules" size="sm" /></>) : support === 'partiel' ? (<> <Icon id="ui/partial" size="sm" /></>) : ''}
                    <span className="muted"> · {spell.type}{spell.subType ? ` (${spell.subType})` : ''}{spell.cn != null ? ` · NI ${spell.cn}` : ''}</span>
                  </span>
                  <span className="adv-meta" />
                  <button className="btn small" disabled={cost > 0 && !afford(cost)} onClick={() => buySpell(hero.id, spell.id)}>
                    {cost > 0 ? `Mémoriser · ${cost} PX` : 'Inclus au Talent'}
                    {spell.family === 'chaos' ? ' · +1 Corruption' : ''}
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
              .filter((c) => c.id !== v.career)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} ({findClassById(c.class)?.label ?? c.class}) · {v.changeCostFor(c.id)} PX
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
