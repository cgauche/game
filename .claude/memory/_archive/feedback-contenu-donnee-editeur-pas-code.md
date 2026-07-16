---
name: feedback-contenu-donnee-editeur-pas-code
description: "Tout scénario/campagne (l'arène incluse) doit être DONNÉE créable dans l'éditeur ; ne JAMAIS modifier du code applicatif pour qu'un contenu fonctionne"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4e6c5100-25b0-4b77-aea8-b26dd13e5d75
---

Un scénario / une campagne **doit pouvoir se créer depuis l'éditeur** et **ne doit nécessiter AUCUNE
modification de code applicatif pour fonctionner**. Le contenu = données ; le moteur = générique.

**Why:** l'utilisateur a corrigé ça plusieurs fois en une session — (1) j'avais ajouté `scenes?` à
l'interface `TestScenario` + modifié `launch()` pour supporter le multi-zones → REVERT (« tu hack » ;
l'éditeur sait déjà charger un projet multi-scènes via `loadProject([scene,...others], id)`) ;
(2) « le système de vague c'est un concept, pas une fonctionnalité » → pas de `WAVES.map()`, juste des
encounters + dialogue flag-gaté en données ; (3) le médecin « ce n'est PAS un PJ » et « si je lui donne
un nom + ses stats + son id, ça marche ? » → oui : nom/id viennent de l'ENTITÉ de scène (`entityId`),
pas codés en dur.

**How to apply:**
- Pour ajouter une capacité de contenu : exposer un **Effet GÉNÉRIQUE** dans `EffectList.tsx` de
  l'éditeur (comme `rest`/`openMerchant`/`restoreFortune`/`medicalAid`), paramétré ; jamais un code
  spécifique au scénario. Si l'éditeur ne sait pas faire qqch → étendre l'éditeur (générique), pas hacker.
- Les **stats/nom/id d'un PNJ** viennent de la `SceneEntity` (label, id, statblock/params), jamais en dur.
- Un contenu se VÉRIFIE en le chargeant par la voie existante (`loadProject` / import éditeur) + `validateScene`, sans toucher au code de l'app.
- L'arène vit en JSON pur (`src/scenes/arene/arene-projet.json`), pas via un helper `arena()` (à retirer partout). Prolonge [[game-arene-data-driven]] et [[game-no-mj-model-everything]].
