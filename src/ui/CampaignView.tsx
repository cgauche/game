import { useState } from 'react';
import { useGame } from '../state/store';
import { formatImperial, toDate, dayPhase } from '../engine/clock';
import { canActFirst, freeActFirst } from '../state/turnEconomy';
import { IsoStage } from '../gameIso/IsoStage';
import { ViewControls } from './ViewControls';
import { DialogueBox } from './DialogueBox';
import { MerchantPanel } from './MerchantPanel';
import { ActionBar } from './ActionBar';
import { CombatBanner } from './CombatBanner';
import { ActiveModal } from './ActiveModal'; // arbitre R2 : une seule modale de combat à la fois
import { VictoryScreen } from './VictoryScreen';
import { BargainModal } from './BargainModal';
import { AppraiseModal } from './AppraiseModal';
import { LootModal } from './LootModal';
import { DocumentModal } from './DocumentModal';
import { CharacterSheet } from './CharacterSheet';
import { InspectPanel } from './InspectPanel';
import { InitiativeStrip } from './InitiativeStrip';
import { PartyDock } from './PartyDock';
import { LogDrawer } from './LogDrawer';
import { GameMenu } from './GameMenu';
import { SaveLoadModal } from './SaveLoadModal';
import { HouseRulesModal } from './HouseRulesModal';
import { CoopMenuSection } from './CoopPanels';
import { AudioControls } from './AudioControls';
import { WorldMapView } from './WorldMapView';
import { TravelRecapModal } from './TravelRecapModal';
import { placeOfScene } from '../state/worldMap';
import { restPlacesHere } from '../state/restFlow';
import { hoverClickCommits } from './pointerCaps';
import { controlsActive } from '../state/netOwnership';
import { combatantClickActs } from '../state/combatOrParty';
import { useGameKeyboard } from './useGameKeyboard';
import { campaign } from '../scenes/campaign';

export function CampaignView() {
  useGameKeyboard(); // raccourcis clavier de jeu (registre unique)
  const scene = useGame((s) => s.scene);
  const mode = useGame((s) => s.mode);
  const journal = useGame((s) => s.journal);
  const dialogue = useGame((s) => s.dialogue);
  const battle = useGame((s) => s.battle);
  const money = useGame((s) => s.money);
  const merchant = useGame((s) => s.merchant);
  const inspectEnabled = useGame((s) => s.inspectEnabled); // option de jeu : inspection des combattants
  const toggleInspect = useGame((s) => s.toggleInspectEnabled);
  const pendingRoundStart = useGame((s) => s.pendingRoundStart);
  const roundStartPromote = useGame((s) => s.roundStartPromote);
  const gameTime = useGame((s) => s.gameTime);
  const worldMap = useGame((s) => s.worldMap);
  const worldMapOpen = useGame((s) => s.worldMapOpen);
  const openWorldMap = useGame((s) => s.openWorldMap);
  const travelPlan = useGame((s) => s.travelPlan);
  const travelRecap = useGame((s) => s.travelRecap);
  const setScreen = useGame((s) => s.setScreen);
  const startScene = useGame((s) => s.startScene);
  const party = useGame((s) => s.party);
  const zoom = useGame((s) => s.zoom);
  const setZoom = useGame((s) => s.setZoom);
  const rotateCam = useGame((s) => s.rotateCam);
  const viewMode = useGame((s) => s.viewMode);
  const toggleViewMode = useGame((s) => s.toggleViewMode);
  const battleClickEntity = useGame((s) => s.battleClickEntity);
  const netMode = useGame((s) => s.net.mode);
  const openRest = useGame((s) => s.openRest);
  const partyPos = useGame((s) => s.partyPos);
  // Offre de repos LÀ OÙ SE TIENT le groupe (zone d'auteur > scène > camp ; null = interdit).
  const restHere = mode === 'exploration' && scene ? restPlacesHere({ scene, partyPos } as Parameters<typeof restPlacesHere>[0]) : null;
  const [sheetId, setSheetId] = useState<string | null>(null);
  const inspectId = useGame((s) => s.inspectId); // statbloc inspecté (store : frise ET token l'ouvrent)
  const setInspectId = useGame((s) => s.setInspectId);
  const setHoverCombatant = useGame((s) => s.setHoverCombatant);
  const pendingCast = useGame((s) => s.pendingCast);
  const [saveOpen, setSaveOpen] = useState(false); // modale Sauvegarder/Charger (Jalon 5)
  const [rulesOpen, setRulesOpen] = useState(false); // panneau « Règles maison » (dont Cadence de combat)
  const clockDate = toDate(gameTime);
  const phase = dayPhase(gameTime);
  const dateLine = `${phase.icon} ${phase.label} — ${clockDate.weekday ? `${clockDate.weekday} · ` : ''}${formatImperial(gameTime)}`;
  const inspected = inspectEnabled && inspectId ? battle?.combatants.find((c) => c.id === inspectId) ?? null : null;
  // Dock : version « vivante » des héros en combat (PB/effets à jour), sinon la party.
  const dockHeroes = party.map((h) => battle?.combatants.find((x) => x.id === h.id) ?? h);
  const activeId = battle && !battle.over ? battle.order[battle.turn] : null;
  // Pré-emption d'initiative (pause de début de Round) : héros éligibles (LDB ch.17 l.27).
  const canFirstIds = battle && pendingRoundStart
    ? battle.order.filter((id) => {
        const c = battle.combatants.find((x) => x.id === id);
        return !!c && canActFirst(c, battle);
      })
    : [];
  // Pré-emption GRATUITE (arme Rapide, LDB 62 l.318-319) — badge ⚡ au lieu de 🍀.
  const freeFirstIds = canFirstIds.filter((id) => {
    const c = battle?.combatants.find((x) => x.id === id);
    return !!c && freeActFirst(c);
  });
  // #21 : pendant une action de CIBLAGE (attaque/incantation/charge/piétinement), cliquer un PORTRAIT
  // (frise ou dock) cible ce combattant — même validation/portée que cliquer son pion sur le champ.
  // COOP : seulement quand le combattant actif est À SOI (le tour d'un autre joueur est inerte).
  const controls = useGame(controlsActive);
  const targetingAction = battle && !battle.over ? battle.action : null;
  const isTargeting = controls && !!targetingAction && ['attack', 'cast', 'charge', 'trample'].includes(targetingAction as string);
  const onStripPortrait = (id: string) => {
    const c = battle?.combatants.find((x) => x.id === id);
    // MÊME comportement que cliquer le token sur la carte (IsoStage) : action de combat si la cible est
    // actionnable ET qu'on contrôle l'actif (coop : ton tour), sinon inspection (read-only, tout joueur).
    // `combatantClickActs` = condition PARTAGÉE carte ⇄ frise — elles ne peuvent plus diverger.
    if (c && controls && combatantClickActs(battle, pendingCast, c)) {
      battleClickEntity(id, { confirm: hoverClickCommits() }); // desktop : un clic commet (cf. pointerCaps)
      return;
    }
    if (inspectEnabled) setInspectId(id);
  };
  const onDockPortrait = (id: string) => {
    if (isTargeting) { battleClickEntity(id, { confirm: hoverClickCommits() }); return; }
    setSheetId(id);
  };

  return (
    <div className="screen campaign-view">
      <main className="stage">
        <IsoStage />
        {/* ── Overlays HUD plein-champ (façon BG3, mobile-first) ── */}
        {mode === 'battle' && battle && (
          <InitiativeStrip
            order={battle.order}
            turn={battle.turn}
            round={battle.round}
            combatants={battle.combatants}
            over={battle.over != null}
            pendingRound={pendingRoundStart?.round ?? null}
            canFirstIds={canFirstIds}
            freeFirstIds={freeFirstIds}
            inspectEnabled={inspectEnabled}
            targeting={isTargeting}
            onToggleInspect={toggleInspect}
            onActivate={onStripPortrait}
            onHover={setHoverCombatant}
            onPromote={roundStartPromote}
          />
        )}
        {mode === 'battle' && battle && <CombatBanner />}{/* fil SOUS la frise (CSS .combat-feed) */}
        {/* Ciblage par carte (Frappe Mortelle / Deux armes / Surincantation / pose de zone) :
            la BARRE D'ACTION se transforme en bandeau d'interlude (cf. ActionBar). */}
        {/* Sauvegarder : exploration seulement (refusée en combat) et jamais l'invité (la save vit chez l'hôte). */}
        <GameMenu sceneName={scene?.nom} money={money} dateLine={dateLine} onQuit={() => setScreen('party')} onSaveLoad={mode === 'exploration' && netMode !== 'guest' ? () => setSaveOpen(true) : undefined} onHouseRules={() => setRulesOpen(true)} coop={<><CoopMenuSection /><AudioControls /></>} />
        {saveOpen && <SaveLoadModal mode="save" onClose={() => setSaveOpen(false)} />}
        {rulesOpen && <HouseRulesModal onClose={() => setRulesOpen(false)} />}
        {/* Carte du monde (#T2) : visible en exploration quand la scène est un lieu connu, ou
            qu'un voyage interrompu attend sa reprise. */}
        {mode === 'exploration' && worldMap && (placeOfScene(worldMap, scene?.id) || travelPlan) && (
          <button
            type="button"
            className={`worldmap-btn ${travelPlan?.interrupted ? 'attention' : ''}`}
            onClick={openWorldMap}
            title={travelPlan?.interrupted ? 'Carte du monde — voyage interrompu (reprendre)' : 'Carte du monde — voyager'}
          >
            🗺️
          </button>
        )}
        {/* 🌙 Dormir ici — l'offre (auberge/chez soi/dehors) vient de la ZONE où se tient le
            groupe, sinon de la scène (donnée d'auteur, restPlacesHere). */}
        {mode === 'exploration' && !travelPlan && restHere && (
          <button
            type="button"
            className="worldmap-btn camp-btn"
            onClick={() => openRest({ places: restHere.places, quality: restHere.quality })}
            title={restHere.places.auberge ? 'Dormir — auberge ou belle étoile' : restHere.places.maison ? 'Dormir — chez soi' : 'Camper — dormir sur place jusqu’à l’aube'}
          >
            {restHere.places.auberge ? '🛏' : restHere.places.maison ? '🌙' : '⛺'}
          </button>
        )}
        <PartyDock heroes={dockHeroes} activeId={activeId} targeting={isTargeting} onOpen={onDockPortrait} />
        <LogDrawer battle={mode === 'battle' && battle ? { log: battle.log, combatants: battle.combatants } : null} journal={journal} />
        <ViewControls
          zoom={zoom}
          onZoomIn={() => setZoom(zoom + 0.3)}
          onZoomOut={() => setZoom(zoom - 0.3)}
          onZoomReset={() => setZoom(1)}
          onRotateLeft={() => rotateCam(-1)}
          onRotateRight={() => rotateCam(1)}
          view={viewMode}
          onToggleView={toggleViewMode}
        />
        {dialogue && <DialogueBox />}
        {merchant && <MerchantPanel />}
        {worldMapOpen && mode === 'exploration' && <WorldMapView />}
        {/* Récapitulatif de voyage (audit M4) : à l'arrivée, ou APRÈS l'embuscade qui a interrompu
            le trajet (jamais par-dessus le combat/un dialogue). */}
        {travelRecap && mode === 'exploration' && !dialogue && !worldMapOpen && <TravelRecapModal />}
        {/* Barre d'action + portrait du héros actif EN BAS (cf. ActionBar). */}
        {mode === 'battle' && battle && <ActionBar />}
        {/* Défaite : overlay centré (la victoire a son écran plein, VictoryScreen). */}
        {mode === 'battle' && battle?.over === 'defeat' && (
          <div className="defeat-overlay">
            <div className="battle-result defeat">
              <h2>Défaite…</h2>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const cur = useGame.getState().scene;
                  if (cur) {
                    useGame.setState({ mode: 'exploration', battle: null });
                  } else {
                    startScene(campaign[0].scene);
                  }
                }}
              >
                Reprendre
              </button>
            </div>
          </div>
        )}
      </main>

      <VictoryScreen />{/* écran de fin de combat plein écran (se gate sur battle.over==='victory') */}
      {/* Arbitre R2 : UNE seule modale de combat à la fois, par priorité (cf. ActiveModal). */}
      <ActiveModal />
      {/* Modales HORS combat (contexte exclusif) : restent montées indépendamment.
          LootModal AVANT AppraiseModal : Évaluer/Détecter une ligne s'empile AU-DESSUS de la fenêtre. */}
      <LootModal />
      <BargainModal />
      <AppraiseModal />
      <DocumentModal />
      {sheetId && <CharacterSheet heroId={sheetId} onClose={() => setSheetId(null)} />}
      {inspected && <InspectPanel combatant={inspected} onClose={() => setInspectId(null)} />}
    </div>
  );
}
