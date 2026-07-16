---
name: game-playtest-color-fait-is-scoping-decision
description: "Dans un doc de retours playtest annoté par le dev, un surlignage VERT « Fait » = décision de périmètre (fini), pas du poison — n'ouvrir en issue que les jaunes et non-coloriés."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6c70a460-5c19-4d4d-a3c5-23c170a19582
---

Sur le doc de retours Jinashi (`retours_warhammer_tactic_jinashi.odt`, 2026-07-07), la légende de couleurs de FOND = statut dev : **vert `#81d41a` = « Fait et ok »**, **jaune `#ffff00` = « Ok, mais »**, **rouge `#ff0000` = « Pas fait »** ; texte vert/rouge (canal distinct) = sentiment +/−. J'avais flaggé F11 (« hauts-faits ») et F12 (« BF(3)+4 ») comme POISON (« étiquetés Fait mais le code ≠ la demande littérale du joueur »). L'utilisateur a corrigé : « **Regarde les couleurs du document** » — F11 et F12 sont **verts (Fait)**, donc **finis par décision du dev** (F12 : le total résolu `(7)` entre parenthèses satisfait l'intention ; F11 : onglet Background éditable via Ambitions livré par #79, « hauts-faits » n'était qu'un « peut-être »).

**Why:** le surlignage de statut est posé PAR le dev/utilisateur, pas par le joueur — un vert « Fait » est sa décision de périmètre, PAS une auto-évaluation périmée à réfuter au code. Sur-littéraliser la formulation du joueur (« hauts-faits », « BF(3) ») pour rouvrir un point vert fabrique du **faux-poison** et du bruit (l'inverse exact de l'erreur qu'on craignait). Le dev avait raison : il n'y avait AUCUN vrai poison. Le vrai « ne fais confiance ni à moi » s'exerce sur les JAUNES et NON-TRIÉS (là où le statut est incertain), pas pour re-litiguer les verts tranchés.

**How to apply:** ne transformer en issue QUE les points **jaunes (Ok-mais)** et **non-coloriés (non triés)** ; un **vert (Fait)** ne s'ouvre pas et ne se qualifie jamais de poison, même si l'implémentation diffère du mot exact du joueur. Les `=>` du joueur sont ses raffinements post-fix : un `=>` sur un point resté jaune = travail réel restant. Toujours réconcilier d'abord contre les issues DÉJÀ fermées (ici tout le lot #70-80 = playtest:jinashi) avant d'ouvrir quoi que ce soit. [[feedback-playtest-themes-not-points]] [[feedback-audit-nest-pas-ordre-de-travail]] [[game-json-data-add-guardrail]]
