---
name: game-affichage-structure-plus-renderer
description: "Doctrine user 2026-07-10 (#295) : « reprendre la main sur ce qu'on affiche » — les flux n'ont PAS le droit de produire une chaîne d'affichage ; ils émettent de la STRUCTURE (ids + conséquences typées), UN moteur de rendu par surface compose selon des règles uniques, gabarits dans UN catalogue paramétrable. Le combat (journal structuré + réalisateur) est LE patron à généraliser."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dcfa9f52-337e-40a6-9036-fb84db19e703
---

**Mandat (2026-07-10, sur le chantier seam/#295)** : « Il faudrait surtout reprendre la main sur ce qu'on affiche pour que cela suive toujours les mêmes règles et qu'on puisse juste modifier certains paramètres. » Déclencheurs : titres de jet assemblés en template-string par chaque site, libellés de compétence recodés, et des lignes de dénouement qui ré-impriment le résultat du jet visible juste au-dessus.

**Why** : un composeur que les sites APPELLENT reste esquivable (le prochain codeur écrit sa chaîne). L'inversion de contrôle rend la dérive inexprimable : pas d'API pour produire du texte depuis un flux → pas de variante possible ([[feedback-gardes-structurelles-pas-greps]]).

**How to apply** :
- Un flux émet un ÉVÉNEMENT structuré : `{ kind, acteur/skill/difficulty en IDS, conséquences: GameOp/typées, paramètres }` — jamais une chaîne.
- UN renderer par surface (modale de jet, ligne de PV, journal) compose le texte ; les gabarits vivent dans UN catalogue (patron `fr.ts` — c'est là qu'on « modifie des paramètres », multilangue-prêt).
- Règle dure : la ligne de dénouement énonce la CONSÉQUENCE, l'outcome (dé/cible/SL) n'est rendu que par la rangée de jet — la signature de l'événement ne porte pas l'outcome à formater.
- Le patron existe : journal de COMBAT structuré + réalisateur ([[game-combat-events-structures]]) — GÉNÉRALISER, ne pas réinventer.

Relié : [[game-ids-internes-libelles-display-multilangue]], [[feedback-personne-ne-lit-le-journal]], [[game-rollflow-canonical-system]].
