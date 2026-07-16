---
name: game-browser-evaluate-no-infinite-loop
description: "Recette navigateur — jamais de boucle non bornée dans un evaluate ; vérifier le contrat d'une fn store avant de l'appeler en boucle"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3b2e71b4-5c3c-476f-8d8d-10331bd73755
---

Dans un `evaluate` Playwright/browser, **jamais de `while` non borné**, et **vérifier le contrat
d'une fonction du store AVANT de l'appeler en boucle**.

Incident 2026-07-06 : `while (s.pendingReveals) { s.dismissReveal(); ... }` a gelé le thread JS de
l'onglet **15 min**. Deux bugs cumulés : (1) `s = getState()` est un **snapshot figé** — `s.pendingReveals`
ne reflète JAMAIS la mutation ; (2) `dismissReveal()` **sans argument** ne vide pas forcément
`pendingReveals` → la condition de sortie n'est jamais atteinte. L'utilisateur a d'abord cru le
navigateur bloqué ; c'était mon JS infini.

**Why:** un onglet dont le thread JS boucle est indistinguable d'un navigateur planté ; on perd du
temps à diagnostiquer le mauvais outil, et on gèle la session de recette.

**How to apply:** boucles bornées uniquement (`for (let i=0; i<N && cond; i++)`), relire `getState()`
FRAÎCHEMENT à chaque tour (pas un `s` capturé), et lire la signature de la fn store (`dismissReveal(id?)`
prend peut-être un argument) avant de l'appeler. Idéalement : une action = un `evaluate`, pas de boucle.
Voir [[game-cross-session-console-unblock]], [[game-browser-verif-tempo]].
