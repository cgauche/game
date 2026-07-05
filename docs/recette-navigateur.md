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

## Outils de recette `window.__wfrp` (DEV uniquement, `src/state/devtools.ts`)

Pour piloter le jeu depuis Playwright **sans chasser les coordonnées pixel des tokens**.
Depuis un `browser_evaluate` :
- `__wfrp.state()` → instantané lisible (écran, `sceneId`, `partyPos`, `inDialogue`, `inCombat`, groupe, argent).
- `__wfrp.entities()` → **cartographie** : chaque entité de la scène `{ id, label, kind, pos, access }`
  (`access` = `talk`/`merchant`/`interact`/`—`).
- `__wfrp.talk('id')` → téléporte le groupe à côté de l'entité et l'**interpelle** (ouvre dialogue/marchand).
- `__wfrp.goto('id'|{x,y})` → place le groupe sur la case (déclenche portes/triggers au pas).
- `__wfrp.screen('menu'|'party'|…)` → navigue ; `__wfrp.store` = store Zustand brut (`getState`/`setState`).
- `__wfrp.scenario('entrainement', seed?)` → **lance un scénario de test prêt à jouer** (sans menu, pause de Round 1
  acquittée, initiative déterministe si `seed`) ; sans argument : liste les ids.
- `__wfrp.hover('id'|{x,y}|null)` → **survol programmatique** en combat (tooltip + réticule de visée se rendent
  sans souris) ; `__wfrp.aim('id')` → vérité state du ciblage (ok/invalid + raison, compétence, dégâts).
- `__wfrp.battle()` → snapshot combat (round, actif, modales ouvertes, combattants une ligne chacun) ;
  `__wfrp.turn('id')` → **donne le tour** (fini d'attendre l'IA) ; `__wfrp.place('id',{x,y})` → téléporte ;
  `__wfrp.log(n)` → queue lisible des journaux (exploration + feed de combat).
- `__wfrp.modal()` → modale(s) `pending*` ouvertes ; `__wfrp.roll()` / `__wfrp.confirm()` / `__wfrp.cancel()`
  → pilotent LA modale ouverte par convention `<flux>Roll/Confirm/Cancel` (révélations/Round : verbe propre).
- Les tokens de combat portent `data-cid="<id du combattant>"` dans le SVG → survol/clic ciblé par sélecteur DOM.
- **Triches de recette** : `killEnemies()` (victoire par le flux normal), `healParty()` (PB max,
  états/critiques/maladies purgés), `give(co)` / `xp(n)`, `flags()` / `flag('id', bool)` (portes de
  l'arène), `go('scene-id')` (transition), `fight()` (liste/lance une rencontre de la scène),
  `time(min)` / `rest(jours)` (horloge + cascade quotidienne).

## Piège du *closure-sync*

Lire le DOM dans le **même** `evaluate` que `talk()` lit l'état AVANT le re-rendu React —
séparer en deux appels (cf. `game-browser-verif-tempo`). Plus généralement : cliquer un bouton
qui change un état React PUIS agir dans le MÊME `evaluate` lit l'ANCIEN état (React n'a pas
re-rendu). Séparer en deux appels, ou utiliser un `ref` côté composant pour la logique de drag.
