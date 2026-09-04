---
name: project-1463-cloture-sous-decision-2026-09-01
description: "Épic #1463 (un concept = une structure) au 2026-09-01 soir : grand juge = FERMABLE SOUS DÉCISION — 3 décisions d'objectif à l'utilisateur (#1654 AST 71, #1620 TypeChecker, #1657 concept test), puis #1388"
metadata: 
  node_type: memory
  type: project
  originSessionId: 39a8970a-cba9-474a-be43-12bdf0b366e7
  modified: 2026-09-01T13:01:22.050Z
---

État au 2026-09-01 ~18h (HEAD 9739ee1f4+, pilotage final au ticket, issuecomment-5494198273).

**Fermés cette session** : #1548, #1552, #1553, #1616, #1640, #1457 (8 trains, réfutation de fermeture TIENT),
#1633 (concepts d'enveloppe, hors-strate 1157→1145 exact). Vagues voisines terminées : plage, monnaie,
reference (session d'audit) ; décors #1624/#1644 (game-66, session close).

**Grand juge d'épic (sur pièces)** : clause 1 TIENT · clause 2 PARTIEL (grammaire/ est le porteur réel —
corps amendé ; concept `test` 65 lignes/302 occ sans forme cible → #1657 ; « une porte moteur » non
instrumentée) · clause 3 PARTIEL porté (#1654 : AST 71→0, plafond 76 à resserrer à 71, 2 angles morts :
defs-scenes hors scan, lexique fermé = plafond de détection) · clause 4 RÉFUTÉE portée (#1620 : (i) phrase
vraie livrée, (ii) TypeChecker 173 l. + (iii) dérivation TARGETS ouverts).

**Les 3 décisions — TRANCHÉES par l'utilisateur le 2026-09-01 (verbatim aux tickets)** : « Garder l'épic
ouvert jusqu'à 0 » (AST) · « Financer #1620 (ii) TypeChecker AVANT #1388 » · « Avant #1388 — l'épic reste
ouvert » (concept test) ; puis « Pas de demi-migration j'ai dit, ça sert à quoi si on ferme l'épique sans
avoir terminé ? » → [[feedback-epic-ne-se-ferme-jamais-sur-tickets-ouverts]] (mes « recommandés » étaient
à contresens de la doctrine).
**Comment appliquer :** #1463 RESTE OUVERT ; séquence = #1657 (concept test : forme cible en grammaire/,
migration, stock −65, AST −30) → #1620 (ii) TypeChecker puis (iii) dérivation TARGETS → #1654 (AST → 0,
inventaire nominatif par concept, décrue partagée avec les vagues de résorption voisines) → NOUVEAU grand
juge → seulement alors #1388. Dettes d'outillage hors DoD (#1640-#1656) restent sériées après.

Liens : [[project-1467-l1b-livre]] (carnet de dépilage), [[game-train-chirurgical-portes-sur-l-index]]
(5 occurrences, règle suite complète), [[feedback-attribution-rouge-suite-sonde-arbre-committe]],
[[feedback-pilotage-epic-commentaire-github]].

**État 2026-09-04 (session unique #1463, main = 34f31f185)** : #1657 B2c + B3-0/1/1b/2/3 POUSSÉS (résolution par la porte canonique : critiques, amputations, équipage, maladies, Cauchemars ; `AUTO_RESOLUS` supprimé, garde `flowTestEngineRoll` BLOQUANTE, assertion inverse au registre, `SAVE_VERSION` 46) ; #1685 fermé par 8b52f3a55 + solde. Reste dans l'ordre validé : B3-2b (cible du coup à l'équipage = station nommée par le livre, `Combatant.shipStation` jumeau de `shipRole`, 9 nœuds MDG manquants, écran d'affectation = MAQUETTE à valider ; design jugé `#1657` issuecomment-5520816290) → B2e météo → #1681/#1684 → famille table (+#1683) → #1620 (iii) → L1a/L1c → restes #1654 → portes → gardes → #1437 + #918 (juge de grounding d'abord ; `calmeValue` 13 sites de psychologie de combat y est routé) → réitération #1673. Arbre principal bloqué à 7692b631c par un WIP voisin sur 15 docs dérivés (signalé à game-a3) — l'intégration se lit sur origin/main.

**État 2026-09-04 soir (main = 072d8ccaf)** : B3-2b-a (stations à bord, `crewTarget` union, foyer unique des traits navals) et B3-2b-c (« Tomber du gréement », op `fall`, `applyFall` en `src/engine`) POSÉS ; B3-2b-b (écran « Stations à bord », maquette validée, recette obligatoire) EN COURS. Verdict retenu (juge de diff B3-2b-c) : une MAGNITUDE tirée après un Test déjà surfacé (hauteur de chute, dégâts) reste journalisée, hors doctrine des étapes à TABLE — re-statuer sous #1508 (dés de monde). Reste ensuite : B2e météo → #1681/#1684 → famille table → #1620 (iii) → L1a/L1c → #1654 → portes → gardes → #1437 + #918 → réitération #1673.
