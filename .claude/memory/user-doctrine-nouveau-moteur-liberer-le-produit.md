---
name: user-doctrine-nouveau-moteur-liberer-le-produit
description: "Doctrine produit (2026-08-10, verbatim) : l'existant porte des compromis façonnés par les LIMITES de l'ancien moteur — le chantier WebGL (#1176) doit refaire MIEUX, jamais reproduire le contournement. Étend le registre des fossiles du code au PRODUIT."
metadata: 
  node_type: memory
  type: user
  originSessionId: 5d129c4b-c665-4e81-9389-8f4edf55ae2a
  modified: 2026-08-10T18:53:41.843Z
---

**Verbatim (2026-08-10)** : « De toute facon pas mal d'élément de l'existant ne me vont pas, et le nouveau moteur va surement permettre de faire tout en mieux, sans avoir les limitant qui ont poussé a faire les choses différament »

Prononcé dans la foulée de deux cas d'espèce : les escaliers (#1233 — « on va devoir en profiter pour les repenser ») et les lumières posées (#1245 — « sans reprendre l'ancien fonctionnement qui de toute facon ne marche pas »).

**Why** : une grande part de l'existant (rendu, mais aussi modèle de contenu et données authorées) a la FORME de ce que l'ancien moteur-peintre savait faire, pas la forme voulue. Porter ces formes dans le nouveau moteur serait le fossile suprême — la doctrine du registre (« le code recommencé de 0 peut être bien différent ») vaut pour le PRODUIT entier.

**How to apply** :
- À chaque lot qui touche un système hérité : se demander « cette forme vient-elle d'une limite du peintre ? » — si oui, DESIGN à neuf contre les capacités du moteur cible (z-buffer, vraie géométrie, vraies lumières, boucle de rendu), jamais un portage du contournement. La parité avec l'affine n'est un critère QUE pour ce qui marchait et plaisait.
- Le stock connu = la moitié « modèle de contenu » de l'audit 2026-08-09 ([[game-audit-moteur-rendu-2026-08-09]]) : murs à hauteur variable (muret/comptoir/garde-corps), escaliers réels (#1233), étages habités simultanés, fenêtres traversables/sources de jour, lumière par pièce/posée (#1245), toit-terrasse, eau graduée, props 3D ancrés à l'arête ([[game-refonte-ui-jeu-video-2026-07]] direction billboards→3D).
- La chasse aux cicatrices dans la DONNÉE (contournements authorés pour ruser avec l'ancien affichage) est déjà au registre des fossiles pour la clôture de Phase 3.
- Chaque refonte = design jugé avant codeur + validation UTILISATEUR sur pièce (écran de goût) — c'est lui qui dit ce qui « ne lui va pas », jamais une déduction.
- **ANCRE DE PRIORITÉ (2026-08-10, verbatim)** : « la scéne d'introduction de la campagne de L'Ennemi Intérieur c'est la diligence, autant te dire que la scene est vraiment complexe » — la DILIGENCE est la scène-BANC du chantier : 2 niveaux, escaliers (#1233 y est né), toits joints (l'intention de maquette), façade longue (#1212), herse hors palette (#1215). L'ordre des déplombages du modèle de contenu se juge à ce qu'il débloque pour ELLE d'abord — c'est la première chose que verra un joueur de la campagne.
- État des lieux complet par système vs ambitions : posté sur #1176 (commentaire du 2026-08-10).
- **VALIDATION DE GOÛT DIFFÉRÉE (2026-08-10, verbatim)** : « Je ne fairais pas de retour car il reste encore enormement a faire. Je te fairais des retours une fois le tout terminé » — pour CE chantier moteur, les écrans de goût ne bloquent plus lot par lot : avancer avec des défauts raisonnables ET tout laisser éditable en donnée (le retour final de l'utilisateur devient des retouches de donnée, pas du code). La recette JOUEUR par agent reste obligatoire à chaque lot ; seul le verdict de GOÛT utilisateur est reporté à la fin.
