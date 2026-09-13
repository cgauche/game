---
name: user-arbitrage-barre-materialisee-et-sans-pages
description: "La grille de capacités est 2×6 fixe (pas de pages) et le pré-remplissage se MATÉRIALISE dans le héros : rien ne glisse jamais"
metadata:
  node_type: memory
  type: user
---

Verbatim utilisateur (2026-08-24) : « La barre déduite s’écrit une fois dans le héros ; une capacité nouvelle s’ajoute à la première case libre ; retirer laisse un trou ; RIEN ne glisse jamais — le plus proche de "la position s’apprend" (RT). »

**Why:** une position de capacité s’apprend par la main du joueur ; toute recomposition (écoulement, pages I/II/III) la lui reprend, ce que la référence Rogue Trader ne fait pas.

**How to apply:** la grille reste 2×6 et l’exhaustif vit à l’écran de capacités ; au premier rendu, le pré-remplissage déduit s’écrit dans `Combatant.barre` via `poserDansBarre` ; une entrée neuve s’append au premier rang libre, une entrée qui quitte l’offre laisse sa case dessinée fermée avec sa raison.
