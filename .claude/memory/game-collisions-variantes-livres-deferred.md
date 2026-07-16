---
name: game-collisions-variantes-livres-deferred
description: Collisions/règles alternatives entre livres (même talent/trait/mutation aux desc+source+page+effets différents) — mécanisme de variantes DIFFÉRÉ (jugé trop complexe en data-driven)
metadata: 
  node_type: memory
  type: project
  originSessionId: 79086e8f-2b86-464f-8a9e-6f2bc67f4515
---

Plusieurs talents/traits/mutations existent en **versions différentes selon le livre/la règle optionnelle active**, et la règle de l'user est : **« les 2 sont valides »** (garder les deux, ne pas réconcilier de force).

Trois cas distincts :
- **Cas A — variante choisie par le CONTEXTE (table)** : ex. mutations. La table d100 diffère de toute façon → **deux entités « both valid »** + la table (gouvernée par une règle optionnelle) route vers la bonne. RÉSOLU proprement. Fait pour EDOC : « Écailles épineuses » LDB (+1 PA) vs EDOC (-10 Dex/-10 Soc/+1 PA) = deux entités ; règle `corruption-tables-edoc` choisit la table. Voir [[game-mutation-creature-id-migration]].
- **Cas B — variante de l'ENTITÉ attachée directement** : ex. **certains talents AA ont des règles différentes sous le système d'Avantage AA**. Un perso « a Fusilier » : l'attache doit être agnostique à la règle, la résolution **live** (toggle en cours de partie). Et ce n'est **pas que l'effet** qui change : **desc, source, page et d'autres éléments** aussi. **NON RÉSOLU.**
- **Cas C — même ENTITÉ NOMMÉE (créature), profil différent selon le livre, NON gaté par une règle** : ex. **Brochet du Stir** ZI (Amphibie, Attaque caudale, harvest « prédire l'avenir », 3 Points de Chance) vs T2C ch.13 (Aquatique, Foulée, Belliqueux). ✅ **RÉSOLU (user 2026-07-03 : « les 2 ont le droit d'exister »)** : **DEUX entrées distinctes** (`brochet-du-stir` + `brochet-du-stir-fluvial`), MÊME libellé, **ids distincts**, `folder`/`source` distincts, `appearance.species` partagé (même rig). L'auteur choisit par **id** à l'authoring d'une rencontre — le jeu référence par id ([[game-label-id-migration-complete]]), donc `id-collisions.test.ts` confirme « inoffensives à l'exécution ». **Pas besoin du mécanisme `variants` du Cas B** (aucun toggle de règle). Piège de PROCESS à éviter : réconcilier/écraser (un agent avait écrasé ZI→T2C ; garder les DEUX). Ne JAMAIS détruire la curation d'une version (harvest, capacités) en « fusionnant ».

**Why:** notre gating d'op (`onlyIfCondition`/`unlessCondition`, [[game-passifs-unifies-p0-p3]]) ne référence que des **États**, pas l'état d'une règle optionnelle ([[game-data-driven-architecture]] `policy.ts`/`rule(id)`).

**How to apply:** proposition esquissée = **variantes d'entité** (`variants?: [{ when:{rule,equals}, ...surcharge complète }]` + un résolveur unique `resolveVariant` appelé par TOUS les lecteurs : Codex, `passiveMods`, `fireTriggers`, statbloc). L'user a tranché : **ça rend le data-driven super compliqué → DIFFÉRÉ** (« enfin bon continue EDOC »). Ne pas l'implémenter sans relancer la discussion. En attendant, rester sur deux entités « both valid » pour le Cas A.
