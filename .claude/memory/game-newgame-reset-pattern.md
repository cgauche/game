---
name: game-newgame-reset-pattern
description: "Reset de nouvelle partie/scénario = revenir à l'état de création du store (getInitialState), zéro-maintenance + garde-fou test ; ne JAMAIS lister les champs à la main"
metadata: 
  node_type: memory
  type: project
  originSessionId: 4e6c5100-25b0-4b77-aea8-b26dd13e5d75
---

**Reset au démarrage d'une partie/scénario (`startScene` dans `src/state/store.ts`) = ZÉRO-MAINTENANCE.**

**Why:** la version historique réinitialisait une **liste de champs maintenue à la main** qui avait dérivé au fil des features (psychologie, qualités…). Résultat : `gameTime`, `facing`, `previousScene` et **5 suspensions de combat** (`pendingFateSave`/`pendingFumble`/`pendingDeviation`/`pendingCast`/`pendingRoundStart`) **fuyaient d'une partie à l'autre** → modale fantôme / crash si on quittait en plein combat puis relançait. Toute nouvelle feature qui ajoute de l'état risquait de re-fuir.

**How to apply:** `startScene` repart de l'**état de CRÉATION du store**, capturé automatiquement par Zustand (`useGame.getInitialState()`, dispo en zustand ≥4.4 ; ici 4.5.7) :
```ts
const { screen, party, camRot, zoom } = get();
set({
  ...(JSON.parse(JSON.stringify(useGame.getInitialState())) as Partial<GameState>), // JSON retire les fonctions ; set() (fusion) préserve les actions
  screen, party, camRot, zoom,              // SEULS champs conservés (navigation/vue/groupe)
  scene, mode, partyPos, flags, money, campaignSceneId, journal, // dérivés de la scène de départ
});
```
- **Conséquence clé** : tout champ d'état ajouté à l'init d'un **système futur** (#T2 voyage/Fatigue, etc.) se réinitialise **sans rien câbler** — ne JAMAIS revenir à une liste manuelle.
- **Garde-fou** (test `store.test.ts` « Nouvelle partie / scénario — reset complet (anti-dérive) ») : itère `getInitialState()`, et pour tout champ DATA hors `PRESERVED_OR_DERIVED` (screen/party/camRot/zoom + dérivés scène), exige `=== défaut de création`. **Échoue si un futur champ fuit** → force à le couvrir (ou à l'ajouter à l'allowlist en connaissance de cause).
- Scénarios de test ET campagne passent tous deux par `startScene` (TestScenariosScreen : setParty→startScene ; loadProject→startScene), donc une seule correction couvre les deux.
- `transitionTo` (changement de scène INTRA-partie) ≠ reset : il conserve flags/argent/inventaire/gameTime/groupe.

Commit 33b62ea. Découvert pendant la revue du seam « temps de voyage » (#T1). Commit propre malgré le `smoke?` WIP // dans store.ts : cf. [[git-commits-propres-wip-parallele]].
