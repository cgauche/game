import { useState } from 'react';
import { useGame } from '../state/store';
import { canActFirst, freeActFirst } from '../state/turnEconomy';
import { preemptShooterIds } from '../state/targeting';
import { IsoStage } from '../gameIso/IsoStage';
import { PovStage } from '../gameIso/pov/PovStage';
import { SceneErrorBoundary } from './SceneErrorBoundary';
import { PovControls } from './PovControls';
import { ViewControls } from './ViewControls';
import { DialogueBox } from './DialogueBox';
import { MerchantPanel } from './MerchantPanel';
import { TavernGameModal } from './TavernGameModal';
import { ActionBar } from './ActionBar';
import { PosteSheet } from './ShipSheet';
import { isVehicle } from '../engine/vehicle';
import { isEngin } from '../engine/structures';
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
import { CombatStartSplash } from './CombatStartSplash';
import { PartyDock } from './PartyDock';
import { LogDrawer } from './LogDrawer';
import { Icon } from './Icon';
import { GameMenu } from './GameMenu';
import { ObjectiveBannerMount } from './ObjectiveBanner';
import { SaveLoadModal } from './SaveLoadModal';
import { HouseRulesModal } from './HouseRulesModal';
import { SessionEndModal } from './SessionEndModal';
import { CoopMenuSection, GmSoloToggle } from './CoopPanels';
import { AudioControls } from './AudioControls';
import { WorldMapView } from './WorldMapView';
import { PortView } from './PortView';
import { ShipDossier } from './ShipDossier';
import { LandMarketView } from './LandMarketView';
import { SeaActivitiesModal } from './SeaActivitiesModal';
import { ManannPriestModal } from './ManannPriestModal';
import { ShoreLeaveModal } from './ShoreLeaveModal';
import { TravelRecapModal } from './TravelRecapModal';
import { VoyageScreen } from './VoyageScreen';
import { voyageHubActive, voyageStepPending } from '../state/modalArbiter';
import { placeOfScene } from '../state/worldMap';
import { restPlacesHere } from '../state/restFlow';
import { hoverClickCommits } from './pointerCaps';
import { controlsActive, controlsCombatant } from '../state/netOwnership';
import { combatantClickActs } from '../state/combatOrParty';
import { useGameKeyboard } from './useGameKeyboard';
import { useGamepad } from './useGamepad';
import { OptionsModal } from './OptionsModal';
import { campaign } from '../scenes/campaign';

export function CampaignView() {
  useGameKeyboard(); // raccourcis clavier de jeu (registre unique)
  useGamepad(); // couche manette : dispatche les MÊMES intentions que le clavier (registre partagé)
  const scene = useGame((s) => s.scene);
  const mode = useGame((s) => s.mode);
  const journal = useGame((s) => s.journal);
  const dialogue = useGame((s) => s.dialogue);
  const battle = useGame((s) => s.battle);
  const money = useGame((s) => s.money);
  const merchant = useGame((s) => s.merchant);
  const sessionEndOpen = useGame((s) => s.sessionEndOpen); // Effet `sessionEnd` (#83) : ouvre la même modale
  const closeSessionEnd = useGame((s) => s.closeSessionEnd);
  const inspectEnabled = useGame((s) => s.inspectEnabled); // option de jeu : inspection des combattants
  const toggleInspect = useGame((s) => s.toggleInspectEnabled);
  const pendingRoundStart = useGame((s) => s.pendingRoundStart);
  const roundStartPromote = useGame((s) => s.roundStartPromote);
  const gameTime = useGame((s) => s.gameTime);
  const worldMap = useGame((s) => s.worldMap);
  const worldMapOpen = useGame((s) => s.worldMapOpen);
  const openWorldMap = useGame((s) => s.openWorldMap);
  const port = useGame((s) => s.port);
  const openPort = useGame((s) => s.openPort);
  const landMarket = useGame((s) => s.landMarket);
  const openLandMarket = useGame((s) => s.openLandMarket);
  const pendingSeaActivities = useGame((s) => s.pendingSeaActivities);
  const pendingManannPriest = useGame((s) => s.pendingManannPriest);
  const pendingShoreLeave = useGame((s) => s.pendingShoreLeave);
  const vessel = useGame((s) => s.vessel);
  const travelPlan = useGame((s) => s.travelPlan);
  const travelRecap = useGame((s) => s.travelRecap);
  const setScreen = useGame((s) => s.setScreen);
  const startScene = useGame((s) => s.startScene);
  const partyWiped = useGame((s) => s.partyWiped);
  const party = useGame((s) => s.party);
  const zoom = useGame((s) => s.zoom);
  const setZoom = useGame((s) => s.setZoom);
  const rotateCam = useGame((s) => s.rotateCam);
  const viewMode = useGame((s) => s.viewMode);
  const toggleViewMode = useGame((s) => s.toggleViewMode);
  const povActive = useGame((s) => s.povActive);
  const togglePov = useGame((s) => s.togglePov);
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
  const hovered = useGame((s) => s.hovered);
  const [saveOpen, setSaveOpen] = useState(false); // modale Sauvegarder/Charger (Jalon 5)
  const [rulesOpen, setRulesOpen] = useState(false); // panneau « Règles maison » (dont Cadence de combat)
  const [optionsOpen, setOptionsOpen] = useState(false); // écran Options (remap clavier)
  const [dossierOpen, setDossierOpen] = useState(false); // dossier du navire persistant (#227, EN et HORS combat)
  const [voyageMin, setVoyageMin] = useState(false); // écran-hub de voyage RÉDUIT (#333) — forcé ouvert dès qu'une étape attend
  const pendingCascade = useGame((s) => s.pendingCascade);
  const pendingRest = useGame((s) => s.pendingRest);
  // Écran-hub de voyage (#333) : actif tout au long d'un voyage EN COURS (source unique `voyageHubActive`).
  // Réductible pour consulter la scène, mais FORCÉ ouvert dès qu'une étape (cascade OU nuit) attend —
  // sinon l'étape incrustée serait invisible (l'arbitre a déjà supprimé la modale flottante).
  const voyageHub = voyageHubActive({ travelPlan, travelRecap, mode, worldMapOpen, battle });
  const voyageStepUp = voyageStepPending({ pendingCascade, pendingRest });
  const showVoyage = voyageHub && (!voyageMin || voyageStepUp);
  const [sessionOpen, setSessionOpen] = useState(false); // écran de fin de séance (Ambitions/Détermination)
  const inspected = inspectEnabled && inspectId ? battle?.combatants.find((c) => c.id === inspectId) ?? null : null;
  // Dock : version « vivante » des héros en combat (PB/effets à jour), sinon la party.
  // Le dock (portraits du haut) liste les héros PUIS les navires alliés (couche Mer) : cliquer un navire ouvre SA
  // fiche (état + équipage), comme une fiche héros. Le navire n'apparaît qu'en combat naval (sinon le filtre est vide).
  const dockHeroes = [
    ...party.map((h) => battle?.combatants.find((x) => x.id === h.id) ?? h),
    ...(battle?.combatants.filter((c) => (isVehicle(c) || isEngin(c)) && c.kind === 'hero') ?? []),
  ];
  const activeId = battle && !battle.over ? battle.order[battle.turn] : null;
  // Pré-emption d'initiative (pause de début de Round) : combattants éligibles (LDB ch.17 l.27) que le
  // siège LOCAL CONTRÔLE (héros, ou ennemis conduits par le MJ) — `controlsCombatant` filtre le contrôle.
  const canFirstIds = battle && pendingRoundStart
    ? battle.order.filter((id) => {
        const c = battle.combatants.find((x) => x.id === id);
        return !!c && canActFirst(c, battle) && controlsCombatant(useGame.getState(), c);
      })
    : [];
  // Pré-emption GRATUITE (arme Rapide, LDB 62 l.318-319) — badge dédié au lieu de Chance.
  const freeFirstIds = canFirstIds.filter((id) => {
    const c = battle?.combatants.find((x) => x.id === id);
    return !!c && freeActFirst(c);
  });
  // Tir rapide (talent, LDB 10) : héros CONTRÔLÉS localement pouvant interrompre à distance pendant la pause
  // (arme chargée + pas encore tiré ce Round). La visée ARMÉE (`preemptAiming`) vit dans le STORE → le clic
  // adversaire route par `battleClickEntity` (source unique carte ⇄ frise), comme toute action de ciblage.
  const preemptAiming = useGame((s) => s.preemptAiming);
  const armPreempt = useGame((s) => s.armPreempt);
  const canPreemptIds = preemptShooterIds(useGame.getState); // source UNIQUE (partagée avec le ciblage clavier)
  // #21 : pendant une action de CIBLAGE (attaque/incantation/charge/piétinement), cliquer un PORTRAIT
  // (frise ou dock) cible ce combattant — même validation/portée que cliquer son pion sur le champ.
  // COOP : seulement quand le combattant actif est À SOI (le tour d'un autre joueur est inerte).
  const controls = useGame(controlsActive);
  const targetingAction = battle && !battle.over ? battle.action : null;
  const isTargeting = controls && !!targetingAction && ['attack', 'cast', 'charge', 'trample'].includes(targetingAction as string);
  // Tir rapide (LDB 10) : le badge arme/désarme la visée d'un héros pendant la pause de début de Round.
  const onStripPortrait = (id: string) => {
    const c = battle?.combatants.find((x) => x.id === id);
    // Tir rapide armé : router le clic vers `battleClickEntity` (source UNIQUE carte ⇄ frise) — il déclenche
    // l'interruption sur un adversaire valide, même pendant la pause où il n'y a pas de combattant actif.
    if (preemptAiming) { battleClickEntity(id); return; }
    // MÊME comportement que cliquer le token sur la carte (IsoStage) : action de combat si la cible est
    // actionnable ET qu'on contrôle l'actif (coop : ton tour), sinon inspection (read-only, tout joueur).
    // `combatantClickActs` = condition PARTAGÉE carte ⇄ frise — elles ne peuvent plus diverger.
    if (c && controls && combatantClickActs(useGame.getState, c)) {
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
    // #225 : filet de niveau écran — couvre carte du monde, port, marché, modales… (tout ce qui est
    // hors du stage, jusque-là rendu à nu). `onRetry` = simple reprise du rendu (pas de reload : le
    // store n'est pas touché par un crash de render, la session en mémoire survit).
    <SceneErrorBoundary
      className="app-error-boundary"
      message="Une erreur d'affichage est survenue. Votre partie n'est pas perdue."
      retryLabel="Revenir à la scène"
      onRetry={() => {}}
    >
    <div className="screen campaign-view">
      <main className="stage">
        <SceneErrorBoundary>{mode === 'exploration' && povActive ? <PovStage /> : <IsoStage />}</SceneErrorBoundary>
        {/* ── Overlays HUD plein-champ (façon BG3, mobile-first) ── */}
        {mode === 'battle' && battle && (
          <>
            <InitiativeStrip
              order={battle.order}
              turn={battle.turn}
              combatants={battle.combatants}
              over={battle.over != null}
              canFirstIds={canFirstIds}
              freeFirstIds={freeFirstIds}
              inspectEnabled={inspectEnabled}
              targeting={isTargeting || !!preemptAiming}
              onToggleInspect={toggleInspect}
              onActivate={onStripPortrait}
              onHover={setHoverCombatant}
              hoveredId={hovered}
              onPromote={roundStartPromote}
              canPreemptIds={canPreemptIds}
              preemptArmedId={preemptAiming}
              onPreempt={armPreempt}
            />
            <CombatStartSplash />
          </>
        )}
        {mode === 'battle' && battle && <CombatBanner />}{/* fil SOUS la frise (CSS .combat-feed) */}
        {/* Ciblage par carte (Frappe Mortelle / Deux armes / Surincantation / pose de zone) :
            la BARRE D'ACTION se transforme en bandeau d'interlude (cf. ActionBar). */}
        {/* Sauvegarder : exploration seulement (refusée en combat) et jamais l'invité (la save vit chez l'hôte). */}
        <GameMenu sceneName={scene?.nom} money={money} time={gameTime} onQuit={() => setScreen('party')} onSaveLoad={mode === 'exploration' && netMode !== 'guest' ? () => setSaveOpen(true) : undefined} onEndSession={mode === 'exploration' && netMode !== 'guest' ? () => setSessionOpen(true) : undefined} onHouseRules={() => setRulesOpen(true)} onOptions={() => setOptionsOpen(true)} coop={<><CoopMenuSection /><GmSoloToggle /><AudioControls /></>} />
        {/* Objectif courant (#238) — surface discrète TOUJOURS visible en exploration ; masquée en
            combat (l'écran tactique se réserve le HUD). Nulle si la pile d'objectifs est vide. */}
        {mode === 'exploration' && <ObjectiveBannerMount />}
        {saveOpen && <SaveLoadModal mode="save" onClose={() => setSaveOpen(false)} />}
        {(sessionOpen || sessionEndOpen) && <SessionEndModal onClose={() => { setSessionOpen(false); closeSessionEnd(); }} />}
        {rulesOpen && <HouseRulesModal onClose={() => setRulesOpen(false)} />}
        {optionsOpen && <OptionsModal onClose={() => setOptionsOpen(false)} />}
        {/* Barre d'actions de lieu : carte / port / marché / repos — rangée qui s'auto-empile
            (aucune se recouvre, quel que soit le sous-ensemble affiché). */}
        <div className="worldmap-actions">
        {/* Dossier du navire (#227) : écran PERSISTANT du navire de campagne, visible dès que
            `vessel` existe — EN et HORS combat (source unique ; en combat il montre le même dossier). */}
        {vessel && (
          <button
            type="button"
            className="worldmap-btn"
            onClick={() => setDossierOpen(true)}
            title="Dossier du navire — état, cargaison, équipage"
          >
            <Icon id="travel/sail-ship" size="lg" />
          </button>
        )}
        {/* Écran-hub de voyage RÉDUIT (#333) : le rouvrir (« on pilote un voyage »). Caché tant qu'une
            étape attend (le hub est alors forcé ouvert). */}
        {voyageHub && voyageMin && !voyageStepUp && (
          <button type="button" className="worldmap-btn" onClick={() => setVoyageMin(false)} title="Rouvrir l’écran de voyage">
            <Icon id="travel/sail-ship" size="lg" />
          </button>
        )}
        {/* Carte du monde (#T2) : visible en exploration quand la scène est un lieu connu, ou
            qu'un voyage interrompu attend sa reprise. */}
        {mode === 'exploration' && worldMap && (placeOfScene(worldMap, scene?.id) || travelPlan) && (
          <button
            type="button"
            className={`worldmap-btn ${travelPlan?.interrupted ? 'attention' : ''}`}
            onClick={openWorldMap}
            title={travelPlan?.interrupted ? 'Carte du monde — voyage interrompu (reprendre)' : 'Carte du monde — voyager'}
          >
            <Icon id="nav/campaign" size="lg" />
          </button>
        )}
        {/* Port — le groupe est à un lieu PORTUAIRE de la carte avec un navire de campagne :
            services au chantier + commerce maritime (MDG 15). */}
        {mode === 'exploration' && !travelPlan && vessel && worldMap && placeOfScene(worldMap, scene?.id)?.port && (
          <button
            type="button"
            className="worldmap-btn port-btn"
            onClick={openPort}
            title="Port — chantier naval et commerce maritime"
          >
            <Icon id="scenario/port" size="lg" />
          </button>
        )}
        {/* Marché terrestre — le groupe est à un Lieu de commerce de cargaison de la carte (T2C ch.11) :
            acheter/vendre/brader la cargaison du convoi. */}
        {mode === 'exploration' && !travelPlan && worldMap && placeOfScene(worldMap, scene?.id)?.market && (
          <button
            type="button"
            className="worldmap-btn market-btn"
            onClick={openLandMarket}
            title="Marché — commerce de cargaison terrestre"
          >
            <Icon id="scenario/market" size="lg" />
          </button>
        )}
        {/* Dormir ici — l'offre (auberge/chez soi/dehors) vient de la ZONE où se tient le
            groupe, sinon de la scène (donnée d'auteur, restPlacesHere). */}
        {mode === 'exploration' && !travelPlan && restHere && (
          <button
            type="button"
            className="worldmap-btn camp-btn"
            onClick={() => openRest({ places: restHere.places, quality: restHere.quality })}
            title={restHere.places.auberge ? 'Dormir — auberge ou belle étoile' : restHere.places.maison ? 'Dormir — chez soi' : 'Camper — dormir sur place jusqu’à l’aube'}
          >
            {/* Une seule icône Repos (auberge/chez soi/camp) — le `title` porte la nuance. */}
            <Icon id="nav/rest" size="lg" />
          </button>
        )}
        </div>
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
          pov={povActive}
          onTogglePov={mode === 'exploration' ? togglePov : undefined}
        />
        {mode === 'exploration' && povActive && <PovControls />}
        {dialogue && <DialogueBox />}
        {merchant && <MerchantPanel />}
        {/* Jeux de taverne (NADJ ch.16) : la modale se rend seule quand `tavernGames` est ouvert
            (Effet `openTavernGames` d'un dialogue d'aubergiste). Nulle sinon — mont inconditionnel. */}
        <TavernGameModal />
        {worldMapOpen && mode === 'exploration' && <WorldMapView />}
        {port && mode === 'exploration' && <PortView />}
        {/* Dossier du navire (#227) : plein-champ, monté EN et HORS combat (persistant). */}
        {dossierOpen && vessel && <ShipDossier onClose={() => setDossierOpen(false)} />}
        {/* Écran-hub de voyage (#333) : plein-champ pendant tout voyage EN COURS ; héberge la cascade
            du jour EN SON CENTRE (l'arbitre supprime la modale flottante). */}
        {showVoyage && <VoyageScreen onClose={() => setVoyageMin(true)} />}
        {landMarket && mode === 'exploration' && <LandMarketView />}
        {pendingSeaActivities && mode === 'exploration' && <SeaActivitiesModal />}
        {/* Au port ouvert, ces décisions sont surfacées par l'onglet Escale du hub (#228) — pas de double surface. */}
        {pendingManannPriest && mode === 'exploration' && !port && <ManannPriestModal />}
        {pendingShoreLeave && mode === 'exploration' && !port && <ShoreLeaveModal />}
        {/* Récapitulatif de voyage (audit M4) : à l'arrivée, ou APRÈS l'embuscade qui a interrompu
            le trajet (jamais par-dessus le combat/un dialogue). */}
        {travelRecap && mode === 'exploration' && !dialogue && !worldMapOpen && <TravelRecapModal />}
        {/* Barre d'action + portrait du héros actif EN BAS (cf. ActionBar). */}
        {mode === 'battle' && battle && <ActionBar />}
        {/* Défaite : overlay centré (la victoire a son écran plein, VictoryScreen). Dans une Scène de
            combat de bataille de masse (ADE II 08), `dismissDefeat` fait CONTINUER la bataille (repli
            tactique, pas game-over) ; hors bataille de masse, il rend la main à la scène. */}
        {mode === 'battle' && battle?.over === 'defeat' && (
          <div className="defeat-overlay">
            <div className="battle-result defeat">
              <h2>{useGame.getState().massBattle?.combatScene ? 'Repoussés…' : 'Défaite…'}</h2>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const g = useGame.getState();
                  if (g.massBattle?.combatScene || g.scene) g.dismissDefeat();
                  else startScene(campaign[0].scene);
                }}
              >
                {useGame.getState().massBattle?.combatScene ? 'Poursuivre la bataille' : 'Reprendre'}
              </button>
            </div>
          </div>
        )}
        {/* Anéantissement HORS COMBAT (`checkPartyWiped`) : MÊME écran de défaite que le combat, hors
            bataille (aucun `battle`) — le groupe entier est tombé (faim, exposition, damnation…). */}
        {partyWiped && (
          <div className="defeat-overlay">
            <div className="battle-result defeat">
              <h2>Le groupe a péri…</h2>
              <button className="btn btn-primary" onClick={() => useGame.getState().dismissDefeat()}>Retour au menu</button>
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
      {sheetId && (() => {
        const c = battle?.combatants.find((x) => x.id === sheetId);
        // Un navire ouvre SA seule coque ; un emplacement de siège ouvre TOUTE la batterie alliée, centrée sur le cliqué.
        if (c && isVehicle(c)) return <PosteSheet combatantIds={[c.id]} onClose={() => setSheetId(null)} />;
        if (c && isEngin(c)) {
          const engins = battle!.combatants.filter((x) => isEngin(x) && x.kind === c.kind).map((x) => x.id);
          return <PosteSheet combatantIds={engins} initialHullId={c.id} onClose={() => setSheetId(null)} />;
        }
        return <CharacterSheet heroId={sheetId} onClose={() => setSheetId(null)} />;
      })()}
      {inspected && <InspectPanel combatant={inspected} onClose={() => setInspectId(null)} />}
    </div>
    </SceneErrorBoundary>
  );
}
