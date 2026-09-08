---
name: user-arbitrage-tests-sur-scenes-dediees-jamais-sur-scenes-utilisees
description: "Arbitrage user 2026-09-07 : un test se joue sur une scène CRÉÉE POUR LUI (fixture, authoring ASCII, scénario de test), jamais sur une scène UTILISÉE (campagne, Diligence, Arène) — une carte que le joueur ou l'auteur édite ne doit rougir aucun test"
metadata:
  type: user
  originSessionId: 1c0e1f9a-0a0e-4b10-ab45-a52c36d41f83
  modified: 2026-09-07T19:36:19.850Z
---

**Verbatims (2026-09-07, chantier #1709 lot D0)** :
- « diligence-projet.test.ts, c'est le truc qui fait que si je veux modifier cette carte vue qu'elle est dans mes scénarios, le test devient rouge et qu'on doit le modifier a chaque fois ? »
- « Franchement si on veut faire de test, faites les sur des scenes créé spécialement pour ces tests, pas sur des scénes qui sont utilisés ... »

**Contexte** : `src/scenes/diligence/diligence-projet.test.ts` figeait une photographie de la carte de campagne (668 murs, 422 surfaces, 18 pièces, cellier 12/12/8, 32×38, paliers `[1,2,3,4]`, ids des scènes) et `src/scenes/arene/arene-projet.test.ts` les 18 scènes du projet — toute édition de la carte rougissait le test. Le premier réflexe (convertir les comptes en propriétés SUR la carte réelle) a été écarté par le second verbatim : la carte utilisée n'est pas un terrain de test du tout.

**Why** : une scène de campagne est de la DONNÉE éditable par l'auteur ([[feedback-toute-donnee-de-scene-editable-sans-ia]], [[user-doctrine-campagne-jamais-generee-par-script]]) ; un test qui la lit en fait un contrat figé, et son rouge n'attribue aucun défaut au moteur. Ce qu'un tel test voulait prouver (le relief porte la liaison verticale, une porte relie deux pièces, `pathTo` atteint l'étage) est une propriété du MOTEUR, qui se prouve sur une fixture minimale et nommée. Même classe que [[feedback-test-jamais-un-cardinal-vivant-ni-un-magasin-partage]].

**How to apply** : un test qui a besoin d'une scène la CONSTRUIT (authoring ASCII `src/scenes/asciiMap.ts`, ou un scénario sous `src/scenes/test-scenarios/` — skill `creer-un-scenario-de-test`) ; aucun test n'importe `diligenceCampaign`/`arene-projet.json` pour asserter leur contenu. Ce qui reste licite sur les scènes utilisées : les gardes GÉNÉRIQUES jouées sur toutes les scènes livrées (parse du schéma, invariants structurels comme « aucune arête dupliquée » — `wallIndex.test.ts`), jamais une assertion qui nomme une scène et son contenu. Avant tout brief de test touchant `src/scenes/**`, relire cette fiche.
