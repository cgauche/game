---
name: game-poc-cleanup-inventory-tome1
description: Nettoyage POC 2026-06-11 — inventaire de GROUPE supprimé (giveItem→giveTrapping custom/réel) + campagne Tome 1 supprimée (tests sur fixture neutre)
metadata: 
  node_type: memory
  type: project
  originSessionId: df22e358-4438-4cca-b8e3-ad83ea327a2e
---

Grand nettoyage POC demandé par l'utilisateur (« on est encore sur une base POC, adapte/supprime au besoin »), 2 refactos majeures poussées 2026-06-11.

**1. Inventaire de GROUPE supprimé** (commit `5358954`) : `store.inventory`, l'effet **`giveItem`**, `giveItemToHero`, la section « Butin » de l'écran de victoire et « Inventaire du groupe » du menu sont **SUPPRIMÉS**. Désormais **un seul chemin pour donner un objet = `giveTrapping`** : nom RÉEL de la base → objet à stats ; nom INCONNU → objet **CUSTOM** (`customTrapping(name)` dans `engine/items.ts`, kind `misc`, sans stats) sur un héros. Le butin d'ÉQUIPEMENT reste attribuable par portrait à la victoire (`pendingVictory.gear` + `assignVictoryGear`, cf. [[game-arene-editor-data-project]]). NE PAS réintroduire `giveItem`/inventaire de groupe. Les handouts restent via l'effet `document` (lisibles), pas via l'inventaire.

**2. Campagne Tome 1 SUPPRIMÉE** (commit `49fa98f`) : `tome1-intro/route/auberge/carte/dossiers` **supprimés**. Ils servaient de décor à ~35 tests de combat → nouvelle **`src/scenes/test-fixture.ts`** (`testScene`) : grille 22×16 herbe, heroStart (6,10), rencontre **`enc-mutants`** (3 Mutants à (16,11)/(18,12)/(17,13)) — drop-in. **Tout test de combat unitaire fait `startScene(testScene)` puis `startCombat('enc-mutants')`** puis adapte les combattants. `campaign.ts` ne contient plus que l'Arène (`campaign[0]`), carte du monde vide par défaut. Éditeur : scène par défaut = `testScene`. Tests de CONTENU tome1 (Gustav, porte→intérieur, embuscade narrative) retirés.

⚠️ `Game/CLAUDE.md` (carte d'archi) cite encore tome1/giveItem — périmé, non mis à jour (doc du repo). Suite 2891 verte, typecheck 0. Prolonge [[game-supprimer-legacy]] + [[feedback-contenu-donnee-editeur-pas-code]].
