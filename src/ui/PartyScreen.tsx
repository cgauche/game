import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useGame, type GameState } from '../state/store';
import type { NetState } from '../state/netFlow';
import { makePregens } from '../data/pregens';
import { rosterLoad, rosterRemove, rosterAdd, rosterExport, rosterImport } from '../state/roster';
import { downloadText, fileSlug } from '../state/fileIo';
import { campaign, builtinCampaigns } from '../scenes/campaign';
import { publishedProjects } from '../state/projectLibrary';
import { Combatant } from '../engine/types';
import { Money } from '../engine/money';
import { itemLabel } from '../engine/items';
import { axisScore, dominantAxes, AXIS_QUALIFY_MIN } from '../engine/axes';
import { Coins } from './Coins';
import {
  CandidateCard, SeatCard, ActionCard, heroStatusLabel, heroSubtitle,
  axisDataFor, heroRoseAxes, type RecruitState,
} from './CharCard';
import { CharacterSheet } from './CharacterSheet';
import { HeroPresentation } from './HeroPresentation';
import { Modal } from './Modal';
import { ScreenShell } from './ScreenShell';
import { GatedAction } from './GatedAction';
import { MetalStatus } from './MetalStatus';
import { RoseAxes } from './RoseAxes';
import { CharacterPreview } from './CharacterPreview';
import { DetailFrame } from './DetailFrame';
import { MasterDetail } from './MasterDetail';
import { CharStatsGrid } from './CharStatsGrid';
import { SkillChip, TalentChip, EntityRef } from './EntityChip';
import { Icon } from './Icon';
import { Tabs } from './Tabs';
import { CORE_AXIS_IDS, findSpellById } from '../data';
import { resolveActiveAxes } from '../state/worldMap';
import { t } from '../i18n';

/**
 * Écran d'équipe — solo ET coop. En coop, l'hôte attribue chaque SIÈGE (`net.slots`) ; chaque joueur
 * remplit LES SIENS (créer / roster local / pré-tiré) via `partyAddHero` — enveloppé en intent côté
 * invité, l'hôte reste autoritaire.
 *
 * STRUCTURE (arbitrage user 2026-07-13) : l'écran de groupe = LA COMPAGNIE SEULE (aucune galerie de
 * candidats inline — c'est un écran à part). Une grille de sièges : occupé = carte RICHE (portrait +
 * archétype + rôle + accroche, personnage cliquable → présentation) ; vide = placeholder sobre avec
 * deux actions « Créer » (créateur) / « Choisir » (sélecteur dédié). Le sélecteur (`HeroSelector`,
 * plein-champ `ScreenShell`) porte les onglets Mes personnages / Pré-tirés, les grandes cartes-portraits
 * et l'import — c'est LÀ qu'on recrute ou remplace. La compagnie a toujours toute la place (le problème
 * « 3/4 d'écran figé sur des candidats » disparaît).
 *
 * C'est AUSSI ici que se choisit la campagne (cartouche Campagne + « Changer ») — solo comme coop
 * (hôte seul ; les invités voient le nom via le snapshot). Le choix par défaut est l'Arène.
 */

/** Nav clavier des sièges (roving tabindex) : flèches Haut/Bas (colonne d'équipe) — ⇄ tolérées —
 *  vers le siège voisin (bouclé), Enter/Espace = présentation du héros assis (aucune action sur un
 *  siège vide — le recrutement se joue au sélecteur). Pur. */
export function slotKeyNav(key: string, idx: number, count: number): { focus: number } | 'primary' | null {
  const prev = key === 'ArrowUp' || key === 'ArrowLeft';
  const next = key === 'ArrowDown' || key === 'ArrowRight';
  if (prev || next) return { focus: (idx + (prev ? -1 : 1) + count) % count };
  return key === 'Enter' || key === ' ' ? 'primary' : null;
}

/** Appariement sièges → héros : le k-ième siège attribué au joueur S affiche le k-ième héros possédé
 *  par S (ordre de `party`). Les héros orphelins sont reversés dans les sièges vides restants. */
function slotViews(party: Combatant[], slots: number[], ownership: Record<string, number>) {
  const queues = new Map<number, Combatant[]>();
  for (const h of party) {
    const seat = ownership[h.id] ?? 0;
    queues.set(seat, [...(queues.get(seat) ?? []), h]);
  }
  const views = [0, 1, 2, 3].map((i) => {
    const seat = slots[i] ?? 0;
    return { seat, hero: queues.get(seat)?.shift() };
  });
  const leftovers = [...queues.values()].flat();
  for (const v of views) if (!v.hero && leftovers.length) v.hero = leftovers.shift();
  return views;
}

export function PartyScreen() {
  const party = useGame((s) => s.party);
  const net = useGame((s) => s.net);
  const setScreen = useGame((s) => s.setScreen);
  const startScene = useGame((s) => s.startScene);
  const loadProject = useGame((s) => s.loadProject);
  const pendingCampaign = useGame((s) => s.pendingCampaign);
  const sceneInProgress = useGame((s) => s.scene != null);
  const addHero = useGame((s) => s.partyAddHero);
  const removeHero = useGame((s) => s.partyRemoveHero);
  const replaceHero = useGame((s) => s.partyReplaceHero);
  const setEditingHero = useGame((s) => s.setEditingHero);
  const assignSlot = useGame((s) => s.netAssignSlot);
  const leave = useGame((s) => s.netLeave);
  const [campaignPick, setCampaignPick] = useState(false);

  const startCampaign = () => {
    if (pendingCampaign) {
      loadProject(pendingCampaign.scenes, pendingCampaign.startSceneId, pendingCampaign.worldMap ?? null);
    } else {
      startScene(campaign[0].scene);
    }
    setScreen('campaign');
  };

  const inProgress = sceneInProgress && !pendingCampaign;
  // Le choix de campagne appartient à l'hôte (ou au solo), hors partie en cours (« Reprendre »).
  const canPickCampaign = net.mode !== 'guest' && !inProgress;
  // Axes ACTIFS de la campagne (#409/#417) : `resolveActiveAxes` lit `activeAxes` sur
  // `pendingCampaign` (`ProjectDoc`, `state/worldMap.ts`) et retombe sur le socle `CORE_AXIS_IDS`
  // si absent — SOURCE UNIQUE de ce défaut, jamais un `?? []` dispersé côté écran.
  const axisIds = resolveActiveAxes(pendingCampaign ?? {});

  return (
    <>
      <PartyScreenView
        party={party}
        net={net}
        axisIds={axisIds}
        title={t('party.title')}
        campaignName={pendingCampaign ? pendingCampaign.name : t('campaign.builtin')}
        onChangeCampaign={canPickCampaign ? () => setCampaignPick(true) : undefined}
        inProgress={inProgress}
        onMenu={() => setScreen('menu')}
        onQuitCoop={() => { leave(); setScreen('menu'); }}
        onCreate={() => { setEditingHero(null); setScreen('creator'); }}
        onEditHero={(id) => { setEditingHero(id); setScreen('creator'); }}
        onAddHero={addHero}
        onRemoveHero={removeHero}
        onReplaceHero={(oldId, hero) => {
          // Le remplaçant prend le siège qui possédait l'ancien (solo : hôte, siège 0).
          const seat = net.ownership[oldId] ?? net.mySeat ?? 0;
          replaceHero(oldId, hero, seat);
        }}
        onAssignSlot={assignSlot}
        onStart={startCampaign}
        onResume={() => setScreen('campaign')}
      />
      {campaignPick && (
        <CampaignSelect currentName={pendingCampaign?.name ?? null} onClose={() => setCampaignPick(false)} />
      )}
    </>
  );
}

/** Modale de choix de la campagne : l'Arène (intégrée) + les projets PUBLIÉS de l'éditeur. */
function CampaignSelect({ currentName, onClose }: { currentName: string | null; onClose: () => void }) {
  const setPendingCampaign = useGame((s) => s.setPendingCampaign);
  const published = useState(() => publishedProjects())[0];
  const pick = (pc: GameState['pendingCampaign']) => {
    setPendingCampaign(pc);
    onClose();
  };
  return (
    <Modal variant="plain" className="picker-modal" title={t('party.campaign.pick.title')} onClose={onClose} backdropClose>
        <div className="pregen-list">
          <div className="pregen-row">
            <span className="campaign-row-name"><Icon id="scenario/arena" size="sm" /> {t('campaign.builtin')}</span>
            <button className="btn small btn-primary" disabled={currentName == null} onClick={() => pick(null)}>
              {currentName == null ? t('party.campaign.pick.current') : t('party.campaign.pick.choose')}
            </button>
          </div>
          {builtinCampaigns.map((c) => (
            <div key={c.id} className="pregen-row">
              <span className="campaign-row-name"><Icon id={c.icon} size="sm" /> {c.name}</span>
              <button
                className="btn small btn-primary"
                disabled={currentName === c.name}
                onClick={() => pick({ name: c.name, scenes: c.scenes, startSceneId: c.startSceneId, worldMap: c.worldMap })}
              >
                {currentName === c.name ? t('party.campaign.pick.current') : t('party.campaign.pick.choose')}
              </button>
            </div>
          ))}
          {published.map((p) => (
            <div key={p.id} className="pregen-row">
              <span className="campaign-row-name"><Icon id="nav/campaign" size="sm" /> {p.name}</span>
              <button
                className="btn small btn-primary"
                disabled={currentName === p.name}
                onClick={() => pick({ name: p.name, scenes: p.project.scenes, startSceneId: p.startSceneId, worldMap: p.project.worldMap ?? null })}
              >
                {currentName === p.name ? t('party.campaign.pick.current') : t('party.campaign.pick.choose')}
              </button>
            </div>
          ))}
        </div>
        <button className="btn" onClick={onClose}>
          {t('party.campaign.pick.close')}
        </button>
    </Modal>
  );
}

/** Cible ouverte dans le sélecteur dédié : recruter un siège vide, ou remplacer un héros en place. */
type SelectorTarget = { mode: 'recruit' } | { mode: 'replace'; heroId: string };

/** Couverture de GROUPE par axe + PORTEUR (le meilleur score) — même seuil `AXIS_QUALIFY_MIN` que le
 *  jumeau moteur `partyCoverage` (`engine/axes.ts`), réutilisé pour retrouver QUI porte la meilleure
 *  valeur QUALIFIÉE, ce que `partyCoverage` seul (agrégat nu, sans porteur) ne donne pas (#417 rail
 *  de composition). Sous le seuil : `value` ramené à 0 ET `heroName` omis — « à pourvoir », jamais une
 *  fausse couverture par Caractéristique nue (réfutation utilisateur 2026-07-15, le rail affichait
 *  Sigmund sur Discrétion à 0.31 < 0.45 alors que la carte de siège l'écartait déjà). */
function partyCoverageWithHero(party: Combatant[], axisIds: string[]): { id: string; label: string; value: number; heroName?: string }[] {
  return axisDataFor(axisIds).map((axis) => {
    let best = 0;
    let heroName: string | undefined;
    for (const h of party) {
      const v = axisScore(h, axis);
      if (v > best) { best = v; heroName = h.name; }
    }
    return best >= AXIS_QUALIFY_MIN ? { id: axis.id, label: axis.label, value: best, heroName } : { id: axis.id, label: axis.label, value: 0 };
  });
}

/** Numéraux romains des 4 sièges (« Contrat I »…« Contrat IV ») — habillage cérémoniel de la
 *  grille (`compagnie-mock0.png`, #417 correction de cap 2026-07-14 ; mot « acte » de la maquette
 *  remplacé par « contrat » [entériné 2026-07-14], moins ambigu). */
const ACT_ROMAN = ['I', 'II', 'III', 'IV'];
/** Nombre en toutes lettres (0-4, le format d'un mot dans le sous-titre « quatre sièges — deux
 *  scellés » — jamais un chiffre nu dans ce libellé cérémoniel). */
const NUM_WORDS_FR = ['zéro', 'un', 'deux', 'trois', 'quatre'];

/** Énumération « à la française » (Oxford comma absent, dernier élément lié par « et »). Pur. */
function joinFr(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}

/** Phrase de synthèse du pied d'écran — composée depuis `partyCoverageWithHero` (axes ACTIFS à
 *  pourvoir), textes du patron `compagnie-mock0.png` (#417 correction de cap 2026-07-14). */
function partySummaryText(party: Combatant[], axisIds: string[]): string {
  const n = party.length;
  const engaged = n === 0
    ? t('party.acts.summary.engaged.zero')
    : n === 1
      ? t('party.acts.summary.engaged.one')
      : t('party.acts.summary.engaged.many', { n });
  const ready = n > 0 ? t('party.acts.summary.ready') : t('party.acts.summary.notReady');
  const vierges = 4 - n;
  const missingAxes = partyCoverageWithHero(party, axisIds).filter((c) => c.value === 0).map((c) => c.label);
  const viergePart = vierges === 0
    ? t('party.acts.summary.vierge.zero')
    : missingAxes.length === 0
      ? t(vierges === 1 ? 'party.acts.summary.vierge.one.plain' : 'party.acts.summary.vierge.many.plain', { n: vierges })
      : t(vierges === 1 ? 'party.acts.summary.vierge.one' : 'party.acts.summary.vierge.many', { n: vierges, axes: joinFr(missingAxes) });
  return `${engaged} — ${ready} ; ${viergePart}.`;
}

/** Rail du REGISTRE de compagnie : cartouche de campagne + rose de COMPOSITION (médaillon agrégé) +
 *  rangées d'axes (alvéole allumée = couverte + porteur, pointillés = à pourvoir). AIDE, jamais un
 *  blocage — le rail ne gate rien (#417, planche-compagnie.html §A). */
function CompanyRail({ party, axisIds, campaignName, onChangeCampaign }: {
  party: Combatant[];
  axisIds: string[];
  campaignName?: string;
  onChangeCampaign?: () => void;
}) {
  const coverage = partyCoverageWithHero(party, axisIds);
  return (
    <aside className="party-rail">
      {campaignName && (
        <div className="camp-plate">
          <span className="camp-plate-eyebrow">{t('party.campaign.label')}</span>
          <span className="camp-plate-name">{campaignName}</span>
          {onChangeCampaign && (
            <button className="btn small" onClick={onChangeCampaign}>{t('party.campaign.change')}</button>
          )}
        </div>
      )}
      <div className="mini-title">{t('party.rail.composition')}</div>
      <div className="party-rail-rose">
        <RoseAxes
          axes={coverage.map((c) => ({ id: c.id, label: c.label, value: c.value > 0 ? c.value : null }))}
          size="medal"
          title={t('party.rose.company.title')}
        />
      </div>
      <div className="compo">
        {coverage.map((c) => (
          <div className={`compo-row${c.value > 0 ? '' : ' miss'}`} key={c.id}>
            <span className={`socket${c.value > 0 ? ' lit' : ''}`} aria-hidden="true" />
            <span className="compo-ax">{c.label}</span>
            <span className="compo-who">{c.heroName ?? t('party.rail.missing')}</span>
          </div>
        ))}
      </div>
      <p className="c-note party-rail-hint">{t('party.rail.hint')}</p>
    </aside>
  );
}

/** Vue pure de l'écran d'équipe (testable sans store — le rendu statique des tests lit
 *  l'état INITIAL de zustand, pas l'état muté). */
export function PartyScreenView({
  party,
  net,
  title,
  campaignName,
  onChangeCampaign,
  axisIds = CORE_AXIS_IDS,
  inProgress,
  onMenu,
  onQuitCoop,
  onCreate,
  onEditHero,
  onAddHero,
  onRemoveHero,
  onReplaceHero,
  onAssignSlot,
  onStart,
  onResume,
}: {
  party: Combatant[];
  net: NetState;
  title: string;
  /** Campagne sélectionnée (cartouche du rail). Absent = cartouche masqué (vue partielle/tests). */
  campaignName?: string;
  /** Axes ACTIFS de la campagne (rose des forces, rail de composition, #417). `CORE_AXIS_IDS` par défaut. */
  axisIds?: string[];
  /** Ouvre le choix de campagne — absent = lecture seule (invité coop, partie en cours). */
  onChangeCampaign?: () => void;
  /** Une partie est en cours (scène vivante, hors lancement explicite de campagne) :
   *  « Reprendre » prend la primauté, « Commencer » resterait sinon le seul chemin et
   *  écraserait silencieusement la progression (chargement d'une save coop inclus). */
  inProgress?: boolean;
  onMenu: () => void;
  onQuitCoop: () => void;
  onCreate: () => void;
  /** Ouvre le créateur en MODIFICATION pour ce héros (bouton « Modifier »). Absent = non éditable. */
  onEditHero?: (heroId: string) => void;
  onAddHero: (h: Combatant, wealth?: Money) => void;
  onRemoveHero: (heroId: string) => void;
  /** Remplace EN PLACE le héros `oldId` par celui choisi dans le sélecteur (bouton « Remplacer »).
   *  Absent = pas de bouton « Remplacer ». La bourse (`wealth`) est ignorée (pas un recrutement). */
  onReplaceHero?: (oldId: string, hero: Combatant, wealth?: Money) => void;
  onAssignSlot: (slot: number, seat: number) => void;
  onStart: () => void;
  onResume?: () => void;
}) {
  // Sélecteur dédié ouvert (recrutement d'un siège vide OU remplacement ciblé).
  const [selector, setSelector] = useState<SelectorTarget | null>(null);
  // Roving tabindex : UN seul siège tabbable ; flèches haut/bas entre sièges, Enter/Espace = présentation
  // du héros assis. Cf. `slotKeyNav` (pur).
  const [focusSlot, setFocusSlot] = useState(0);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Cliquer le portrait/nom d'un héros ouvre sa PRÉSENTATION (récit) ; « Fiche complète » y mène ensuite
  // à CharacterSheet (chiffres) pour un membre du groupe.
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [presentHero, setPresentHero] = useState<Combatant | null>(null);
  // Solo : carte siège→héros STABLE — le siège d'un héros retiré RESTE en place (le trou ne file plus
  // à droite). Réconciliée avec `party`. En coop, on garde `slotViews` (sièges attribués).
  const [slotMap, setSlotMap] = useState<(string | null)[]>(() => {
    const m: (string | null)[] = [null, null, null, null];
    party.forEach((h, i) => { if (i < 4) m[i] = h.id; });
    return m;
  });
  useEffect(() => {
    setSlotMap((prev) => {
      const ids = new Set(party.map((h) => h.id));
      const next = prev.map((id) => (id && ids.has(id) ? id : null));
      const placed = new Set(next.filter((x): x is string => !!x));
      for (const h of party) {
        if (placed.has(h.id)) continue;
        const e = next.indexOf(null);
        if (e >= 0) { next[e] = h.id; placed.add(h.id); }
      }
      return next.every((v, i) => v === prev[i]) ? prev : next;
    });
  }, [party]);

  const coop = net.mode !== 'local';
  const isHost = net.mode !== 'guest';
  const seats = Object.entries(net.seatNames).map(([s, n]) => ({ seat: Number(s), name: n }));
  const seatName = (seat: number) =>
    net.seatNames[seat] ?? (seat === 0 ? t('party.seat.host') : t('party.seat.player', { n: seat + 1 }));
  const views = coop
    ? slotViews(party, net.slots ?? [0, 0, 0, 0], net.ownership)
    : slotMap.map((id) => ({ seat: 0, hero: id ? party.find((h) => h.id === id) : undefined }));
  const ownsHero = (id: string) => !coop || (net.ownership[id] ?? 0) === net.mySeat;
  /** Un siège attribué à un invité n'est pas rempli → l'hôte ne peut pas lancer. */
  const guestPending = views.some((v) => v.seat !== 0 && !v.hero);

  // Recrutement / remplacement : un seul chemin, le SÉLECTEUR dédié.
  const onSelectorPick = (h: Combatant, wealth?: Money) => {
    if (!selector) return;
    if (selector.mode === 'replace') {
      onReplaceHero?.(selector.heroId, h, wealth);
    } else if (party.length < 4 && !party.some((p) => p.id === h.id)) {
      onAddHero(h, wealth);
    }
    setSelector(null);
  };
  const selectorReplaceName =
    selector?.mode === 'replace' ? party.find((h) => h.id === selector.heroId)?.name : undefined;
  const inParty = (id: string) => party.some((p) => p.id === id);

  return (
    <div className="screen party-screen">
      <header className="bar">
        {net.mode === 'guest' ? (
          <button className="btn small" onClick={onQuitCoop}>
            {t('party.back.quit')}
          </button>
        ) : (
          <button className="btn small" onClick={onMenu}>
            {t('party.back.menu')}
          </button>
        )}
        <h2>{title} ({party.length}/4)</h2>
        {net.mode === 'guest' && (
          <span className="hint"><Icon id="ui/wait" size="sm" /> {t('party.guest.waiting')}</span>
        )}
      </header>
      {isHost && guestPending && (
        <p className="hint party-coop-hint"><Icon id="ui/wait" size="sm" /> {t('party.coop.pending')}</p>
      )}

      {/* L'écran de groupe = LA COMPAGNIE SEULE (grille de sièges, 2×2, généreuse) + le RAIL du
          registre (campagne + composition, #417). Aucune galerie ici. */}
      <div className="party-main">
      <CompanyRail party={party} axisIds={axisIds} campaignName={campaignName} onChangeCampaign={onChangeCampaign} />
      <div className="party-company">
        <div className="party-acts-header row-flex">
          <h3 className="party-acts-title">{t('party.acts.title')}</h3>
          <span className="party-acts-subtitle">
            {t(party.length <= 1 ? 'party.acts.subtitle.one' : 'party.acts.subtitle', { seats: NUM_WORDS_FR[4], sealed: NUM_WORDS_FR[Math.min(party.length, 4)] })}
          </span>
        </div>
        <div className="party-roster" aria-label={t('party.acts.title')}>
          {views.map(({ seat, hero: h }, i) => {
            const mine = !coop || seat === net.mySeat;
            return (
              <div
                className={`seat-slot ${h ? 'filled' : 'empty'}`}
                key={i}
                ref={(el) => { slotRefs.current[i] = el; }}
                style={{ '--i': i } as CSSProperties}
                role="group"
                aria-label={t('party.slot.adventurer', { n: i + 1 })}
                tabIndex={i === focusSlot ? 0 : -1}
                onFocus={(e) => { if (e.target === e.currentTarget) setFocusSlot(i); }}
                onKeyDown={(e) => {
                  const nav = slotKeyNav(e.key, i, views.length);
                  if (!nav) return;
                  if (nav === 'primary') {
                    if (e.target !== e.currentTarget) return; // contrôle interne (select…) = lui, pas le siège
                    if (!h) return;
                    e.preventDefault();
                    setPresentHero(h);
                  } else {
                    e.preventDefault();
                    setFocusSlot(nav.focus);
                    slotRefs.current[nav.focus]?.focus();
                  }
                }}
              >
                {coop && (net.mode === 'host' && !h ? (
                  <label className="slot-owner">
                    <span>{t('party.slot.player')}</span>
                    <select value={seat} onChange={(e) => onAssignSlot(i, Number(e.target.value))}>
                      {seats.map(({ seat: s, name: n }) => (
                        <option key={s} value={s}>{s === 0 ? `${n} (hôte)` : n}</option>
                      ))}
                    </select>
                  </label>
                ) : h ? (
                  <div className="slot-owner hint"><Icon id="nav/seat-owner" size="sm" /> {seatName(seat)}{seat === net.mySeat ? t('party.slot.you') : ''}</div>
                ) : null)}
                {h ? (
                  <SeatCard
                    hero={h}
                    seatLabel={t('party.acts.badge', { n: ACT_ROMAN[i] })}
                    axisIds={axisIds}
                    onPresent={() => setPresentHero(h)}
                    actions={ownsHero(h.id) && (
                      <>
                        {onEditHero && (
                          <button className="btn small ghost" onClick={() => onEditHero(h.id)}>{t('party.hero.edit')}</button>
                        )}
                        {onReplaceHero && (
                          <button className="btn small ghost" onClick={() => setSelector({ mode: 'replace', heroId: h.id })}>{t('party.hero.replace')}</button>
                        )}
                        <button className="btn small ghost danger" onClick={() => onRemoveHero(h.id)}>{t('party.hero.remove')}</button>
                      </>
                    )}
                  />
                ) : (
                  <div className="seat-empty">
                    <span className="seat-contract-badge">{t('party.acts.badge', { n: ACT_ROMAN[i] })}</span>
                    <span className="seat-empty-title">{t('party.acts.empty.title')}</span>
                    <span className="hint seat-invite">
                      {mine ? t('party.slot.invite') : <><Icon id="ui/wait" size="sm" /> {t('party.slot.waiting', { name: seatName(seat) })}</>}
                    </span>
                    {mine && (
                      <div className="seat-empty-actions row-flex">
                        <button className="btn small" onClick={onCreate}>{t('party.seat.create')}</button>
                        <button className="btn small btn-primary" onClick={() => setSelector({ mode: 'recruit' })}>{t('party.seat.choose')}</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      </div>

      {net.mode !== 'guest' && (
        <footer className="party-actions row-flex">
          <p className="party-actions-summary">{partySummaryText(party, axisIds)}</p>
          <div className="party-actions-buttons row-flex">
            {inProgress && (
              <button className="btn btn-primary" onClick={onResume}>
                {t('party.action.resume')}
              </button>
            )}
            {/* « Commencer » gaté (`GatedAction`) : la raison d'indisponibilité est VISIBLE sous le bouton. */}
            <GatedAction
              id="party-start"
              className="party-start"
              label={t('party.action.start')}
              enabled={party.length > 0 && !guestPending}
              reason={guestPending ? t('party.action.start.guestPending') : t('party.action.start.empty')}
              primary={!inProgress}
              onClick={onStart}
            />
          </div>
        </footer>
      )}

      {selector && (selector.mode === 'recruit' || onReplaceHero) && (
        <HeroSelector
          party={party}
          mode={selector.mode}
          axisIds={axisIds}
          replaceName={selectorReplaceName}
          onPick={onSelectorPick}
          onCreate={onCreate}
          onClose={() => setSelector(null)}
        />
      )}
      {presentHero && (
        <HeroPresentation
          hero={presentHero}
          onFullSheet={inParty(presentHero.id) ? () => { setSheetId(presentHero.id); setPresentHero(null); } : undefined}
          onClose={() => setPresentHero(null)}
        />
      )}
      {sheetId && <CharacterSheet heroId={sheetId} onClose={() => setSheetId(null)} />}
    </div>
  );
}

/** Sélecteur d'aventurier DÉDIÉ (« un écran différent et adapté », arbitrage user 2026-07-13) : écran
 *  plein-champ `ScreenShell` portant les onglets Mes personnages / Pré-tirés, les grandes cartes-portraits
 *  et l'import. Recrute un siège vide (`recruit`, les déjà-recrutés quittent l'étal) ou remplace un héros
 *  en place (`replace`, les membres restent grisés « Déjà choisi »). Source unique de la carte-portrait
 *  = `CandidatePool`/`CandidateCard`. */
export function HeroSelector({
  party,
  mode,
  axisIds = CORE_AXIS_IDS,
  replaceName,
  onPick,
  onClose,
  onCreate,
}: {
  party: Combatant[];
  mode: 'recruit' | 'replace';
  /** Axes ACTIFS de la campagne (glyphes de rose des candidats, #417). `CORE_AXIS_IDS` par défaut. */
  axisIds?: string[];
  /** Nom du héros remplacé (titre du mode `replace`). */
  replaceName?: string;
  onPick: (h: Combatant, wealth?: Money) => void;
  onClose: () => void;
  /** Ouvre le créateur (carte-action « Créer un personnage »). */
  onCreate?: () => void;
}) {
  const replace = mode === 'replace';
  return (
    <ScreenShell
      title={replace ? t('picker.title.replace', { name: replaceName ?? '' }) : t('party.select.title')}
      onClose={onClose}
      body="centered-wide"
      className="hero-selector"
    >
      <CandidatePool
        party={party}
        variant={replace ? 'modal' : 'gallery'}
        axisIds={axisIds}
        onPick={onPick}
        hideInParty={!replace}
        onCreate={onCreate}
      />
    </ScreenShell>
  );
}

/** Vivier de candidats — personnages sauvegardés (roster localStorage LOCAL du joueur) + pré-tirés,
 *  onglets Mes personnages / Pré-tirés, cartes-action créer/importer. Rendu DANS le sélecteur dédié
 *  (`HeroSelector`) : source unique de la carte-portrait `CandidateCard`, en mode `gallery` (recrutement,
 *  grandes cartes) ou `modal` (remplacement — les membres restent grisés « Déjà choisi »). */
export function CandidatePool({
  party,
  onPick,
  variant = 'gallery',
  canRecruit = true,
  hideInParty = false,
  axisIds = CORE_AXIS_IDS,
  onCreate,
}: {
  party: Combatant[];
  onPick: (h: Combatant, wealth?: Money) => void;
  /** `gallery` = recrutement (les recrutés quittent l'étal) ; `modal` = remplacement (membres grisés). */
  variant?: 'gallery' | 'modal';
  /** Un siège reste-t-il à pourvoir ? Sinon « Recruter » est grisé (groupe complet). */
  canRecruit?: boolean;
  /** Écarte du vivier les personnages DÉJÀ dans le groupe (recrutement) : un recruté quitte l'étal. Le
   *  mode remplacement (`false`) les garde, grisés « Déjà choisi ». */
  hideInParty?: boolean;
  /** Axes ACTIFS de la campagne (glyphe + médaillon de rose, #417). `CORE_AXIS_IDS` par défaut. */
  axisIds?: string[];
  /** Ouvre le créateur (carte-action « Créer un personnage »). */
  onCreate?: () => void;
}) {
  const allPregens = useState(() => makePregens())[0];
  const [roster, setRoster] = useState(() => rosterLoad());
  const [tab, setTab] = useState<'roster' | 'pregens'>(roster.length ? 'roster' : 'pregens');
  const [importErr, setImportErr] = useState<string | null>(null);
  // Candidat ÉLU (déplié dans l'ACTE DE PRÉSENTATION, `DetailFrame`) — plus de modale (#417,
  // planche-compagnie.html §B « la présentation intégrée au sélecteur »).
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const setScreen = useGame((s) => s.setScreen);
  const setEditingHero = useGame((s) => s.setEditingHero);

  const inParty = (id: string) => party.some((p) => p.id === id);
  const shownPregens = hideInParty ? allPregens.filter((h) => !inParty(h.id)) : allPregens;
  const shownRoster = hideInParty ? roster.filter((e) => !inParty(e.hero.id)) : roster;
  const state: RecruitState = { status: canRecruit ? 'available' : 'blocked' };
  const shownList: { hero: Combatant; wealth?: Money }[] =
    tab === 'roster' ? shownRoster.map(({ hero, wealth }) => ({ hero, wealth })) : shownPregens.map((h) => ({ hero: h }));
  const selected = shownList.find((e) => e.hero.id === selectedId) ?? shownList[0] ?? null;

  const removeSaved = (id: string) => {
    rosterRemove(id);
    setRoster(rosterLoad());
  };
  const exportHero = (entry: { hero: Combatant; wealth: Money }) =>
    downloadText(`wfrp4-perso-${fileSlug(entry.hero.name)}.json`, rosterExport(entry));
  const startCreate = () => {
    if (onCreate) return onCreate();
    setEditingHero(null);
    setScreen('creator');
  };
  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    const result = rosterImport(await file.text());
    if (!result.entry) {
      setImportErr(result.error);
      return;
    }
    rosterAdd(result.entry);
    setRoster(rosterLoad());
    setImportErr(null);
    setTab('roster');
  };

  return (
    <>
      <Tabs
        className="sheet-tabnav"
        tabs={[
          { key: 'roster' as const, label: t('picker.tab.roster') },
          { key: 'pregens' as const, label: t('picker.tab.pregens') },
        ]}
        active={tab}
        onChange={setTab}
      />

      <MasterDetail
        className="candidate-master-detail"
        listLabel={t('party.select.title')}
        list={
          <div className="candidate-grid">
            {tab === 'roster'
              ? shownRoster.map(({ hero, wealth }) => (
                  <CandidateCard
                    key={hero.id}
                    hero={hero}
                    variant={variant}
                    state={state}
                    recruited={inParty(hero.id)}
                    wealth={wealth}
                    axisIds={axisIds}
                    selected={selected?.hero.id === hero.id}
                    onRecruit={() => onPick(hero, wealth)}
                    onPresent={() => setSelectedId(hero.id)}
                    onExport={() => exportHero({ hero, wealth })}
                    onDelete={() => removeSaved(hero.id)}
                  />
                ))
              : shownPregens.map((h) => (
                  <CandidateCard
                    key={h.id}
                    hero={h}
                    variant={variant}
                    state={state}
                    recruited={inParty(h.id)}
                    axisIds={axisIds}
                    selected={selected?.hero.id === h.id}
                    onRecruit={() => onPick(h)}
                    onPresent={() => setSelectedId(h.id)}
                  />
                ))}
            {/* Cartes-action (même famille visuelle) : UNE carte « Créer un personnage » ; « Importer » à
                côté, dans l'onglet Mes personnages. */}
            <ActionCard icon="nav/new-game" label={t('picker.roster.create')} invite={t('party.create.invite')} onClick={startCreate} />
            {tab === 'roster' && (
              <ActionCard icon="file/import" label={t('picker.import.btn')} invite={t('party.import.invite')} title={t('picker.import.btn.title')} onClick={() => fileRef.current?.click()} />
            )}
          </div>
        }
        detail={
          selected ? <CandidateDetailPane hero={selected.hero} wealth={selected.wealth} axisIds={axisIds} /> : <p className="hint">{t('picker.detail.empty')}</p>
        }
      />
      {importErr && <p className="hint danger candidate-import-err">{importErr}</p>}
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={(e) => { void onImportFile(e.target.files?.[0]); e.target.value = ''; }}
      />
    </>
  );
}

/** ACTE DE PRÉSENTATION du candidat élu — `DetailFrame` (nom + chips méta + rubriques + prose),
 *  médaillon de rose près de l'en-tête (#417, planche-compagnie.html §B). Un candidat EST un
 *  `Combatant` complet (pregen) : le corps compose les MÊMES primitives que la fiche vivante du
 *  créateur (`CreatorSummary`) — `CharStatsGrid` pour les Caractéristiques, `SkillChip`/`TalentChip`/
 *  `EntityRef` codex-liées pour compétences/talents/possessions/axes — jamais une ligne de texte
 *  (recalage utilisateur 2026-07-14, écho de « composer, jamais de markup brut », 2026-07-12).
 *  Aucun bouton dédié : le recrutement reste sur la carte de la liste (`CandidateCard`), jamais
 *  dupliqué ici. */
function CandidateDetailPane({ hero, wealth, axisIds }: { hero: Combatant; wealth?: Money; axisIds: string[] }) {
  const axes = dominantAxes(hero, axisDataFor(axisIds), 3);
  const skills = [...hero.skills].filter((s) => s.advances > 0).sort((a, b) => b.advances - a.advances).slice(0, 14);
  const talents = hero.talents;
  const possessions = (hero.items ?? []).slice(0, 12);
  // Sorts/prières connus (`hero.spells`, `types.ts:1173` — pregens sorcier/prêtre, `pregens.json`) :
  // titre distingué par `isPrayer` (`schemas/defs/spells.ts:49`) — Sorts SEULS, Miracles SEULS, ou
  // les deux (« Sorts & Miracles »), jamais une invention de nature quand le catalogue est mêlé.
  const spellRefs = (hero.spells ?? []).map((id) => ({ id, data: findSpellById(id) }));
  const hasSpell = spellRefs.some((s) => s.data && !s.data.isPrayer);
  const hasPrayer = spellRefs.some((s) => s.data?.isPrayer);
  const spellsTitle = hasSpell && hasPrayer ? t('present.spells.both') : hasPrayer ? t('present.spells.prayers') : t('present.spells.spells');
  const proseParts: string[] = [];
  if (hero.motivation) proseParts.push(`**${t('present.motivation')} :** ${hero.motivation}`);
  if (hero.details?.ambitionShort) proseParts.push(`« ${hero.details.ambitionShort} »`);
  if (hero.details?.ambitionLong) proseParts.push(`${t('present.ambitionLong')} : ${hero.details.ambitionLong}`);
  const prose = proseParts.length > 0 ? proseParts.join('\n\n') : t('present.noStory');

  return (
    <div className="candidate-detail-pane">
    <DetailFrame
      topper={
        <div className="candidate-detail-head">
          <CharacterPreview hero={hero} size="md" ambiance="panel" className="candidate-detail-fig" />
          <div className="candidate-detail-id">
            <h3 className="detail-frame-name">{hero.name}</h3>
            <span className="detail-frame-sub">{heroSubtitle(hero)}</span>
            <div className="detail-frame-meta row-flex">
              <MetalStatus status={heroStatusLabel(hero)} size="chip" />
              {wealth != null && <span className="chip">{t('picker.hero.purse')} <Coins money={wealth} /></span>}
            </div>
          </div>
          <RoseAxes axes={heroRoseAxes(hero, axisIds)} size="medal" title={t('party.rose.title', { name: hero.name })} />
        </div>
      }
      sections={
        <>
          <CharStatsGrid size="sm" value={(k) => hero.characteristics[k]} className="candidate-detail-stats" />
          <div className="creator-derived">
            <span><Icon id="resource/wounds" size="sm" /> Blessures <b>{hero.wounds.max}</b></span>
            <span><Icon id="resource/movement" size="sm" /> Mouvement <b>{hero.movement}</b></span>
            <span><Icon id="resource/fate" size="sm" /> Destin <b>{hero.fate ?? '—'}</b> · Chance <b>{hero.fortune ?? '—'}</b></span>
            <span><Icon id="resource/resilience" size="sm" /> Résilience <b>{hero.resilience ?? '—'}</b> · Déterm. <b>{hero.resolve ?? '—'}</b></span>
          </div>
          {axes.length > 0 && (
            <section className="hero-present-sec">
              <h4>{t('present.forces')}</h4>
              <div className="skill-tags">
                {axes.map((a) => <EntityRef key={a.id} category="axes" id={a.id} label={a.label} />)}
              </div>
            </section>
          )}
          {spellRefs.length > 0 && (
            <section className="hero-present-sec">
              <h4>{spellsTitle}</h4>
              <div className="skill-tags">
                {spellRefs.map(({ id, data }) => (
                  <EntityRef key={id} category="spells" id={id} label={data?.label ?? id} />
                ))}
              </div>
            </section>
          )}
          <section className="hero-present-sec">
            <h4>{t('present.skills')}</h4>
            <div className="skill-tags">
              {skills.length ? skills.map((s) => <SkillChip key={`${s.skillId}|${s.spec ?? ''}`} skill={s} />) : <span className="hint">—</span>}
            </div>
          </section>
          <section className="hero-present-sec">
            <h4>{t('present.talents')}</h4>
            <div className="skill-tags">
              {talents.length ? talents.map((tt) => <TalentChip key={`${tt.talentId}|${tt.spec ?? ''}`} talent={tt} />) : <span className="hint">—</span>}
            </div>
          </section>
          <section className="hero-present-sec">
            <h4>{t('present.possessions')}</h4>
            <div className="skill-tags">
              {possessions.length
                ? possessions.map((it) => <EntityRef key={it.uid} category="trappings" id={it.trappingId} label={itemLabel(it)} />)
                : <span className="hint">—</span>}
            </div>
          </section>
        </>
      }
      prose={prose}
    />
    </div>
  );
}
