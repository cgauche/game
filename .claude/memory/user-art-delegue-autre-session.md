---
name: user-art-delegue-autre-session
description: "DIRECTIVE (2026-08-04) : TOUT ce qui est lié à l'ART (rigs, lots d'artistes) est réservé à une AUTRE session dédiée — la session d'orchestration ne dépêche AUCUN artiste et ne touche pas aux rigs"
metadata: 
  node_type: memory
  type: user
  originSessionId: 032f0876-8eb3-421a-bddc-50a550c9bc09
  modified: 2026-08-04T18:51:29.840Z
---

Verbatim utilisateur (2026-08-04, à propos du programme d'art #1075 — bovin, élémentaires, quintaine, familiers exotiques) : « Je demanderais a un autre agent de faire tout ce qui est lié a l'art, donc ne les touches pas »

**Why :** l'utilisateur sépare les fils — l'orchestration moteur/UI/données d'un côté, l'art (rigs SVG, lots d'artistes) de l'autre, confié à une session dédiée.

**How to apply :** ne jamais dépêcher d'agent `artiste` ni éditer `src/gameIso/rig/**` depuis la session d'orchestration ; consigner les DÉCISIONS d'art arbitrées (gabarits choisis, périmètres) sur les tickets pour que la session d'art les trouve ([[game-rig-3vues-contrat-prod-chantier]], #1075) ; les lots de DONNÉES dépendant d'un art à venir se séquencent APRÈS et se reprennent quand les rigs sont livrés. Attention au partage d'arbre : si la session d'art tourne en parallèle, mes commits restent path-scopés hors rig.
Cf. [[feedback-svg-art-fable-pas-opus]], [[game-rig-socle-audit-2026-07-16]].
