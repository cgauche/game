# Architecture — où trouver quoi (référence vivante)

> Extrait verbatim du CLAUDE.md (dégraissage 2026-07-05). À lire quand on cherche où vit un
> module, avant de créer un fichier, ou pour l'état courant des systèmes. La table des
> « Primitives partagées » reste dans `CLAUDE.md` (toujours chargée).

## Arborescence

```
Source/                     Livres WFRP4 en .md (vérité citable, FR uniquement)
src/data/                   NOTRE base APP-OWNED (JSON commité, éditable dans le Compendium) + index.ts (accès typé), pregens.ts
                            EXCEPTIONS manuscrites (tables verbatim sourcées) : criticals.ts, oups.ts,
                            mutations.ts (Tableaux de Corruption LDB 19). Les métadonnées de résolution
                            des sorts vivent dans SpellData (spells.json) — l'ancien registre spellspecs/
                            et le repli regex sont SUPPRIMÉS (Migration #5)
src/geometry/                Géométrie/simulation PURE partagée `state` ⇄ `gameIso` (#161 : `state` en a
                            besoin pour SA PROPRE logique — curseur de combat, IA, cadence des beats —
                            pas seulement le rendu ; zéro dépendance framework). `iso.ts` : projection
                            isométrique (Dims, tileCenter, rotTile…) — `gameIso/iso.ts` la ré-importe pour
                            ses dérivés qui ont besoin du MONDE (WALL_H_M/isoPxToM, via state/relief).
                            `walk.ts` : interpolation temporelle le long d'un chemin (walkMs/walkXY,
                            STEP_MS) — cadence l'attente de fin de marche AVANT résolution de combat.
src/engine/                 Règles WFRP4, PUR + testé :
  types.ts                    Caractéristiques, Combatant, Weapon, ItemInstance, Difficulty…
  tests.ts                    Tests & Degrés de Réussite (DR), tests opposés
  combat.ts                   touche/localisation inversée/dégâts/critique/initiative
  characteristics.ts          bonus, Blessures (BF+2×BE+BFM)
  character.ts                création de personnage (espèce+2d10, 40 augmentations, talents…)
  creation.ts                 tables de création LDB 04/05 : d100 espèce/carrière, bonus PX,
                              100 Points, Richesse initiale, âge/taille/yeux/cheveux
  careerSlots.ts              spécialisations & emplacements « (Au choix) » des carrières :
                              parsing, désignations par carrière, Maxi des talents
  talentEffects.ts            talents à effet création/attributs (+5 carac de départ, addSkill,
                              Dur à cuire/Chanceux/Obstiné/Véloce)
  advancement.ts              coûts PX, complétion de Niveau, changement de carrière (validé)
  items.ts                    inventaire/équipement : itemFromTrapping, recomputeLoadout, encombrement
  skills.ts                   valeur d'un test de compétence (partyBest) hors combat
  conditions.ts               États (+ durées d'États de sort, États récurrents)
  ops.ts                      **`GameOp` = LA langue UNIQUE de tout EFFET mécanique** (soin, retrait/pose
                              d'État, octroi de trait/talent/arme, dégâts, modificateurs, corruption…),
                              exécutée par `applyOps(target, ops, ctx)` et éditée par `GameOpEditor`.
                              AVANT de modéliser un effet en type/champ ad hoc → l'exprimer en `GameOp[]`.
                              Consommée par : sorts, Imparfaites (miscast), mutations, traits, qualités
                              (`passive`), effets déclenchés (`Flow`/`Trigger`), CONSOMMABLES. Jalon 2.6 :
                              PerSL (échelle par DR), onlyGroups, grantTrait/grantTalent/augmentWeapon/…
  spellspec.ts                spellSupport : classification mécanique/partiel/narratif d'un sort depuis
                              SpellData (duck typing — l'interface SpellSpec, le registre spellspecs/ et
                              le repli regex fallbackSpec sont supprimés, métadonnées migrées en donnée)
  magic.ts                    incantation/Focalisation/Péché/ZdE/portée/armure (« Repousser les Vents »)
  miscast.ts                  tables d'Imparfaites & Colère des dieux (d100 → GameOps, verbatim)
  corruption.ts               Corruption & mutations (LDB 19 : expositions, seuil, limites → damné)
  grimoire.ts                 apprentissage/mémorisation des sorts (coûts par Talent) + lecture au livre
  travel.ts                   voyage RAW (#T2) : vitesses km/h, 6 h/jour, marche forcée, coûts diligence/barge
  provisions.ts               rations & Faim (LDB 18 l.417-422) : consommation/jour, Tests, malus, Brouet
  axes.ts                      axes de forces/faiblesses (#409, mécanique MAISON) : axisScore/axesProfile/
                                partyCoverage/dominantAxes depuis `data/axes.json` (`derivation` en ids de
                                skills/talents) — SOURCE UNIQUE du mini-radar, du rail de composition (#417)
                                et des « rôles » de carte (`heroRoles`, `ui/CharCard.tsx`, réconcilié dessus)
src/state/
  scene.ts                  SCHÉMA DE SCÈNE (tiles, entities, dialogues, triggers, encounters, Effect[])
  worldMap.ts               SCHÉMA DE CARTE DU MONDE (#T2) : lieux/routes au niveau projet + format projet v2
                            (`ProjectDoc`, `activeAxes?: string[]` #409 — axes de forces/faiblesses ACTIFS de
                            la campagne, ids de `data/axes.json`, défaut `CORE_AXIS_IDS` via `resolveActiveAxes`).
                            DONNÉES DE LIEU (#343) : le nœud `MapPlace` est LA source des services d'un lieu —
                            `port` (schéma riche + catalogue `naval-ports.json`), `market` (LandMarketProfile) et
                            `services[]` EXTENSIBLES (catalogue `lieux-services.json` : auberge/temple/forgeron/
                            guilde…). API UNIQUE `placeServices(place, scene?)` : compose ces trois sources +
                            l'auberge (offre PROPRE au service OU dérivée de l'offre de repos de la scène liée) en
                            une liste `ResolvedPlaceService[]` — payloads RÉFÉRENCÉS, jamais recopiés (zéro
                            duplication de vérité). Consommée par le hub de lieu (#343) et l'auberge ; les
                            consommateurs actuels (portFlow/landMarketFlow/restPlacesHere) restent inchangés.
  campaignNarratif.ts       SCHÉMA du bloc NARRATIF d'un paquet de campagne (schema 3, #765) : `NarratifBlock`
                            = `{affaires, indices, presetsPnj, objets}`, EMBARQUÉ dans le JSON du projet, jamais
                            copié dans `src/data` global (`validateNarratif` refuse toute collision d'id).
  campaignData.ts           COUTURE UNIQUE de résolution de la couche de campagne runtime (#767) : lit le slot
                            `campaignNarratif` (posé par `loadProject`) par id STABLE. `presetPnjById`/`affaireById`/
                            `indiceById` = COUCHE-SEULEMENT (n'existent pas au global) ; `trappingById` chaîne
                            campagne-D'ABORD puis règle globale (`findTrappingById`). Maps mémoïsées par référence du
                            bloc. Le moteur reste PUR : `engine/items` reçoit ce `trappingById` en résolveur injecté
                            (défaut = global) aux sites d'état `giveTrapping` — il n'importe jamais le store.
                            PNJ nommés (#671) : `resolvePresetCreature` résout un `presetId` de scène en créature mergée
                            (`mergeCreatureProfile`, base globale + surcharges du preset) + apparence embarquée ; câblée au
                            spawn de rencontre (`combatSlice` → `spawnEnemy` canal `presetCreature`, `spawn.ts` reste sans
                            import de cette couche) et au portrait de dialogue (`gameIso/pickBackend.tsx`).
  store.ts                  store Zustand : GameState + vue (caméra/zoom) + campagne (scènes, dialogues,
                            effets, temps/repos) + actions de combat — délègue aux modules (get,set) :
  combatFlow.ts               flux de combat tour par tour (IA, attaques, effets, fin de combat).
                              CONVENTION « baril » : les clusters FEUILLES extraits sont des modules
                              séparés que combatFlow ré-exporte (`export * from './combatX'`) pour ne
                              pas casser les importeurs — un module feuille n'importe RIEN de combatFlow
                              (tout passe par get().xxx / modules feuilles). Déjà sortis : combatGeometry.ts
                              (géométrie pure) et combatEffects.ts (effets de scène/campagne : applyEffects,
                              butin attribuable, checkTriggers, pushReveal). NE PAS extraire le preview
                              (previewAttack/Defense) : il partage attackEnv/bestDefenseMode avec la
                              résolution → cycle. La cohésion preview↔résolution est voulue.
  rollFlowFactory.ts / rollFlowSpecs.ts  FABRIQUE générique des flux de jet différé (« une situation = une modale ») +
                              specs des flux (attack/defense/cast/disengage/trample/run/focus/psych/
                              frenzy/approach/test/heal + reload/recover/activity/corruption/appraise/
                              bargain) — un nouveau jet = 1 spec + 1 xConfirm. Résilience « Je ne
                              faillirai pas ! » (LDB 17 l.73, GLOBALE) : mécanisme UNIQUE (factory
                              `forceSuccess`/`setForcedRoll` + UI `ForcedRollPicker`). Un flux qui
                              l'offre déclare `caps: { forced: true }` ; son `resolve(s,p,actor,get,
                              forced?)` porte alors LES TROIS cas dans UN seul résolveur : `forced`
                              absent = jet normal (RNG) ; `{}` = `forceSuccess` (dé par défaut : 01→DR
                              max, ou opposé→jet courant forcé à ≥ DR+1) ; `{ roll }` = `setForcedRoll`
                              (dé choisi, doit rester une réussite). PLUS de dérives `force`/`forceRoll`
                              séparées (l'ancien « code dérivé ») — la résolution forcée VIT dans le
                              résolveur du Test, à côté du jet normal. La localisation suit le dé inversé
                              (attaque LDB 13 l.142, Projectile magique LDB 46 l.156) : choisir le dé la
                              re-dérive — il n'y a PAS de « coup ciblé » libre pour un Projectile (RAW).
  corruptionFlow.ts           gainCorruption (seuil → mutation → damnation, révélation 🧬) + cibles
  pendings.ts                 types Pending* (ré-exportés par store.ts)
  partyFlow.ts                équipement, avancement PX, consommables de fiche, butin
  merchantFlow.ts             marchand : réassort, panier, achat/vente/réparation, Marchandage, Évaluation
  travelFlow.ts               voyage jour par jour (temps, fatigue, péripéties d10+auteur, interruption/reprise)
  upkeep.ts                   entretien QUOTIDIEN (#T3 cascade : rations/faim + maladies + convalescence
                              des critiques, jours CALENDAIRES) + purge des effets a duree d'horloge
                              (castPenalties/ActiveEffect.untilTime) — anti-double-comptage lastUpkeepDay
  spawn.ts / path.ts / bus.ts
  dir8.ts                     Dir8 (8 caps grille) + géométrie associée : rotateDir8, DIR8_DELTA,
                              facingToward (#161 : ex-`gameIso/rig/facing.ts` — la géométrie de cap grille
                              n'est pas du rendu, `gameIso` la ré-importe pour l'orientation écran)
  viewLevel.ts                override DEBUG de l'étage AFFICHÉ (`__wfrp.viewLevel(z)`, #161 : ex-
                              `gameIso/viewLevel.ts`) — SOURCE dans `state`, lu par `gameIso/IsoStage`
  combatLog.ts                CombatEvent/CombatEventKind + CombatTone/toneOf/isImportantEvent/
                              lastEventTone (#161 : cadence des beats, `gameIso/combatNarration` les
                              réutilise pour l'icône/la coloration par camp, hors du périmètre `state`)
  migrateDoc.ts                PRIMITIVE GÉNÉRIQUE de migration séquentielle de document versionné
                              (`{version, ...}` → `MigrationMap` chaînée jusqu'à `targetVersion` ;
                              refuse net — jamais ne corrompt — objet malformé/version future/trou
                              dans la chaîne) : tout futur doc versionné la réutilise plutôt que de
                              réinventer une chaîne ad hoc (#301)
  saves.ts                    Sauvegarde/chargement de partie (localStorage 3 slots + export/import
                              JSON) : `SAVE_VERSION` + `MIGRATIONS` (via `migrateDoc`) upgradent une
                              save ancienne AVANT validation — un bump de version SANS son
                              `MIGRATIONS[N]` ET sa fixture golden `v<N>-*.json` fait échouer le
                              CLIQUET de `saves-flow.test.ts`. Fixtures RÉELLES (jamais composées à
                              la main) sous `__fixtures__/saves/`, régénérées via
                              `__fixtures__/saves/_generate.test.ts` (`describe.skip`, procédure
                              dans son `README.md`) — chargées par `saves-flow.test.ts` (« Golden
                              saves ») : le filet qui détecte qu'une refonte d'état (ex. #311,
                              renommage `CharKey`) casse silencieusement une save existante.
  roster.ts                   Roster persistant (localStorage) des personnages créés au créateur —
                              son propre couple `EXPORT_VERSION`/`ROSTER_MIGRATIONS` (même primitive
                              `migrateDoc`), indépendant de `saves.ts` (le roster ne voyage PAS dans
                              la save de partie)
src/gameIso/                Rendu isométrique SVG (remplace Phaser) :
  iso.ts                      dérivés MÉTRIQUES de la projection (WALL_H_M, isoPxToM — besoin du monde,
                              via state/relief) ; la projection elle-même (Dims, tileCenter, diamondPath,
                              screenToTile, stageSize…) vit dans `src/geometry/iso.ts` (#161)
  sprites.ts                  décor (props/villageois/terrain en relief) + DEFS (gradients) — PLUS de sprite créature
  rig/                        gabarits corporels (bipède + quadrupède/ailé/serpentin/…) — rend TOUT le bestiaire
                              AJOUTER une créature : suivre docs/creer-une-creature.md (registre defs/,
                              corps nu ≠ tenue, illustration art-ref obligatoire, pièges codifiés)
  pickBackend.tsx             classifieur unique : rig humanoïde / gabarit animé / sprite décor
  IsoStage.tsx                composant de rendu (caméra, clics, tokens, surbrillances)
  fx/                         FX de combat pilotés par le bus : useCombatFx (flottants/projectiles/halos/
                              zones) + FxLayer (rendu) + useWalkAnim (marche animée)
src/ui/                     React : menus, CampaignView (HUD), CharacterSheet, modales
  creator/                    assistant de création multi-étapes (LDB 04/05) : CharacterCreator.tsx
                              (rendu) + draft.ts (état pur : tirages figés, bonus PX, validation)
  gallery/DesignGallery.tsx   galerie design system IN-APP (#412, DEV uniquement) : MasterDetail
                              liste de primitives → spécimen vivant (données réelles) — référence de
                              goût pérenne du canon UI, voir docs/charte-ui.md § « Galerie design
                              system »
  RollShell.tsx               coquille PARTAGÉE et UNIQUE des modales de jet (mono, opposé, ou N
                              contributeurs — le mono = N=1) : Lancer→Chance→Pacte→Résilience→Appliquer
                              + frisson + pickers (dé forcé `caps.picker` / localisation du Critique) +
                              <Dice>. TOUTE modale de jet la PARAMÈTRE : contrôles en props, métier en
                              slots (setup/preInfluence/postRollExtra/forcedExtra) — cf. les hooks
                              `jetProps/*` (ex. useDefenseJetProps) ; aucune mécanique générique
                              réécrite par modale. (Désengagement : pré-jet = MENU d'options via
                              <OptionChooser>, pas un « preview + Lancer » ; le coup dans le dos de
                              « Fuir » est montré INLINE dans la modale, plus de popin RevealModal.)
  MapCanvas.tsx               primitive de CARTE SVG panoramable/zoomable (#343) : caméra (pan/zoom molette-
                              vers-le-curseur/pinch tactile), fond, TRACÉS et MARQUEURS cliquables data-driven
                              (`paths[]`/`markers[]`/`overlay`/`chrome`), cibles de clic FIABLES (fond
                              pointer-events:none, hit-target large par tracé). AUCUNE logique de voyage dedans
                              (elle reste dans WorldMapView, premier consommateur ; le plan de ville #343-B sera
                              le second). Caméra pure = `worldMapViewport.ts` (clamp/fit/viewOn).
  editor/                     Éditeur v2 : Editor.tsx (shell), editorState.ts (sélection unifiée +
                              mutations PURES), EditorCanvas (pointeur/overlays/resize), Palette (rail
                              d'outils + contenu contextuel), Inspector (DOCKÉ, folds ; scène si rien
                              de sélectionné), LogicDock (triggers/dialogues/rencontres/validation en
                              master-détail, édition live), EffectList (rangées repliées + picker),
                              useSceneHistory (undo/redo), useEditorView (caméra)
src/scenes/                 Documents de scène + campaign.ts (campagne = l'Arène, `arene/arene-projet.json`,
                            projet v2 {scenes, worldMap} — 20 scènes : Bourg+intérieurs, 13 zones, 3 expéditions,
                            embuscade ; AUTHORING par `scripts/arene/generate.mjs`, cartes ASCII → JSON canonique
                            qui RESTE la source éditable dans l'éditeur)
                            + test-fixture.ts (scène neutre `testScene` + rencontre `enc-mutants` des tests de combat)
src/state/asciiMap.ts       AUTHORING de map en ASCII — la MÉTHODE À PRIVILÉGIER pour tout contenu de
                            map (scène/scénario) plutôt que poser les tuiles une à une. `parseAsciiRows(rows,
                            base, legend)` → {w,h,tiles} (1 char = 1 tuile) ; `parseWalledAscii` (box-drawing
                            (2W+1)×(2H+1) : tuiles + MURS d'arête, `:` = porte). Légende de base : `#`mur
                            `~`eau `D`porte `_`fosse `=`planches (surchargeable). Garde-fou : lignes de
                            largeurs inégales / char inconnu → throw. Entités/props/départ : poser des
                            MARQUEURS custom dans l'ASCII (ex. `@BFLr`), nettoyer avant le parse (`replace`)
                            puis scanner leurs positions.
src/net/                    Coop en ligne (relay WebSocket) : relay.ts (RelayClient heartbeat/backoff,
                            RoomHost = un Transport virtuel par siège, RoomGuest), session.ts (hôte-
                            autoritaire : intents allowlist + snapshots), protocol.ts, compress.ts,
                            intents.ts — codes de room 6 chars, reconnexion auto par token (grace 2 min)
server/                     Worker Cloudflare du relay coop (Durable Object « Room », hibernation WS,
                            TTL 30 min) — npm run relay:dev / relay:deploy
art-ref/                    Illustrations extraites des PDFs + mapping.json (GITIGNORÉ — droits Cubicle 7)
```

## Coop en ligne — limitations connues (traçabilité #254)

Deux restrictions posées en 0cd24a01 (#232/#91) sans ticket au moment du commit — RESTENT en l'état
(lever = travail coop futur, hors #254 qui ferme sur DOCUMENTATION seule) :

- **Cadence COMMANDÉE désactivée hors mode local** — `src/state/seaVoyageFlow.ts` l.876 et l.1541
  gatent la résolution immédiate/headless d'une journée de routine (`runCascadeImmediate`) par
  `get().net.mode === 'local'` (en plus de `seaAutoResolves`/`seaDayAllRoutine`) ; en coop la cadence
  reste JOUR-PAR-JOUR quels que soient les ordres (commentaire au site : « coop = cadence manuelle,
  pas d'auto-pilote des postes d'autrui »). Raison technique : la résolution immédiate est un bloc
  synchrone HÔTE-SEUL qui ne passe par AUCUN owner/intent du registre de modales (`modalArbiter.ts`)
  — elle piloterait donc silencieusement les Tests de routine des postes tenus par des PERSONNAGES
  D'INVITÉS sans leur passer la main (contradiction avec le gating spectateur/ownership déjà posé
  ailleurs, `netOwnership.controlsActive`), même si le résultat reste tracé au PV. Lever ⇒ router les
  Tests de routine par owner de poste comme le fait déjà le registre de modales pour les interruptions.
- **Conseil de bord (paie hebdomadaire + Moral, #229) hostOnly** — `src/state/modalArbiter.ts` l.110-112 :
  décision de bourse PARTAGÉE (argent du groupe) → seul l'hôte la tranche, comme les autres actions à
  l'argent du groupe (achat/vente marchand…) ; aucun routage d'intent coop pour cette décision. Lever
  ⇒ router `pendingCouncil` en intent coop (vote/délégation) comme le reste des décisions partagées.

## Systèmes clés (état actuel)

- **Schéma de Scène + Effets** (`scene.ts`) : `Effect` = setFlag, journal, document, **giveTrapping**
  (donner un objet — nom RÉEL de la base → objet à stats ; nom inconnu → objet CUSTOM `misc` ;
  il n'y a PLUS de `giveItem`/inventaire de groupe), giveMoney, giveXp, startCombat, **transition**
  (scène+entry), startDialogue, **test** (compétence + difficulté + `onSuccess`/`onFailure`),
  endDialogue. Tout est appliqué par `applyEffects` dans le store.
- **Moteur de campagne** : transitions de scènes (registre depuis `campaign`), tests de
  compétence interactifs (modal + branches), inventaire/argent/handouts (state party-level).
- **Inventaire/équipement** : chaque héros a `items: ItemInstance[]` ; `weapons`/`armour`
  ACTIFS dérivés via `recomputeLoadout` (équiper change le combat). Fiche = `CharacterSheet.tsx`.
- **Rendu des entités** : tout passe par `pickBackend` → le **rig** (`src/gameIso/rig/`) : humanoïdes
  bipèdes (carrière + arme + armure + mutations visibles) et créatures non-bipèdes via gabarit corporel
  animé (quadrupède/ailé/serpentin/…). `sprites.ts` ne fournit plus que le décor (props).
  Le sprite monolithique (`creatureSprites.json` + `enemySprite`/`creatureView`) a été retiré (juin 2026).
- **Objets ORIENTÉS** (navires, engins de siège, véhicules terrestres, props directionnels) : un SEUL
  contrat de vues `ViewArt` (`src/gameIso/rig/viewArt.ts`, `front?`/`profile?`/`back?`), sélectionné par
  l'UNIQUE résolveur `project(dir, camRot)` (`rig/facing.ts`) + repli `pickView` ; couverture de vues en
  galerie QC (`oriented-objects.html`). Les véhicules à coque sont routés par `hull.propulsion`
  (`bodyPlan.ts`) : mer/fleuve → gabarit `navire`, terrestre → gabarit `terrestre` (plus de repli
  accidentel d'un attelage vers la coque de navire). Détail : `docs/rendu-pipeline.md` § « Objets orientés ».
- **Éditeur v2** (juin 2026, interface refaite de 0) : iso WYSIWYG, rail d'outils + contenu
  contextuel (pose directe depuis les catalogues), inspecteur DOCKÉ (plus aucune modale d'édition),
  panneau Logique en bas (triggers/dialogues/rencontres/validation, master-détail, édition live →
  undo global), points d'entrée ⚑ et zones de repos dessinés sur la carte, resize à la poignée,
  barre de statut. Bouton « Tester » lance la scène en jeu.
- **Passifs unifiés + corruption data-driven** (réf. **`docs/systeme-passifs.md`**) : tout modificateur
  PASSIF continu (trait/mutation/qualité/trauma/maladie/faim/sort) = une liste de `GameOp` lue par UN
  collecteur `passiveMods(c)` (`engine/trauma.ts`), emballée en `PassiveMod{op, kind}` — le `kind` porte
  l'annulation ET la combinaison (`intrinsèque` = Σ dans la base / autres = pool non-cumul). `charMod` =
  SEUL op de modif de carac (passif ET sort) ; `moveMod` pour le Mouvement (≠ carac : `M` ∉ `CharKey`).
  Traits de profil appliqués `spawn→live` (`Combatant.liveTraits` + `baseWithTraits`, sans double-compte
  du profil bestiaire imprimé FINAL). **Édité en DONNÉES au Codex** : `TraitData`/`QualityData`/`Mutation`
  ont `passive: GameOp[]`, édité par le `<GameOpEditor>` EXISTANT (comme un sort — NE PAS réinventer de
  widget de liste d'ops). **Mutation découplée de sa table** : `mutations.json` (entités) ⊥
  `mutationTables.json` (plages d100 → réf mutation) → plusieurs tables (une par dieu du Chaos, Compagnon T1)
  sans collision. L'APPARENCE d'une mutation (cornes/peau…) reste couche **rig** (≠ GameOp).

## Rigueur compilateur (tsconfig.json / server/tsconfig.json)

- `strict: true` (racine + serveur) + `noUnusedLocals`/`noUnusedParameters: true` (les deux
  configs) — le code mort ne compile plus en silence (#300 cran 1).
- `noUncheckedIndexedAccess` et `exactOptionalPropertyTypes` restent **désactivés** — verdict
  mesuré #300 cran 2 (2026-07-11) : essai en ligne de commande (`tsc --noUncheckedIndexedAccess`
  / `--exactOptionalPropertyTypes`, hors config commitée) sur la racine → **3732** et **960**
  erreurs respectivement, réparties dans QUASIMENT tous les dossiers au prorata de leur taille
  (`src/state` 2094, `src/gameIso` 697, `src/engine` 441, `src/ui` 270, `src/scenes` 142 pour le
  premier flag) — aucun dossier propre à cliqueter isolément. Activation = chantier dédié
  multi-session (refonte des accès indexés / des types optionnels site par site), pas une purge
  mécanique comme le cran 1. Différé, pas écarté.

## Direction visuelle & apparence

- **Isométrique 2.5D « à la Baldur's Gate »** (vue 3/4), PAS de vue top-down ni de carrés de
  couleur générés par code. Art SVG dessiné/calculé à la main, scènes détaillées et ANIMÉES
  (idle, marche, attaque, mort). Le rendu vit dans `src/gameIso/` (projection `iso.ts`, gabarits
  corporels `rig/`, décor `sprites.ts`) et réutilise le moteur de règles pur (`src/engine`), le
  store et le schéma de Scène — direction posée après le rejet net d'un premier jet top-down
  générique jugé « jeu 2D des années 1980 ».
- **Toute apparence (couleur/matériau/géométrie SVG) vit dans un registre `defs/`**, consommée
  par TOUS les renderers — jamais codée en dur dans un renderer, jamais choisie par regex/label
  sur l'id (ban total du regex). Un même élément rendu par deux vues (iso `walls.ts` + POV
  `geometry.ts`) partage UNE def. Avant de colorer/dessiner une entité : chercher ou créer sa def
  (`structureAppearance(id)`, `TerrainDef`, etc.), classer par CHAMP DONNÉE (`kind`/`fortified`/…),
  jamais par pattern d'id. Nouveau type de rendu ⇒ étendre la def + le registre `gen-registry.mjs`,
  pas un `if` dans le renderer.
