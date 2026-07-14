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
import { CandidateCard, SeatCard, ActionCard, type RecruitState } from './CharCard';
import { CharacterSheet } from './CharacterSheet';
import { HeroPresentation } from './HeroPresentation';
import { Modal } from './Modal';
import { ScreenShell } from './ScreenShell';
import { GatedAction } from './GatedAction';
import { Icon } from './Icon';
import { Tabs } from './Tabs';
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

  return (
    <>
      <PartyScreenView
        party={party}
        net={net}
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

/** Vue pure de l'écran d'équipe (testable sans store — le rendu statique des tests lit
 *  l'état INITIAL de zustand, pas l'état muté). */
export function PartyScreenView({
  party,
  net,
  title,
  campaignName,
  onChangeCampaign,
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
  /** Campagne sélectionnée (cartouche Icon nav/campagne). Absent = cartouche masqué (vue partielle/tests). */
  campaignName?: string;
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
        {campaignName && (
          <div className="campaign-pill">
            <span aria-hidden><Icon id="nav/campaign" /></span>
            <span className="campaign-pill-name">{campaignName}</span>
            {onChangeCampaign && (
              <button className="btn small" onClick={onChangeCampaign}>
                {t('party.campaign.change')}
              </button>
            )}
          </div>
        )}
        {net.mode === 'guest' && (
          <span className="hint"><Icon id="ui/wait" size="sm" /> {t('party.guest.waiting')}</span>
        )}
      </header>
      {isHost && guestPending && (
        <p className="hint party-coop-hint"><Icon id="ui/wait" size="sm" /> {t('party.coop.pending')}</p>
      )}

      {/* L'écran de groupe = LA COMPAGNIE SEULE (grille de sièges, 2×2, généreuse). Aucune galerie ici. */}
      <div className="party-company">
        <h3 className="party-roster-title">{t('party.company')} ({party.length}/4)</h3>
        <div className="party-roster" aria-label={t('party.company')}>
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
                    seatLabel={t('party.seat.badge', { n: i + 1 })}
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
                    <span className="seat-num">{t('party.seat.label', { n: i + 1 })}</span>
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

      {net.mode !== 'guest' && (
        <footer className="party-actions">
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
        </footer>
      )}

      {selector && (selector.mode === 'recruit' || onReplaceHero) && (
        <HeroSelector
          party={party}
          mode={selector.mode}
          replaceName={selectorReplaceName}
          onPick={onSelectorPick}
          onPresent={setPresentHero}
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
  replaceName,
  onPick,
  onClose,
  onCreate,
  onPresent,
}: {
  party: Combatant[];
  mode: 'recruit' | 'replace';
  /** Nom du héros remplacé (titre du mode `replace`). */
  replaceName?: string;
  onPick: (h: Combatant, wealth?: Money) => void;
  onClose: () => void;
  /** Ouvre le créateur (carte-action « Créer un personnage »). */
  onCreate?: () => void;
  /** Ouvre la présentation d'un candidat (clic figure/nom). */
  onPresent?: (h: Combatant) => void;
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
        onPick={onPick}
        hideInParty={!replace}
        onPresent={onPresent}
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
  onPresent,
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
  /** Ouvre la PRÉSENTATION d'un candidat (clic figure/nom). */
  onPresent?: (h: Combatant) => void;
  /** Ouvre le créateur (carte-action « Créer un personnage »). */
  onCreate?: () => void;
}) {
  const allPregens = useState(() => makePregens())[0];
  const [roster, setRoster] = useState(() => rosterLoad());
  const [tab, setTab] = useState<'roster' | 'pregens'>(roster.length ? 'roster' : 'pregens');
  const [importErr, setImportErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const setScreen = useGame((s) => s.setScreen);
  const setEditingHero = useGame((s) => s.setEditingHero);

  const inParty = (id: string) => party.some((p) => p.id === id);
  const shownPregens = hideInParty ? allPregens.filter((h) => !inParty(h.id)) : allPregens;
  const shownRoster = hideInParty ? roster.filter((e) => !inParty(e.hero.id)) : roster;
  const state: RecruitState = { status: canRecruit ? 'available' : 'blocked' };

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
                onRecruit={() => onPick(hero, wealth)}
                onPresent={onPresent ? () => onPresent(hero) : undefined}
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
                onRecruit={() => onPick(h)}
                onPresent={onPresent ? () => onPresent(h) : undefined}
              />
            ))}
        {/* Cartes-action (même famille visuelle) : UNE carte « Créer un personnage » ; « Importer » à
            côté, dans l'onglet Mes personnages. */}
        <ActionCard icon="nav/new-game" label={t('picker.roster.create')} invite={t('party.create.invite')} onClick={startCreate} />
        {tab === 'roster' && (
          <ActionCard icon="file/import" label={t('picker.import.btn')} invite={t('party.import.invite')} title={t('picker.import.btn.title')} onClick={() => fileRef.current?.click()} />
        )}
      </div>
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
