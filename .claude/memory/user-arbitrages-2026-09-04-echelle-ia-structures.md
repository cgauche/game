---
name: user-arbitrages-2026-09-04-echelle-ia-structures
description: "Deux arbitrages user du 2026-09-04 (soir) : échelle de la Diligence = 2 m/case RAW conservée (#1507 option A) ; l'IA ne cible des structures qu'en SIÈGE, bornées par l'arme et un rayon de plan (I-20/I-17 de #1680). Plus le rappel : avant de recommander sur une question d'UX/produit, regarder l'ÉTAT DE L'ART."
metadata:
  type: user
  originSessionId: 4407a64f-b0ad-4d3d-b30f-ffca252025d6
  modified: 2026-09-04T19:42:27.484Z
---

Questions posées par AskUserQuestion le 2026-09-04 (options = assertions), réponses verbatim :

1. **Échelle de la Diligence (#1507)** — « à 2 m par case (LDB 15 l.12), l'auberge mesure 64 × 76 m, chambres de 4×4 à 6×8 m, portail de 8 m » → **« A — 2 m/case, RAW »** : état actuel conservé, rien ne bouge à l'écran, #1507 se ferme sur cette question (fermeture par commit `corrige #1507`, jamais à la main).

2. **IA et structures (I-20 / I-17 de #1680)** — « l'IA énumère une approche vers les 668 arêtes ciblables de la Diligence à chaque tour (225 784 candidats) et un gobelin peut tirer sur un mur » → **« Structures ciblables en siège seul »** : hors siège, aucune structure n'entre dans le choix de cible ; en siège, seules celles que l'arme peut abîmer, dans un rayon de plan. C’est un CHANGEMENT DE DÉCISION de l’IA (invariant à écrire, juge de design, journal des décisions AVANT/APRÈS attendu différent et nommé). Le moteur n’avait AUCUNE notion de siège (lecteur 2026-09-04 : toute arête à `structure` devient un combattant à chaque combat, 668 sur la Diligence) → question « Qu’est-ce qui fait d’un combat un SIÈGE ? » → **« Un drapeau de RENCONTRE, éditable »** : la rencontre déclare `siege: true` dans l’éditeur, défaut false ; la Diligence n’est jamais un siège sauf si un auteur le dit.

3. **Fusion des matières (#1680 ligne 10)** → **« Oui, chantier #1463 »** : dataset à discriminant `domaine`, 5 domaines (`propMaterials`, `roofMaterials`, `reliefMaterials`, `structureAppearance` JSON, `TERRAIN_DEFS` TS), arbitrage pixel `ardoise` à l'écran — nouveau chantier, une session dédiée (régime une session par chantier).

4. **Picking des features de façade (#1680 ligne 13)** — REFUSÉ tel que posé, puis TRANCHÉ après état de l’art (NWN placeables statique/utilisable + OnUsed ; BG3 Alt = tooltips du monde sur les interactifs seuls ; RT Tab maintenu) : question « Ligne 13 reposée : quel modèle pour le décor ? » → **« Statique / utilisable, comme NWN et BG3 »** — une `PropData` déclare `usable` avec ses actions (vocabulaire Flow/GameOp existant), tout utilisable porte identité de picking + nom au survol + surbrillance à la touche ; portes, sièges, pièges rejoignent ce modèle. Chantier (ticket dédié, une session). Premier refus : « Drole de recommandé. On peut mettre des actions sur le décors non ? Tu sais quoi, quand tu te pose ce genre de question, regarde l'état de l'art avant » → la question n'est pas « une cheminée se désigne-t-elle ? » mais « le décor porte-t-il des ACTIONS, comme dans les RPG de référence ? » ; l'état de l'art (NWN placeables « usable », BG3 objets interactifs surlignés au survol, Rogue Trader) se lit AVANT de reposer la question.

5. **Validation de GOÛT des décors volumiques (#1624)** — planche QC `public/props-volumiques.html` (cuisson réelle, socle #1680) envoyée → **« La planche me va, tu peux valider #1624 »** (2026-09-04) : la validation d’écran de #1624 est acquise ; la fermeture passe par son lot 3 — recette JOUÉE le 2026-09-04 sur l’arbre principal (enseigne vue par la tranche après rotation, cheminée masquée par le toit, rien ne transparaît de l’intérieur, picking intact ; preuve « autres scènes » non jouable, couverte par la planche) — puis un commit `corrige #1624` avec solde `.claude/soldes/1624.md` et six captures `public/qc/1624-lot3/`. #1644 (mobilier, même planche) n’a PAS été nommé : ne pas le fermer sans son mot.

**Why:** ces choix ferment #1507, ouvrent un chantier (#1463 matières) et un lot (IA siège), et recadrent la ligne 13. **How to apply:** ne jamais reposer 1-3 ; pour 4, produire une note d'état de l'art avec sources, puis une question dont les options sont des modèles d'interaction existants. Liens : [[user-doctrine-etat-de-lart-avant-invention]], [[project-1680-socle-volumique-etat-2026-09-03]], [[feedback-option-askuser-porte-une-assertion]].
