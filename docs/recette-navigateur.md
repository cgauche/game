# Recette navigateur — vérifier une feature dans le jeu (Playwright MCP)

> Extrait verbatim du CLAUDE.md (dégraissage 2026-07-05). À lire au moment de valider une
> feature UI dans le navigateur.

**Vérification** : après une feature UI, valider dans le navigateur (Playwright MCP) — charger
`localhost:5173`, dérouler le flux, vérifier `console` (0 erreur) et screenshoter. Le menu
**« 🧪 Tests — scénarios »** ouvre un choix de scénarios de test (groupe fixé + scène adaptée,
combat direct) ; **passer par le scénario adapté, sinon en créer un** — un scénario = un fichier
dans `src/scenes/test-scenarios/` (cf. `docs/test-scenarios.md`).

## Preuve headless (agents)

> **Le socle `lib.mjs` est TOUJOURS la première option, avant tout `playwright-MCP`** — le profil
> Chrome partagé (piloté par `playwright-MCP`) peut être VERROUILLÉ par une autre session en cours
> (lock Chrome mort/vivant d'une autre recette) ; `lib.mjs` lance SON propre Chrome headless avec un
> profil temporaire dédié (`launchSession`), donc jamais ce conflit. N'invoquer `playwright-MCP` que
> si le besoin dépasse ce que `lib.mjs`/`shot-screen.mjs` couvrent (vécu diagnostic #506).
>
> **NUANCE mesurée (recette #1117, 2026-08-05)** : sur les CASCADES à re-render fréquent (une étape
> valide, la suivante se monte — le DOM change sous la main), `playwright-MCP` s'est montré PLUS
> FIABLE que le socle, dont les refs se périment entre deux gestes. La préférence `lib.mjs` reste la
> règle pour la capture et la console ; pour PILOTER une cascade pas à pas, `playwright-MCP` est
> l'outil qui tient — et le piège des refs périmées ci-dessous s'applique aux deux.

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

> **L'étalon se juge à 1600.** La largeur par DÉFAUT du kit est **1600×900** — la largeur à laquelle
> les maquettes sont DESSINÉES (`docs/plans/2026-07-14-maquettes-createur/*.html` : `.mock{width:1600px}`),
> donc la seule à laquelle une capture se compare à son étalon. Le défaut historique de 1280 a fait
> juger « étriqués » pendant deux jours des écrans qui rendaient juste à leur largeur de référence
> (lot « matières & proportions », #393). Une recette **responsive** passe sa largeur explicitement
> (`setViewport` avec la largeur voulue, `setMobileViewport` pour le mobile canon 360×740) — le
> défaut ne remplace pas la passe 900/700/560/360 de la charte, il fixe la largeur de RÉFÉRENCE.

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
| `clickButtonByText` | trouve un `<button>`/`[role="button"]` par son TEXTE (`session, texte, {exact?}`), `scrollIntoView`, PUIS lit son rect et clique via un VRAI clic CDP (`Input.dispatchMouseEvent` pressed+released) — SCROLL-AWARE : lire le rect AVANT le scroll fait rater le clic SILENCIEUSEMENT (aucune erreur, aucun effet) |
| `realKey` | frappe RÉELLE (`session, key`, `Input.dispatchKeyEvent` : `rawKeyDown`/`char`/`keyUp`) — traverse les MÊMES handlers que le clavier physique (`keybindings.ts`), contrairement à un `KeyboardEvent` JS synthétique souvent ignoré |
| `evaluate` / `waitFor` | eval JS dans la page (attend les promesses) / poll jusqu'à condition vraie |
| `checkServer` / `launchSession` | briques bas niveau d'`openApp` (séparément utilisables) — `launchSession` porte le défaut **1600×900** (§ « L'étalon se juge à 1600 » ci-dessus) |

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

**Cliquer le VRAI bouton « Lancer » fait lire un `roll` NULL le temps du roulis** : le clic déclenche
`useRollFrisson.trigger` (`src/ui/useRollFrisson.ts`) qui attend le tumble (**750 ms**, `TUMBLE_MS`)
AVANT d'exécuter le résolveur réel et de committer le jet au store — lire l'état (`pendingTest.roll`,
`__wfrp.modal()`…) tout de suite après un `Input.dispatchMouseEvent` sur « Lancer » lit donc encore
`roll: null`. Deux parades : attendre le roulis (`waitFor`, ~800 ms) avant de lire, OU `freezeTimeout`
(exemple ci-dessus) AVANT le clic — `setTimeout` patché à 0 ms collapse le tumble ET l'atterrissage
(`LAND_MS`), le résolveur s'exécute quasi immédiatement. **`__wfrp.roll()` n'a PAS ce piège** : il
appelle l'action du store DIRECTEMENT (`devDriveModal`, `src/state/devtools.ts`), sans passer par le
bouton ni l'animation — réservé au SETUP/observation (doctrine ci-dessous), jamais pour valider le
flux visuel que le joueur vit.

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

> **Touches du déplacement en EXPLORATION** (piège de recette : les flèches paraissent mortes hors combat).
> Le pas du groupe est sur les codes physiques `KeyW`/`KeyA`/`KeyS`/`KeyD` (bindings `explore-*` de
> `src/state/keybindings.ts` — WASD sur clavier QWERTY, ZQSD sur AZERTY : `code` = position, pas lettre).
> Les **flèches** (`ArrowUp`…) pilotent le SEUL curseur de combat (bindings `cursor-*`). En vue subjective
> (`povActive`), les mêmes touches deviennent cap-relatives (bindings `pov-*`).
> La case d'arrivée n'est PAS un delta de grille fixe : `stepPartyDir` → `exploreStepDest`
> (`src/state/exploreNav.ts`) retient la voisine CONNECTÉE dont le centre est le mieux aligné avec la
> direction ÉCRAN poussée (`screenStepDot`, `src/state/combatCursor.ts`) — le delta `x`/`y` dépend donc de
> la rotation caméra et de la vue. Vérifier le déplacement par la position lue (`__wfrp.state()`), jamais
> par un delta attendu en dur.

> **Mouvement EN COMBAT au clavier** (piège de recette, mesuré 2026-08-04) : pousser le curseur
> au-delà de l'allonge de Mouvement normal du combattant n'échoue pas silencieusement — la validation
> ouvre la modale de **Course** (Test d'Athlétisme +20). Une recette qui « appuie N fois sur la flèche
> puis Entrée » pour un simple pas peut donc déclencher un JET inattendu (et perdre son état si elle
> l'annule mal). Viser une case DANS l'allonge, ou vérifier `__wfrp.modal()` avant de valider.

## Outillage `__wfrp` (SOURCE UNIQUE du harnais, DEV uniquement, `src/state/devtools.ts`)

Pour piloter le jeu depuis Playwright **sans chasser les coordonnées pixel des tokens**, via
`browser_evaluate`. Cette section liste **TOUS** les helpers de `buildApi()` — un ajout/retrait
côté `devtools.ts` se répercute ICI (source unique, jamais une 2ᵉ liste partielle ailleurs).

### Scène / navigation

| Helper | Usage | Limites connues |
|---|---|---|
| `state()` | instantané `{screen, sceneId, partyPos, inDialogue, inCombat, party, money…}` | lecture seule ; `party` est une PROJECTION allégée (`{id, name}` seulement, `devtools.ts`) — ni `.skills` ni `.activeEffects` ; pour inspecter le détail d'un héros, lire `store.getState().party` |
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

**Flux HORS convention `<flux>Roll/Confirm/Cancel`** (`devDriveModal`/`roll()`/`confirm()`/`cancel()` ne
les couvrent PAS — cliquer les VRAIS boutons) : `pendingCorruption` (Exposition/Seuil de Corruption,
LDB 19) se résout par l'action `resolveCorruption` — bouton **« Continuer »** de la modale
(`src/ui/CorruptionModal.tsx`), jamais `corruptionConfirm` (n'existe pas) ; `pendingCascade` se
résout par `cascadeResolveAll` (bouton **« Tout lancer »**, résout d'un coup le reste sans influence)
puis `cascadeFinish` (bouton **« Terminer »** du bilan) — `cascadeRoll`/`cascadeNext` avancent étape
par étape (bouton « Continuer »/« Terminer » de la dernière étape), cf. `src/ui/CascadeModal.tsx`.

**`pendingTest` seul ne rend RIEN à l'écran** : c'est un slot d'état pur (`store.ts`), consommé en
LECTURE par `useTestJetProps` (`src/ui/jetProps/useTestJetProps.tsx`) — dont `CascadeModal.tsx` est
l'UNIQUE point de montage qui l'appelle. Poser `pendingTest` à la main (`store.setState`) sans que
`CascadeModal` soit monté ne produit donc aucune modale visible (piège du dernier recours de la
doctrine ci-dessus). Raccourci de démo LÉGITIME pour l'armer EN COMBAT (passe par une vraie action du
store, pas un `setState` forgé) : `__wfrp.store.getState().battleGainAdvantage(skillId)`
(`src/state/combatSlice.ts`) — ouvre le `pendingTest` « Avantage — <compétence> » (LDB 09 l.305-308),
à condition que `skillId` soit une Compétence que le combattant actif POSSÈDE (`hero.skills`) et dont
la donnée porte `combatAdvantage` (`SkillData`, ex. `intuition`) ; sinon l'action ne fait rien
(silencieux, cf. gate `skillAdvantageCap`).

**Lancer un sort à cible « Vous »** : une fois focalisé (ou prêt à incanter directement), le
LANCEMENT ne passe PAS par le bouton « Focaliser (X/CN) » — celui-ci (`battleFocusSpell`) ne fait
QUE (re)poser/empiler de la Focalisation, il ne lance jamais le sort. Le lancement effectif passe
par un clic sur le **TOKEN DU LANCEUR lui-même** sur la carte (`castClickCommit`,
`src/state/targetingModes.ts` — le clic-combattant en mode `cast` vise l'allié/ennemi/SOI selon le
token cliqué). Défaut d'affordance joueur ticketé par ailleurs — cette section décrit l'état ACTUEL,
pas la cible d'UX.

### Combat — triche de mise en place

| Helper | Usage | Limites connues |
|---|---|---|
| `spawn(creatureId, pos?, {side?, id?}?)` | instancie une créature du REGISTRE (`creatures.json`) directement EN COMBAT — VRAI pipeline `creatureToCombatant` (`src/state/spawn.ts`, MÊME dérivation que `spawnEnemy`), sans rencontre de scène. `spawn('gobelin')` / `spawn('gobelin', {x:12,y:8}, {side:'hero'})` | `pos` défaut : à côté du combattant ACTIF (sinon 1er combattant positionné) ; `opts.side` (`'enemy'` défaut / `'hero'` / `'npc'`) pose `kind` après coup — `'hero'` marque aussi `aiControlled` (allié PNJ piloté par l'IA, jamais un 5ᵉ héros manuel) ; `creatureId` inconnu → `✗` |
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
| `disease(heroId, maladieId, { phase? })` | contracte une maladie via le VRAI cycle (`contractDisease` + `tickDisease` de l'incubation) ; `phase:'active'` la déclare en avançant son horloge — jamais un état forgé (localisation de cloque, transitions, `infectedMinutes` réels) | `maladieId` inconnu → `✗` ; défaut = phase d'incubation. Ex. `disease('hero-1','crampes-abdominales')` n'existe pas (crampes = SYMPTÔME) → passer par la maladie porteuse (`colique`, `vers-de-carie`, `vers-du-reik`) |
| `bladeTrap(defenderId, attackerId, defSL?)` | ouvre l'étape « Piège-lame » sans forcer un Critique défensif | assigne un `uid` factice à l'arme de l'attaquant si absent |
| `focus('id', spell?, dr?)` | met un combattant en Focalisation (test d'interruption au coup suivant) | c'est aussi le raccourci LÉGITIME de SETUP pour poser un DR de Focalisation ARBITRAIRE sur un sort à CN élevé et sauter le grind multi-Rounds du bouton « Focaliser » (ci-dessous) — pas seulement l'éprouve d'interruption |
| `fear(heroId, enemyId, indice?)` | pose une Peur + simule l'approche de la source | positions requises (`✗` sinon) |
| `talent('id', talentId, opts?)` | octroie un Talent à un combattant — `opts` = `times` (nombre, défaut 1) OU `{ spec?, times? }` pour un talent `specsSource` (ex. `talent('hero-1','magie-du-chaos',{spec:'tzeentch'})` — la spec posée EST l'id lu par `chaosDomainOf`, `engine/combatFeatures/dispatch.ts`) | sans `spec`, un talent `specsSource` reste sans mécanique lisible |

### Groupe / campagne / règles

| Helper | Usage | Limites connues |
|---|---|---|
| `give(gold=10)` / `xp(amount=100)` | crédite la bourse / +PX au groupe | — |
| `giveTrapping(heroId, trappingId, qty?)` | donne un objet de CATALOGUE à un héros (défaut : le 1er), par le VRAI pipeline `giveTrapping` du store (`applyEffects` → `itemFromGive` : item bien formé, qualités du catalogue, rangement/Encombrement recalculés) | `trappingId` inconnu → message `✗` ; `qty` fixe la quantité de l'instance (ex. `giveTrapping('hero-1','boulet-et-poudre',6)` charge le coffre d'un canon) — ⚠ munitions ≠ rations (achat au marchand : la munition d'artillerie/à distance est un article SÉPARÉ des vivres, jamais suggéré à la place) |
| `flags()` / `flag('id', value=true)` | lit/force un drapeau de scénario | — |
| `setMorale(n)` | pose directement `vessel.morale.score` (setup, MÊME patron que `flag()`) | pas le pipeline hebdomadaire (`recalcMorale`) — sert à rendre la désertion à quai (bande ≤75, `moraleBand(score).desertionRoll`) observable sans dérouler des semaines de facteurs ; `✗` sans `state.vessel` |
| `gmSeat(bool?)` | flip du siège MJ SOLO (`setGmSeat`, siège 0) — sans argument : BASCULE | ⚠ **`scenario()` ne RÉINITIALISE PAS le siège MJ** (mesuré #1028 : `net.gmSeat` survit à `setParty`/`startScene`/`loadProject` — seuls `setGmSeat` et la fermeture d'un siège `netSeatClosed` y touchent) : appeler `gmSeat(false)` EXPLICITEMENT entre deux scénarios, sinon le 2ᵉ hérite du siège MJ (ennemis conduits à la main, jets surfacés qu'on croyait auto). La VALIDATION du flux MJ reste la checkbox RÉELLE de l'UI (§ Pièges vécus ci-dessous), ce helper économise seulement la mise en place |
| `time(minutes=60)` / `rest(days=1)` | avance l'horloge / dort N jours par le chemin EAGER | ⚠ **`rest()` n'ouvre AUCUNE modale de nuit** : il route `restParty` → `restFlow.sleepParty`, qui résout la nuit ENTIÈRE d'un coup (triche d'avancement). Le VRAI chemin joueur — la cascade influençable, une étape à la fois — est le bouton « Dormir » de l'auberge/du camp (`restSleep` → `openRestNight` → `pendingRest`) : pour recetter un jet de nuit (Faim, Récupération, Exposition, maladie…), passer par CE bouton, jamais par `rest()`. ⚠ **NE PILOTE PAS non plus une traversée EN MER** : découplé de `travelPlan.sea` (`state/seaVoyageFlow.ts`), il avance l'horloge SANS faire progresser le navire sur sa route (désynchronise `gameTime` du voyage). Pour accélérer une traversée COMMANDÉE, voir « Voyage en mer » ci-dessous |
| `chantier('reparer'\|'carener'\|upgradeId, units?)` | services du chantier naval au port | hors combat, navire de campagne requis |
| `massBattle(ally?, enemy?, rounds?)` | lance une bataille de masse de démo | la scène courante doit porter les rencontres attendues |
| `scenario(id?, seed?)` | lance un scénario de test PRÊT À JOUER ; sans argument : liste les ids | Round 1 déjà acquitté, initiative déterministe SI `seed` |
| `campaign(id?, seed?, sceneId?)` | charge une CAMPAGNE BUILT-IN (`builtinCampaigns`, `scenes/campaign.ts`) SANS dérouler le character creator ×4 à la main — groupe canonique (`makeShowcaseParty`), MÊME chemin que le picker `PartyScreen` (`setPendingCampaign` + `loadProject`) ; sans argument : liste les ids | les campagnes built-in ne portent PAS de pré-tirés propres (seul `pregens.json`, libre-service au picker) → groupe canonique (les 4 piliers de l'Arène), pas le casting narratif de la campagne ; `sceneId` (optionnel) démarre ailleurs que l'entrée par défaut ; `pendingCampaign` redevient `null` juste après (comme le flux réel : `loadProject`→`startScene` réinitialise l'état à l'INITIAL hors le sous-ensemble préservé, `store.ts`) — pas une régression |
| `interlude(weeks=3)` | arme un INTERLUDE de démo jouable (`startInterlude` — MÊME flux réel : `state.interlude` peuplé, Événement d100/héros, budget `min(3, weeks)`, écran 'interlude') SANS voyager jusqu'à Altdorf | catalogue d'Activités dérivé de la DONNÉE (`interludeCatalog`/`activities.json`), rien d'inventé ; sans groupe chargé, pose le groupe canonique (`makeShowcaseParty`, comme `campaign()`) ; `✗` si combat en cours ; interlude déjà ouvert → message sans réarmer ; à conduire ensuite à la main (Activités, clôture) — pas `screen('interlude')` seul (écran vide) |
| `rules(id?, value?)` | lit/force une règle optionnelle (`policy.ts`) | override runtime NON persisté ; `rules(id, null)` réinitialise ; la CADENCE n'y est plus (préférence de confort, cf. `prefs()`) — les règles sont VERROUILLÉES tant qu'un combat est en cours (`houseRulesMutability`), l'écriture est alors refusée en silence |
| `prefs(id?, value?)` | lit/force une PRÉFÉRENCE de confort (`state/preferences.ts`) — dont `prefs('combat-cadence', 'auto')` (auto/rapide/manuel) | écriture PERSISTÉE (localStorage) + effet déclaré joué (reprise de boucle) ; `prefs(id, null)` réinitialise ; modifiable EN COMBAT, contrairement aux règles |
| `seed(n)` | re-ensemence le RNG de bataille EN COURS de combat | même action que `scenario(id, seed)` au lancement |
| `previewRoll(seed, count=1)` | lecture PURE des `count` premiers d100 d'un seed — `makeRNG(seed)` À PART, ZÉRO mutation d'état (jamais le `battleRng` du store) | fidèle au PROCHAIN jet réel du store UNIQUEMENT depuis un `seed(n)`/`scenario(id, seed)` FRAIS, avant toute autre consommation — `battleRng` est PARTAGÉ (initiative/dégâts/IA s'intercalent, désynchronisent la prédiction) ; deux previews du même seed renvoient TOUJOURS la même séquence |
| `fastForward(maxIters=400)` | avance les tours IA jusqu'au prochain tour PILOTÉ HUMAIN (ou fin de combat), MÊME machinerie que la partie réelle, juste sans les délais du Réalisateur | `maxIters` = garde-fou anti-boucle (scrutations, pas des tours) — `✗ borne atteinte…` = soft-lock probable, à diagnostiquer via `auto()` ; retourne une `Promise` (`await`) |
| `fillCreatorDefaults(uptoStep?)` ⚠ résout INTÉGRALEMENT chaque étape traversée — pour observer un état « non soldé », viser l'étape N−1 puis dérouler le dernier cran à la main. ⚠ `browser_take_screenshot` écrit au cwd du process Playwright (racine du repo) même avec un filename relatif : déplacer chaque capture vers le scratchpad JUSTE après la prise, jamais en fin de recette | remplit le brouillon du CRÉATEUR de personnage OUVERT avec des défauts VALIDES (`fillDraftDefaults`, `ui/creator/creatorDefaults.ts`) jusqu'à `uptoStep` incluse (défaut : dernière étape), puis avance l'étape affichée | SETUP UNIQUEMENT (couture `window.__wfrpCreator`, requiert `CharacterCreator` monté sinon `✗ créateur non monté`) — sert à SAUTER jusqu'à une étape sans dérouler tirages/choix un par un ; le flux joueur réel (tirages, choix, allocations) reste testé aux clics, jamais via ce raccourci |

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
| `advanceSeaDay({stopOnEveryEvent?, stopAt?, maxIters?})` | symétrique VOYAGE de `fastForward` : pilote la journée EN COURS (cascade du jour, halte de nuit, Activités hebdo si le palier de 8 jours tombe) jusqu'au JOUR SUIVANT — MÊME machinerie que le joueur (`cascadeResolveAll`/`Finish`, `restSleep`, `seaActivitiesConfirm`), sans les clics | s'arrête sur la cascade `travelDay` FRAÎCHE du jour suivant (déjà ouverte, `cursor:0`, pas encore consommée — le PROCHAIN `advanceSeaDay()`/`roll()`/`skipToArrival()` la joue), jamais un `pendingCascade` à `null` ; `maxIters` (défaut 400) = garde-fou scrutations, `✗ borne atteinte…` = soft-lock probable (`auto()`) ; retourne une `Promise` (`await`). **PORTÉE EXACTE de `stopOnEveryEvent:true` (#380)** : il ne s'arrête QUE sur un événement RACONTÉ (carte-parchemin, `travelDay.events` non vide, testé sur `pendingRest`/`pendingSeaActivities`) — **jamais** sur une étape STRUCTURELLE du jour (Progression, choix de Progression, Orientation, Exposition, Entretien…), que `cascadeResolveAll` traverse aux défauts. L'attendre pour observer une étape a coûté un point de recette. Pour CELA : `stopAt:'<kind>'` (#1117) → s'arrête **avant** de résoudre la cascade qui porte cette étape et rend la main intacte (ex. `advanceSeaDay({stopAt:'sea-progression-choice'})`, puis `__wfrp.modal()`/`roll()`). Même option sur `advanceRiverDay` |
| `skipToArrival(maxIters=4000)` | comme `advanceSeaDay` mais ROULE jusqu'à l'ACCOSTAGE (`openPortAt`, `travelPlan` vidé) | s'arrête aussi sur un combat (embuscade/abordage) — `battle` alors ouvert, à jouer/`fastForward` séparément ; `Promise` (`await`) |
| `dealShipDamage(n=5)` | inflige `n` Dégâts de coque HORS COMBAT — VRAI pipeline (`damageVesselHull` si un voyage est en cours sur le navire de campagne, sinon `setVesselHull` directement au port) | symétrique de `dealDamage` (combat) — voir le piège des DEUX copies de coque ci-dessous ; **NE déclenche PAS un naufrage fiable** (voir piège d'ORDONNANCEMENT ci-dessous, `forceShipwreck`) |
| `forceShipwreck(aboardIds?)` | déclenche `beginShipwreck` DIRECTEMENT (setup ASSUMÉ, PAS le pipeline de dégâts) — coque + cargaison purgées IMMÉDIATEMENT, cascade de survie à la nage (Chance/Pacte/Résilience influençable) ouverte pour les héros à bord | `✗` sans `state.vessel` ; voir piège d'ORDONNANCEMENT ci-dessous |
| `clickRoute(routeId)` | calcule un point ON-PATH CLIQUABLE d'une route depuis ici → `{x,y}` ÉCRAN. SONDE `elementFromPoint` au milieu du tracé et, si un décor transparent l'intercepte (chaîne d'ancêtres sans `cursor:pointer`), balaie d'autres fractions de `getPointAtLength` jusqu'à un point cliquable (repli INTÉGRÉ) | ne clique PAS lui-même (le VRAI clic reste `page.mouse.click(x,y)`, Playwright) — remplace le calcul manuel `browser_run_code_unsafe`, voir piège ci-dessous ; `note` indique la fraction retenue (ou qu'aucune n'a testé cliquable → milieu par défaut) ; `✗` si route inconnue/non cliquable d'ici/tracé absent du DOM |
| `forceEncounter(id='navire-hostile')` | force un événement de bord maritime NOMMÉ (`sea-events.json`, id ou kind) au PROCHAIN jour — court-circuite le timer 1d10 + le tirage d100/Manann | à dérouler avec `advanceSeaDay()` : le drive s'ARRÊTE sur la décision présentée (Cogue pirate fuir/combattre/soumettre) sans la trancher — voir doctrine ci-dessous ; `✗` si aucune traversée en cours / événement introuvable |

**Observer le PROCÈS-VERBAL groupé du jour (`MultiRollList`, une bande par rubrique + son enjeu)** —
le PV se lit à `SeaVoyageScreen` (`.sea-voyage-log`) et à `TravelRecapModal`, alimenté par
`travelDay.entries` (une ligne par contributeur, `group` = le libellé de l'étape). Il n'existe qu'une
fois le jour RÉSOLU en route **commandée** (les Tests d'équipage de routine s'auto-résolvent —
`voyageCadence.ts`) : `await __wfrp.advanceSeaDay()` puis lire l'écran de traversée. Pour jouer une
étape d'équipage À LA MAIN avant qu'elle n'entre au PV, s'arrêter dessus par son `kind` — les kinds
RÉELS passés à `buildVoyageCrewStep` (`seaVoyageFlow.ts`, 3ᵉ argument — à ne pas confondre avec le
`testTypeId` du 2ᵉ) sont `progression`, `orientation`, `embuscade`, `phare`, et en crise `poursuite`
ou `tourbillon` :

```js
await __wfrp.advanceSeaDay({ stopAt: 'orientation' });  // rend la main AVANT le Test d'Orientation
__wfrp.modal();                                          // la modale de cascade est intacte
```

`stopAt:'sea-progression-choice'` vise le CHOIX de progression (une étape de décision), pas un Test
d'équipage : pour le Test lui-même, viser `progression`.

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

## Maladies réactives — trigger `onOwnTestFailed` (Crampes abdominales, MSRC 16)

Les Crampes abdominales (symptôme de `colique` / des Vers) réagissent à **tout Test RATÉ du porteur** :
DR ≤ −2 → *Sonné* ; DR ≤ −4 → Test de **Force Mentale** (palier 2) ou *À Terre* ; DR ≤ −6 → *Inconscient*
(cumulatifs, « ou pire »). Pour recetter : `__wfrp.disease('hero-1','colique',{phase:'active'})` puis faire
échouer un Test (Activité d'interlude, attaque, Parade/Esquive, Test de scène…).

**Cadence-aware** : le sous-Test de FM du palier 2 d'un **HÉROS** s'ouvre en **modale de jet** (cascade en
combat, `pendingTest` de scène en interlude) — pilotable Chance/Résilience, jamais inline ; un **PNJ/auto**
le résout inline. Garde de ré-entrance : ce FM ne ré-émet jamais le trigger (`noOwnTestFailed`).

**Points d'émission de `onOwnTestFailed`** (pour ne pas chercher à l'aveugle) :
- `store.resolveTest` — Test de scène/compétence/combat (chemin modal joueur) ;
- `interludeFlow.confirmActivity` — Activité d'interlude ratée ;
- `combatFlow.applyAttackResult` — l'**ATTAQUANT** rate son jet d'attaque (CC/CT) **et** le **DÉFENSEUR**
  rate sa Parade/Esquive (Test opposé) — le porteur uniquement, pas la défense d'un non-porteur ;
- `triggeredEffects.resolveInlineFlowTest` + `combat/triggeredTest` (inline ennemi/auto) ;
- `cascade.commitStep` (seam CENTRAL des Tests différés d'entretien : `faim`/`recovery`/`diseaseTick`/… ).

**Cadence observée en recette** : après *Lancer*, compter **~2,5 s** avant que *Appliquer* soit stable
(résolution de la défense adverse + animation d'attaque) — attendre cette tempo avant de lire le résultat.
Cette cadence n'est PAS spécifique au combat : **toute résolution de dés animée** (`RollShell` et ses
modales — Test de scène, Activité d'interlude, jet composite…) tourne sur la même animation de dés ;
attendre ~2,5 s après *Lancer* avant de capturer/lire l'état de N'IMPORTE QUELLE modale de jet
(cf. `game-browser-verif-tempo`, closure-sync ci-dessous).

## Pièges vécus (corrections d'expérience)

- **Occlusion de la carte du monde sur le panneau latéral** (vécu 2026-08-05, recette 3) : sous 901px
  de large, la mise en page EMPILE carte et panneau ; `.map-canvas-frame` porte un `aspect-ratio` et
  débordait de sa cellule, son SVG recouvrant les commandes du panneau (« Rythme normal / Forcer +1 M »
  injoignables — `elementFromPoint` résolvait sur un `path`/`rect` du canevas). Corrigé #1117
  (`.worldmap-canvas` borne son contenu). **La recette précédente avait RÉUSSI le même clic** : elle
  tournait au-dessus de 901px, où les deux colonnes séparent les surfaces — d'où deux verdicts opposés
  sur le même bouton. RÈGLE : un clic qui échoue se DIAGNOSTIQUE d'abord à `document.elementFromPoint`
  (centre + 4 coins), et la LARGEUR de fenêtre se note au rapport — un test de clic sans viewport
  déclaré n'est pas reproductible.
- **`forceRiverCapsize` arme ET reconstruit la journée** (#1117) : le clic « Partir » construit les
  étapes du jour de façon SYNCHRONE — armer le vent après coup ne changeait rien (2 essais sur 3
  perdus en recette 4). Le helper reconstruit désormais la cascade du jour en cours ; `__wfrp.riverDayCascade()`
  la (re)pose seule et rend ses étapes, pour ne pas rejouer achat/carte/départ à chaque essai.
- **Zoom de la carte, panneau de route OUVERT — DÉFAUT OUVERT (#1117)** : à ~850×900, panneau ouvert,
  `elementFromPoint` au centre et aux 4 coins de « Zoomer » rend `ASIDE.worldmap-side`. Deux pistes ont
  été éliminées par la mesure : l'ordre d'empilement (le cadre carte isole déjà, `.wm-zoom` porte son
  `z-index`) et le `sticky` de l'aside (la primitive `.layout-sidebar` le remet en `static` ≤900px —
  `base.css`, garde `WorldMapView.test.tsx`). La cause restante est GÉOMÉTRIQUE et se mesure au
  navigateur, pas au CSS : relever `getBoundingClientRect()` de `.worldmap-canvas`,
  `.map-canvas-frame`, `.wm-zoom` et de l'aside, plus leur `position`/`transform`/`margin` calculés,
  et joindre les 4 rectangles au rapport. Sans ces rectangles, tout nouveau correctif est un pari.
  L'`aside` ne s'ouvre qu'avec une route SÉLECTIONNÉE : recetter aussi à ~360px.
- **Toutes les routes de barge ne sont PAS une descente JOUÉE** (#1117) : la cascade jour-par-jour
  fluviale exige QUATRE conditions (`travelFlow.startTravel` → `buildRiverPlan`) — la route porte
  `river: true`, le mode choisi est une EMBARCATION, une coque existe, et le groupe compte un
  batelier (`hasBatelier` : Voile ou Ramer avancé). L'une manque ⇒ repli sur le transport payant
  (« on paie un passeur »), résolu en NARRATION, sans aucune cascade ni jet. Dans le scénario
  « Commerce fluvial », une seule route la porte : **`r-grunburg-altdorf` (Grünburg → Altdorf,
  45 km)** ; les maillons courts de 30 km de la chaîne du Reik n'ont pas `river: true` et se
  résolvent donc en narration. Recetter la navigation fluviale sur CE trajet, jamais sur un maillon.
- **L'interactivité des étapes du jour dépend du MODE de traversée** (#1117) : seul « Jour par jour »
  monte les étapes de `travelDay` en modale ; en traversée rapide elles se résolvent sans surface.
  Une recette qui ne voit « aucune modale » doit d'abord vérifier le mode choisi au départ.
- **Scénario « Voyage maritime » : la traversée démarre en Violente tempête persistante** (recette 3) —
  `kmDone` reste figé tant qu'elle dure (voiles affalées), donc ni progression ni survitesse à observer.
  Armer d'abord un vent calme (`__wfrp.forceSeaWeather({ vent: 'calme-plat' })` puis le cran voulu, ou
  dérouler les jours jusqu'à la levée du verrou météo) AVANT de recetter la Progression, la survitesse
  ou l'Orientation. Sans ça, le rapport conclut « rien ne bouge » sur un état de mer parfaitement RAW.
- **Le « Lancer » d'une cascade n'est pas celui de la rangée** (même recette) : quand une seule rangée
  est lançable, `RollShell` HISSE le bouton dans sa barre d'actions et lance lui-même. Un fix posé sur
  le CTA de rangée peut donc être vert en test et mort à l'écran. Viser le bouton de la BARRE
  (`.modal-actions`) pour recetter une cascade, et se souvenir qu'un même verbe peut avoir deux hôtes.

- **« Tout lancer » n'est PAS « Lancer »** (vécu 2026-08-05, a coûté la moitié d'une recette) : dans
  une cascade, la barre porte « Lancer » (la ligne COURANTE, influençable) et « Tout lancer » (TOUTE
  la séquence restante, résolue d'un coup, SANS aucune modale ni influence). Cliquer le second par
  réflexe brûle la scène qu'on venait recetter — et rien ne le rejoue. Depuis #1117 les deux ne se
  ressemblent plus (`all`/`rollAll` sont des rôles SECONDAIRES dans `RollShell`, le primaire reste le
  jet de la ligne) ; en recette, viser le bouton par son NOM accessible exact (« Lancer »),
  jamais par sa position.
- **Un champ « Fixer le dé » par LIGNE** (même recette) : chaque rangée offre le sien. Ils portaient
  le même nom accessible → le geste (clavier comme automate) visait au hasard et la frappe partait
  ailleurs, le jet tombant en aléatoire. Le nom accessible porte désormais sa ligne
  (« Fixer le dé — Voile ») : le cibler ainsi, et vérifier la valeur du champ AVANT d'appuyer Entrée.
- **Popover Codex resté ouvert par-dessus le CTA** (même recette, vécu 3 fois) : un popover de chip
  affiché (survol/focus) recouvrait « Continuer » et interceptait le clic ; Échap semblait inopérant
  (il refermait puis le re-focus le rouvrait aussitôt). Corrigé #1117 — si le symptôme revient :
  Échap, puis cliquer une zone neutre, et le SIGNALER (c'est une régression, pas une fatalité).

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
  scénario) — la VALIDATION du flux reste la checkbox RÉELLE. ⚠ Le siège **PERSISTE d'un `scenario()`
  au suivant** (mesuré #1028) : le lancement ne touche pas `net.gmSeat`. Le remettre à zéro à la main
  (`gmSeat(false)`) avant toute recette qui suppose le mode solo — sinon les ennemis restent conduits
  par le MJ et leurs jets s'ouvrent en fenêtre au lieu d'être roulés par l'IA.
- **L'IA ne joue pas l'action qu'on attend** (mesuré #1042) : sur `turn()`, un ennemi lanceur peut
  très bien attaquer au lieu d'incanter — sa décision suit sa situation tactique, pas le besoin du
  recetteur. Attendre une incantation ennemie en relançant des tours est un puits de temps. Pour la
  déclencher de façon DÉTERMINISTE : `gmSeat(true)` puis jouer l'incantation AUX CLICS (l'ennemi
  devient conduit à la main) — et `gmSeat(false)` une fois la fenêtre observée.
- **Champ CONTRÔLÉ React : `evaluate()` + `.value = …` est SANS EFFET** (vécu #1028, ~8 appels
  perdus) : poser la valeur d'un `<input>` contrôlé depuis `browser_evaluate` écrit dans le DOM sans
  déclencher le handler React — l'état ne bouge pas, le champ se ré-affiche à sa valeur d'avant, et
  le jet part avec un VRAI d100 alors qu'on croyait l'avoir fixé (« Fixer le dé » `ForcedRollPicker`,
  et tout formulaire de l'éditeur/du créateur). Utiliser la SAISIE RÉELLE (`browser_type` / `.fill()`
  Playwright), qui émet les événements que React écoute. Contrôle : relire le champ APRÈS la frappe
  (re-snapshot) — s'il est revenu à l'ancienne valeur, rien n'a été posé.
- **Calibrer une issue déterministe d'opposition (« Dissipé ! », « Résiste ! »)** : fixer le dé du
  RÉPONDANT ne suffit pas — une opposition compare deux DR, donc il faut AUSSI fixer le jet du
  LANCEUR à un DR faible (dé haut, sous sa cible). Sinon l'incantation peut être hors de portée du
  contre-lanceur (DR lanceur > DR max atteignable) et le « Dissipé ! » reste inaccessible quel que
  soit le dé du répondant. Ordre pratique : fixer le dé du lanceur AVANT de lancer, puis celui du
  répondant dans sa rangée.
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
  (fichier non gitignoré → poison potentiel pour un commit/deploy). Les SEULES racines autorisées en
  écriture par l'outil sont la RACINE du repo et `.playwright-mcp\` du repo (`%TEMP%` reste rejeté,
  « outside allowed roots ») ; une capture SANS chemin explicite atterrit donc à la RACINE du repo.
  NE PAS présumer : vérifier où atterrit la 1ʳᵉ capture, et si c'est hors `.playwright-mcp/`, la
  DÉPLACER hors du repo IMMÉDIATEMENT — l'arbre git est PARTAGÉ (d'autres sessions y écrivent).
- **« Browser already in use » / « Target page… has been closed » PERSISTANT (2026-07-16)** : si
  l'erreur revient après 2 tentatives, ce n'est PAS une contention active mais un lock Chrome MORT
  (reliquat d'une session Playwright jamais fermée proprement, pipe `--remote-debugging-pipe`
  orphelin) — signature : les PID `chrome.exe` du profil concerné restent FIGÉS (zéro churn) entre
  deux vérifications. Récupération : identifier UNIQUEMENT les processus du profil dédié
  `ms-playwright-mcp\<id>` par leur ligne de commande (ex. `Get-CimInstance Win32_Process -Filter
  "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*ms-playwright-mcp*' }`), puis
  `Stop-Process` sur CES PID uniquement — JAMAIS un kill global par nom d'image (`chrome.exe`
  seul) : d'autres Chrome tournent sur la machine, dont celui de l'utilisateur.
- **Jamais de `dispatchEvent`/`MouseEvent` synthétique** pour cliquer un token/bouton — provoque de
  FAUSSES erreurs `setPointerCapture` (l'élément n'a jamais reçu de vrai pointeur). Utiliser les
  VRAIS clics Playwright (`browser_click`, sélecteur `data-cid`/rôle/texte).
- **Passer des tours** : `turn('id')` (triche, donne le tour) ou `fastForward()` (avance l'IA) —
  jamais de manipulation manuelle de `battle.round`/`battle.turn`/`battle.order` via `store`.
- **Ordre canonique en combat piloté : DRAINER toute modale AVANT `turn('id')`** — `turn()` réinitialise
  `battle.acted:false` pour le NOUVEL actif, mais une résolution en vol d'une modale déjà ouverte
  (`pendingDefense`, cascade d'attaque…) écrit son résultat en fusionnant sur le `battle` COURANT
  (`{...battle, acted: true, …}`, ex. `src/state/combatSlice.ts`/`combatFlow.ts`), donc APRÈS le
  `turn()`. Résultat : `battle.acted=true` fantôme posé sur le combattant qui vient de recevoir le
  tour, qui bloque silencieusement son Action sans message d'erreur. Vider `modal()`/`pendingDefense`/
  `pendingCascade`/tout `pending*` (`roll()`/`confirm()`/vrais boutons) AVANT tout `turn('id')`.
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
- **Roster du HUD : viser un DOUBLON de libellé par son ID, pas par son nom** — deux héros (ou deux
  marins d'équipage) peuvent porter le MÊME libellé à l'écran ; un sélecteur par texte en attrape un
  au hasard, et la capture « prouve » alors l'autre. Résoudre l'id d'abord (`__wfrp.battle()` liste
  les combattants une ligne chacun, id compris), puis `screenPos(id)` → VRAI clic souris. Le canal
  `data-cid` est unique par entité, le texte ne l'est pas.
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

- **Occlusion par footer fixe (`.bar`)** : un élément visuellement cliquable peut être RECOUVERT au
  point de clic — toujours `scrollIntoView({block:'center'})` AVANT de lire le `getBoundingClientRect`
  et de cliquer ; vérifier par `elementFromPoint` en cas de clic mort (vécu recette #495, créateur
  étape Caractéristiques).

- **Occlusion par le panneau de sorts (`.ab-spell-row`)** : le dock des sorts RESTE superposé après la
  sélection d'un sort et couvre la moitié BASSE de l'écran. La visée canonique du token (« bas de la
  bbox », `screenPos` ci-dessus) tombe alors DANS le panneau, pas sur le token — clic mort ou action
  parasite. Panneau de sorts ouvert : viser le HAUT du token (`{x: x+width/2, y: y+8}`) et VÉRIFIER par
  `elementFromPoint` avant le clic ; si un `.ab-spell-row` répond, remonter encore (vécu recette #1004,
  incantation sur un token en combat).

- **Sélecteur TEXTE ambigu pour un sort** : viser un sort par son seul NOM (getByText de Playwright)
  matche AUSSI les lignes de journal de combat qui le citent → plusieurs nœuds, ou le mauvais. Cibler
  le bouton du dock : `div.ab-spell-row button` avec hasText (vécu recette #1004).

- **Sort de ZONE = DEUX portées, DEUX clics** : le clic sur un token ne fait qu'ARMER l'incantation
  (`castZoneSpell` ouvre la modale sans cible — le centre se choisit APRÈS le jet,
  `src/state/combatFlow.ts`). Le placement réel est un SECOND mode clic-case (« Poser la zone »,
  `PLACING_MODE` de `src/state/targetingModes.ts`) avec SA PROPRE validité : portée du sort mesurée
  du lanceur à la CASE + Ligne de Vue (`placedZoneValidAt`). Un `aim()` ok sur une cible ne dit RIEN
  de la case de pose, et une case hors portée échoue SANS message (`commitPlacedZone`/`castCommitZone`
  retournent sans rien faire, le clic est mort). En recette : poser la zone sur une case PROCHE du
  lanceur, et ne pas interpréter un clic sans effet comme un bug (vécu recette #1040, ~35 appels perdus).

- **Le dé fixé d'une rangée AUTO-RÉSOUT le jet** : sur une rangée pas encore lancée (mesuré sur les
  rangées de Contre-sort de la modale d'incantation), la saisie dans « Fixer le dé » LANCE le jet puis
  substitue la valeur — geste ATOMIQUE (`withPreRollFixedDie`, câblé par `rowForcedDie`,
  `src/ui/forcedDieRow.ts`). Aucun bouton « Lancer » séparé à cliquer, et aucun à chercher. Le champ
  pré-jet n'est offert que si l'option « Dés fixés » est active pour le siège (`canFixDie`) et si la
  rangée porte son déclencheur de jet ; sans champ, c'est bien « Lancer » qui résout (vécu recette
  #1040, ~8 appels).

- **Un sort à cible `special` n'a AUCUN ciblage au clic** : vérifier le `target` (et la `range`) du sort
  AVANT de le choisir pour une recette. Ex. « Soleil flamboyant » (`src/data/spells.json`) est
  `target.kind: 'special'` + `range.kind: 'self'` : la ZdE n'est pas chiffrable (`zdeRadiusTiles` rend
  `null` → `castZoneSpell` refuse d'ouvrir une pose de zone) et `spellRangeTiles` vaut 0, donc tout
  token autre que le lanceur tombe en `{invalid, reason:'range'}` dans `castAffordance`. Choisir un sort
  à cible chiffrée pour éprouver le ciblage (vécu recette #1040, ~15 appels perdus).

- **Rect périmé** : sur une liste qui peut se RE-RENDRE entre le `scrollIntoView` et le clic
  (animation, gain de PX, re-render React), re-mesurer `getBoundingClientRect` JUSTE AVANT le
  `Input.dispatchMouseEvent` — sinon le clic atterrit sur le voisin sans erreur levée (vécu recette
  #496 : clic « Humains » atterri sur « Nains »).

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

- **Apostrophe TYPOGRAPHIQUE dans les libellés** (`’`, U+2019) ≠ apostrophe droite (`'`, U+0027) :
  l'UI est MIXTE selon l'écran (mesuré : « Tenter un Test d'Athlétisme » = droite, « Dormir jusqu'à
  l'aube » = typographique) — pas de convention unique à copier. `clickButtonByText` (`lib.mjs`)
  normalise désormais LES DEUX formes vers une seule avant comparaison, côté texte cherché ET côté
  texte DOM ; un sélecteur Playwright `has-text`/`:text-is` écrit à la main reste exposé au piège et
  doit copier le libellé DEPUIS un snapshot/`__wfrp` plutôt que le retaper.
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

- **Ouvrir la fiche complète d'un héros (`CharacterSheet`)** : `sheetId` est un `useState` LOCAL au
  composant écran (`PartyScreen.tsx`/`CampaignView.tsx`) — aucun helper `__wfrp` ne l'arme (le raccourci
  `sheet()` envisagé a été ÉCARTÉ, cf. `docs/architecture.md`). Chemin RÉEL, roster HORS combat
  (`PartyScreen`) : cliquer le portrait/nom d'un héros (`.seat-card-main`, `SeatCard`/`PresentHandle`,
  `src/ui/CharCard.tsx`) ouvre d'abord la PRÉSENTATION (`HeroPresentation`, récit) ; son bouton
  **« Fiche complète → »** (`present.fullSheet`, seulement si le héros est dans le groupe actif) pose
  `sheetId` et ferme la présentation. En COMBAT (`CampaignView`, dock du roster), un clic direct sur le
  portrait (`onDockPortrait`, hors ciblage) pose `sheetId` SANS étape de présentation — deux chemins
  distincts vers le même `CharacterSheet`. Piloter au clavier/souris réel (doctrine ci-dessus) ;
  `__wfrp.state()`/`entities()` n'exposent PAS `sheetId` (état de composant, pas du store).

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

Variante mesurée (2026-08-05) : un **focus posé par un `useEffect` post-rendu** (ex. le popover
épinglé de `CodexRef` qui focalise sa porte après `↓`) n'est pas garanti au moment d'un
`evaluate(document.activeElement)` immédiat — lire un focus transitoire fait conclure à tort à
un vol de focus. Lire via `browser_snapshot` (qui laisse s'écouler un tour d'event loop), ou
attendre avant de lire. Ne JAMAIS « réparer » en mutant le DOM (`tabindex` à la main) : recharger
et rejouer la séquence canonique.
