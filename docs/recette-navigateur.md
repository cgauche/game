# Recette navigateur — vérifier une feature dans le jeu (Playwright MCP)

> Extrait verbatim du CLAUDE.md (dégraissage 2026-07-05). À lire au moment de valider une
> feature UI dans le navigateur.

**Vérification** : après une feature UI, valider dans le navigateur (Playwright MCP) — charger
`localhost:5173`, dérouler le flux, vérifier `console` (0 erreur) et screenshoter. Le menu
**« 🧪 Tests — scénarios »** ouvre un choix de scénarios de test (groupe fixé + scène adaptée,
combat direct) ; **passer par le scénario adapté, sinon en créer un** — un scénario = un fichier
dans `src/scenes/test-scenarios/` (cf. `docs/test-scenarios.md`).

## Preuve headless (agents)

Kit **committé** `scripts/recette/` — capture d'écran + console sans réinventer un script CDP par
agent (constat 2026-07-14 : plusieurs dizaines de scripts scratchpad ad hoc, un par session, pour
faire la même chose). Deux niveaux :

- **Cas simple** : `scripts/recette/shot-screen.mjs`, la CLI prête à l'emploi — plus AUCUN script à
  écrire.
- **Cas sur-mesure** : `scripts/recette/lib.mjs`, le socle (à importer dans un script jetable pour
  dérouler un flux précis).

Moissonné de scripts scratchpad éprouvés (patrons repris tels quels) : CDP nu sur Chrome headless
(`des-v5-verify.mjs`, `gallery-v2-tour.mjs`, `repro-399.mjs` — spawn Chrome, `Target.attachToTarget`,
`Runtime.evaluate`), filtrage console par `sessionId` (`repro-399.mjs`, `gallery-v2-tour.mjs`),
émulation `prefers-reduced-motion` via `Emulation.setEmulatedMedia` (`dice-reduced-motion.mjs`).
**Zéro dépendance nouvelle** : `playwright-core` n'était PAS installé dans ce dépôt (vérifié —
seul le scratchpad d'un agent l'avait en local) ; le socle reste donc en CDP nu (fetch + WebSocket
natifs Node ≥ 22), le choix le plus robuste des scripts moissonnés au regard de cette contrainte.
Le kit ne DÉMARRE **jamais** le serveur de dev — il s'y **attache** (erreur claire si injoignable).

### CLI — `scripts/recette/shot-screen.mjs`

```
node scripts/recette/shot-screen.mjs --screen gallery --out mon-dossier
node scripts/recette/shot-screen.mjs --screen menu --mobile
```

Options : `--screen <id>` (obligatoire, un id de `SCREENS`, `src/state/store.ts`), `--out <dir>`
(défaut CWD), `--url <url>` (défaut `http://localhost:5173/`), `--mobile` (viewport 360×740),
`--width`/`--height`, `--settle <ms>`. Exit ≠ 0 si la console a remonté une erreur/exception après
l'ouverture de l'écran.

### Socle — `scripts/recette/lib.mjs`

| Fonction | Rôle |
|---|---|
| `openApp` | vérifie le serveur (fetch), lance Chrome headless, navigue, attend que `__wfrp.screen` soit prêt (chargement async, cf. `src/main.tsx`) |
| `gotoScreen` | navigue vers un écran via `__wfrp.screen` |
| `shot` | capture PNG nommée dans un dossier donné (créé si absent) |
| `consoleGuard` | collecte erreurs/warnings/exceptions, filtrés sur LA session courante (piège du buffer partagé, § « Pièges vécus » ci-dessous) |
| `freezeTimeout` / `unfreezeTimeout` | monkey-patch `setTimeout` pour figer/dégeler une durée d'animation avant capture |
| `emulateReducedMotion` | force `prefers-reduced-motion: reduce` (CDP `Emulation.setEmulatedMedia`) |
| `setViewport` / `setMobileViewport` | viewport explicite / mobile canon 360×740 (charte-ui.md — testable dès 360px) |
| `evaluate` / `waitFor` | eval JS dans la page (attend les promesses) / poll jusqu'à condition vraie |
| `checkServer` / `launchSession` | briques bas niveau d'`openApp` (séparément utilisables) |

**Capturer un écran** :
```js
import { openApp, gotoScreen, shot, consoleGuard } from './scripts/recette/lib.mjs';
const session = await openApp();
const guard = consoleGuard(session);
await gotoScreen(session, 'compendium');
await shot(session, 'compendium-01', 'mon-dossier');
console.log(guard.errors());
await session.close();
```

**Figer une animation le temps d'une capture** :
```js
import { openApp, evaluate, freezeTimeout, shot } from './scripts/recette/lib.mjs';
const session = await openApp();
await freezeTimeout(session, [0]); // AVANT de déclencher l'animation
await evaluate(session, "document.querySelector('.dice-roll-btn').click()");
await shot(session, 'des-figes', 'mon-dossier');
await session.close();
```

Pièges déjà documentés (renvois, pas de doublon) : le buffer console **partagé** entre
sessions/onglets, le **closure-sync** (lire le DOM dans le même `evaluate` que l'action qui change
l'état React), le **HMR silencieux** qui ramène au menu en pleine recette — voir « Pièges vécus » et
« Piège du *closure-sync* » plus bas dans ce document.

## Doctrine : piloter COMME UN JOUEUR, pas à la main

Ordre de préférence STRICT pour exercer un flux :
1. **Vrai input** : le contrôle **clavier** est développé (cf. `src/state/keybindings.ts` — navigation,
   ciblage, actions ; + manette) → `browser_press_key` ; clics réels sur les éléments (`data-cid` sur
   les tokens SVG, boutons des modales). C'est le SEUL pilotage qui valide ce que le joueur vit.
2. **`__wfrp` pour le SETUP et l'OBSERVATION** : lancer un scénario (`scenario`), placer/donner le
   tour (`place`/`turn`), lire la vérité (`state`/`battle`/`aim`/`modal`/`log`).
3. **Appel direct des fonctions du store** (`__wfrp.store.getState().xxx()`) : DERNIER recours,
   jamais pour valider le flux testé — on validerait un chemin que le joueur n'emprunte pas, et
   c'est la première source d'erreurs (closures, état non re-rendu, préconditions sautées).

## Outillage `__wfrp` (SOURCE UNIQUE du harnais, DEV uniquement, `src/state/devtools.ts`)

Pour piloter le jeu depuis Playwright **sans chasser les coordonnées pixel des tokens**, via
`browser_evaluate`. Cette section liste **TOUS** les helpers de `buildApi()` — un ajout/retrait
côté `devtools.ts` se répercute ICI (source unique, jamais une 2ᵉ liste partielle ailleurs).

### Scène / navigation

| Helper | Usage | Limites connues |
|---|---|---|
| `state()` | instantané `{screen, sceneId, partyPos, inDialogue, inCombat, party, money…}` | lecture seule |
| `entities()` | cartographie des entités de la scène `{id,label,kind,pos,access}` | exclut les entités `hiddenUntilCombat` |
| `screenPos('id')` | bounding box ÉCRAN (`{x,y,width,height}`) du token `[data-cid="id"]` — COMBAT ET EXPLORATION (même canal `data-cid`, #226) | lecture seule ; `null` si le token n'est pas dans le DOM (hors vue) ; pour un clic, **viser `{x: x+width/2, y: y+height}` (le BAS de la bbox, pied du token) plutôt que le centre géométrique** — un token de grande taille (créature haute) a sa bbox étirée vers le haut, et le centre géométrique tombe hors silhouette (retour vécu en recette, résidu #199) |
| `talk('id')` | téléporte le groupe à côté de l'entité + l'interpelle (dialogue/marchand) | rien si l'entité n'a ni dialogue ni marchand ; ⚠ un marchand-PNJ de scène n'a PAS de bande de décor (`ScreenShell` slot `backdrop`) — cette ambiance n'existe QUE par le chemin service-de-lieu (`openPlaceMerchant`, hub de ville) qui la porte en donnée. Ne pas conclure à une régression de décor en interpellant un PNJ |
| `goto('id'\|{x,y,z?})` | place le groupe sur une case (déclenche portes/triggers au pas) | — |
| `screen('menu'\|'party'\|…)` | navigue vers un écran | id validé contre `SCREENS` (`state/store.ts`) — `throw` immédiat + liste des ids valides si invalide (#211 ; avant : routage silencieux, écran blanc, zéro erreur console). ⚠ `screen('interlude')` n'ARME PAS l'interlude : `InterludeScreen` rend `null` sans `state.interlude` (peuplé par `startInterlude`) → écran vide. Utiliser `interlude()` (ci-dessous), pas `screen('interlude')` |
| `levels()` | décompose le rendu multi-niveaux (tuiles/murs/hauteurs par étage) | lecture seule |
| `viewLevel(z?\|null)` | force l'étage AFFICHÉ (debug rendu) ; sans argument : lit l'override | n'affecte que le RENDU, jamais la logique (LdV/portée restent réelles) |
| `ascii(z?)` | plan ASCII de la couche (à comparer œil-pour-œil avec l'écran) | `console.log(__wfrp.ascii())` pour l'alignement monospace |
| `fog(on=false)` | brouillard ON/OFF (diagnostic RENDU sans vision) | bascule GLOBALE — remettre `fog(true)` avant de valider un flux de vision réel |
| `labels(on?)` | overlay debug de coordonnées sur la carte | bascule ; zéro coût si OFF |
| `go('scene-id', entry?)` | saute vers une scène du projet | scène inconnue → message `✗`, scène inchangée |
| `fight(encounterId?)` | sans argument : liste les rencontres de la scène ; avec id : lance le combat | — |
| `store` | store Zustand brut (`getState`/`setState`) | **dernier recours** (doctrine ci-dessus, §3) — ⚠ **`setState` brut peut CORROMPRE l'état sans récupération** (pas de validation/dérivations liées, contrairement aux actions du store) : un état incohérent après un `setState` direct impose un RELOAD complet, pas un simple retour arrière. `store` = LECTURE (`getState()`) ; toute mutation passe par un helper `__wfrp` ou une vraie action du store (`getState().xxx()`), jamais `setState` à la main sur un flux qu'on valide |

### Combat — lecture / ciblage

| Helper | Usage | Limites connues |
|---|---|---|
| `battle()` | snapshot combat (round, actif, modales, combattants une ligne chacun) | lecture seule |
| `hover('id'\|{x,y}\|null)` | survol PROGRAMMATIQUE (tooltip + réticule sans souris) | requiert IsoStage monté (`✗ IsoStage non monté` sinon) |
| `aim('id')` | vérité state du ciblage pour l'actif (`ok`/`invalid`/`none` + raison, compétence, dégâts) | uniquement en combat |
| `pad('A'\|'B'\|…)` / `padDir('up'\|…)` | simule bouton/direction manette (shim DEV, MÊME chemin que la vraie manette) | requiert le shim `window.__wfrpPad(Dir)` installé (`useGamepad` monté) |
| `modal()` | modale(s) `pending*` ouvertes + actions dérivées | conventions `<flux>Roll/Confirm/Cancel` uniquement (voir doctrine ci-dessous) |
| `roll()` / `confirm()` / `cancel()` | pilotent LA modale ouverte par convention | `✗ aucune modale ouverte` / `✗ pas de flux pilotable` si hors convention |
| `log(n=8)` | dernières lignes du journal (exploration + feed combat) | lecture seule |
| `aiLog(n=50)` | diagnostic IA : action choisie + classement des candidats par tour | `(forcé)` = garde psychologie/RAW hors scoring |
| `auto()` | diagnostic auto-cadence (mode, modale active, `willAutoResolve`, `pending*` ouverts) | pour investiguer un soft-lock, pas pour agir |

### Combat — triche de mise en place

| Helper | Usage | Limites connues |
|---|---|---|
| `turn('id')` | donne le TOUR à un combattant (réinitialise Action/Mouvement) | saute les bornes de Round — mise en place, pas simulation de partie |
| `place('id',{x,y})` | téléporte un combattant | **PIÈGE COMPOSITE (corrigé)** : cible une coque à postes (`postes` non vide) ou un membre de `ShipPoste.crewIds` → déplace la FORMATION ENTIÈRE (coque + tout l'équipage des postes) du même delta, MÊME sémantique que la poussée (`pushCommitTile`). Téléporter la coque SEULE désynchronisait aperçu (postes) et portée réelle (équipage resté en arrière) — 30 % du budget d'une recette perdu à débugger ce déphasage avant fix. Retourne `{msg, moved:[ids]}` en cas composite, une chaîne sinon (combattant simple inchangé). |
| `turnShip('id','tribord'\|'babord'\|crans)` | vire le cap d'un navire (triche, sans jet) | ne déplace QUE le cap (`facing`), jamais la position — vérifier ensuite avec `aim()` |
| `maneuver('id', side?, helmsmanId?)` | manœuvre RÉELLE (Test de Navigation, peut échouer) | contrairement à `turnShip`, PEUT rater — pas une triche |
| `killEnemies({withQualityLoot?})` | élimine tous les ennemis + flux de victoire NORMAL | ignore les postes `inert` non `dead` (affûts non visés, LDB — voir `isOutOfAction`) ; `withQualityLoot:true` ajoute à `pendingVictory.gear` un objet CATALOGUÉ à qualités (premier trapping de `trappings.json` avec `qualities` non vide, choisi dynamiquement — MÊME brique `gearFromEffects` que le vrai butin) — NON ajouté si la victoire n'est pas atteinte (cascade de fin de combat ouverte / combat en cours), le message le signale |
| `dealDamage('id', n=5)` | inflige `n` Dégâts à un combattant par le VRAI pipeline (`applyOps` op `wounds` → armure de coque/PA, États, puis `checkBattleOver` : reddition/naufrage/victoire) | combat requis ; éprouve l'issue navale (coule une coque, teste un naufrage) sans jouer chaque tir |
| `combatEnd({heroId?,critical?,corruption?})` | arme les conséquences de fin de combat (Infection/Corruption/Destin) puis LAISSE la cascade ouverte | à conduire à la main (`cascadeRoll`/`Next`) — n'auto-résout rien, contrairement à `killEnemies` |
| `healParty()` | groupe à neuf (PB max, états/critiques/maladies purgés, morts relevés) | ne touche QUE `kind:'hero'` en combat |
| `charge('enemyId', heroId?)` | simule une charge (déclenche `onCharged`, Frappe réactive) | héros cible = le plus proche par défaut |
| `quality('id', label?, advantage?)` | ajoute un Atout/Défaut à l'arme ACTIVE + Avantages | ne touche que `weapons[0]` |
| `condition('id', name?, n?)` | applique un État via le VRAI `addCondition` (déclenche les triggers) | — |
| `bladeTrap(defenderId, attackerId, defSL?)` | ouvre l'étape « Piège-lame » sans forcer un Critique défensif | assigne un `uid` factice à l'arme de l'attaquant si absent |
| `focus('id', spell?, dr?)` | met un combattant en Focalisation (test d'interruption au coup suivant) | — |
| `fear(heroId, enemyId, indice?)` | pose une Peur + simule l'approche de la source | positions requises (`✗` sinon) |
| `talent('id', talentId, times?)` | octroie un Talent à un combattant | — |

### Groupe / campagne / règles

| Helper | Usage | Limites connues |
|---|---|---|
| `give(gold=10)` / `xp(amount=100)` | crédite la bourse / +PX au groupe | — |
| `giveTrapping(heroId, trappingId, qty?)` | donne un objet de CATALOGUE à un héros (défaut : le 1er), par le VRAI pipeline `giveTrapping` du store (`applyEffects` → `itemFromGive` : item bien formé, qualités du catalogue, rangement/Encombrement recalculés) | `trappingId` inconnu → message `✗` ; `qty` fixe la quantité de l'instance (ex. `giveTrapping('hero-1','boulet-et-poudre',6)` charge le coffre d'un canon) — ⚠ munitions ≠ rations (achat au marchand : la munition d'artillerie/à distance est un article SÉPARÉ des vivres, jamais suggéré à la place) |
| `flags()` / `flag('id', value=true)` | lit/force un drapeau de scénario | — |
| `setMorale(n)` | pose directement `vessel.morale.score` (setup, MÊME patron que `flag()`) | pas le pipeline hebdomadaire (`recalcMorale`) — sert à rendre la désertion à quai (bande ≤75, `moraleBand(score).desertionRoll`) observable sans dérouler des semaines de facteurs ; `✗` sans `state.vessel` |
| `gmSeat(bool?)` | flip du siège MJ SOLO (`setGmSeat`, siège 0) — sans argument : BASCULE | setup légitime (`scenario()` RESET le siège à chaque lancement) — la VALIDATION du flux MJ reste la checkbox RÉELLE de l'UI (§ Pièges vécus ci-dessous), ce helper économise seulement la mise en place |
| `time(minutes=60)` / `rest(days=1)` | avance l'horloge / dort N jours (cascade quotidienne) | ⚠ **NE PILOTE PAS une traversée EN MER** : `rest()` appelle `restFlow.sleepParty` directement, découplé de `travelPlan.sea` (`state/seaVoyageFlow.ts`) — avance l'horloge SANS faire progresser le navire sur sa route (désynchronise `gameTime` du voyage). Pour accélérer une traversée COMMANDÉE, voir « Voyage en mer » ci-dessous |
| `chantier('reparer'\|'carener'\|upgradeId, units?)` | services du chantier naval au port | hors combat, navire de campagne requis |
| `massBattle(ally?, enemy?, rounds?)` | lance une bataille de masse de démo | la scène courante doit porter les rencontres attendues |
| `scenario(id?, seed?)` | lance un scénario de test PRÊT À JOUER ; sans argument : liste les ids | Round 1 déjà acquitté, initiative déterministe SI `seed` |
| `campaign(id?, seed?, sceneId?)` | charge une CAMPAGNE BUILT-IN (`builtinCampaigns`, `scenes/campaign.ts`) SANS dérouler le character creator ×4 à la main — groupe canonique (`makeShowcaseParty`), MÊME chemin que le picker `PartyScreen` (`setPendingCampaign` + `loadProject`) ; sans argument : liste les ids | les campagnes built-in ne portent PAS de pré-tirés propres (seul `pregens.json`, libre-service au picker) → groupe canonique (les 4 piliers de l'Arène), pas le casting narratif de la campagne ; `sceneId` (optionnel) démarre ailleurs que l'entrée par défaut ; `pendingCampaign` redevient `null` juste après (comme le flux réel : `loadProject`→`startScene` réinitialise l'état à l'INITIAL hors le sous-ensemble préservé, `store.ts`) — pas une régression |
| `interlude(weeks=3)` | arme un INTERLUDE de démo jouable (`startInterlude` — MÊME flux réel : `state.interlude` peuplé, Événement d100/héros, budget `min(3, weeks)`, écran 'interlude') SANS voyager jusqu'à Altdorf | catalogue d'Activités dérivé de la DONNÉE (`interludeCatalog`/`activities.json`), rien d'inventé ; sans groupe chargé, pose le groupe canonique (`makeShowcaseParty`, comme `campaign()`) ; `✗` si combat en cours ; interlude déjà ouvert → message sans réarmer ; à conduire ensuite à la main (Activités, clôture) — pas `screen('interlude')` seul (écran vide) |
| `rules(id?, value?)` | lit/force une règle optionnelle (`policy.ts`) — inclut `combat-cadence` (auto/rapide/manuel) | override runtime NON persisté ; `rules(id, null)` réinitialise |
| `seed(n)` | re-ensemence le RNG de bataille EN COURS de combat | même action que `scenario(id, seed)` au lancement |
| `fastForward(maxIters=400)` | avance les tours IA jusqu'au prochain tour PILOTÉ HUMAIN (ou fin de combat), MÊME machinerie que la partie réelle, juste sans les délais du Réalisateur | `maxIters` = garde-fou anti-boucle (scrutations, pas des tours) — `✗ borne atteinte…` = soft-lock probable, à diagnostiquer via `auto()` ; retourne une `Promise` (`await`) |

**Doctrine `seed`/`fastForward`** : SETUP et OBSERVATION seulement (même doctrine que le reste de
`__wfrp`, § ci-dessus) — `seed` fige l'aléatoire pour REJOUER une recette à l'identique, il ne
force jamais une issue particulière ; `fastForward` saute le BRUIT des tours IA (temps d'attente
Playwright), jamais l'action du joueur ni un jet du flux qu'on est en train de valider. **Passer un
Round/tour se fait TOUJOURS par `turn()`/`fastForward()`, jamais à la main** (pas de bidouille de
`battle.round`/`order` par `store.setState` — ce sont des recettes, pas le flux testé).

Les tokens portent `data-cid="<id de l'entité/combattant>"` dans le SVG — COMBAT ET EXPLORATION
(#226, `src/gameIso/stage/tokens.tsx`) → survol/clic ciblé par sélecteur DOM (vrais clics
Playwright, cf. piège ci-dessous), ou lecture de position via `screenPos('id')`.

### Voyage en mer — accélérer une traversée commandée (recette, #297)

La progression jour par jour d'une traversée EN MER (`runSeaDay`, `state/seaVoyageFlow.ts` — météo,
périls, halte de nuit) enchaîne les jours ; chaque jour est UNE cascade (`pendingCascade`, `purpose:
'travelDay'`) qui se SUSPEND à chaque étape influençable et à chaque halte de nuit (`pendingRest`) ;
elle reprend à la CONFIRMATION de ces étapes/modales, jamais via `time()`/`rest()` (ci-dessus,
`rest()` reste découplé de `travelPlan.sea`).

| Helper | Usage | Limites connues |
|---|---|---|
| `advanceSeaDay({stopOnEveryEvent?, maxIters?})` | symétrique VOYAGE de `fastForward` : pilote la journée EN COURS (cascade du jour, halte de nuit, Activités hebdo si le palier de 8 jours tombe) jusqu'au JOUR SUIVANT — MÊME machinerie que le joueur (`cascadeResolveAll`/`Finish`, `restSleep`, `seaActivitiesConfirm`), sans les clics | s'arrête sur la cascade `travelDay` FRAÎCHE du jour suivant (déjà ouverte, `cursor:0`, pas encore consommée — le PROCHAIN `advanceSeaDay()`/`roll()`/`skipToArrival()` la joue), jamais un `pendingCascade` à `null` ; `maxIters` (défaut 400) = garde-fou scrutations, `✗ borne atteinte…` = soft-lock probable (`auto()`) ; retourne une `Promise` (`await`). `stopOnEveryEvent:true` (#380) : s'arrête AUSSI au recap dès qu'un événement de bord RACONTÉ (routine, non décisionnel — carte-parchemin `sea.events`, rendue par `SeaVoyageBody`) vient d'être résolu, pour le constater ; `restSleep()`/`advanceSeaDay()` reprend ensuite. Défaut inchangé (arrêt au jour suivant / décision présentée seulement) |
| `skipToArrival(maxIters=4000)` | comme `advanceSeaDay` mais ROULE jusqu'à l'ACCOSTAGE (`openPortAt`, `travelPlan` vidé) | s'arrête aussi sur un combat (embuscade/abordage) — `battle` alors ouvert, à jouer/`fastForward` séparément ; `Promise` (`await`) |
| `dealShipDamage(n=5)` | inflige `n` Dégâts de coque HORS COMBAT — VRAI pipeline (`damageVesselHull` si un voyage est en cours sur le navire de campagne, sinon `setVesselHull` directement au port) | symétrique de `dealDamage` (combat) — voir le piège des DEUX copies de coque ci-dessous ; **NE déclenche PAS un naufrage fiable** (voir piège d'ORDONNANCEMENT ci-dessous, `forceShipwreck`) |
| `forceShipwreck(aboardIds?)` | déclenche `beginShipwreck` DIRECTEMENT (setup ASSUMÉ, PAS le pipeline de dégâts) — coque + cargaison purgées IMMÉDIATEMENT, cascade de survie à la nage (Chance/Pacte/Résilience influençable) ouverte pour les héros à bord | `✗` sans `state.vessel` ; voir piège d'ORDONNANCEMENT ci-dessous |
| `clickRoute(routeId)` | calcule un point ON-PATH CLIQUABLE d'une route depuis ici → `{x,y}` ÉCRAN. SONDE `elementFromPoint` au milieu du tracé et, si un décor transparent l'intercepte (chaîne d'ancêtres sans `cursor:pointer`), balaie d'autres fractions de `getPointAtLength` jusqu'à un point cliquable (repli INTÉGRÉ) | ne clique PAS lui-même (le VRAI clic reste `page.mouse.click(x,y)`, Playwright) — remplace le calcul manuel `browser_run_code_unsafe`, voir piège ci-dessous ; `note` indique la fraction retenue (ou qu'aucune n'a testé cliquable → milieu par défaut) ; `✗` si route inconnue/non cliquable d'ici/tracé absent du DOM |
| `forceEncounter(id='navire-hostile')` | force un événement de bord maritime NOMMÉ (`sea-events.json`, id ou kind) au PROCHAIN jour — court-circuite le timer 1d10 + le tirage d100/Manann | à dérouler avec `advanceSeaDay()` : le drive s'ARRÊTE sur la décision présentée (Cogue pirate fuir/combattre/soumettre) sans la trancher — voir doctrine ci-dessous ; `✗` si aucune traversée en cours / événement introuvable |

**Doctrine `advanceSeaDay`/`skipToArrival`** : même doctrine que `fastForward` — SETUP et
accélération du BRUIT de routine, jamais un raccourci qui saute une décision du joueur. La halte de
nuit est résolue avec les valeurs PRÉ-REMPLIES de la modale (`pendingRest`, lodging/pitance par
défaut) — pour tester spécifiquement un choix de couchage/tambouille, dérouler cette nuit-là à la
main (vrais boutons) plutôt que via ces helpers. Si le scénario propose un départ en **voyage
rapide** (MDG ch.15 l.21-37, `sea.fast` — palier appliqué en un bloc), le choisir AU DÉPART reste la
vraie accélération native du jeu ; il n'est pas rejouable après coup sur une traversée déjà en cours
au pas.

**`forceEncounter` + `advanceSeaDay` s'ARRÊTENT à l'événement PRÉSENTÉ** : un événement de bord qui
ouvre une DÉCISION du joueur (Cogue pirate `navire-hostile` → cascade `purpose:test` fuir/combattre/
soumettre, `openPirateHail`) n'est PAS de la routine — le drive (`advanceSeaDay`/`skipToArrival`)
s'arrête PROPREMENT dessus et le signale (`✓ événement présenté — « … » attend une décision …`),
laissant `pendingCascade` intact pour que le recetteur voie et tranche les 3 choix (jamais un
`defaultChoice` appliqué en silence, jamais l'état vidé sous l'écran). Les choix INTERNES d'une
journée (`purpose:travelDay`) gardent, eux, leur défaut de routine. Dérouler alors la branche au clic
(vrais boutons) ; `advanceSeaDay()` reprend ensuite le voyage.

**Constater une carte-parchemin de ROUTINE** : `forceEncounter()` tire par défaut
`navire-hostile`, un événement DÉCISIONNEL (le drive s'arrête sur la décision, pas sur une carte
racontée). Pour observer une carte-parchemin de routine (`sea.events`, `SeaVoyageBody`), NE PAS
forcer : laisser le tirage d100/Manann jouer et rouler avec `advanceSeaDay({stopOnEveryEvent:true})`
— le drive s'arrête au recap dès qu'un événement raconté vient d'être résolu.

**Piège des DEUX copies de coque** (#296) : la coque « source de vérité » est `state.vessel.wounds` ;
`travelPlan.vehicle` n'en est qu'une COPIE DE TRAVAIL utilisée par `applyOps`/le combat pendant la
traversée. Juste après l'appareillage (`startTravel`/`buildSeaPlan`), `vessel.wounds` peut rester
`undefined` un moment (la copie de travail démarre pleine, la persistance n'a encore rien à écrire) —
lire la coque RÉELLE en cours de voyage via `travelPlan.vehicle.wounds`, PAS `vessel.wounds`, tant
qu'aucun Dégât/jour n'a encore persisté. `dealShipDamage`/`damageVesselHull`/`healVesselHull`
écrivent TOUJOURS les deux (une seule écriture par appel) — jamais un accès `.wounds` direct sur
l'une des deux copies dans une recette.

**Piège d'ORDONNANCEMENT du naufrage** (#332, symétrique du piège des deux copies ci-dessus) : la
garde de naufrage (MDG ch.13 l.674, coque à 0 → `beginShipwreck`) n'est évaluée QU'À L'ENTRÉE de
`runSeaDay` (`state/seaVoyageFlow.ts` : `plan.vehicle.wounds.current <= 0`). Poser
`dealShipDamage(999)` PUIS rouler le jour avec `advanceSeaDay`/`skipToArrival` ne produit PAS
mécaniquement un naufrage : si la Réparation de fortune (ou tout autre applier du même jour) répare
la coque AVANT que `runSeaDay` ne soit re-consulté, les dégâts posés sont EFFACÉS sans que la garde
n'ait eu l'occasion de s'exécuter — la preuve écran #269 est donc mécaniquement impossible avec ce
seul enchaînement. `forceShipwreck()` bypass ce piège en appelant `beginShipwreck` DIRECTEMENT
(MÊME fonction que `runSeaDay`/`checkBattleOver` sur un naufrage réel), sans course contre les
appliers du jour.

## Pièges vécus (corrections d'expérience)

- **Retour-menu SILENCIEUX en pleine partie = arbre PAS gelé, pas un bug** (vécu 2026-07-11,
  3 reloads pendant une recette, zéro erreur console/collecteur) : Vite sert le WORKING TREE — un
  agent/une session qui écrit sous `src/` (ou dont la suite régénère un registre `gen-registry`)
  déclenche un HMR/full-reload qui ramène au menu et PERD la progression. Règle : une recette exige
  l'arbre GELÉ — AUCUN agent concurrent (même « scripts/docs seulement » : leurs suites régénèrent
  du `src/`). Si ça arrive : `git status` avant de blâmer le code.
- **Refs Playwright PÉRIMÉES après un `await`** : après tout `await __wfrp.xxx()` (ou tout clic qui
  déclenche de l'async), RE-SNAPSHOTER avant de cliquer — jamais réutiliser une ref d'un snapshot
  antérieur (échec « ref not found » sinon).
- **Activer le siège MJ en SOLO** : menu ☰ en jeu → case « Contrôler aussi les ennemis / le monde
  (MJ) » (`GmSoloToggle`, `src/ui/CoopPanels.tsx`) — observable via `__wfrp` : `net.gmSeat` non nul.
  `__wfrp.gmSeat(true/false)` pose/retire le siège en SETUP (évite les clics répétés à chaque
  scénario, `scenario()` le reset) — la VALIDATION du flux reste la checkbox RÉELLE.
- **Module Vite PÉRIMÉ après un fix** (vécu 2026-07-09, faux « PAS CORRIGÉ » sur un P0) : le
  watcher Vite sous Windows peut RATER une écriture de fichier (agent/git) — le serveur sert alors
  l'ancienne transformation même après un reload complet. Symptôme : la stack console cite des
  numéros de ligne de l'AVANT-fix ; preuve : le `?t=` de l'URL du module (`travel.ts?t=…`) est plus
  vieux que le fix. Remède : toucher le mtime du fichier (`(Get-Item f).LastWriteTime = Get-Date`)
  puis recharger — vérifier le `?t=` AVANT de conclure qu'un fix ne marche pas. Corollaire : la
  console MCP est un buffer PARTAGÉ entre sessions/onglets — `all:true` peut remonter les erreurs
  d'une session PRÉCÉDENTE ; après un clic sensible, lire la console IMMÉDIATEMENT et depuis la
  dernière navigation, jamais en fin de parcours.
- **Captures d'écran** : le dossier d'atterrissage DÉPEND du serveur Playwright MCP — souvent
  `.playwright-mcp/` (gitignoré), mais la recette 2026-07-11 a constaté l'écriture à la RACINE du repo
  (fichier non gitignoré → poison potentiel pour un commit/deploy). NE PAS présumer : vérifier où
  atterrit la 1ʳᵉ capture, et si c'est hors `.playwright-mcp/`, la DÉPLACER hors du repo (ou dans
  `.playwright-mcp/`) IMMÉDIATEMENT. `%TEMP%` reste rejeté (« outside allowed roots »).
- **Jamais de `dispatchEvent`/`MouseEvent` synthétique** pour cliquer un token/bouton — provoque de
  FAUSSES erreurs `setPointerCapture` (l'élément n'a jamais reçu de vrai pointeur). Utiliser les
  VRAIS clics Playwright (`browser_click`, sélecteur `data-cid`/rôle/texte).
- **Passer des tours** : `turn('id')` (triche, donne le tour) ou `fastForward()` (avance l'IA) —
  jamais de manipulation manuelle de `battle.round`/`battle.turn`/`battle.order` via `store`.
- **`aim()` juge l'arme SÉLECTIONNÉE dans la barre**, pas une arme perso du héros. Pour éprouver un
  tir de pièce d'artillerie, ouvrir « Attaque ▾ » et cliquer l'entrée d'arme du CANON avant `aim()` —
  un `range` sur l'arme personnelle du servant ne dit RIEN du canon. `aim()` renvoyant
  `{invalid, reason:'noammo'}` = pièce sans munition : en acheter à l'arsenal/chandelier PUIS charger
  (la munition d'artillerie est un article séparé des vivres, cf. `giveTrapping`) ; l'affordance à
  l'écran nomme la munition attendue (« Pas de munitions (Boulet et poudre) »).
- **Les tokens de combat SVG ne sont JAMAIS « stable » pour Playwright** : ils oscillent en
  permanence (idle-bob, `src/gameIso/stage/tokens.tsx`) → `browser_click` attend une stabilité qui ne
  vient pas et expire. Cibler par le **roster du HUD** (portraits/frise, éléments DOM stables) ou lire
  `screenPos('id')` puis un VRAI clic souris (`page.mouse.click`) aux coordonnées — jamais un
  `browser_click` qui attend la fin de l'animation du token.
- **Cliquer une ROUTE de la carte du monde** : le tracé SVG n'a de hit-test QUE sur son trait
  (`pointer-events: stroke`) — jamais la bbox, jamais son label (`pointer-events: none`). Un clic au
  centre du bbox (ce que fait `browser_click` sur l'élément) tombe hors du trait et est intercepté par
  la vignette de lieu dessous. Méthode canonique (#297) : `__wfrp.clickRoute('routeId')` fait le
  calcul ON-PATH en interne (`getPointAtLength`/`getScreenCTM`, MÊME technique que ci-dessous) et
  renvoie `{x,y}` ÉCRAN — appelable via `browser_evaluate` standard (plus besoin de
  `browser_run_code_unsafe`) ; puis un VRAI clic souris (`page.mouse.click(x,y)`) — jamais
  `browser_click` sur le sélecteur de la route. `clickRoute` sonde `elementFromPoint` au point
  calculé et, si un DÉCOR TRANSPARENT interpose (milieu du tracé tombant sur un élément sans
  `cursor:pointer` dans sa chaîne d'ancêtres), balaie d'autres fractions du tracé jusqu'à un point
  cliquable — le repli du recetteur est désormais INTÉGRÉ (`note` dit la fraction retenue). Repli
  manuel ultime (si `clickRoute` échoue, ex. carte hors écran) : calculer soi-même un point ON-PATH
  via `getPointAtLength` du `path` + `getScreenCTM()` (coordonnées écran réelles du trait) — requiert
  alors `browser_run_code_unsafe` (chargé via ToolSearch, ABSENT du set d'outils de démarrage).

- **Mode Pousser (bélier/engin de siège) au clavier — séquence exacte** (#199) : cliquer le slot
  « Pousser » de la barre d'action ouvre le mode-CASE (`battle.action === 'push'`) mais laisse ce
  BOUTON focalisé dans le DOM. `ArrowUp/Down/Left/Right` posent/déplacent `combatCursor` (le **1er
  appui pose le curseur sur la case de DÉPART elle-même**, coût 0 — `Pousser (0)` à l'aperçu, RIEN
  ne bouge encore ; il faut un **2e appui** pour quitter cette case et voir un coût > 0). `Entrée`/
  `NumpadEnter` commet (`commitCursor` → `pushCommitTile`) — fonctionne MÊME si le bouton « Pousser »
  garde le focus résiduel du clic souris qui a ouvert le mode (corrigé : `cursor-commit` n'a plus la
  garde `notWhenControlFocused`, `src/state/keybindings.ts`). `Échap` annule le curseur ;
  « Annuler dépl. » (post-commit, tant qu'aucune Action n'a été prise) défait aussi une poussée
  commise au clavier, comme au clic (`src/state/push-keyboard-commit.test.ts`).

- **Combat naval — l'arc de bordée d'une pièce montée (`weapon.mountSide`)** : `firedAttackBlock`
  refuse le tir avec `reason:'arc'` si la cible n'est pas dans l'arc du bord monté, calculé depuis le
  cap de la COQUE support (`shipOfCrew` → `get().facing[ship.id]`), pas celui du servant
  (`src/state/combatFlow.ts:331-341`). Tribord/babord pointent PERPENDICULAIREMENT au cap (rotation de
  2 crans de 45°, `arcDir8`/`mountedWeaponBears`, `src/state/shipPostes.ts:128-146`) : une cible dans
  l'axe proue-poupe est TOUJOURS hors arc tribord/babord, quelle que soit la distance. Diagnostic à
  l'écran : `aim('cible')` → `{invalid, reason:'arc'}` = géométrie, pas munition/portée ; re-vérifier
  après un `turnShip`/`maneuver` du navire.

- **Apostrophe TYPOGRAPHIQUE dans les libellés** (`’`, U+2019) ≠ apostrophe droite (`'`, U+0027) : un
  sélecteur Playwright écrit avec `'` (« Dormir jusqu'à l'aube ») NE MATCHE PAS le texte réellement
  rendu (l'UI utilise systématiquement `’`) — copier le libellé DEPUIS un snapshot/`__wfrp` plutôt que
  le retaper.
- **`button:has-text("Lancer")` matche aussi « Tout lancer »** (sous-chaîne) : un clic visant LE bouton
  « Lancer » peut résoudre le mauvais élément si « Tout lancer » est aussi à l'écran — utiliser
  `:text-is("Lancer")` (correspondance EXACTE) pour lever l'ambiguïté.
- **`__wfrp.routes()`** (symétrique d'`entities()`) : liste les routes CLIQUABLES de la carte du monde
  depuis le lieu courant (`{id, from, to, distanceLabel}`) — cible une route par son `id` pour
  `clickRoute(id)` quand plusieurs chips de distance affichés sont ambigus (même trajet, deux modes).
- **Combat naval — `aim('<coque>')` n'est (quasi) jamais une attaque directe** : une coque composite
  (`postes` non vide) est routée par `attackAffordance` vers « Servir »/« Renfort » (poste libre
  ADJACENT et acteur non déjà en poste) ou `none` — jamais vers un réticule d'attaque
  (`src/state/targetingModes.ts:236-241`, `serveTargetPoste`/`servablePostes`,
  `src/state/shipPostes.ts:339-361`). En pratique, un héros DÉJÀ posté (`mannedPoste` renseigné) tombe
  systématiquement sur `none` (`serveTargetPoste` refuse tant qu'on sert déjà une pièce) : la coque
  ennemie n'est donc pas une cible d'`aim()`, seuls ses membres d'équipage embarqués (`crewIds`) le
  sont. Dégâts à la coque = la Bordée, action du TOUR DE NAVIRE (mode `battery`, `batteryAffordance`,
  `src/state/targetingModes.ts:174-186`), un flux de ciblage SÉPARÉ de l'attaque personnelle.
- **Combat naval — `place('id',{x,y})` ne réinitialise PAS `battle.action`/l'arme choisie** (vérifié
  empiriquement sur `src/state/devtools.ts:390-414` : la fonction mute `pos` puis
  `useGame.setState({ battle: { ...b } })` sans toucher `action`/`selectedAttack`) — repositionner une
  coque/un servant PUIS re-choisir l'arme, ou l'inverse, donne le MÊME résultat avec ce helper de
  triche. Le mouvement RÉEL (clic-pour-se-déplacer, hors `place()`) remet lui `battle.action` à `null`
  (ex. `src/state/store.ts:1707`) — un réflexe distinct, à ne pas confondre avec la triche `place()`.
- **Combat naval — cibler un membre d'équipage d'une coque composite** : les sous-tokens SVG
  superposés d'un poste (chef + servants sur la même case) n'ont pas de bbox fiable au clic. Méthode
  fiable : le PORTRAIT du roster HUD (frise/dock, bas d'écran) route par `battleClickEntity` — MÊME
  ciblage que cliquer le pion sur la carte (`src/ui/CampaignView.tsx:142-166`, `onStripPortrait`/
  `onDockPortrait`) — puis ouvre la modale Attaque. La modale PRÉSÉLECTIONNE l'arme PERSONNELLE du
  servant, jamais l'arme de poste (`personalWeaponsOf` exclut explicitly l'arme du poste servi de
  l'auto-choix, `src/state/mount.ts:104-121`) : RE-sélectionner l'arme de poste dans le `<select>`
  « Arme » de la modale (`src/ui/jetProps/useAttackJetProps.tsx:171-184`) avant de lancer le jet.

## Collecteur d'erreurs de playtest (#304)

Les erreurs d'une soirée de playtest ne remontent que si le joueur les VOIT (console jamais
consultée hors recette) — `src/ui/errorCollector.ts` capture localement (**zéro réseau**)
`window.onerror` + `unhandledrejection` + les crashs de rendu interceptés par `SceneErrorBoundary`
(`componentDidCatch` appelle `recordError`, EN PLUS de `console.error` — comportement de la
boundary inchangé, y compris la reprise `onRetry`/rechargement). Buffer borné (50 entrées, FIFO) :
`{message, stack tronquée (2000 car.), scène courante, seed RNG, version (`package.json`), horodatage}`.

- **DEV** : bandeau discret en bas à droite (`src/ui/ErrorCollectorBanner.tsx`, chunk async chargé
  seulement si `import.meta.env.DEV`) — compteur d'erreurs, clic → panneau listant les entrées +
  bouton « Exporter » (JSON copié dans le presse-papier + téléchargé), prêt à coller dans une issue.
- **PROD** : le collecteur reste actif (mêmes capteurs), le bandeau est absent ; export via
  `window.__wfrp.errors()` (liste) / `window.__wfrp.exportErrors()` (JSON string) — même canal
  `window.__wfrp` que la recette, mais posé DEV **et** PROD par `installErrorCollector()`
  (`src/main.tsx`), contrairement au reste de `buildApi()` (`devtools.ts`, DEV uniquement).
- ⚠ **seed RNG non tracé actuellement** : `battleRng()`/`seedBattleRng` (`src/state/battleRng.ts`)
  n'exposent pas la graine numérique (RNG opaque) — le champ `seed` de chaque entrée est `null` tant
  qu'aucune session `state/store` n'instrumente ce point (hors périmètre #304, `src/ui/`).

## Piège du *closure-sync*

Lire le DOM dans le **même** `evaluate` que `talk()` lit l'état AVANT le re-rendu React —
séparer en deux appels (cf. `game-browser-verif-tempo`). Plus généralement : cliquer un bouton
qui change un état React PUIS agir dans le MÊME `evaluate` lit l'ANCIEN état (React n'a pas
re-rendu). Séparer en deux appels, ou utiliser un `ref` côté composant pour la logique de drag.
