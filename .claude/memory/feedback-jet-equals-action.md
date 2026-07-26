---
name: feedback-jet-equals-action
description: "Critère d'économie d'action quand le RAW est muet — un jet = une Action ; pas de jet = juste du Mouvement."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6a091869-bf82-4c57-9848-2d25a75eaedb
---

Pour trancher le COÛT d'un acte de combat quand le canon ne le chiffre pas : **« tout jet indique que c'est une Action »** (mot de l'utilisateur). Donc :
- l'acte demande un **Test/jet** → c'est une **Action** (consomme `battle.acted`) ;
- l'acte ne demande **aucun jet** → ce n'est **pas** une Action, c'est **juste du Mouvement** (« sinon c'est juste du mouvement non ? ») → consomme le budget de mouvement (`battle.movementUsed`, cf. [[game-split-movement-decision]]).

**Why:** comble les trous où le RAW est silencieux sans inventer ; aligne l'économie d'action sur un critère objectif et vérifiable. Prolonge l'invariant [[game-jet-modale-exhaustif]] (« un jet = une modale ») côté coût.

**How to apply:** ex. Combat monté — enfourcher/descendre ne demande aucun Test (Chevaucher sans jet si on a la Compétence, LDB 09 l.99) ⟹ pas une Action : `battleMount`/`battleDismount` consomment le **Mouvement** (on peut enfourcher PUIS attaquer le même tour ; le +20 de cavalerie devient atteignable). NB : ce critère comble les SILENCES du RAW — il ne renverse pas les exceptions canon explicites (Piétinement = action gratuite l.320, Sacrifier l'Avantage = gratuit l.87, Viser/Sur la défensive = Action sans jet). Voir [[game-engagement-trio]] pour les autres décisions d'économie d'action. Rattaché au système de montures (cf. roadmap Jalon 1.5 « Combat monté »).
