import { useState } from 'react';
import { useGame } from '../state/store';
import { formatImperial, toDate, dayPhase } from '../engine/clock';
import { canActFirst } from '../state/turnEconomy';
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
import { DocumentModal } from './DocumentModal';
import { CharacterSheet } from './CharacterSheet';
import { InspectPanel } from './InspectPanel';
import { InitiativeStrip } from './InitiativeStrip';
import { PartyDock } from './PartyDock';
import { LogDrawer } from './LogDrawer';
import { GameMenu } from './GameMenu';
import { WorldMapView } from './WorldMapView';
import { placeOfScene } from '../state/worldMap';
import { campaign } from '../scenes/campaign';

export function CampaignView() {
  const scene = useGame((s) => s.scene);
  const mode = useGame((s) => s.mode);
  const journal = useGame((s) => s.journal);
  const dialogue = useGame((s) => s.dialogue);
  const battle = useGame((s) => s.battle);
  const inventory = useGame((s) => s.inventory);
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
  const setScreen = useGame((s) => s.setScreen);
  const startScene = useGame((s) => s.startScene);
  const party = useGame((s) => s.party);
  const zoom = useGame((s) => s.zoom);
  const setZoom = useGame((s) => s.setZoom);
  const rotateCam = useGame((s) => s.rotateCam);
  const viewMode = useGame((s) => s.viewMode);
  const toggleViewMode = useGame((s) => s.toggleViewMode);
  const battleClickEntity = useGame((s) => s.battleClickEntity);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [inspectId, setInspectId] = useState<string | null>(null);
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
  // #21 : pendant une action de CIBLAGE (attaque/incantation/charge/piétinement), cliquer un PORTRAIT
  // (frise ou dock) cible ce combattant — même validation/portée que cliquer son pion sur le champ.
  const targetingAction = battle && !battle.over ? battle.action : null;
  const isTargeting = !!targetingAction && ['attack', 'cast', 'charge', 'trample'].includes(targetingAction as string);
  const onStripPortrait = (id: string) => {
    if (isTargeting) { battleClickEntity(id); return; }
    if (inspectEnabled) setInspectId(id);
  };
  const onDockPortrait = (id: string) => {
    if (isTargeting) { battleClickEntity(id); return; }
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
            inspectEnabled={inspectEnabled}
            targeting={isTargeting}
            onToggleInspect={toggleInspect}
            onInspect={isTargeting || inspectEnabled ? onStripPortrait : undefined}
            onPromote={roundStartPromote}
          />
        )}
        {mode === 'battle' && battle && <CombatBanner />}{/* fil SOUS la frise (CSS .combat-feed) */}
        <GameMenu sceneName={scene?.nom} money={money} inventory={inventory} dateLine={dateLine} onQuit={() => setScreen('party')} />
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
      {/* Modales HORS combat (contexte exclusif) : restent montées indépendamment. */}
      <BargainModal />
      <AppraiseModal />
      <DocumentModal />
      {sheetId && <CharacterSheet heroId={sheetId} onClose={() => setSheetId(null)} />}
      {inspected && <InspectPanel combatant={inspected} onClose={() => setInspectId(null)} />}
    </div>
  );
}
