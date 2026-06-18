# Identité unifiée SceneEntity ↔ Combatant (cycle de vie explo → combat → scène)

*2026-06-18 — fix « embuscade : ennemis dupliqués / apparence différente / restent après le combat ».*

## Problème

Une rencontre **visible** (option Surprise `EncounterDef.surprise` LDB 13, ou toute entité enrôlée non
cachée) produisait trois symptômes, tous issus d'**une** cause : à `startCombat`, le combattant était
re-créé avec un id neuf `enemy-${i}`, **décorrélé** de la `SceneEntity` qui l'avait enrôlé.

1. **Apparence différente** : le rig se seede sur l'id (`hashSeed(c.id)` côté combat,
   `hashSeed(ent.id)` côté explo) → seeds ≠ → sexe/carrure/yeux divergents.
2. **Duplication** : la boucle de rendu (`IsoStage`) ne masquait que les entités `hiddenUntilCombat` ;
   une entité visible enrôlée restait dessinée en figurant estompé **sur la case** du combattant spawné.
3. **Persistance** : `finalizeBattle` ne faisait le writeback que des héros ; rien ne réconciliait
   `scene.entities` avec les ennemis vaincus → ils réapparaissaient vivants à la fin du combat.

## Décision : une seule identité

`Combatant.id === SceneEntity.id`. Le ré-ID `enemy-${i}` était la dette ; on le supprime. Le combattant
spawné **garde l'id de son entité de scène** (`store.ts` `startCombat`).

Conséquences directes (pas de code en plus) :
- **Apparence** : même id → même seed → parité explo↔combat **par construction** (aucune retouche du rig).
- **Duplication** : la boucle de rendu saute toute entité `personnage` qui est un combattant vivant de la
  bataille (`battle.combatants.some(c => c.id === ent.id)`). Les badauds non enrôlés restent en figurants.
- **Persistance** : réconciliation post-combat directe par id (cf. ci-dessous).

## Brique : réconciliation post-combat

Dans `finalizeBattle` (hook unique de writeback de fin de combat) : tout combattant **issu d'une entité
de scène** (`scene.entities` contient son id) et **hors d'action** (`isOutOfAction`) quitte la scène via
`removeEntities`. Règle *identity-driven*, pas de cas enemy/ally :
- victoire → tous les ennemis hors d'action → retirés ;
- défaite → ennemis vivants → conservés (la scène reflète qu'ils ont gagné) ;
- héros du groupe → jamais des entités de scène → jamais touchés ;
- allié emprunté mort → entité hors d'action → retiré (cohérent).

`removeEntities(get, set, ids[])` (nouvelle brique dans `combatGeometry.ts`, un seul `set` + un seul
`SCENE_DIRTY`) ; `removeEntity` en devient un mince wrapper.

Le re-déclenchement est neutralisé sans flag dédié : le filtre roster de `startCombat`
(`.filter(r => !!r.ent)`) ne spawne plus une entité disparue.

## Fichiers

- `src/state/store.ts` — `startCombat` : id spawné = `ent.id`.
- `src/gameIso/IsoStage.tsx` — boucle d'entités : saute les combattants vivants.
- `src/state/combatFlow.ts` — `finalizeBattle` : retrait des entités vaincues.
- `src/state/combatGeometry.ts` — `removeEntities` (brique) + `removeEntity` (wrapper).
- `src/engine/combat.ts` — *(fix collatéral, bug pré-existant)* `attackModifiers` : `target.weapons?.find`
  (option « Longueur d'arme » plantait sur une cible sans tableau `weapons`).
- `src/state/combat-entity-reconcile.test.ts` — 5 tests (identité, parité d'apparence, retrait victoire,
  conservation défaite, `removeEntities`).

## Base pour la suite

Le cycle SceneEntity → Combatant (par id) → réconciliation est le point d'ancrage pour : renforts,
morts persistants (laisser un cadavre lootable au lieu de retirer), fuite hors-carte, PNJ qui rejoignent
un combat depuis un dialogue. Tous passent par le même hook `finalizeBattle` + `removeEntities`.

## Note connexe (hors scope)

`src/scenes/ambush-test.ts` (`02-embuscade`) utilise un **double calque** historique : mutants ambiants
visibles + entités de combat `hidden:true` aux mêmes cases. Ce contournement existait précisément à cause
du bug corrigé ici ; il pourrait être simplifié (entités visibles enrôlées directement), mais c'est une
scène de test qui fonctionne — non touchée.
