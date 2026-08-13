---
name: game-arbitrage-vue-top-tactique-tabletop
description: "Arbitrage user (2026-08-12, verbatim) : la vue TOP est une vue TACTIQUE type logiciel tabletop/VTT — lisibilité de plateau, pas une photo zénithale du monde 3D. Cadre le lot P3-5 du chantier WebGL #1176."
metadata: 
  node_type: memory
  type: project
  originSessionId: 87c77da4-29e3-40cc-9238-bea1ae78a458
  modified: 2026-08-12T09:21:49.255Z
---

**Verbatim (2026-08-12)** : « C'est une vue tactique, comme si on était sur un logiciel tabletop »

Réponse à la question posée à l'ouverture de la Phase 3 du chantier [[game-audit-moteur-rendu-2026-08-09]] (#1176) : en vue top volumique, garder le plan symbolique de l'affine ou passer à une vraie vue zénithale ? — Ni l'un ni l'autre tel quel : la référence est le **logiciel de table virtuelle** (Foundry VTT/tabletop).

**Why** : le juge de design P3 avait mesuré qu'une ortho π/2 sur le monde volumique rend des TOITS (illisible en tactique), et que le top affine actuel est un plan symbolique (traits épais sur `el.ends`, glyphes de porte, couples montés scindés en 2 pions — `affineWalls.ts:6-7,146`, `builders/tokens.ts:85-100`). L'arbitrage tranche l'INTENTION : priorité à la lisibilité de plateau tactique.

**How to apply** (lot P3-5 de #1176, design à juger au moment du lot) :
- Le critère de chaque choix de rendu top = « est-ce lisible comme un plateau de VTT ? » : pas de toits qui occluent (découvert permanent), pions/jetons lisibles et cliquables par case, grille tactique, portes/escaliers en affordances lisibles.
- Ce n'est PAS une pose de caméra de plus sur la scène three telle quelle — la vue top a droit à une POLITIQUE DE STYLE propre (quoi montrer/masquer), comme les canaux « dégagement » et « billboards » du socle.
- Le défaut mesuré à corriger quand même côté moteur : ancrage du billboard quand le haut-caméra devient horizontal (sujet décalé de 1,15 m hors de sa case, sonde du juge 2026-08-12 sur #1176).
