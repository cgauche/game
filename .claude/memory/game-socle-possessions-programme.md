---
name: game-socle-possessions-programme
description: "Programme SOCLE POSSESSIONS lancé le 2026-07-19 — spec committée, doctrine du modèle (porteur unique, identité bestiaire, union discriminée, overlay figé), chaîne de tickets #610-#627."
metadata: 
  node_type: memory
  type: project
  originSessionId: 28c73772-f9e8-48df-97c3-237da1659a39
  modified: 2026-07-19T20:48:43.557Z
---

**Programme lancé le 2026-07-19** — spec normative : `docs/plans/2026-07-19-socle-possessions.md`
(committée ; sera supprimée une fois le programme exécuté). Ticket-programme : #268.

**EXÉCUTION DÉMARRÉE le 2026-07-19** — session locale désignée par l'user pour MENER le programme
de bout en bout (mandat verbatim : « ce travail est capital »). Ordre : T0 assainissement d'abord
(vague A parallèle {#611, #612, #613} — disjoints ; puis vague B #610 seul, car #610 partage
trappings.json avec #611 et items.ts avec #612). Grounding + vérif RAW adversariale lancés AVANT
toute écriture (la spec §2 est un état mesuré EN DESIGN, re-vérifié au code + Source avant de
spécifier). Orchestration : agents codent, l'orchestrateur vérifie (gates complètes + réfutation).

**AVANCEMENT (2026-07-20)** : **T0 LIVRÉ** — #612 (bugs inventaire, `92e4e86a`), #611 (montures→bestiaire,
`1b6bc0de`), #610 (véhicules unifiés + réf typée `{vehicleId}`, `1671d523`) fermés + jugés adversarialement
(TIENT). #613 (poison label) DIFFÉRÉ (demande une taxonomie de famille d'arme, pas un patch). **T1-b #614**
(moteur `possession.ts`, `e68502db`) fermé + jugé TIENT. ⚠ **VERSIONS DE SAVE DÉCALÉES** : la vague name→label
#608 (`86af9213`) a pris **v10** → T-bourse #531 = **v11**, socle #615 = **v12** (l'ordre bourse-avant-socle
tient ; #615 reste bloqué par #531). Arbitrage user 2026-07-20 : véhicule-en-objet ÉLIMINÉ (pas propé) —
[[feedback-no-legacy-propping-fallbacks]]. Le `source.page` des montures (folios 22-24 « à cheval ») est
routé vers **#560** (convention `number|number[]`, arbitrage user 2026-07-17 résolu, implémentation à faire).

**Arbitrage user 2026-07-21 (verbatim)** : « Le jeu n'est pas en prod, je m'en fiche que mes saves soient
perdu » → le basculement mule-objet→possession (#617/#618) NE migre PAS les saves : une vieille save aux
bêtes-en-objet CASSE (acceptée). Lot 2 a SUPPRIMÉ la migration morte `extractPossessionFromItem`/
`rehomePossessionsFromItems` : le basculement ne s'accompagne d'AUCUNE migration de save. `SAVE_VERSION`
vaut **15** (`src/state/saves.ts`) et `migrateDoc` refuse toute save dont la version DÉPASSE la cible
(rejet au chargement, pas un crash). La
migration `rehomeCaravan` (MIGRATIONS[4], v4→v5) garde une liste GELÉE `LEGACY_V4_BEAST_TRAPPING_IDS` (les
7 trappings-bêtes de l'ère pré-socle, données historiques figées — jamais réalignée sur le catalogue courant
qui n'a plus ces trappings). [[feedback-no-legacy-propping-fallbacks]].

**AVANCEMENT (2026-07-21)** : **#645** (modèles de rig blaireau/poulet/vers/singe + 2 extensions moteur gatées
`comb?`/`blunt?`, `7adb2071`) fermé + jugé/poli. **#617/#618 Lot 1** (producteur dotations→possessions,
`5c83e9de`) committé. **Lot 2** (bêtes hors ItemInstance, tout re-sourcé sur le registre Possession :
careerLevels 45 `{id}`→`{creatureId}`, 8 trappings retirés, montures re-keyées par creatureId, voyage
re-sourcé, champs `mountInjury`/`cargo`/`aboard` retirés d'ItemInstance, migration morte supprimée) — jugé
adversarialement (aucun RÉFUTÉ), fix flush-party sur chute de selle, en cours de commit. Restes ticketés :
**#647** (cavalier-Enc MDG 12 l.25-33 non branché), **#648** ({text} dotations restantes : blaireau du Moot
manqué + choix cheval/harnais/Diligence), **#646** (bug QC render-creature.mts label vs id). UX éditeur
possessions (StructFields/EffectList) en arbre, à committer avec le Lot 2.

**Suivi 2026-07-21 (fil fermé + jugé + recetté)** : #646 (QC), #647 (RAS — arbitrage user « on ne devrait
pas s'amuser à avoir des gens sur leur monture dans un bateau » : le couple monté à l'embarquement est un
non-scénario, la bête embarque en possession distincte et prend son shipboard-Enc, DÉJÀ câblé `possession.ts`),
#648-blaireau, **#649** (registre des possessions sur la fiche héros — `PossessionsRegistry`, groupé par nature,
`possessionLabel`+lien codex+LifeBar), **#650** (nom propre : `label?` sur la ref `{creatureId}`/`{vehicleId}` +
schéma zod + producteur + 4 noms restaurés dans careerLevels + l'éditeur `StructFields` préserve/saisit le label),
**#652** (crash CodexRef `useEffect` après return anticipé, trouvé EN RECETTE #649). Restent OUVERTS : **#651**
(stats « Petit/Grand chien féroce » mappés au chien générique — à sourcer au RAW), **#648-choix** (« cheval ou
Diligence » + les 36 `{text}` « A ou B » d'équipement) : le **construct `{choice}` d'équipement GÉNÉRAL** —
remplacer le hack chaîne magique `"Arme (Au choix)"` (7 usages, seul choix câblé ; 36 choix « ou » silencieusement
ignorés par `buildInventory`) + pas de sélection au créateur — est le **CHANTIER SUIVANT** décidé par l'user
(2026-07-21, « Choix général : chantier suivant »). Leçon : [[feedback-migration-donnees-ui-exige-recette-au-commit]].

**#654 (construct de choix d'équipement) BOUCLÉ 2026-07-21** — 3 lots, chacun jugé TIENT + recetté :
Lot 1 (`50f1073e`, `TrappingRef` += `{choice: TrappingRef[]}` / `{wildcard: string}` + `resolveTrappingChoices`
+ schéma zod récursif `z.lazy`, en miroir de `AdvancementRef` des talents), Lot 2 (`e01cd50f`, pick au créateur —
`{choice}`→`OptionChooser`, `{wildcard:'arme'}`→`MediaSelect`+`SearchFilterField` [pas `GroupedPickGrid` qui exige
un `preview` de rig par item] ; 7 « Arme (Au choix) »→`{wildcard:'arme'}` ; **la chaîne magique
`text==='Arme (Au choix)'` + le `<select>` HTML brut + le champ `weaponChoiceId` SUPPRIMÉS**), Lot 3 (`9f3d9f8f`,
9 choix propres→`{choice:[{id}]}`, 11 emplacements). Clé de couture : `d.trappingChoices: Record<trappingRefLabel(slot), choix>`
(même convention que `specChoices` des talents ; le label d'un slot inline sans id stable est toléré, cf. §25 du
garde label-logic). **Restes ticketés #656** : les 25 choix « X ou Y » restants bloqués par obstacle RÉEL —
taxonomie de famille d'arme (**#613**, pour les jokers de sous-catégorie « Arme simple / à deux mains / cavalerie »),
construct de **bundle** (branche = plusieurs objets : Arc+Flèche, Cheval+selle/harnais [= reste #648], paires de pistolets),
**qualité-sur-ref** (#624 : « Fleuret/Cape de qualité »), objet catalogue **absent** (Écharpe, Bateau-fluvial, Carquois),
ou entités **T3-T4** (immeubles #356, serviteurs #453, unités, troupeaux). Bug trouvé EN REVUE du Lot 1 : **#655**
(le verbe `test` de `rollFlowSpecs.ts:1423` tirait `defaultRNG` Math.random au lieu de `battleRng` seedable → tout jet
de Test [+ relance Sombre Pacte] non rejouable en coop/replay ; le SEUL des 9 `rollTest` du fichier sans `rng` ; 1 ligne,
fermé). #651 (stats « chien féroce ») FERMÉ RAS — arbitrage user « laissons le chien » (générique LDB, « juste des
descriptions »). #653 (DX recette possessions) reste ouvert.

**#657 (joker de QUALITÉ = le « qualité-sur-ref » #624) BOUCLÉ 2026-07-21** — 3 lots jugés TIENT.
Lot 1 moteur (`c32be9b5`) : `qualityChoice` + `qualities` sur la branche `{id}` de `TrappingRef` ;
`resolveTrappingChoices` → `{id, qualities:[atout]}` défaut raffine (MIROIR de `{choice}`) ; `FABRICATION_ATOUTS`
= les 4 Atouts d'objet LDB ch.60 Fabrication (Raffiné/Léger/Pratique/Solide, p.286, déjà au registre `qualities.json`) ;
`buildInventory` merge via `qualityInstance` (value « Solide 3 » préservée). Lot 3 data (`49fb0633`) : 41 refs `{text}`
« de qualité » migrées → 37 `{id, qualityChoice}` + 2 `{choice}` imbriqués (= les 2 #656 Bloc C : Fleuret/Miroir,
Main gauche/Cape-2). Lot 2 UI (`e90a07e7`, ferme #657 par solde) : `TrappingChoiceSlot` récursif = `OptionChooser`
sur les 4 Atouts (hints verbatim, raffine pré-sélectionné, cas nested sous une branche `{choice}`) ; clé
`trappingRefLabel` en miroir du résolveur.
⚠ **FINDING MAJEUR — le rang>1 ne surface NULLE PART** (confirmé user 2026-07-21 verbatim : « la réponse est non,
actuellement il n'est pas possible de récupérer l'équipement des rangs supérieur a 1 ») : « de qualité » (et TOUT
l'équipement de rang 2-4) vit aux niveaux de carrière 2-4, mais `createHero`=niveau 1, `changeCareer` pose
`careerLevel` SANS octroyer les dotations (conforme RAW WFRP4 : possessions = fait de création), `possessionsFlow`
lit `careerLevel ?? 1`=1 pour un héros frais → le pick de qualité est **LATENT**, jamais déclenché en jeu standard.
Arbitrage user **Option A** : fermer #657 en FONDATION (construct + résolveur + migration + pick prêts), surfaçage
tracké **#660** (création vétéran / départ à un rang>1 qui OCTROIE les dotations du niveau — débloque tout l'équipement
supérieur, pas que « de qualité »). Reste **#659** (6 « de qualité » à base catalogue absente : Épée/Livrée/Symbole de
garde/Armes-placeholder/« de qualité supérieure »). Leçon : un pick UI adossé à des données de rang>1 ne se recette
pas au navigateur tant que #660 n'octroie pas ce rang (couverture = tests de rendu + moteur).

**#660 vétéran — RAW recadré par l'user 2026-07-21 puis PARQUÉ** : le RAW autorise de dépenser les PX bonus de création
(Étape 9 « Progression », LDB 05 l.907, « dans un premier temps » → compléter le niveau puis avancer) → « vétéran = créer
un perso avec ~2000 PX via l'outil de création » est FIDÈLE-RAW, pas la house-rule interdite. Notre créateur N'implémente
PAS l'Étape 9 (pas de pas « dépense de PX »). L'octroi de dotation à un CHANGEMENT de niveau EN JEU reste muet au RAW
(house-rule, user a choisi opt-in OFF). #660 designé complet, laissé de côté « pour le moment ». En jeu RAW, l'équipement
de rang>1 s'obtient par l'ÉCONOMIE (marchand/butin), pas par la montée de niveau.

**#618 (T1-c4) FERMÉ 2026-07-21** (`fd62eb0f`, `corrige #618`) — le rituel de fermeture a ÉVITÉ 2 fausses fermetures :
un juge de réfutation a trouvé #618 DoD 3 (cascades) et #622 (migration a/b/c + cliquet + semis rejoint-en-cours) NON tenus
alors qu'ils SEMBLAIENT faits. #618 comblé : cascades de possession — mort de bête en combat (bloc `pos-` dans finalizeBattle
via `inBattleId`, mort→destroyed items co-localisés / blessée→wounds clampé) + naufrage (`beginShipwreck` marque
Possession{navire} par `vehicleId` + embarquées `destroyed`). ⚠ **DORMANTES** (comme #657) : spawn combat = #621, navire-Possession
= T2/#267 ; testées en contexte forgé. **#622 RESTE OUVERT** (bloqué levé mais gaps propres : résidus `{text}` Cheval/Charette/
Bateau fluvial/Voilier/Rhinox à migrer, cliquet décroissant absent, `partyAddHero` ne sème pas le rejoint-en-cours).
⚠ **Gate de PALIER** : `.claude/soldes/.compteur` compte les fermetures ; à **10** (`PALIER`), `scripts/hooks/solde-ticket-guard.mjs` exige une revue adversariale du CUMUL — `.claude/soldes/revue-palier.md`, ligne `verdict: CONFIRMÉ|PARTIEL|RÉFUTÉ` + ≥80 car. de synthèse + date — avant toute nouvelle fermeture. La revue consommée, le compteur repart ; c'est le compteur qu'on lit pour savoir si le gate mord, jamais la présence du fichier.
⚠ `scripts/qc/_tmp-*.mts` (scratch session art/rig, untracked) cassent `tsc` brut — filtrer `_tmp` ; et ils font des `git clean`
qui EFFACENT les soldes gitignorés (#657/#618 disparus post-commit, sans impact — hooks lus au commit).

**#622 (T1-g dotations) AVANCÉ 2026-07-21** (3 commits `ref #622` : `dfb43c93`/`144d1393`/`9ee4fe98`) — PAS fermé. Migrés
`{text}`→refs typées : bêtes (Cheval/Rhinox/Cheval-de-guerre-léger), véhicules (Charrette [typo], Chariot), 11 bateaux
(« transport fluvial »→`chaland` [seul fluvial à capacité, 300] ; petits/rapide/côtiers→barque/barge/esquif ; cérémonie→chaloupe,
à-commander→galère-de-guerre ; « Bateaux de patrouille »→`bateau-de-patrouille` + `count:{roll:1d10}`). **Compte `{text}` 547→526**,
cliquet anti-régression posé (`refs-migrated.test.ts`, baseline resserrée à chaque pas). **DOCTRINE #650 étendue** (arbitrages user) :
une possession bête/véhicule GARDE son nom authoré en `label` quand il diffère du catalogue (« Cheval de guerre », « Chariot (Scène) »),
SAUF les FAUTES (typo « Charette »→charrette, sans label). Indéterminé pluriel → `count:{roll:1d10}` (« le jeu adore les 1d10 »).
**Nouveaux tickets du fil (observations user)** : **#661** (richesses marchandes « Biens/Bijoux/Marchandises valant X » = objet-valué/
cargo/bourse à trancher RAW), **#662** (PLACEMENT équipé/sac/**sur-la-bête** perdu à la migration — `TrappingRef` sans hint, `buildInventory`
heuristique), **#663** (`possessionGrantsFromRefs` n'applique que `count.fixed` → le 1d10 spawn 1, pas Nd10), **#664** (5/6 bateaux sans
`chargement`/capacité au catalogue). Restes #622 : bundles « … ou Chariot/Cabane » → **#656** ; semis `partyAddHero` rejoint-en-cours.

**#663 FERMÉ** (`2fdae843`) — count.roll appliqué au spawn (le 1d10 patrouille spawn 1d10) via RNG de semis DÉDIÉ
`makeRNG(hashSeed('possession-seed:'+hero.id))` (patron `spawn.ts:103`), JAMAIS `battleRng`. LEÇON forte : le 1er essai (battleRng au semis)
passait le juge CIBLÉ mais la SUITE COMPLÈTE cassait 2 fichiers (garde #370 état→moteur ; `duel-naval` — battleRng = singleton COMBAT,
consommé au semis = désync). → un RNG de semis/hors-combat NE DOIT JAMAIS être `battleRng` ; une fermeture ne se prouve QUE sur la suite complète.

**#620 (T1-e écran Possessions) — FONDATION LANDÉE 2026-07-21** (Lot 1a `aad41fa7`, Lot 1b `986b50b8`).
Le refactor « porteur unique » de la gestion d'objets : (1a moteur/store) `state/carrier.ts` `resolveCarrier(state, carrierId)` (héros de `party`
par id | possession de `possessions` par uid) ; `toggleEquip`/`stowItem`/`transferItem`/`setItemSkin` généralisés à un `carrierId`,
`recomputeLoadout` (armes) RÉSERVÉ aux Combatant (une possession ne combat pas) ; `containerFillEnc`/`canStow`/`equipConflicts` relâchés
`Combatant`→`Pick<Combatant,'items'>`. (1b UI) `ui/CarrierInventory.tsx` = le cœur d'inventaire COMMUN extrait de la fiche héros (PlaqueRow,
badges, Équiper/Ranger/Donner/Sortir/Parure routés par `carrierId`), la fiche le composant + slot `rowExtra` pour les HÉROS-ONLY (armes/mains/
Évaluer/Utiliser). Jugé TIENT (DOM héros identique) + **recette navigateur = fiche fonctionnellement+visuellement INTACTE, console 0 erreur**.
2 bugs pré-existants trouvés en recette → **#720** (AppraiseModal absent du Roster = clic mort), **#721** (usePartyItem retire l'ItemInstance
entière même si qty>1). **Lot 2** : `PossessionsScreen` (ScreenShell+MasterDetail+Tabs, l'onglet Inventaire = `CarrierInventory` sur
`possession.items`), actions gatées co-localisation, entrée depuis PartyScreen — **écran de goût = validation USER avant commit**.
⚠ L'aperçu d'une possession vivante passe par `CreaturePreview` (`compendium/`), qui route vers le BON gabarit via `resolveRender` —
JAMAIS `CharacterPreview`, qui prend un `Combatant` et ne connaît que les bipèdes.

**#620 Lot 2 v1 LANDÉ 2026-07-21** (`a4fbc1a2`, `ref #620`). `PossessionsScreen` = ScreenShell+MasterDetail+Tabs
(Aperçu renommage/LifeBar/**Contenance charge-portée**/traits ; Inventaire=`CarrierInventory` sur `possession.items`),
actions gatées Laisser/Reprendre/**Embarquer(choix du navire, MediaSelect cale X/Y)**/Débarquer/Abandonner, entrée bouton
`PartyScreen`. Moteur : `possessionLoadEnc` (charge PORTÉE hors poids propre) ; `possessionTotalEnc = ownEnc + possessionLoadEnc`
(SOURCE UNIQUE) — corrige le bug user « bête vide = 18/20 » (le corps `SIZE_SHIPBOARD_ENC` ne compte QUE dans la cale d'un
hôte via `embarkedEnc`, jamais dans la contenance propre de la bête). **PROCESS écran de goût EXEMPLAIRE** : 2 recettes
navigateur, la 1re a trouvé 5 défauts (badge superposé, double-clic Codex, Enc corps-propre, ton surcharge, embarquement cible
implicite), tous corrigés + re-vérifiés live ; verdict user = « c'est moche, à améliorer, mais **plus tard** » → v1 fonctionnelle
committée + passe visuelle ticketée. LEÇON user (rappelée en séance) : **« différé » = TICKET**, jamais un constat flottant.
Différés alors ticketés : onglets Soute/Voyage et rig créature de l'Aperçu (soldés plus bas), **#723** (Donner héros→possession),
**#724** (passe visuelle, OUVERT), #653 (outillage `__wfrp` possessions en recette, OUVERT).

**AVANCEMENT 2026-07-22** (user absent, mandat « tous les tickets Possession restants ») :
- **#723 FERMÉ** (c507e76c) : « Donner » héros→possession co-localisée ; invariant `carriersCoLocated` au STORE `transferItem`
  (source unique, `carrier.ts`), UI = reflet ; correctif L5 (CodexRef cliquable dans l'option = double action → texte nu).
  Classe récurrente CodexRef-sans-stopPropagation → **#725**.
- **#620 Soute/Voyage LANDÉ** (7a48499b, `ref #620`) : Soute = `bulkCarriers`+`CargoTransferPanel`+`NotchGauge` (cales
  navire/véhicule, bête EXCLUE — son bât = Inventaire/Enc) ; Voyage = allures EDOC (`mountTravel`, champ `trot` pas `trotte`).
  Brèche latente navire-possession (bulkCarriers l'exclut) NON ATTEIGNABLE → réservée T2/#267. L'onglet Aperçu porte le rig créature
  réel (`CreaturePreview`), ce qui solde le DoD de #620.
- **#621 FERMÉ 2026-07-22** (`0369ca3f`, PAYOFF) : la monture-possession entre en COMBAT comme allié appairé (`heroCombatMount`
  → `spawnEnemy(id=pos-uid)` + `mountUp` dans `startCombat`) → **RÉVEILLE les cascades #618** (mort de bête en combat = possession détruite).
  ⚠ GATE re-mesuré 3× sur pièces avant de tomber juste : `dresse-monture` seul → « profil EDOC » → **RAW LDB 339** validé user :
  `possessionCombatRideable = possessionRideable && (!belliqueux || dresse-monture)` (le `cheval` LDB non-belliqueux est montable ; Dressé
  Monture n'est que FACULTATIF sur le Cheval ch.78). Défaut de DÉFAITE trouvé par le juge : `heroesAlive` comptait les montures → corrigé
  `!c.mountable` (corrige aussi un latent scène). Suites : **#728** (cheval LDB montable combat mais sans profil VOYAGE), montures orphelines
  cheval-de-trait-lourd/boeuf liées (`b6d0da12`). LEÇON : pour un gate de contenu, MESURER la donnée ET le Source avant de coder — [[game-rig-3vues-contrat-prod-chantier]].

**Doctrine du modèle (arbitrages user 2026-07-19, verbatims dans la spec §1)** :
- **Porteur unique** : « un héros, un mercenaire, ou une mule, c'est la même chose » — toute
  possession PORTE des `ItemInstance[]` avec les sémantiques du héros (equipped/inside/contenants,
  même Enc) ; JAMAIS un 2e système de poches. La mule ne va pas DANS un sac ([[game-doctrine-une-entite-n-livres-n-variantes]] reste vrai par ailleurs).
- **Identité du vivant = le BESTIAIRE** : les bêtes quittent trappings.json ; prix = facette
  `purchase` sur la créature ; réf vivante = `{creatureId}` | `{custom: CustomStatblock}` (dualité
  du spawn). Un PNJ custom de l'éditeur se donne par l'effet `givePossession` (dialogue à choix
  payant = patron canonique).
- **Pas de God-object** : tronc commun + union discriminée par nature (bete/serviteur/vehicule/
  navire/immeuble) — zéro champ étranger à sa nature.
- **Overlay FIGÉ à l'acquisition** : stats aléatoires LDB 77 tirées UNE fois, seedées par l'UID
  d'instance (« relancées à chaque combat ? Pas fou »), jamais un Combatant persisté pour une réf
  catalogue (édition Codex vivante).
- **Location de première classe** (avec-le-groupe | au-lieu | embarquée) + contenance récursive
  (code neuf — le tronc CargoCarrier ne somme pas les embarquées) + CASCADES d'écriture
  (naufrage corps-et-biens, succession au choix du joueur, abandon = perdu confirmé — décisions
  №1-6 entérinées 2026-07-19, spec §13).

**Chaîne** : T0 #610 (véhicules unifiés) #611 (vivant au bestiaire) #612 (bugs inventaire) #613
(poison libellé) → #531 T-bourse (migration **v10**) → T1 #614→#615 (**v11**)→#616→#617→#618 →
#619/#620/#621/#622/#623. Tranches : T2 #267+#250, T3 serviteurs (prérequis #453), T4 #356.
Parallèles : #624 (344 dotations équipement texte), #625 (écurie), #626 (capture), #627 (coop).
Dressage : #571 (bloqué par #618) → #437.

**Pièges consignés** : versions de save ASSIGNÉES (v10 bourse AVANT v11 socle) ; fourrage TARIFÉ
au RAW (PDT 03 l.251 : 1/– par cheval/jour fourrage compris ; LDB 66 écurie 10 sc/nuit) — un
« muet » s'affirme APRÈS grep du Source ; traits Dressé = 9 au RAW et liste OUVERTE (LDB 85).
Voir [[game-coop-dissociation-bg3]].
