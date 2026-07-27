# Systèmes implémentés — généré (#298)

> ⚠️ Fichier GÉNÉRÉ par `node scripts/docs/build-systemes.mjs` (`npm run docs:systemes`) — NE PAS ÉDITER À LA MAIN.
> Source éditoriale (nom/périmètre/état/ticket) : `src/data/systemes.manifest.json`. Source des primitives :
> `src/data/primitives.manifest.json`. La matrice ci-dessous est CALCULÉE du graphe d'imports réel (closure
> transitive des modules racines déclarés par système) — jamais périmée : re-générer après tout ajout.

## Sommaire des systèmes

| Système | État | Modules racines | Ticket |
|---|---|---|---|
| Combat (arène tactique) | complet | `src/state/combatFlow.ts`, `src/state/combatHooks.ts`, `src/state/combatSlice.ts`, `src/state/combatSetup.ts`, `src/engine/combat.ts` | — |
| Magie (incantation, sorts, mésaventures) | complet | `src/engine/magic.ts`, `src/engine/miscast.ts`, `src/engine/overcast.ts`, `src/engine/grimoire.ts`, `src/engine/dispel.ts`, `src/ui/CastModal.tsx` | — |
| Corruption & mutation | complet | `src/engine/corruption.ts`, `src/state/corruptionFlow.ts`, `src/ui/CorruptionModal.tsx` | — |
| Psychologie (P1-P4) | complet | `src/engine/psychology.ts`, `src/state/encounterPsychFlow.ts` | — |
| Voyage terrestre | partiel | `src/state/travelFlow.ts`, `src/engine/travel.ts`, `src/engine/travelStages.ts`, `src/engine/travelTables.ts`, `src/engine/travelEncounter.ts`, `src/ui/TravelRecapModal.tsx`, `src/ui/TravelRolesPanel.tsx` | #298 (openRoll TER : fourche forcedPaceDay dupliquée, travelFlow.ts:368-381) |
| Voyage fluvial | partiel | `src/state/riverVoyageFlow.ts`, `src/engine/riverNavigation.ts` | #267/#268 (asymétrie naufrage fluvial sans checkPartyWiped, riverVoyageFlow.ts:649-651) |
| Voyage maritime | partiel | `src/state/seaVoyageFlow.ts`, `src/engine/seaVoyage.ts`, `src/engine/seaNavigation.ts`, `src/engine/seaWeather.ts`, `src/engine/seaPerils.ts`, `src/ui/SeaVoyageScreen.tsx`, `src/ui/SeaActivitiesModal.tsx` | #298 (openRoll MER : scorbut/épuisement forcés inline, seaVoyageFlow.ts:900-905,968-973) |
| Combat naval tactique | partiel | `src/engine/shipBuild.ts`, `src/engine/shipCritical.ts`, `src/engine/shipMelee.ts`, `src/state/shipManeuver.ts`, `src/state/shipBattery.ts`, `src/state/shipCollision.ts`, `src/state/shipDamage.ts`, `src/state/shipDeck.ts`, `src/state/shipPostes.ts`, `src/ui/ShipBatteryModal.tsx`, `src/ui/ShipManeuverModal.tsx`, `src/ui/ShipDossier.tsx`, `src/ui/ShipSheet.tsx` | #250, #267, #268 (Phase 8, gelé) |
| Bataille de masse / siège | complet | `src/engine/massBattle.ts`, `src/state/massBattleFlow.ts`, `src/engine/activities.ts`, `src/ui/MassBattleView.tsx` | — |
| Interlude / entre-deux | partiel | `src/state/interludeFlow.ts`, `src/engine/activities.ts`, `src/ui/InterludeScreen.tsx` | — |
| Marchand / négoce / cargaison | partiel | `src/state/merchantFlow.ts`, `src/state/portFlow.ts`, `src/state/landMarketFlow.ts`, `src/engine/bargain.ts`, `src/engine/cargo.ts`, `src/engine/landCargo.ts`, `src/ui/MerchantPanel.tsx`, `src/ui/LandMarketView.tsx`, `src/ui/PortView.tsx` | #298 (bargainPct forké portFlow.ts:126≡landMarketFlow.ts:157 ; Marchandage résolu hors modale portFlow.ts:12-14) |
| Équipage / paie / postes | complet | `src/state/shipCrew.ts`, `src/engine/crewMorale.ts`, `src/engine/warMachineCrew.ts`, `src/state/stations.ts`, `src/ui/CrewTestModal.tsx`, `src/ui/ShipRolesPanel.tsx` | — |
| Repos / survie | complet | `src/state/restFlow.ts`, `src/engine/rest.ts`, `src/engine/provisions.ts`, `src/engine/suffocation.ts`, `src/engine/exposure.ts`, `src/engine/waterExposure.ts`, `src/ui/RestModal.tsx` | — |
| Coop en ligne (relay) | complet | `src/state/netFlow.ts`, `src/state/netOwnership.ts`, `src/net/relay.ts`, `src/net/session.ts`, `src/net/intents.ts`, `src/ui/CoopLobby.tsx`, `src/ui/CoopPanels.tsx` | — |
| Éditeur de scène / campagne | complet | `src/state/sceneEdit.ts`, `src/state/validateScene.ts`, `src/state/mapSpec.ts`, `src/ui/editor/Editor.tsx` | — |
| Codex / Compendium | complet | `src/ui/compendium/CompendiumScreen.tsx` | — |

- **Combat (arène tactique)** (`combat`) : Barils combatFlow + hooks universels combatHooks.ts (docs/combat-events-coherence.md).
- **Corruption & mutation** (`corruption`) : docs/systeme-passifs.md.
- **Voyage terrestre** (`voyage-terre`) : cf. docs/plans/2026-07-11-matrice-primitives-systemes.md §openRoll.
- **Voyage maritime** (`voyage-maritime`) : Chantier naval GELÉ (pause structurelle #276) — reprend après le programme #269-#275.
- **Combat naval tactique** (`combat-naval`) : MDG 12-14.
- **Bataille de masse / siège** (`bataille-masse`) : Activités partagées avec interlude (budget max 3 RAW commun).
- **Interlude / entre-deux** (`interlude`) : Refonte UX différée (session dédiée) — backend fini, RAW « assister coûte-t-il un créneau ? » à trancher.
- **Équipage / paie / postes** (`equipage`) : Station+AssignRow (stations.ts) — patron top-down slot+affectation.
- **Repos / survie** (`repos-survie`) : MultiRollList/NightEntry — bilan nuit.
- **Coop en ligne (relay)** (`coop`) : Worker Cloudflare (server/), axe contrôleur pilotedByHuman/aiDriven/humanControlled.
- **Éditeur de scène / campagne** (`editeur`) : Schéma de Scène unique — pas de scène codée en dur (règle stricte 2).
- **Codex / Compendium** (`codex`) : Éditable sans JSON — onglets par domaine.

## Matrice primitives × systèmes (générée)

Colonnes : `combat`=Combat (arène tactique) · `magie`=Magie (incantation, sorts, mésaventures) · `corruption`=Corruption & mutation · `psychologie`=Psychologie (P1-P4) · `voyage-terre`=Voyage terrestre · `voyage-fluvial`=Voyage fluvial · `voyage-maritime`=Voyage maritime · `combat-naval`=Combat naval tactique · `bataille-masse`=Bataille de masse / siège · `interlude`=Interlude / entre-deux · `commerce`=Marchand / négoce / cargaison · `equipage`=Équipage / paie / postes · `repos-survie`=Repos / survie · `coop`=Coop en ligne (relay) · `editeur`=Éditeur de scène / campagne · `codex`=Codex / Compendium.
Cellule = **U** (la primitive est dans la closure d'import du système) ou vide (non détectée directement —
n'exclut pas un usage indirect hors des modules racines déclarés).

| Primitive | combat | magie | corruption | psychologie | voyage-terre | voyage-fluvial | voyage-maritime | combat-naval | bataille-masse | interlude | commerce | equipage | repos-survie | coop | editeur | codex |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `ScreenShell` |  |  |  |  |  |  |  | U |  |  | U |  |  |  | U |  |
| `RollShell` |  | U | U |  |  |  |  | U | U | U |  | U |  |  |  |  |
| `RollRow` |  | U | U |  | U |  | U | U | U | U |  | U |  |  |  |  |
| `makeRollFlow/FLOWS` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `openRoll/resolveSurface` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `OptionChooser/ChoiceButtons` |  | U | U |  | U |  | U | U | U | U | U | U | U |  | U |  |
| `optionValue/optionPending/testPending` |  | U | U |  |  |  |  | U | U | U |  | U |  |  |  |  |
| `InfluenceRow` |  | U | U |  | U |  | U | U | U | U |  | U |  |  |  |  |
| `VsHeader` |  | U |  |  |  |  |  |  | U | U |  |  |  |  |  |  |
| `PortraitTile/CharFrame` |  | U | U |  | U |  | U | U | U | U | U | U | U | U | U | U |
| `SearchFilterField` |  |  |  |  |  |  |  |  |  | U |  |  |  |  | U |  |
| `findTableEntry` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `baseTestMods` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `actorIn/inBattleId` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `applyOps/GameOp` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `GameOpEditor` |  |  |  |  |  |  |  |  |  |  |  |  |  |  | U | U |
| `passiveMods` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `fireTriggers` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `resolveFreeAttacks` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `damageHull/healHull/damageVesselHull/healVesselHull` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `cascade/registerCascadeApplier` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `rule/policy` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `netOwnership` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `RefField` |  |  |  |  |  |  |  |  |  |  |  |  |  |  | U | U |
| `Prose` |  | U | U |  | U |  | U | U | U | U | U | U | U | U | U | U |
| `resolveRender/pickBackend` |  | U | U |  | U |  | U | U | U | U | U | U | U | U | U | U |
| `MasterDetail` |  |  |  |  |  |  |  |  |  | U |  |  |  |  | U | U |
| `gen-registry (_registry.generated)` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

## Primitives jamais adoptées par un système déclaré

- `gen-registry (_registry.generated)` (scripts/gen-registry.mjs) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).

## Modules `src/state`/`src/engine` non rattachés à un système déclaré

Portée : fichiers top-level (hors `*.test.ts`) non atteints par la closure d'import d'AUCUN système du
manifeste. Informatif — inclut les infra partagées (store, types, helpers transverses) qu'aucun système
unique ne « possède » légitimement ; à trier au fil de l'eau, pas un échec bloquant de ce script.

15 fichier(s) :

- `src/engine/axes.ts`
- `src/engine/names.ts`
- `src/engine/spellspec.ts`
- `src/state/advancement.ts`
- `src/state/attackRelevance.ts`
- `src/state/cascadeTestKit.ts`
- `src/state/devtools.ts`
- `src/state/hotbarBridge.ts`
- `src/state/houseRules.ts`
- `src/state/jumpMove.ts`
- `src/state/keybindings.ts`
- `src/state/mapQC.ts`
- `src/state/preferences.ts`
- `src/state/turnEconomy.ts`
- `src/state/viewLevel.ts`
