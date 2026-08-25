# Authoring de campagne — la carte des coutures d'auteur

Référence VIVANTE (maintenue au fil du code). Une **campagne** = un projet multi-scènes relié par une
carte du monde (`{ schema: 3, scenes, worldMap, narratif }`), COMMITÉ, 100 % rééditable dans l'éditeur. Pour le
pas-à-pas « par où commencer », voir le skill `creer-une-campagne`. Ce document cartographie CHAQUE
système qu'un auteur mobilise. Règle d'or transverse : **on n'authore que des IDS stables** (le libellé
est de l'affichage multilangue — CLAUDE.md, encadré « id STABLE ») ; **personne ne lit le journal**
(tout dénouement doit être VISIBLE au moment) ; **aucun texte technique dans un texte joueur**.

## 1. Pipeline

- **Lib partagée** `scripts/campagne/lib.mjs` — helpers purs de TOUTE campagne (`scene`, `hero`, `NPC`,
  `P`, `poste`, `flowOf`, `flagWhen`, `testNode`, `fightTrigger`, `resetIds`, `fouille`, `zoneVictory`).
  Importée, jamais copiée ni dupliquée. L'étendre sur place si un helper manque à toutes les campagnes.
- **Générateur** `scripts/<campagne>/generate.mjs` (modèles : `scripts/arene/generate.mjs`,
  `scripts/loup-et-saumure/generate.mjs`, `scripts/barge-du-sel/generate.mjs` — ce dernier le plus récent,
  CharKey canonique) — assemble les scènes + la `worldMap`, écrit le JSON. OUTIL d'auteur (`tsx`), PAS un
  build : la sortie commitée est la source.
- **Compilation** `scene()` construit un `MapSpec` déclaratif puis délègue à `buildScene()`
  (`src/state/mapSpec.ts`) — MÊME compilateur headless-editor que l'éditeur. L'ASCII (`rows`/`legend`/
  `base`) est parsé, les bâtiments composés par `addBuilding`, les rencontres terse expansées par
  `buildEncounter()` (`src/state/encounterAuthoring.ts`). Jamais poser une tuile à la main.
- **Chargement** `parseProject()` (`src/state/worldMap.ts`) relit le JSON et résout les réfs sparse
  (ports, cf. §5). Les validateurs id-only de la lib (`creatureId`/`skillId`/`spellId`/`speciesId`/
  `tenueId`/`weaponId`) FAIL-FAST à l'authoring — un libellé qui s'y glisse lève.

## 2. Navire de campagne (`state.vessel`)

Câblé par des **Effects** (`src/state/scene.ts`), jamais en dur :

- `setVessel` — POSE/REMPLACE le navire de campagne (`vehicleId`, `name`, `morale`, `hullCurrent`/
  `hullMax`, `saboteurDR`, `crew`). REMPLACE tout `state.vessel` : un second `setVessel` efface Humeur de
  Manann, dégâts de coque et Moral accumulés — pour un patch, utiliser `adjustVessel`.
- `adjustVessel` — patch INCRÉMENTAL (`name`/`morale`/`hullCurrent`/`saboteurDR`…) sans réinitialiser le
  reste (ex. `saboteurDR` remis à 0 quand un sabotage est levé, sans toucher la coque).
- `adjustManann` — décale l'Humeur de Manann par `factorId` RÉEL de `src/data/sea-events.json` (validé par
  `findManannFactor()`, `src/engine/seaVoyage.ts`), jamais un delta brut anonyme.
- `saboteurDR` (dans `[-5,0]`) — malus discret aux Tests d'équipage de COMBAT ; s'authore SUR le
  `setVessel`. Effet de combat SEULEMENT : le pipeline de voyage ne lit aucun `GameOp`.
- `crew` — roster SALARIÉ (`{ roleId, count }`, barème `wage`). `roleId` ∈ ids RÉELS de
  `src/data/crew-roles.json` : `capitaine` · `timonier` · `vigie` · `mousse` · `navigateur` · `artilleur` ·
  `cuisinier` · `chirurgien` · `chansonnier`. **Aucun id `matelot`** : le rang-et-fichier (marin de base) est
  le `mousse` — ne pas inventer de rôle générique, prendre l'id existant.

**Bridge campagne ⇄ combat** : au DÉBUT du combat, toute coque spawnée dont `creatureId === vessel.vehicleId`
repart de l'état persisté (`src/state/combatSlice.ts`) ; à la FIN, ses dégâts sont réécrits dans le navire
de campagne (`src/state/combatFlow.ts`). Sans `setVessel` (ou avec un autre `vehicleId`), aucune
persistance — chaque combat spawn une coque fraîche.

## 3. Routes et voyage (`worldMap.routes`, `MapRoute`)

- `a`/`b` bidirectionnels, `km` (MILLES si `sea`), `modes`, `perils` (péripéties d'auteur `chancePct`),
  `perilDie` (seuil d10 RAW). DEUX routes entre les mêmes lieux sont OK (seul `id` est une clé) — le
  « sens » n'est qu'un nommage d'auteur, pas une contrainte mécanique.
- `ambush: { scene, encounter, at? }` — cible du « Attaqués ! ». En MER, `at` (fraction 0-1, défaut 0.5)
  ANCRE l'embuscade de façon DÉTERMINISTE : elle se déclenche quand la distance franchit `at × km`, une
  fois par traversée, hors RNG (#212).
- `sea: true` → voyage joué sur le navire de campagne (`src/state/seaVoyageFlow.ts`, cap `seaHeading`) ;
  `river: true` → descente jouée jour par jour (`src/state/riverVoyageFlow.ts`, `riverPerils`/
  `riverExposure`). Terrestre = table de péripéties + `inns` (relais d'auberge).
- Une route `sea: true` REQUIERT un `seaHeading` explicite d'auteur — aucun défaut silencieux :
  `buildSeaPlan` jette si absent (#416). L'éditeur pose `'est'` (neutre) à l'activation du toggle
  « mer » ; à l'auteur de régler le vrai cap. Rappel RAW : la dominante de la Mer des Griffes souffle
  DE l'OUEST (MDG ch.13 l.253) — poser `'ouest'` en cap plein donne un vent de face ~60 % des jours
  (pit #408, traversées interminables).

## 4. Catalogues navals (data-driven, éditables)

- `src/data/naval-traits.json` — catalogue UNIQUE des Traits de coque (blindage, bélier…) ET des
  améliorations d'INSTANCE (ex. `proue-idole-de-stromfels`). `upgrades: NavalTraitRef[]` sur l'entité-coque
  accepte l'id de l'un OU l'autre kind : `findNavalTrait()`/`navalPassiveOps()` sont KIND-AGNOSTIQUES (ils
  résolvent tout id du catalogue et lisent son `passive` — un Trait intrinsèque posé en amélioration
  d'instance est licite, ex. `renforce` — MDG p.97 — sur la coque pirate de la Barge du Sel).
- `src/data/naval-ports.json` — Index des ports (Taille/Richesse/Production/Surplus/Demande RAW).
- `src/data/crew-roles.json` — rôles d'équipage salarié (`wage` hebdomadaire) ; `src/data/crew-test-types.json`
  — types de Tests d'équipage (`progression`, `manoeuvre`, `perception`, `orientation`…).

## 5. Ports par référence (`place.port`)

`place.port = { ref }` où `ref` est un id de `naval-ports.json` (#217). L'authoring JSON est SPARSE :
`resolvePortRef()` (`src/state/worldMap.ts`, appelé par `parseProject()`) fait couler Taille/Richesse/
surplus depuis le catalogue. Des champs locaux surchargent le catalogue port par port.

## 6. Postes d'artillerie par référence (`poste`, #222)

`poste(trappingId, side, crewIds?)` de la lib émet la forme de RÉFÉRENCE `{ trappingId, uid, side,
crewIds }`. La base (Dégâts/Qualités/Enc/Portée) N'est PAS matérialisée : elle est HYDRATÉE au spawn
depuis `trappingId` par `hydratePoste()` (`src/engine/items.ts`). `trappingId` doit désigner une pièce
POSABLE (trapping à art d'affût `siegeRig`) sinon `throw`. `crewIds` vide = poste servable en jeu par un
héros adjacent (`serveAtPoste()`, `src/state/shipPostes.ts`) — aucun id de héros n'est connu à l'authoring.
Garde-fou : les projets ne portent AUCUN poste en forme ancienne (base copiée), cf. la garde #222 de
`src/data/refs-migrated.test.ts`.
Formation des servants (#210) : un servant posé SUR la case de l'engin (ou sans position propre) est
AUTO-FORMÉ au spawn en anneau autour de l'empreinte (`autoFormCrews` — jamais l'avant, ADE II ch.08
l.258) ; une position de scène DISTINCTE prime toujours (placement d'auteur respecté).

## 7. Entités-coque (`ref` de véhicule)

`creatureId()` accepte créature ∪ véhicule (`findVehicleById()`, #218) : un `ref` de `vehicles.json`
(`cogue`/`langskip`/`loup-imperial`) passe en `encounters[].enemies[]` terse comme en `entities` BRUTES.
Une coque RICHE (équipage exposé `crewIds`, artillerie `postes`, améliorations `upgrades`) se pose en
`entities` + s'enrôle via `encounters[].members` (plus expressif que le terse).

**Échelle & modèle de combat naval — `metresPerTile` toggle `isMerScene`.** `metresPerTile≥4`
(`isMerScene`, `src/state/scene.ts`) bascule le combat naval en modèle NAVIRE-UNITÉ (équipage passager hors
`order`, tour de coque, action Bordée/Manœuvre — `combatOrder`/`isPassengerInBattle`). En dessous (défaut
2 m/case, PERSON-scale) : l'équipage combat individuellement, les héros SERVENT les pièces (`Servir <pièce>`)
et l'abordage se joue à la case (`reachTiles`, LDB 15 : 1 case = 2 m fixe, indépendant de `metresPerTile`).
Les grilles d'ABORDAGE restent à 2 m/case : le modèle MER exige une IA de manœuvre de coque ENNEMIE qui
n'existe pas encore (`runEnemyAI` ne pilote aucun `bodyShape:'vehicule'` → la coque adverse ne s'avance ni ne
vire), et la bordée (portée en mètres) tombe hors d'atteinte sans manœuvre d'approche. L'échelle mer vaut
pour les scènes de TRAVERSÉE ; réserver le modèle navire-unité au jour où l'IA navale existe.

## 8. Objectifs de victoire (`EncounterDef.victoryCondition`)

Six formes (`VictoryCondition`, `src/state/scene.ts`), défaut `allEnemiesDead` :
`allEnemiesDead` · `destroyStructure` (arête) · `surviveRounds` · `reachZone` (rect) · `woundsThreshold`
(reddition d'une cible sous `belowPercent` de ses Blessures) · `firstBlood` (fin de rencontre au premier
sang — la première cible neutralisée clôt le combat, `threshold?` = seuil de Blessures ; le tir est banni
par défaut, duel). `onVictory` = un `Flow` (aplati en Effets).

## 9. Flags et gating

`setFlag` pose un drapeau de scène (`Scene.flags`) ; `flagWhen` (lib) / `when` gatent un choix ou un
Trigger sur une expression « flag,!flag ». C'est le seul mécanisme d'état narratif — pas de compteur
codé en dur.

### 9bis. Dialogues (`Dialogue`, `DialogueNode.speakerId`, #669)

Un `Dialogue` (`Scene.dialogues`) est un arbre de `DialogueNode` (`id`, `text`, `choices`). **Aucun nom
en clair** n'est jamais authoré dans un nœud (doctrine id-only, CLAUDE.md « on ne MANIPULE que des
IDs ») : le portrait ET le nom de l'interlocuteur se résolvent TOUJOURS par ID d'entité, jamais par une
chaîne de nom dupliquée dans la donnée.

- **Locuteur de SESSION** — ouvrir un dialogue en interagissant avec une entité (`interactEntity`) pose
  `dialogue.speakerId = ent.id` automatiquement ; un `startDialogue.speakerId` explicite le fait pour un
  dialogue lancé par script (trigger, effet). C'est le locuteur PAR DÉFAUT de tous les nœuds.
- **Locuteur PAR NŒUD** — `DialogueNode.speakerId` (id d'une `SceneEntity` de la MÊME scène) surcharge le
  locuteur de session pour CE nœud seulement : permet d'ALTERNER les interlocuteurs dans une même
  conversation (ex. une tablée à plusieurs PNJ). Un nœud sans `speakerId` retombe sur la session.
- Le nom affiché = le `label` de l'entité résolue (`DialogueBox`, `src/ui/DialogueBox.tsx`) — jamais un
  champ `speaker` de texte (supprimé, #669).
- **Patron de reprise** — pas de mécanisme dédié : les `DialogueChoice.when` (algèbre `Condition`) gatent
  les choix d'un même nœud d'accueil sur un flag posé au premier passage (« premier contact » vs
  « on se reconnaît »). Voir `src/scenes/test-scenarios/dialogue-multi.ts` (patron complet, alternance +
  reprise).
- **Coop** — un dialogue est une décision de GROUPE (jeton d'exploration unique) : `chooseDialogue`/
  `closeDialogue`/`interactEntity` sont réservés au siège hôte/MJ (`netOwnership.intentAllowedFor`), les
  autres sièges LISENT. Un Test social DÉCLENCHÉ depuis un choix reste arbitré normalement par le
  propriétaire du héros testeur (`openSkillTest`→`pendingTest`→`modalArbiter`).

### 9ter. Choix gatés sur le GROUPE (`when` skill/career/species/status, #711)

Un `DialogueChoice.when` accepte, en plus des kinds génériques (§9), 4 kinds PARTY-LEVEL — vrai si UN
héros VIVANT du groupe (`who: 'any'`, défaut) ou TOUS (`who: 'all'`) satisfont la condition
(`evalCondition`, `src/engine/flowCore.ts`) :

- `{ kind: 'skill', id, spec?, advances? }` — un héros possède la Compétence `id` (`spec` éventuelle,
  ex. Langue) avec au moins `advances` avances (défaut 0 = simple possession).
- `{ kind: 'career', id }` — un héros exerce la carrière `id` (`Combatant.career`).
- `{ kind: 'species', id }` — un héros est de l'espèce `id` (`Combatant.species`, id de `species.json`).
- `{ kind: 'status', atLeast }` — un héros a un Statut (LDB 08) au moins `atLeast` (« Argent 2 »,
  `parseStatus`/`statusMeets`, `src/engine/social.ts`).

**Convention d'affichage** — un choix gaté par un `when` de ce type se PRÉFIXE dans le `text` du
descripteur entre crochets, pour que le joueur voie POURQUOI ce choix lui est offert :
« **[Crochetage]** Forcer la serrure », « **[Halfling]** Se glisser par le soupirail »,
« **[Statut : Argent+]** Négocier d'égal à égal ». Le préfixe reste PROSE de fixture/campagne (pas de
mécanisme dédié de rendu) — voir le patron complet dans
`src/scenes/test-scenarios/98-conditions-etendues.ts`.

### 9quater. Persistance d'état des scènes au revisit (#707)

Quand le groupe QUITTE puis REVIENT dans une scène déjà visitée, ses mutations de jeu sont conservées
— une couche d'INSTANCE par `sceneId` (`sceneInstances`, `src/state/store.ts`) capture le delta au
départ et le réapplique au clone frais du document à l'entrée (`transitionTo`). Le document projet
reste la SOURCE (rééditable) ; l'instance est superposée, sérialisée dans la save, répliquée en coop.

**Ce qui PERSISTE au revisit** : les entités RETIRÉES (décor `interact.consume` fouillé, PNJ tués en
combat), les portes/structures/tuiles OUVERTES/ABATTUES/EFFONDRÉES (flags de `scene.flags`), et les
fouilles non-consommées (flags `__fouille` globaux).

**Ce qui NE persiste PAS (limite ASSUMÉE)** : une entité SPAWNÉE au runtime (présente en jeu mais
ABSENTE du document authored) disparaît au revisit — un auteur qui veut un objet/PNJ persistant le
PLACE dans le document de scène, il ne le spawne pas. Patron de recette :
`src/scenes/test-scenarios/99-revisit.ts` (fouiller un coffre + ouvrir une porte, aller-retour de
scène, tout reste en l'état).

## 10. Objectifs courants (`setObjective` / `clearObjective`)

Réponse à « je fais quoi maintenant ? » (#238, corollaire de « personne ne lit le journal ») : une PILE
d'objectifs (`store.objectives`, `{ id, text }[]`) affichée par un bandeau discret mais TOUJOURS visible
en exploration (`src/ui/ObjectiveBanner.tsx`, masqué en combat). Le plus RÉCENT est en tête ; plusieurs →
dépliable.

- `setObjective { id, text } & ScheduleSpec` — pose OU met à jour (re-poser le même `id` STABLE remplace
  son `text` et le remonte en tête). `text` = consigne joueur verbatim (`Prose`-safe : pas d'id de code ni
  de réf RAW brute). Une `ScheduleSpec` optionnelle (#668) pose `Objective.deadline` (minute absolue) →
  compte à rebours affiché en puce par `ObjectiveBanner`.
- `clearObjective { id? }` — retire l'objectif `id`, ou TOUS si `id` absent (fin d'acte).

La pile TRAVERSE les scènes (persistée hors `stateFields`, comme `flags`) et n'est vidée qu'en nouvelle
partie (`startScene`). Chaque pose/maj/retrait est aussi archivé au `journal`. L'étalon de campagne câble
les objectifs acte par acte (passage dédié) — l'auteur n'a rien à coder en dur.

### 10bis. Échéances (`ScheduleSpec`, `delayedEffect` & `setObjective`)

`ScheduleSpec` (`src/engine/clock.ts`) est le vocabulaire UNIQUE d'échéance, partagé par `delayedEffect`
(déclenche un `Flow` à l'échéance) et `setObjective` (pose `Objective.deadline`, compte à rebours). Résolu
en minute absolue par `scheduleAt(now, spec)` — priorité `atDate` > `afterDays` > `afterMinutes` >
`atHour`/`atMinute` seuls (prochaine occurrence) :

- `afterMinutes` — dans N minutes depuis maintenant.
- `afterDays` (+ `atHour`/`atMinute` optionnels, défaut minuit) — dans N jours, à l'heure dite.
- `atDate: { year?, month, day, hour?, minute? }` — date impériale ABSOLUE ; `year` absent = année
  courante de la partie. ⚠ `month` est **0-based** (index de `IMPERIAL_MONTHS`, `src/engine/clock.ts`) —
  l'ÉDITEUR (`ScheduleSpecFields`, `src/ui/editor/ScheduleSpecFields.tsx`) MASQUE ce détail derrière un
  select de mois PAR NOM ; l'auteur ne saisit jamais l'index.
- `atHour`/`atMinute` seuls (aucun autre champ) — prochaine occurrence de cette heure du jour.

Une échéance déjà passée à la pose (date antérieure, ou `afterDays:0` avec l'heure du jour déjà écoulée)
donne `executeAt <= now` : ce n'est PAS une erreur — l'effet/l'objectif tire au tout prochain
`advanceTime` (repos, voyage, avance de temps), comme tout `delayedEffect` en retard.

## 10ter. Bloc narratif (`narratif`, paquet auto-suffisant #765)

Un paquet de campagne schema 3 porte un bloc `narratif` (frère de `scenes`/`worldMap`, au NIVEAU
projet — jamais per-scène), typé `NarratifBlock` (`src/state/campaignNarratif.ts`) :

```
narratif: { affaires: Affaire[]; indices: Indice[]; presetsPnj: PresetPnj[]; objets: TrappingData[] }
```

- **`affaires`** (`Affaire`) — fils d'enquête ; **`indices`** (`Indice`, `kind: 'indice' | 'rumeur'`)
  rattachés à une affaire (`affaireId`), révélés par `stades` (`IndiceStade`, prose verbatim source) et
  recoupés par `refs` (ids d'autres indices) ; **`presetsPnj`** (`PresetPnj`) — PNJ pré-composés (`base`
  = id d'une créature globale surchargé par `profil`/`apparence`) ; **`objets`** (`TrappingData`) —
  possessions propres à la campagne.
- **Frontière RÉFÉRENCE vs NARRATIF.** Le narratif RÉFÉRENCE la règle globale (`src/data`) PAR ID
  (`base` → id de `creatures.json`), il ne la copie PAS et n'entre JAMAIS dans `src/data` global : c'est
  du contenu EMBARQUÉ dans le JSON, révélé seulement en jeu. `narratifSchema`
  (`src/data/schemas/defs-scenes/narratif.ts`, composé par `projetSchema`) garde cet invariant
  fail-fast au parse : aucun id narratif ne peut collisionner avec un id global (créature/possession),
  `affaireId`/`refs`/`base` doivent résoudre, ids internes uniques.
- **Identité (`meta`).** Le paquet porte aussi un bloc `meta` (`ProjectMeta`, `src/state/worldMap.ts`) —
  `id`/`label`/`version` requis, `icon`/`description`/`auteur` optionnels — identité de campagne pour la
  bibliothèque (#766), validée fail-fast SI présente ; optionnelle au format (la migration 2→3 n'en injecte pas).
- **Migration.** Un projet schema 2 legacy (localStorage éditeur d'avant #765) monte au format courant
  au chargement (`PROJECT_MIGRATIONS[2]` injecte un narratif vide). Les **quatre projets committés sont
  en schema 3** : « L'Arène » (`src/scenes/arene/arene-projet.json`), « La Barge du Sel »
  (`src/scenes/barge-du-sel/barge-du-sel-projet.json`), « La Diligence »
  (`src/scenes/diligence/diligence-projet.json`, sans `worldMap`) et « Le Loup et la Saumure »
  (`src/scenes/loup-et-saumure/loup-et-saumure-projet.json`) — produits par `projectDoc`
  (`scripts/campagne/lib.mjs`, fabrique UNIQUE du document de projet). Chacun a son def de schéma
  (`src/data/schemas/defs-scenes/`) et parse `projetSchema` en CI.
- **Éditeur.** Le bouton « Narratif » (`src/ui/editor/EditorToolbar.tsx`) ouvre le viewer
  `src/ui/editor/NarratifEditor.tsx` (onglets Affaires/Indices/PNJ/Objets).
- **Instancier un PNJ nommé dans une scène (`presetId`, #671).** Une `SceneEntity` (ou un `AuthoredEnemy`
  terse) porte `presetId` = l'id d'un `narratif.presetsPnj`. Présent, l'entité est INSTANCIÉE
  « base globale + surcharges du preset » (jamais depuis `ref`/`statblock`) : `resolvePresetCreature`
  (`src/state/campaignData.ts`) résout le preset, `mergeCreatureProfile` fusionne `base` (`findCreatureById`)
  et `profil` AU NIVEAU CHAMP (`char` par caractéristique ; `skills`/`talents`/`traits`/`spells` remplacés
  en bloc si présents). Au spawn de rencontre (`combatSlice`), la créature mergée et `preset.apparence` sont
  passées à `spawnEnemy` (canal `presetCreature`) ; le portrait de dialogue (`gameIso/tokenBodyKind.tsx`)
  dérive le rig de `preset.base`/`preset.apparence`. Couche non chargée / preset absent → repli silencieux
  sur `ref`/`statblock`. `parseProject` valide fail-fast (clause `presetId` de `projetSchema`) que tout `presetId`
  de scène résout un preset déclaré.

## 11. Règles d'or

- **IDS partout** — `ref`/`skill`/`spell`/`weapon`/`species`/`tenue`/`trappingId`/`factorId`/`roleId` sont
  des ids STABLES. Un libellé est un défaut silencieux (poison). Doctrine : CLAUDE.md, encadré « id STABLE ».
- **Personne ne lit le journal** — tout dénouement pertinent est une surface VISIBLE au moment (dialogue,
  modale, effet à l'écran), le `journal` ne fait que rappeler.
- **Aucun texte technique dans un texte joueur** — un `node.text`/`journal` est rendu VERBATIM par
  `Prose` (`src/ui/Prose.tsx`) : ni identifiant de code, ni tag d'auteur (`[INEXPRIMABLE]`), ni citation
  RAW brute (`MDG 14 l.45`). Les constats d'authoring vont dans un journal `docs/plans/`, jamais en jeu.
- **Prose = verbatim source, Markdown** (CLAUDE.md règle 5) — jamais de reformulation ni de HTML.

## 12. Tous les Effects de scène (carte générée)

Le vocabulaire COMPLET des `Effect` posables dans un `Flow` (choix de dialogue, `onVictory`, trigger,
`delayedEffect`…) vit dans `docs/campagne-effects.md` — carte GÉNÉRÉE depuis le type `Effect` de
`src/state/scene.ts` (`npm run docs:effects`, gatée par `docs:check`), jamais écrite à la main. On y
trouve notamment `givePossession` (attribue une bête/serviteur/véhicule au registre `state.possessions`,
socle possessions #615) à côté de `giveTrapping`/`giveMoney`/`giveXp`, et l'`EffectOp` (pont vers le
moteur mécanique/GameOp).
