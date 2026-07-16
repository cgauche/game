---
name: feedback-classes-mono-ecran-excuse-derive
description: "Doctrine user 2026-07-12 (verbatim : « J'y crois pas une seule seconde à des classes mono-écrans personnellement, c'est une excuse à la dérive ») — le réflexe par défaut est la classe PARTAGÉE ; une classe de domaine doit se justifier, et le stock par module CSS est cliqueté."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: adfd4529-35c1-4ae9-85da-f959f7971274
---

**Verbatim user (2026-07-12)** : « J'y crois pas une seule seconde à des classes mono-écrans personnellement, c'est une excuse à la dérive. » — en réaction au catalogue atomique qui excluait `.voyage-*`/`.city-hub-*`/`.char-card*`… comme « usage mono-écran ».

**Les preuves du jour** : `.city-hub-empty` = état-vide générique ; `.city-hub-prices` = la rangée de prix « livre de comptes » repérée par le panel comme IDENTIQUE sur 3 écrans ; `.city-hub-synth` = liste clé/valeur banale. Des motifs partagés déguisés en classes locales — c'est le mécanisme même de l'incohérence inter-écrans.

**Why :** la charte disait « nouveau style → module du domaine », ce qui INVITAIT à créer du local ; et rien ne comptait le stock. Une classe locale coûte zéro à créer et sa duplication est invisible aux portes.

**How to apply :**
1. Réflexe inversé : AVANT toute classe `.mon-ecran-*`, chercher le motif dans la couche atomique (catalogue de `docs/charte-ui.md`) — l'étendre/paramétrer si presque-là ; une classe de domaine ne se crée que pour du VRAIMENT spécifique (géométrie d'un canevas, skin d'un écran unique) et se justifie.
1bis. **Motif inexprimable → NOUVEAU GÉNÉRIQUE dans la couche partagée** (user 2026-07-12 : « Si on ne sait pas faire, on ajoute de nouveaux génériques. Mais bon là clairement on a déjà pas mal de classes, je doute réellement qu'on en ait besoin de nouveaux ») — jamais une classe locale ; et l'attente est que le cas soit RARE : la résorption #371 se fait presque entièrement à génériques constants (mapper sur l'existant).
2. La charte est corrigée dans ce sens (la règle « nouveau style → module du domaine » est subordonnée au réflexe atomique).
3. Cliquet (xii) posé (#373) : compte de sélecteurs de classe définis PAR module CSS de domaine — baseline gelée, ne peut que décroître ; la résorption des motifs déguisés est un objectif du programme #371 (chaque lot d'écran remonte les motifs partagés dans la couche atomique).

Lié : [[feedback-composer-primitives-jamais-markup-brut]], [[feedback-mutualiser-invariant-pas-juste-appel]], [[feedback-gardes-structurelles-pas-greps]].
