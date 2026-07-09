# Recette navigateur — vérifier une feature dans le jeu (Playwright MCP)

> Extrait verbatim du CLAUDE.md (dégraissage 2026-07-05). À lire au moment de valider une
> feature UI dans le navigateur.

**Vérification** : après une feature UI, valider dans le navigateur (Playwright MCP) — charger
`localhost:5173`, dérouler le flux, vérifier `console` (0 erreur) et screenshoter. Le menu
**« 🧪 Tests — scénarios »** ouvre un choix de scénarios de test (groupe fixé + scène adaptée,
combat direct) ; **passer par le scénario adapté, sinon en créer un** — un scénario = un fichier
dans `src/scenes/test-scenarios/` (cf. `docs/test-scenarios.md`).

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
| `screenPos('id')` | bounding box ÉCRAN (`{x,y,width,height}`) du token `[data-cid="id"]` — COMBAT ET EXPLORATION (même canal `data-cid`, #226) | lecture seule ; `null` si le token n'est pas dans le DOM (hors vue) |
| `talk('id')` | téléporte le groupe à côté de l'entité + l'interpelle (dialogue/marchand) | rien si l'entité n'a ni dialogue ni marchand |
| `goto('id'\|{x,y,z?})` | place le groupe sur une case (déclenche portes/triggers au pas) | — |
| `screen('menu'\|'party'\|…)` | navigue vers un écran | id validé contre `SCREENS` (`state/store.ts`) — `throw` immédiat + liste des ids valides si invalide (#211 ; avant : routage silencieux, écran blanc, zéro erreur console) |
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
| `killEnemies()` | élimine tous les ennemis + flux de victoire NORMAL | ignore les postes `inert` non `dead` (affûts non visés, LDB — voir `isOutOfAction`) |
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
| `flags()` / `flag('id', value=true)` | lit/force un drapeau de scénario | — |
| `time(minutes=60)` / `rest(days=1)` | avance l'horloge / dort N jours (cascade quotidienne) | ⚠ **NE PILOTE PAS une traversée EN MER** : `rest()` appelle `restFlow.sleepParty` directement, découplé de `travelPlan.sea` (`state/seaVoyageFlow.ts`) — avance l'horloge SANS faire progresser le navire sur sa route (désynchronise `gameTime` du voyage). Pour accélérer une traversée COMMANDÉE, voir « Voyage en mer » ci-dessous |
| `chantier('reparer'\|'carener'\|upgradeId, units?)` | services du chantier naval au port | hors combat, navire de campagne requis |
| `massBattle(ally?, enemy?, rounds?)` | lance une bataille de masse de démo | la scène courante doit porter les rencontres attendues |
| `scenario(id?, seed?)` | lance un scénario de test PRÊT À JOUER ; sans argument : liste les ids | Round 1 déjà acquitté, initiative déterministe SI `seed` |
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

### Voyage en mer — accélérer une traversée commandée (recette)

La progression jour par jour d'une traversée EN MER (`runSeaDays`, `state/seaVoyageFlow.ts` — météo,
périls, halte de nuit) est une boucle qui se SUSPEND à chaque Test d'équipage (modale) et à chaque
halte de nuit (`pendingRest`) ; elle reprend à la CONFIRMATION de ces modales, jamais via `time()`/
`rest()` (ci-dessus). **Aucun helper `__wfrp` n'existe pour la sauter** (pas de `fastForward`
équivalent côté voyage — seul le combat en a un) : `pendingRest` n'est pas piloté par la convention
`roll()`/`confirm()` (pas de `restConfirm` câblé dessus, contrairement aux flux `pending<Flux>`
usuels). La méthode réelle la MOINS chère en recette : dérouler la traversée à la main, halte de
nuit après halte de nuit, en cliquant les vrais boutons de la modale de repos (couchage/pitance puis
« dormir ») autant de fois que de jours de traversée — coûteux pour une longue route. Si le scénario
propose un départ en **voyage rapide** (MDG ch.15 l.21-37, `sea.fast` — palier appliqué en un bloc,
sans boucle jour par jour), le choisir AU DÉPART est la vraie accélération native du jeu ; il n'est
pas rejouable après coup sur une traversée déjà en cours au pas.

## Pièges vécus (corrections d'expérience)

- **Module Vite PÉRIMÉ après un fix** (vécu 2026-07-09, faux « PAS CORRIGÉ » sur un P0) : le
  watcher Vite sous Windows peut RATER une écriture de fichier (agent/git) — le serveur sert alors
  l'ancienne transformation même après un reload complet. Symptôme : la stack console cite des
  numéros de ligne de l'AVANT-fix ; preuve : le `?t=` de l'URL du module (`travel.ts?t=…`) est plus
  vieux que le fix. Remède : toucher le mtime du fichier (`(Get-Item f).LastWriteTime = Get-Date`)
  puis recharger — vérifier le `?t=` AVANT de conclure qu'un fix ne marche pas. Corollaire : la
  console MCP est un buffer PARTAGÉ entre sessions/onglets — `all:true` peut remonter les erreurs
  d'une session PRÉCÉDENTE ; après un clic sensible, lire la console IMMÉDIATEMENT et depuis la
  dernière navigation, jamais en fin de parcours.
- **Captures d'écran** : SEUL chemin autorisé par l'outil Playwright MCP = `.playwright-mcp/` à la
  RACINE du repo (gitignoré, `.gitignore:19`) — jamais `%TEMP%` (rejeté « outside allowed roots »),
  jamais un fichier à la racine du repo hors ce dossier.
- **Jamais de `dispatchEvent`/`MouseEvent` synthétique** pour cliquer un token/bouton — provoque de
  FAUSSES erreurs `setPointerCapture` (l'élément n'a jamais reçu de vrai pointeur). Utiliser les
  VRAIS clics Playwright (`browser_click`, sélecteur `data-cid`/rôle/texte).
- **Passer des tours** : `turn('id')` (triche, donne le tour) ou `fastForward()` (avance l'IA) —
  jamais de manipulation manuelle de `battle.round`/`battle.turn`/`battle.order` via `store`.
- **Cliquer une ROUTE de la carte du monde** : le tracé SVG n'a de hit-test QUE sur son trait
  (`pointer-events: stroke`) — jamais la bbox, jamais son label (`pointer-events: none`). Un clic au
  centre du bbox (ce que fait `browser_click` sur l'élément) tombe hors du trait et est intercepté par
  la vignette de lieu dessous. Méthode canonique : calculer un point ON-PATH via la méthode SVG
  native `getPointAtLength` du `path` + `getScreenCTM()` (coordonnées écran réelles du trait), puis un
  VRAI clic souris (`page.mouse.click`) à ces coordonnées — jamais `browser_click` sur le sélecteur de
  la route. Cette méthode requiert l'outil `browser_run_code_unsafe` (exécution JS côté page pour lire
  `getPointAtLength`/`getScreenCTM`, hors sélecteurs Playwright standards) — ABSENT du set d'outils de
  démarrage : le charger via ToolSearch avant de router un clic de route.

## Piège du *closure-sync*

Lire le DOM dans le **même** `evaluate` que `talk()` lit l'état AVANT le re-rendu React —
séparer en deux appels (cf. `game-browser-verif-tempo`). Plus généralement : cliquer un bouton
qui change un état React PUIS agir dans le MÊME `evaluate` lit l'ANCIEN état (React n'a pas
re-rendu). Séparer en deux appels, ou utiliser un `ref` côté composant pour la logique de drag.
