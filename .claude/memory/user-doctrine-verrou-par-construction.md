---
name: user-doctrine-verrou-par-construction
description: "« Chacun fait ce qu'il veut » = le vrai problème d'un mois — les migrations POLICENT la divergence, seul le VERROU PAR CONSTRUCTION la supprime : murer les portes (exports privés, types marqués, imports lintés) pour que diverger NE COMPILE PAS ; une famille murée ne se remigre JAMAIS"
metadata: 
  node_type: memory
  type: user
  originSessionId: 032f0876-8eb3-421a-bddc-50a550c9bc09
  modified: 2026-08-10T18:26:45.821Z
---

Verbatims utilisateur (2026-08-10, chantier #1262) :
- « Tout ca car tu ne veux pas régler le vrai problème, que je tente de régler depuis 1 mois, a savoir que chacun fait ce qu'il veut. Tu migre un truc a la fois, tu modifier 30 endroits dans le code, puis apres on voit un autre problème, tu remigre ce truc encore 30 fois ... »
- « Car ce que je vois c'est que tu vas repasser ENCORE sur tous les fichiers que tu viens de traiter pour regler UN problème »
- « si l'application fait un jet, il DOIT l'appeler et lui s'occupe du reste ? »

**Why:** une migration change les USAGES mais laisse la CAPACITÉ de diverger (primitives basses publiques : `rollTest` importable partout, `startCascade` avalant des étapes artisanales, rangées manuscrites) — donc la divergence repousse et on remigre. Les gardes-scanners courent APRÈS les patrons. Le seul niveau qui règle le problème : retirer la liberté, pas la surveiller.

**How to apply:**
- Tout chantier de mutualisation livre le MURAGE avec la couture : exports privatisés au module socle, types MARQUÉS (brand TS) que seule la fabrique produit, frontières d'import lintées — diverger ne casse pas la CI, ça NE COMPILE PAS. (⚠ brands vs sérialisation : une donnée sauvegardée perd son brand à JSON.parse — le mécanisme au design, pas en incantation.)
- Chaque vague de migration SE TERMINE en murant la porte qu'elle a vidée ; une famille murée ne se remigre jamais — c'est ça qui honore « un fichier = une migration » dans la durée.
- Le découpage d'un chantier est par FAMILLE DE CONSOMMATEURS (chaque fichier touché UNE fois, directement vers la forme finale), jamais par couche/capacité (qui repasse N fois sur les mêmes fichiers).
- Les gardes-scanners ([[feedback-gardes-structurelles-pas-greps]], #1261) ne subsistent que pour ce que les types ne peuvent pas exprimer.
- Contrat de fin du chantier #1262 : un jet n'importe où = UN appel déclaratif, tout le reste (montage [[game-rollflow-canonical-system]], possession, fenêtre, influences, journal) pris en charge — commentaires du ticket #1262 (carte des couches, état final, verrou).
- Voir [[feedback-altitude-de-design-avant-increments]] (les 3 corrections d'altitude du même jour) et [[user-doctrine-un-hote-jamais-duplique]].
