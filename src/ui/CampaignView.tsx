import { useState } from 'react';
import { useGame } from '../state/store';
import { canActFirst, freeActFirst } from '../state/turnEconomy';
import { preemptShooterIds } from '../state/targeting';
import { IsoStage } from '../gameIso/IsoStage';
import { PovStage } from '../gameIso/pov/PovStage';
import { SceneErrorBoundary } from './SceneErrorBoundary';
import { Modal } from './Modal';
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
import { SessionEndModal } from './SessionEndModal';
import { WorldMapView } from './WorldMapView';
import { GameDate } from './GameDate';
import { PortView } from './PortView';
import { ShipDossier } from './ShipDossier';
import { LandMarketView } from './LandMarketView';
import { SeaActivitiesModal } from './SeaActivitiesModal';
import { ManannPriestModal } from './ManannPriestModal';
import { ShoreLeaveModal } from './ShoreLeaveModal';
import { TravelRecapModal } from './TravelRecapModal';
import { VoyageScreen } from './VoyageScreen';
import { CityHubScreen } from './CityHubScreen';
import { CarnetScreen } from './CarnetScreen';
import { DialogueHistoryScreen } from './DialogueHistoryScreen';
import { voyageHubActive, voyageStepPending } from '../state/modalArbiter';
import { placeOfScene, atLocationPlace, placeServices } from '../state/worldMap';
import { restPlacesHere } from '../state/restFlow';
import { hoverClickCommits } from './pointerCaps';
import { controlsActive, controlsCombatant } from '../state/netOwnership';
import { combatantClickActs } from '../state/combatOrParty';
import { useGameKeyboard } from './useGameKeyboard';
import { useGamepad } from './useGamepad';
import { campaign } from '../scenes/campaign';

export function CampaignView() {
  useGameKeyboard(); // raccourcis clavier de jeu (registre unique)
  useGamepad(); // couche manette : dispatche les MÊMES intentions que le clavier (registre partagé)
  const scene = useGame((s) => s.scene);
  const mode = useGame((s) => s.mode);
  const journal = useGame((s) => s.journal);
  const dialogue = useGame((s) => s.dialogue);
  const battle = useGame((s) => s.battle);
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
  const landMarket = useGame((s) => s.landMarket);
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
  // Fiche de personnage/poste : héros au STORE (`sheetId`, patron `inspectId`) — partagé avec
  // PartyScreen pour que la fiche survive au switch de héros entre les deux hôtes.
  const sheetId = useGame((s) => s.sheetId);
  const setSheetId = useGame((s) => s.setSheetId);
  const openPossessionsScreen = useGame((s) => s.openPossessionsScreen);
  const inspectId = useGame((s) => s.inspectId); // statbloc inspecté (store : frise ET token l'ouvrent)
  const setInspectId = useGame((s) => s.setInspectId);
  const setHoverCombatant = useGame((s) => s.setHoverCombatant);
  const hovered = useGame((s) => s.hovered);
  const [saveOpen, setSaveOpen] = useState(false); // modale Sauvegarder/Charger (Jalon 5)
  const [dossierOpen, setDossierOpen] = useState(false); // dossier du navire persistant (#227, EN et HORS combat)
  const [voyageMin, setVoyageMin] = useState(false); // écran-hub de voyage RÉDUIT (#333) — forcé ouvert dès qu'une étape attend
  const [cityHubOpen, setCityHubOpen] = useState(false); // hub de ville (#343) — s'ouvre depuis le bouton du lieu
  const [carnetOpen, setCarnetOpen] = useState(false); // carnet d'enquête (#670) — s'ouvre depuis le bouton dédié
  const [historyOpen, setHistoryOpen] = useState(false); // relecture des conversations (#718 dernier lot) — s'ouvre depuis le tiroir-journal
  const dialogueHistory = useGame((s) => s.dialogueHistory);
  const campaignNarratif = useGame((s) => s.campaignNarratif);
  // Hub de ville (#343) : le groupe est À un lieu de la carte → UN écran-lieu remplace les boutons
  // flottants Port/Marché/Dormir. `hubPlace` = le lieu courant (null hors lieu : route, camp sauvage).
  const hubPlace = atLocationPlace({ mode, travelPlan, worldMap, sceneId: scene?.id });
  const hubServices = hubPlace ? placeServices(hubPlace, scene ?? undefined) : [];
  const pendingCascade = useGame((s) => s.pendingCascade);
  const pendingRest = useGame((s) => s.pendingRest);
  // Écran-hub de voyage (#333) : actif tout au long d'un voyage EN COURS (source unique `voyageHubActive`).
  // Réductible pour consulter la scène, mais FORCÉ ouvert dès qu'une étape (cascade OU nuit) attend —
  // sinon l'étape incrustée serait invisible (l'arbitre a déjà supprimé la modale flottante).
  const voyageHub = voyageHubActive({ travelPlan, travelRecap, mode, worldMapOpen, battle });
  const voyageStepUp = voyageStepPending({ pendingCascade, pendingRest, pendingShoreLeave });
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
  // Pré-emption d'initiative (pause de début de Round) : combattants éligibles (LDB 17 l.27) que le
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
        {/* Barre HUD supérieure UNIFIÉE : le menu ☰, l'horloge de campagne et les raccourcis de lieu
            (navire / voyage / carte / hub / repos) partagent UN conteneur en rangée qui s'enroule
            ≤700px — plus deux îlots absolus indépendants. Sauvegarder : exploration seulement (refusée
            en combat) et jamais l'invité (la save vit chez l'hôte). */}
        <div className="hud-topbar">
        <GameMenu sceneName={scene?.nom} time={gameTime} onQuit={() => setScreen('party')} onSaveLoad={mode === 'exploration' && netMode !== 'guest' ? () => setSaveOpen(true) : undefined} onEndSession={mode === 'exploration' && netMode !== 'guest' ? () => setSessionOpen(true) : undefined} />
        {/* Horloge de campagne : chip de la barre (date/heure), source unique `GameDate`. */}
        {mode === 'exploration' && (
          <span className="hud-clock" title="Date et heure de la campagne"><GameDate time={gameTime} /></span>
        )}
        {/* Possessions du groupe (#762) : gestion (bêtes/véhicules/navires/serviteurs) atteignable
            EN JEU — hors combat, même gate que « Camper »/la carte du monde (l'écran tactique se
            réserve le HUD). Modale GLOBALE (store `possessionsScreen`, montée dans `App.tsx`). */}
        {mode === 'exploration' && (
          <button
            type="button"
            className="worldmap-btn"
            onClick={() => openPossessionsScreen()}
            title="Possessions du groupe"
          >
            <Icon id="travel/mount" size="lg" />
          </button>
        )}
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
        {/* Carnet d'enquête (#670) : visible seulement si la campagne embarque une enquête
            (au moins un indice défini au narratif) — arène/scènes de test sans indices n'ont pas
            le bouton. */}
        {mode === 'exploration' && (campaignNarratif?.indices.length ?? 0) > 0 && (
          <button
            type="button"
            className="worldmap-btn"
            onClick={() => setCarnetOpen(true)}
            title="Carnet d’enquête"
          >
            <Icon id="nav/compendium" size="lg" />
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
        {/* Hub de ville (#343) : à un lieu de la carte, UN bouton « <Lieu> » ouvre l'écran-lieu qui
            porte Port/Marché/Dormir. Affiché dès que le lieu offre au moins un service, ou un couchage
            sur place. */}
        {hubPlace && (hubServices.length > 0 || restHere) && (
          <button
            type="button"
            className="worldmap-btn"
            onClick={() => setCityHubOpen(true)}
            title={`${hubPlace.label} — services du lieu`}
          >
            <Icon id={hubPlace.icon ?? 'nav/campaign'} size="lg" />
          </button>
        )}
        {/* Dormir ici HORS lieu (route, camp sauvage) — l'offre (auberge/chez soi/dehors) vient de la
            ZONE où se tient le groupe, sinon de la scène. À un lieu, le repos vit DANS le hub. */}
        {mode === 'exploration' && !travelPlan && restHere && !hubPlace && (
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
        {/* Objectif courant (#238) — surface discrète TOUJOURS visible en exploration ; masquée en
            combat (l'écran tactique se réserve le HUD). Nulle si la pile d'objectifs est vide. */}
        {mode === 'exploration' && <ObjectiveBannerMount />}
        {/* Panneaux du menu ☰ : surfaces SYSTÈME, jamais par-dessus un dialogue PNJ en cours (#376 pt.2)
            — `DialogueBox` ne porte pas de `.modal-overlay` (pas de voile plein écran), donc une
            modale système au-dessus resterait invisible/inatteignable sous elle sans cette garde. */}
        {saveOpen && !dialogue && <SaveLoadModal mode="save" onClose={() => setSaveOpen(false)} />}
        {(sessionOpen || sessionEndOpen) && !dialogue && <SessionEndModal onClose={() => { setSessionOpen(false); closeSessionEnd(); }} />}
        <PartyDock heroes={dockHeroes} targeting={isTargeting} onOpen={onDockPortrait} />
        <LogDrawer
          battle={mode === 'battle' && battle ? { log: battle.log, combatants: battle.combatants } : null}
          journal={journal}
          onOpenHistory={mode === 'exploration' && dialogueHistory.length > 0 ? () => setHistoryOpen(true) : undefined}
        />
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
        {/* Jeux de taverne (NADJ 16) : la modale se rend seule quand `tavernGames` est ouvert
            (Effet `openTavernGames` d'un dialogue d'aubergiste). Nulle sinon — mont inconditionnel. */}
        <TavernGameModal />
        {worldMapOpen && mode === 'exploration' && <WorldMapView />}
        {port && mode === 'exploration' && <PortView />}
        {/* Dossier du navire (#227) : plein-champ, monté EN et HORS combat (persistant). */}
        {dossierOpen && vessel && <ShipDossier onClose={() => setDossierOpen(false)} />}
        {/* Écran-hub de voyage (#333) : plein-champ pendant tout voyage EN COURS ; héberge la cascade
            du jour EN SON CENTRE (l'arbitre supprime la modale flottante). */}
        {showVoyage && <VoyageScreen onClose={() => setVoyageMin(true)} />}
        {/* Hub de ville (#343) : écran-lieu plein-champ. Cédé aux écrans plein-champ qu'il ouvre
            (carte du monde, port, marché) — « Entrer » ferme le hub avant de les ouvrir. Cédé aussi à
            la modale de repos (`pendingRest` → `ActiveModal` clé `rest`) : « Dormir » depuis le panneau
            auberge armait `pendingRest` SANS fermer le hub, qui restait monté DERRIÈRE la modale flottante
            (bouton « Recueillir des informations » écrasé sous son bord, #376 pt.4). */}
        {cityHubOpen && hubPlace && mode === 'exploration' && !worldMapOpen && !port && !landMarket && !pendingRest && (
          <CityHubScreen place={hubPlace} scene={scene ?? undefined} rest={restHere} onClose={() => setCityHubOpen(false)} />
        )}
        {carnetOpen && mode === 'exploration' && <CarnetScreen onClose={() => setCarnetOpen(false)} />}
        {historyOpen && mode === 'exploration' && <DialogueHistoryScreen onClose={() => setHistoryOpen(false)} />}
        {landMarket && mode === 'exploration' && <LandMarketView />}
        {pendingSeaActivities && mode === 'exploration' && <SeaActivitiesModal />}
        {/* Au port ouvert, ces décisions sont surfacées par l'onglet Escale du hub (#228) — pas de double surface. */}
        {pendingManannPriest && mode === 'exploration' && !port && <ManannPriestModal />}
        {/* Relâche à terre : incrustée au CENTRE du hub de voyage quand il est actif (VoyageScreen) ;
            modale flottante seulement HORS hub (arbitrage user 2026-07-11). */}
        {pendingShoreLeave && mode === 'exploration' && !port && !voyageHub && <ShoreLeaveModal />}
        {/* Récapitulatif de voyage (audit M4) : à l'arrivée, ou APRÈS l'embuscade qui a interrompu
            le trajet (jamais par-dessus le combat/un dialogue). */}
        {travelRecap && mode === 'exploration' && !dialogue && !worldMapOpen && <TravelRecapModal />}
        {/* Barre d'action + portrait du héros actif EN BAS (cf. ActionBar). */}
        {mode === 'battle' && battle && <ActionBar />}
        {/* Défaite : overlay centré (la victoire a son écran plein, VictoryScreen). Dans une Scène de
            combat de bataille de masse (ADE II 08), `dismissDefeat` fait CONTINUER la bataille (repli
            tactique, pas game-over) ; hors bataille de masse, il rend la main à la scène. */}
        {mode === 'battle' && battle?.over === 'defeat' && (
          <Modal
            title={useGame.getState().massBattle?.combatScene ? 'Repoussés…' : 'Défaite…'}
            variant="plain"
            className="defeat-modal"
            onClose={() => {
              const g = useGame.getState();
              if (g.massBattle?.combatScene || g.scene) g.dismissDefeat();
              else startScene(campaign[0].scene);
            }}
          >
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
          </Modal>
        )}
        {/* Anéantissement HORS COMBAT (`checkPartyWiped`) : MÊME écran de défaite que le combat, hors
            bataille (aucun `battle`) — le groupe entier est tombé (faim, exposition, damnation…). */}
        {partyWiped && (
          <Modal title="Le groupe a péri…" variant="plain" className="defeat-modal" onClose={() => useGame.getState().dismissDefeat()}>
            <button className="btn btn-primary" onClick={() => useGame.getState().dismissDefeat()}>Retour au menu</button>
          </Modal>
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
