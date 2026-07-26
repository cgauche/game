---
name: feedback-jamais-de-branchement-par-id
description: "Doctrine user 2026-07-26 : « if (id= n'est jamais une solution ». Une vue/porte générique ne branche JAMAIS sur un id ; le comportement particulier d'une entrée se DÉCLARE en donnée."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 411c88e0-9fa2-4d10-a2f5-ee5cc57e7b0e
  modified: 2026-07-25T23:44:52.925Z
---

**Verbatim user (2026-07-26)** : « **"if (id=" n'est jamais une solution.** Si je veux rajouter d'autres
options, je ne veux pas voir une suite d'id. Soit la cadence n'a rien a faire dans policy, soit faut lui
mettre un flag »

## La règle

Un composant, une porte ou un résolveur **générique** — celui qui itère un registre et traite N entrées
— ne teste JAMAIS l'identité d'une entrée. Ni `if (id === 'x')`, ni `switch (id)`, ni `Set` d'ids, ni
`Record<id, callback>`, ni liste d'exceptions tenue à la main.

Le comportement particulier d'une entrée est un **ATTRIBUT DÉCLARÉ SUR L'ENTRÉE** (donc éditable, donc
visible à l'auteur de la donnée), que le code générique lit comme n'importe quel autre champ.

⚠ **À ne pas confondre** avec [[game-ids-internes-libelles-display-multilangue]] : là-bas, la faute est
de keyer par LABEL au lieu de l'id. Ici, keyer par id est tout aussi fautif — dans une vue générique,
on ne key pas du tout, on lit un champ.

## Le test qui tranche

*« Si j'ajoute une deuxième entrée du même genre demain, combien de lignes conditionnelles dois-je
écrire ? »* La réponse acceptable est **zéro** — l'ajout est une entrée de donnée, rien d'autre.

## Deux issues, toujours les mêmes

Face à un `if (id === …)` dans du code générique, l'entrée est au mauvais endroit :
- **(A) elle sort du registre** — elle n'y avait pas sa place (cas fondateur : `combat-cadence`, réglage
  de confort logé parmi 76 règles de WFRP, seule à ne porter aucune `ref` de livre) ;
- **(B) elle reste, avec un FLAG** qui exprime sa nature ou son effet de bord, déclaré sur l'entrée.

Jamais une troisième voie « je remplace le `if` par un `switch` ».

**Why :** l'exception codée en dur est indolore à l'écriture et coûteuse au dixième cas — elle
transforme un registre data-driven en liste de cas particuliers, et le panneau « qui ne connaît aucune
règle en dur » finit par toutes les connaître. Le symptôme est structurel : un composant générique qui
nomme une entrée dit que la DONNÉE est mal placée, pas que le composant manque d'un cas.

**How to apply :**
- Rencontrer un `if (id === …)` dans une vue/porte générique = poison présumé : déplacer la donnée ou
  poser le flag, dans le geste.
- Ne jamais « corriger » en enrichissant la condition.
- La classe est GARDÉE structurellement (#842) : `scripts/guards/lib/registryIdBranch.mjs` (AST
  TypeScript — égalité, `switch`, appartenance à une liste fermée, table littérale à clé ouverte,
  toujours conditionnées à une liaison GÉNÉRIQUE) scanne `src/ui`, `src/engine`, `src/state`,
  `src/gameIso`, `src/data` et `scripts` ; `src/ui/registry-id-branch-guard.test.ts` la consomme avec
  un CLIQUET (`KNOWN`/`CEILING`) qui échoue dans les DEUX sens — un site de plus, ou un site de moins
  sans abaisser le plafond. Ce plafond est fait pour DESCENDRE jusqu'à zéro, lot de correction
  après lot : la classe se garde, elle ne se purge pas ([[feedback-gardes-structurelles-pas-greps]]).

Lié : [[game-preference-vs-regle-optionnelle]], [[game-ids-internes-libelles-display-multilangue]],
[[game-data-driven-architecture]], [[feedback-effet-existant-general-parametrable]].
