---
name: feedback-ui-densite-controles-stylises
description: "UI produit (Jalon 9) : aucun contrôle natif non stylisé (checkbox/radio/select), et JAMAIS de grands espaces vides — densité maîtrisée."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: df22e358-4438-4cca-b8e3-ad83ea327a2e
---

Deux règles de design produit posées par l'utilisateur le 2026-06-11 pendant le Jalon 9 (refonte UI) :

1. **Tout contrôle natif doit être stylisé charte.** « La checkbox que tu me montres est moche » → « ça sera pareil pour toutes les checkbox et radio non stylisée ». Les `<input type=checkbox/radio>` système (carré bleu) sont laids. Livré : style GLOBAL `appearance:none` (case charbon bordée, cochée = fond sang `--accent` + marque or `--gold2` ; radio = point or), s'applique à toute l'UI jeu+éditeur (commit f9a2523). **`<select>` aussi chartés** (commit 06390cf : `appearance:none` + chevron or data-URI, focus or, options thémées ; piège : un override `padding` shorthand mange la flèche → mettre `padding-right` + `background-color` pas `background`). Tous les contrôles natifs sont désormais chartés (boutons/cases/radios/selects/curseurs).

2. **Éviter les espaces vides.** « beaucoup d'espace vide » (panneau de voyage : titre seul en haut, bouton mode seul à droite) puis « de façon générale, évite les espaces vides ». **Why:** un panneau aéré-à-vide fait POC/inachevé. **How to apply:** regrouper sur une ligne ce qui peut l'être (ex. itinéraire + boutons de mode en `space-between`), ne pas détourner `.bar` (header à fond/padding) pour une simple rangée, resserrer marges ; densité maîtrisée mais lisible. Vérifier à 360 ET en large (un layout qui tient à 360 peut s'étaler à vide en grand).

Prolonge [[feedback-pas-de-texte-tuto-ui]] et [[game-jalon9-ui-ux-charte]] (« viser le beau »). Critère produit du Jalon 9.
