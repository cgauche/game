---
name: feedback-descripteur-mecanique-jamais-une-description
description: "Un descripteur dans une donnée (« féroce », « petit/grand », « de qualité ») référence souvent un TRAIT ou une RÈGLE, pas de la saveur — vérifier au RAW avant de le traiter en description à jeter (user 2026-07-21)."
metadata:
  type: feedback
---

Réflexe erroné répété : traiter un descripteur d'une donnée comme une DESCRIPTION à jeter (j'ai migré « Petit/Grand chien féroce » → chien générique en droppant les mots, et j'allais faire pareil pour « Fleuret de qualité »). L'user (2026-07-21) corrige la CLASSE :
- **« petit » / « grand »** → le trait de créature **`Taille`** (une variante de taille = la MÊME créature avec un `Taille` différent, JAMAIS une créature distincte re-keyée ni un mot droppé).
- **« de qualité »** → une **RÈGLE définie** (LDB ch.60 « Fabrication » p.293) : une « Possession de Qualité » = un objet portant plus d'**Atouts d'objet** que de Défauts (chaque Atout double prix + baisse dispo). Le « de qualité » générique des possessions = l'Atout **`Raffiné`**. ⚠ Les 8 Atouts/Défauts de Fabrication (Raffiné/Léger/Pratique/Solide/Bâclé/Laid/Peu-Fiable/Volumineux) SONT déjà au registre `qualities.json` (sourcés LDB p.286) — le système existe. Le SEUL trou : une `TrappingRef` de dotation ne peut pas ENCORE attacher un Atout à l'objet octroyé (champ `qualities?` à ajouter sur la branche `{id}` + matérialiser dans `buildInventory`, comme `giveTrapping.give.qualities` le fait pour la magie). NE PAS droper « de qualité » comme saveur.

**Why:** droper un descripteur mécanique = perte de règle silencieuse (dette d'implémentation, pas house-rule — credo). Et l'inverse (re-keyer vers une autre entité, ex. chien→chien-de-ratier) est AUSSI faux : le bon modèle = le trait/la règle SUR la ref existante (trait override / quality), pas une nouvelle entité ni un mot jeté.

**How to apply:** avant de traiter un mot de descripteur comme flavor, vérifier au RAW s'il nomme un trait (`Taille`, `Vitesse`…) ou une règle (qualité de fabrication, état). Si oui → le modéliser (trait sur la possession/ref, ou `Quality` au registre) ; si le RAW ne statte VRAIMENT rien de distinct (ex. le « Chien » LDB — arbitrage user « laissons le chien »), alors seulement c'est de la saveur du `label`. Corollaire de la recherche : chercher au bestiaire/catalogue par **LABEL + synonymes**, jamais par préfixe d'id seul — ce préfixe seul m'a fait rater le blaireau (ADE III) PUIS les chiens féroces (frenchy-bzh). Voir [[feedback-audit-modeling-shape-vs-raw-intent]], [[game-ids-internes-libelles-display-multilangue]].
