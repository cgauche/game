---
name: feedback-wip-voisin-jamais-une-excuse
description: "« M'en fiche s'il y a du wip voisin, c'est une excuse pour ne jamais finir son travail » — le WIP d'une autre session impose la CHIRURGIE (mes hunks, jamais les siens), jamais l'ÉVITEMENT d'un fichier ; un plan qui contourne un fichier partagé est un plan infirme"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 032f0876-8eb3-421a-bddc-50a550c9bc09
  modified: 2026-08-10T20:57:09.895Z
---

Verbatim utilisateur (2026-08-10, V1 du chantier #1262) : « m en fiche si y a du wip voisin, c'est une excuse pour ne jamais finir son travail »

Contexte : la carte de phase 1 de la V1 avait déclaré `combatEffects.ts` « intouchable » (M non committé d'une autre session) et STRUCTURÉ le murage autour de cette absence — `pushCombatStep` non retypable, brand partiel, fossile reporté à V2. L'utilisateur a levé la contrainte : le bon plan traverse le fichier, il ne le contourne pas.

**Why:** sur un arbre partagé en continu, il y a TOUJOURS du WIP voisin quelque part — en faire un mur transforme chaque chantier en gruyère de reports (« à faire quand le voisin aura fini »), et les reports s'empilent sans jamais se résorber. La vraie contrainte n'a jamais été « ne pas éditer le fichier » mais « ne pas toucher les hunks d'autrui ».

**How to apply:**
- Un fichier en WIP voisin S'ÉDITE : hunks chirurgicaux à distance des siens, commit PAR HUNK re-vérifié à l'instant ([[game-index-git-partage-entre-sessions]] forme 2, [[game-stage-chirurgical-hunk-arbre-partage]]), attribution A/B de tout rouge ([[feedback-attribution-rouge-suite-sonde-arbre-committe]]).
- Un plan/brief qui pose « fichier X intouchable (WIP voisin) » comme contrainte STRUCTURANTE (qui déforme l'architecture, reporte un murage, crée un fossile) se corrige : la contrainte est d'EXÉCUTION (comment committer), jamais de CONCEPTION (quoi construire).
- La collision de LIGNES reste possible (deux sessions sur le même hunk) : si elle survient, c'est une coordination ponctuelle avec l'utilisateur, pas un motif d'évitement a priori.
- Ne pas confondre avec les interdits durables : jamais de git destructif, jamais committer les hunks du voisin, jamais rm sur l'arbre partagé ([[feedback-jamais-git-surgery-arbre-partage-actif]]).
