---
name: feedback-artistes-rig-corrigent-defauts-adjacents
description: "Mandat user 2026-07-14 : un artiste rig corrige DANS LE GESTE les défauts de rig adjacents qui dégradent son rendu (cheveux décollés du crâne, ancrage, artefact par-vue) — avec garde-fous parts-partagées"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: cb384a41-d20a-494b-aa60-728b2ed7534f
---

**Verbatim user (2026-07-14, chantier tenues de carrières)** : « D'ailleurs si l'agent peut corriger les problèmes de rigs comme des cheveux décolé du crane ou autre, qui ne sont pas forcement directement a son travail mais qui l'impact »

**Why :** c'est le credo « le poison se corrige dans le geste » appliqué à l'art de rig : l'artiste est le SEUL à avoir le défaut sous les yeux au bon zoom, au bon moment — le renvoyer en signalement recrée un backlog invisible et livre une planche dégradée par un défaut « pas de son périmètre ».

**How to apply :** dans tout brief d'artiste rig (tenue, créature, part), inclure l'extension de mandat : défaut ADJACENT constaté au QC (coiffure décollée, part mal ancrée, artefact par-vue, raccord poing/pied) → correction autorisée au def fautif (`src/gameIso/rig/parts/*/defs`), avec garde-fous : (1) fix minimal, pas de redesign ; (2) parts PARTAGÉES → `npx vitest run src/gameIso` complet + goldens inspectés, jamais `-u` aveugle, régression ailleurs = rollback + signalement ; (3) chaque correction listée au rendu (fichier, défaut, preuve) ; (4) le structurel (compose*/resolve/squelette) reste hors mandat → signalement. Lié : [[game-tenues-carrieres-arbitrage-2026-07-14]], [[user-contrainte-cout-rigs-2026-07-12]].
