---
name: game-doctrine-squelette-qualite-porte-par-plan
description: "DOCTRINE user (2026-08-04, chantier #1082) : chaque SQUELETTE de plan passe sa porte de qualité (z par os×vue, calques d'éléments attachés par vue, parité de silhouette profil/dos) AVANT toute vague d'art sur ce plan"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 97758451-6f31-4cac-98e5-e0b61ef6dedd
  modified: 2026-08-04T21:21:10.259Z
---

Verbatim utilisateur (2026-08-04, session d'art, chantier #1082) : « Il est important que chaque squelette soit de qualité si on veut que le reste suive. Ici clairement, le dos a des gros soucis d'occlusion, et le profil est une abomination de la nature, et y'a surement pleins d'autres soucis (les cornes s'affichent toujours devant qu'on voit vue arriere ou avant, comme la tete ... et ce n'est qu'un exemple parmis d'autres bugs) » — puis : « Les ailes aussi se mettent mal en vue arriere par exemple, et des exemples de ce genre sont légions ».

**Why :** les exemples utilisateur sont STRUCTURELS, pas des bugs d'espèce : le canal `deco` du quadrupède concatène par-dessus l'art sans z par vue (`withDeco`, `r[id] += svg`), la table z ne réoriente pas tous les os par vue (classes N5/N6 de la taxonomie #1082). Peindre de l'art sur un squelette dont l'occlusion par vue est fausse = tout repeindre après (précédent : vague des 29 tenues sur étalon insuffisant, 2026-07-16).

**How to apply :** aucun dispatch d'artiste sur un plan dont le squelette n'a pas passé sa porte (design v2.1, #1082 commentaire du 2026-08-04) : (1) z par os × VUE complet, invariants testables sur un personnage ; (2) tout élément attaché (part, deco, aile, feature) déclare son plan de profondeur PAR VUE — jamais de concaténation aveugle ; (3) parité de silhouette profil/dos mesurée ; (4) ancres publiées + ligne de sol ; (5) sondes perceptuelles + juges en aveugle + œil user. P1 de #1082 = étalon SQUELETTE quadrupède (pas un étalon d'art). Cf. [[user-barre-art-relevee-2026-07-16]] (« jamais de vague sans étalon »), [[game-rig-socle-audit-2026-07-16]], [[user-art-delegue-autre-session]].
