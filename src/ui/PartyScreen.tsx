import { useRef, useState } from 'react';
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

/**
 * Écran d'équipe — solo ET coop. En coop, l'hôte attribue chaque EMPLACEMENT (Aventurier 1-4)
 * à un siège (`net.slots`) ; chaque joueur remplit LES SIENS (créer / charger son roster local /
 * pré-tiré) via `partyAddHero` — enveloppé en intent côté invité, l'hôte reste autoritaire.
 *
 * C'est AUSSI ici que se choisit la campagne (cartouche 📜 + « Changer ») — solo comme coop
 * (hôte seul ; les invités voient le nom via le snapshot). Le choix par défaut est l'Arène.
 */

/** Nom affiché de la campagne intégrée (l'Arène — `pendingCampaign` null). */
export const BUILTIN_CAMPAIGN_NAME = "L'Arène";

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
        title="Votre groupe d'aventuriers"
        campaignName={pendingCampaign ? pendingCampaign.name : BUILTIN_CAMPAIGN_NAME}
        onChangeCampaign={canPickCampaign ? () => setCampaignPick(true) : undefined}
        inProgress={inProgress}
        onMenu={() => setScreen('menu')}
        onQuitCoop={() => { leave(); setScreen('menu'); }}
        onCreate={() => setScreen('creator')}
        onAddHero={addHero}
        onRemoveHero={removeHero}
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
        <h3 className="picker-title">Choisir la campagne</h3>
        <div className="pregen-list">
          <div className="pregen-row">
            <span className="campaign-row-name">⚔️ {BUILTIN_CAMPAIGN_NAME}</span>
            <button className="btn small btn-primary" disabled={currentName == null} onClick={() => pick(null)}>
              {currentName == null ? 'Actuelle' : 'Choisir'}
            </button>
          </div>
          {published.map((p) => (
            <div key={p.id} className="pregen-row">
              <span className="campaign-row-name">📜 {p.name}</span>
              <button
                className="btn small btn-primary"
                disabled={currentName === p.name}
                onClick={() => pick({ name: p.name, scenes: p.project.scenes, startSceneId: p.startSceneId, worldMap: p.project.worldMap ?? null })}
              >
                {currentName === p.name ? 'Actuelle' : 'Choisir'}
              </button>
            </div>
          ))}
        </div>
        <button className="btn" onClick={onClose}>
          Fermer
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
  onAddHero,
  onRemoveHero,
  onAssignSlot,
  onStart,
  onResume,
}: {
  party: Combatant[];
  net: NetState;
  title: string;
  /** Campagne sélectionnée (cartouche 📜). Absent = cartouche masqué (vue partielle/tests). */
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
  onAddHero: (h: Combatant, wealth?: Money) => void;
  onRemoveHero: (heroId: string) => void;
  onAssignSlot: (slot: number, seat: number) => void;
  onStart: () => void;
  onResume?: () => void;
}) {
  const [picker, setPicker] = useState(false);
  // F1 : cliquer le portrait d'un héros ouvre sa fiche complète (réutilise CharacterSheet).
  const [sheetId, setSheetId] = useState<string | null>(null);

  const coop = net.mode !== 'local';
  const isHost = net.mode !== 'guest';
  const seats = Object.entries(net.seatNames).map(([s, n]) => ({ seat: Number(s), name: n }));
  const seatName = (seat: number) => net.seatNames[seat] ?? (seat === 0 ? 'Hôte' : `Joueur ${seat + 1}`);
  const views = slotViews(party, net.slots ?? [0, 0, 0, 0], net.ownership);
  const ownsHero = (id: string) => !coop || (net.ownership[id] ?? 0) === net.mySeat;
  /** Un emplacement attribué à un invité n'est pas rempli → l'hôte ne peut pas lancer. */
  const guestPending = views.some((v) => v.seat !== 0 && !v.hero);

  const pick = (h: Combatant, wealth?: Money) => {
    if (party.length >= 4 || party.some((p) => p.id === h.id)) return;
    onAddHero(h, wealth);
    if (party.length + 1 >= 4) setPicker(false); // groupe complet → on ferme ; sinon on enchaîne
  };

  return (
    <div className="screen party-screen">
      <header className="bar">
        {net.mode === 'guest' ? (
          <button className="btn small" onClick={onQuitCoop}>
            ← Quitter
          </button>
        ) : (
          <button className="btn small" onClick={onMenu}>
            ← Menu
          </button>
        )}
        <h2>{title} ({party.length}/4)</h2>
        {campaignName && (
          <div className="campaign-pill">
            <span aria-hidden>📜</span>
            <span className="campaign-pill-name">{campaignName}</span>
            {onChangeCampaign && (
              <button className="btn small" onClick={onChangeCampaign}>
                Changer
              </button>
            )}
          </div>
        )}
        {net.mode === 'guest' ? (
          <span className="hint">⏳ L'hôte lance la partie</span>
        ) : (
          <>
            {inProgress && (
              <button className="btn btn-primary" onClick={onResume}>
                Reprendre →
              </button>
            )}
            <button
              className={inProgress ? 'btn' : 'btn btn-primary'}
              disabled={party.length === 0 || guestPending}
              title={guestPending
                ? 'Des emplacements attribués aux autres joueurs sont encore vides.'
                : inProgress ? 'Relance la campagne au début — la partie en cours sera perdue.' : undefined}
              onClick={onStart}
            >
              Commencer →
            </button>
          </>
        )}
      </header>
      {isHost && guestPending && (
        <p className="hint party-coop-hint">⏳ En attente que chaque joueur remplisse ses emplacements…</p>
      )}

      <div className="party-grid">
        {views.map(({ seat, hero: h }, i) => {
          const mine = !coop || seat === net.mySeat;
          return (
            <div className="party-slot" key={i}>
              {coop && (
                net.mode === 'host' && !h ? (
                  <label className="slot-owner">
                    <span>Joueur :</span>
                    <select value={seat} onChange={(e) => onAssignSlot(i, Number(e.target.value))}>
                      {seats.map(({ seat: s, name: n }) => (
                        <option key={s} value={s}>{s === 0 ? `👑 ${n}` : n}</option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className="slot-owner hint">👤 {seatName(seat)}{coop && seat === net.mySeat ? ' (vous)' : ''}</div>
                )
              )}
              {h ? (
                <>
                  <CharCard hero={h} onOpen={() => setSheetId(h.id)} />
                  {ownsHero(h.id) && (
                    <button className="btn small danger" onClick={() => onRemoveHero(h.id)}>
                      Retirer
                    </button>
                  )}
                </>
              ) : mine ? (
                <div className="empty-slot">
                  <span className="slot-num">Aventurier {i + 1}</span>
                  <button className="btn" onClick={onCreate}>
                    Créer un personnage
                  </button>
                  <button className="btn" onClick={() => setPicker(true)}>
                    Choisir un personnage
                  </button>
                </div>
              ) : (
                <div className="empty-slot">
                  <span className="slot-num">Aventurier {i + 1}</span>
                  <span className="hint">⏳ En attente de {seatName(seat)}…</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {picker && party.length < 4 && <PartyPicker party={party} onPick={pick} onClose={() => setPicker(false)} />}
      {sheetId && <CharacterSheet heroId={sheetId} onClose={() => setSheetId(null)} />}
    </div>
  );
}

/** Modale de choix : personnages sauvegardés (roster localStorage LOCAL du joueur) + pré-tirés. */
export function PartyPicker({
  party,
  onPick,
  onClose,
}: {
  party: Combatant[];
  onPick: (h: Combatant, wealth?: Money) => void;
  onClose: () => void;
}) {
  const pregens = useState(() => makePregens())[0];
  const [roster, setRoster] = useState(() => rosterLoad());
  const [tab, setTab] = useState<'roster' | 'pregens'>(roster.length ? 'roster' : 'pregens');
  const [importErr, setImportErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const setScreen = useGame((s) => s.setScreen);

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
      setImportErr('Fichier de personnage invalide.');
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
        <h3 className="picker-title">Recruter — {party.length}/4</h3>
        <div className="sheet-tabs">
          <button className={`tab ${tab === 'roster' ? 'on' : ''}`} onClick={() => setTab('roster')}>
            Mes personnages
          </button>
          <button className={`tab ${tab === 'pregens' ? 'on' : ''}`} onClick={() => setTab('pregens')}>
            Pré-tirés
          </button>
        </div>

        {tab === 'roster' ? (
          <div className="pregen-list">
            {roster.length === 0 && (
              <button className="btn" onClick={() => setScreen('creator')}>
                ➕ Créer un personnage
              </button>
            )}
            {roster.map(({ hero, wealth }) => (
              <div key={hero.id} className="pregen-row">
                <CharCard hero={hero} compact />
                <span className="hint">Bourse : {formatMoney(wealth)}</span>
                <button
                  className="btn small btn-primary"
                  disabled={inParty(hero.id)}
                  onClick={() => onPick(hero, wealth)}
                >
                  {inParty(hero.id) ? 'Déjà choisi' : 'Choisir'}
                </button>
                <button className="btn small" onClick={() => exportHero({ hero, wealth })} title="Télécharger ce personnage (JSON) — backup, autre appareil, ou coop d'un ami">
                  Exporter
                </button>
                <button className="btn small danger" onClick={() => removeSaved(hero.id)}>
                  Supprimer
                </button>
              </div>
            ))}
            <div className="party-import">
              <button className="btn small" onClick={() => fileRef.current?.click()} title="Importer un personnage depuis un fichier JSON exporté">
                📥 Importer un personnage…
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
                  {inParty(h.id) ? 'Déjà choisi' : 'Choisir'}
                </button>
              </div>
            ))}
          </div>
        )}

        <button className="btn" onClick={onClose}>
          Terminé
        </button>
      </div>
    </div>
  );
}
