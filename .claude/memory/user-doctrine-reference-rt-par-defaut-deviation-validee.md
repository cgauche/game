---
name: user-doctrine-reference-rt-par-defaut-deviation-validee
description: "Doctrine utilisateur 2026-08-24 : pour toute décision d'UI/comportement, le DÉFAUT est ce que fait l'interface cible (Rogue Trader) ou le standard du genre — ne JAMAIS inventer un comportement absent des deux ; toute déviation = validation utilisateur à l'écran AVANT commit"
metadata:
  node_type: memory
  type: user
  originSessionId: 3c1689ae-eeaa-4da2-a83f-c35ecef5c557
  modified: 2026-08-23T21:21:11.905Z
---

Verbatim utilisateur (2026-08-24) : « Franchement, on part d'une interface de Rogue Trader, on fait un jeu vidéo RPG, pourquoi on réinvente des trucs qui n'existent même pas dans notre interface cible ni dans aucun jeux video du genre ? »

Contexte : trois inventions repérées PAR L'UTILISATEUR le même jour — raisons de refus en texte inline écrasé sous les noms ([[user-arbitrage-raison-de-refus-au-survol-jamais-inline]]), le mot « LIBRE » dans les cases vides ([[user-arbitrage-case-vide-sans-mot-libre]]), et l'oubli que la console était spécifiée personnalisable. Cause racine : la spec a traduit des PRINCIPES (refus visible, a11y) en solutions textuelles inventées, et des annotations de maquette ont fui dans le rendu, sans confronter chaque décision à la référence.

**Why :** le projet a une interface CIBLE (Rogue Trader — `Analyse HUD Rogue Trader.dc.html`, jugée « directement applicable ») et un genre (CRPG tactique : BG3, Solasta, RT). Un comportement absent de la cible ET du genre est presque toujours une erreur de goût ou une sur-interprétation de doctrine — pas une feature. C'est le pendant UI de la règle 1 (aucune invention de règles) : [[user-doctrine-etat-de-lart-avant-invention]] existait, mais n'était appliquée qu'aux gros choix d'architecture, pas à CHAQUE décision de rendu.

**How to apply :** (1) avant toute décision d'UI (rendu, geste, libellé, état vide/désactivé/refusé), la question OBLIGATOIRE du brief est « que fait RT ici ? que fait le genre ? » — la réponse par défaut est LA LEUR ; (2) une déviation ne se justifie que par une contrainte propre au projet (règle WFRP, a11y légale, coop) et passe par validation utilisateur À L'ÉCRAN avant commit ([[feedback-ecran-de-gout-validation-user-avant-commit]]) ; (3) les principes abstraits (« refus visible ») ne s'implémentent JAMAIS en inventant une forme : on cherche la forme du genre qui satisfait le principe (RT : tooltip au survol du slot grisé) ; (4) les annotations de maquette/planche ne sont pas des specs de rendu.
