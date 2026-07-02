import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useGame, type GameState } from '../state/store';
import type { NetState } from '../state/netFlow';
import { makePregens } from '../data/pregens';
import { rosterLoad, rosterRemove, rosterAdd, rosterExport, rosterImport } from '../state/roster';
import { downloadText, fileSlug } from '../state/fileIo';
import { campaign } from '../scenes/campaign';
import { publishedProjects } from '../state/projectLibrary';
import { Combatant } from '../engine/types';
import { Money, formatMoney } from '../engine/money';
import { CharCard } from './CharCard';
import { CharacterSheet } from './CharacterSheet';
import { Icon } from './Icon';
import { OrnateFrame, Fleuron } from './Ornaments';
import { t } from '../i18n';

/**
 * Écran d'équipe — solo ET coop. En coop, l'hôte attribue chaque EMPLACEMENT (Aventurier 1-4)
 * à un siège (`net.slots`) ; chaque joueur remplit LES SIENS (créer / charger son roster local /
 * pré-tiré) via `partyAddHero` — enveloppé en intent côté invité, l'hôte reste autoritaire.
 *
 * C'est AUSSI ici que se choisit la campagne (cartouche Campagne + « Changer ») — solo comme coop
 * (hôte seul ; les invités voient le nom via le snapshot). Le choix par défaut est l'Arène.
 */

/** Nav clavier des emplacements (roving tabindex) : flèches ⇄ emplacement voisin (bouclé),
 *  Enter/Espace = action principale de l'emplacement. Pur — testé sans DOM. */
export function slotKeyNav(key: string, idx: number, count: number): { focus: number } | 'primary' | null {
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    return { focus: (idx + (key === 'ArrowLeft' ? -1 : 1) + count) % count };
  }
  return key === 'Enter' || key === ' ' ? 'primary' : null;
}

/** Appariement emplacements → héros : le k-ième emplacement du siège S affiche le k-ième héros
 *  possédé par S (ordre de `party`). Les héros orphelins (siège sans emplacement, ex. réattribution
 *  après remplissage) sont reversés dans les emplacements vides restants pour rester visibles. */
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="picker-title">{t('party.campaign.pick.title')}</h3>
        <div className="pregen-list">
          <div className="pregen-row">
            <span className="campaign-row-name"><Icon id="scenario/arena" size="sm" /> {t('campaign.builtin')}</span>
            <button className="btn small btn-primary" disabled={currentName == null} onClick={() => pick(null)}>
              {currentName == null ? t('party.campaign.pick.current') : t('party.campaign.pick.choose')}
            </button>
          </div>
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
      </div>
    </div>
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
  /** Remplace EN PLACE le héros `oldId` par celui choisi dans le picker (bouton « Remplacer »).
   *  Absent = pas de bouton « Remplacer ». La bourse (`wealth`) est ignorée (pas un recrutement). */
  onReplaceHero?: (oldId: string, hero: Combatant, wealth?: Money) => void;
  onAssignSlot: (slot: number, seat: number) => void;
  onStart: () => void;
  onResume?: () => void;
}) {
  const [picker, setPicker] = useState(false);
  // Slot occupé → « Remplacer » : ouvre le picker MÊME à 4/4 (un remplacement ne change pas l'effectif).
  const [replaceTarget, setReplaceTarget] = useState<string | null>(null);
  // Roving tabindex : UN seul emplacement tabbable ; flèches gauche/droite entre emplacements,
  // Enter/Espace = action principale (fiche du héros / créer). Cf. `slotKeyNav` (pur).
  const [focusSlot, setFocusSlot] = useState(0);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  // F1 : cliquer le portrait d'un héros ouvre sa fiche complète (réutilise CharacterSheet).
  const [sheetId, setSheetId] = useState<string | null>(null);
  // L2 (solo) : carte slot→héros STABLE — l'emplacement d'un héros retiré RESTE en place (le trou ne
  // file plus à droite). Réconciliée avec `party` : un héros disparu libère SA case ; un nouveau prend
  // la 1re case vide. En coop, on garde `slotViews` (cases attribuées par siège).
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
  /** Un emplacement attribué à un invité n'est pas rempli → l'hôte ne peut pas lancer. */
  const guestPending = views.some((v) => v.seat !== 0 && !v.hero);

  const pick = (h: Combatant, wealth?: Money) => {
    if (party.length >= 4 || party.some((p) => p.id === h.id)) return;
    onAddHero(h, wealth);
    if (party.length + 1 >= 4) setPicker(false); // groupe complet → on ferme ; sinon on enchaîne
  };
  // Le picker sert au recrutement (slot vide) ET au remplacement (slot occupé) : on aiguille selon
  // `replaceTarget`. Fermeture commune : on réinitialise les deux modes.
  const onPickHero = (h: Combatant, wealth?: Money) => {
    if (replaceTarget) {
      onReplaceHero?.(replaceTarget, h, wealth);
      setReplaceTarget(null);
      setPicker(false);
      return;
    }
    pick(h, wealth);
  };
  const closePicker = () => { setPicker(false); setReplaceTarget(null); };
  const replaceName = replaceTarget ? party.find((h) => h.id === replaceTarget)?.name : undefined;

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
          <span className="hint">{t('party.guest.waiting')}</span>
        )}
      </header>
      {isHost && guestPending && (
        <p className="hint party-coop-hint">{t('party.coop.pending')}</p>
      )}

      <div className="party-grid">
        {views.map(({ seat, hero: h }, i) => {
          const mine = !coop || seat === net.mySeat;
          return (
            <div
              className="party-slot"
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
                  // Enter/Espace sur un contrôle INTERNE (bouton, select…) = le contrôle, pas le slot.
                  if (e.target !== e.currentTarget) return;
                  e.preventDefault();
                  if (h) setSheetId(h.id);
                  else if (mine) onCreate();
                } else {
                  e.preventDefault();
                  setFocusSlot(nav.focus);
                  slotRefs.current[nav.focus]?.focus();
                }
              }}
            >
              {coop && (
                net.mode === 'host' && !h ? (
                  <label className="slot-owner">
                    <span>{t('party.slot.player')}</span>
                    <select value={seat} onChange={(e) => onAssignSlot(i, Number(e.target.value))}>
                      {seats.map(({ seat: s, name: n }) => (
                        <option key={s} value={s}>{s === 0 ? `${n} (hôte)` : n}</option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className="slot-owner hint"><Icon id="nav/seat-owner" size="sm" /> {seatName(seat)}{coop && seat === net.mySeat ? t('party.slot.you') : ''}</div>
                )
              )}
              {h ? (
                <>
                  <CharCard hero={h} onOpen={() => setSheetId(h.id)} />
                  {ownsHero(h.id) && (
                    <div className="row-flex slot-actions">
                      {onEditHero && (
                        <button className="btn small" onClick={() => onEditHero(h.id)}>
                          {t('party.hero.edit')}
                        </button>
                      )}
                      {onReplaceHero && (
                        <button className="btn small" onClick={() => setReplaceTarget(h.id)}>
                          {t('party.hero.replace')}
                        </button>
                      )}
                      <button className="btn small danger" onClick={() => onRemoveHero(h.id)}>
                        {t('party.hero.remove')}
                      </button>
                    </div>
                  )}
                </>
              ) : mine ? (
                <OrnateFrame className="empty-slot">
                  <Fleuron />
                  <span className="slot-num">{t('party.slot.adventurer', { n: i + 1 })}</span>
                  <button className="btn" onClick={onCreate}>
                    {t('party.slot.create')}
                  </button>
                  <button className="btn" onClick={() => setPicker(true)}>
                    {t('party.slot.pick')}
                  </button>
                </OrnateFrame>
              ) : (
                <OrnateFrame className="empty-slot">
                  <Fleuron />
                  <span className="slot-num">{t('party.slot.adventurer', { n: i + 1 })}</span>
                  <span className="hint">{t('party.slot.waiting', { name: seatName(seat) })}</span>
                </OrnateFrame>
              )}
            </div>
          );
        })}
      </div>

      {net.mode !== 'guest' && (
        <footer className="party-actions">
          {inProgress && (
            <button className="btn btn-primary" onClick={onResume}>
              {t('party.action.resume')}
            </button>
          )}
          <button
            className={`btn ${inProgress ? '' : 'btn-primary'} party-start`}
            disabled={party.length === 0 || guestPending}
            title={guestPending
              ? t('party.action.start.guestPending')
              : inProgress ? t('party.action.start.willReset') : undefined}
            onClick={onStart}
          >
            {t('party.action.start')}
          </button>
        </footer>
      )}

      {((picker && party.length < 4) || (replaceTarget && onReplaceHero)) && (
        <PartyPicker
          party={party}
          title={replaceTarget ? t('picker.title.replace', { name: replaceName ?? '' }) : undefined}
          onPick={onPickHero}
          onClose={closePicker}
        />
      )}
      {sheetId && <CharacterSheet heroId={sheetId} onClose={() => setSheetId(null)} />}
    </div>
  );
}

/** Modale de choix : personnages sauvegardés (roster localStorage LOCAL du joueur) + pré-tirés. */
export function PartyPicker({
  party,
  onPick,
  onClose,
  title,
}: {
  party: Combatant[];
  onPick: (h: Combatant, wealth?: Money) => void;
  onClose: () => void;
  /** Titre du picker (défaut = recrutement). Le mode « Remplacer » passe « Remplacer {nom} ». */
  title?: string;
}) {
  const pregens = useState(() => makePregens())[0];
  const [roster, setRoster] = useState(() => rosterLoad());
  const [tab, setTab] = useState<'roster' | 'pregens'>(roster.length ? 'roster' : 'pregens');
  const [importErr, setImportErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const setScreen = useGame((s) => s.setScreen);
  const setEditingHero = useGame((s) => s.setEditingHero);

  const inParty = (id: string) => party.some((p) => p.id === id);
  const removeSaved = (id: string) => {
    rosterRemove(id);
    setRoster(rosterLoad());
  };
  const exportHero = (entry: { hero: Combatant; wealth: Money }) =>
    downloadText(`wfrp4-perso-${fileSlug(entry.hero.name)}.json`, rosterExport(entry));
  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    const entry = rosterImport(await file.text());
    if (!entry) {
      setImportErr(t('picker.import.error'));
      return;
    }
    rosterAdd(entry);
    setRoster(rosterLoad());
    setImportErr(null);
    setTab('roster');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="picker-title">{title ?? t('picker.title', { n: party.length })}</h3>
        <div className="sheet-tabs">
          <button className={`tab ${tab === 'roster' ? 'on' : ''}`} onClick={() => setTab('roster')}>
            {t('picker.tab.roster')}
          </button>
          <button className={`tab ${tab === 'pregens' ? 'on' : ''}`} onClick={() => setTab('pregens')}>
            {t('picker.tab.pregens')}
          </button>
        </div>

        {tab === 'roster' ? (
          <div className="pregen-list">
            {/* TOUJOURS visible (pas seulement roster vide) : créer reste un chemin de recrutement.
               setEditingHero(null) : un « Modifier » antérieur ne doit pas rouvrir le créateur en mode édition. */}
            <button className="btn" onClick={() => { setEditingHero(null); setScreen('creator'); }}>
              {t('picker.roster.create')}
            </button>
            {roster.map(({ hero, wealth }) => (
              <div key={hero.id} className="pregen-row">
                <CharCard hero={hero} compact />
                <span className="hint">Bourse : {formatMoney(wealth)}</span>
                <button
                  className="btn small btn-primary"
                  disabled={inParty(hero.id)}
                  onClick={() => onPick(hero, wealth)}
                >
                  {inParty(hero.id) ? t('picker.hero.inParty') : t('picker.hero.choose')}
                </button>
                <button className="btn small" onClick={() => exportHero({ hero, wealth })} title={t('picker.hero.export.title')}>
                  {t('picker.hero.export')}
                </button>
                <button className="btn small danger" onClick={() => removeSaved(hero.id)}>
                  {t('picker.hero.delete')}
                </button>
              </div>
            ))}
            <div className="party-import">
              <button className="btn small" onClick={() => fileRef.current?.click()} title={t('picker.import.btn.title')}>
                {t('picker.import.btn')}
              </button>
              {importErr && <span className="hint danger">{importErr}</span>}
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                style={{ display: 'none' }}
                onChange={(e) => { void onImportFile(e.target.files?.[0]); e.target.value = ''; }}
              />
            </div>
          </div>
        ) : (
          <div className="pregen-list">
            {pregens.map((h) => (
              <div key={h.id} className="pregen-row">
                <CharCard hero={h} compact />
                <button className="btn small btn-primary" disabled={inParty(h.id)} onClick={() => onPick(h)}>
                  {inParty(h.id) ? t('picker.hero.inParty') : t('picker.hero.choose')}
                </button>
              </div>
            ))}
          </div>
        )}

        <button className="btn" onClick={onClose}>
          {t('picker.done')}
        </button>
      </div>
    </div>
  );
}
