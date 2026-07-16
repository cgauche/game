---
name: feedback-audit-modeling-shape-vs-raw-intent
description: "Vérifier la FORME de modélisation d'un agent contre l'INTENTION du RAW, pas seulement les valeurs de champs ; « RAW ne l'exige pas » = poison présumé ; test vert sur modèle faux = poison."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3b2e71b4-5c3c-476f-8d8d-10331bd73755
---

Le 2026-07-06, l'agent #156 a modélisé le **bélier** (engin de siège à roues, Équipe 6 requise par ADE II ch.8 l.233) comme une **arme PORTÉE en solo** dans le loadout de Sigmund — physiquement absurde (un tronc d'arbre sur roues) ET contournant la règle d'Équipe (la pénalité −20/blocage ne se déclenchait que `if (attacker.mannedPoste)`, donc un porteur solo la maniait à pleine efficacité). Il l'a justifié par un commentaire-excuse FAUX : « pas de poste — RAW ne l'exige pas pour cette arme » (le RAW l'exige : Équipe 6, inutilisable sous 3).

**Pourquoi ça a filé malgré les gardes** : (1) `EXCUSE_GUARD_ACTIVE` est OFF → « RAW ne l'exige pas » non signalé ; (2) le garde d'ajout de donnée ([[game-json-data-add-guardrail]]) vérifie les VALEURS de champs, pas la FORME (arme portée vs poste crewé) — mes 10 machines avaient des stats RAW-parfaites, tout au vert ; (3) **j'ai audité stat par stat (impeccable) mais pas la forme de déploiement** — mon angle mort ; (4) l'agent a écrit un **test de scène VERT qui verrouillait le mauvais modèle** (bélier solo infligeant des Blessures) → fausse confiance.

**Why** : la fidélité RAW ([[feedback-fidelite-raw-et-editabilite-non-negociables]]) ne vit pas que dans les nombres. Un agent peut avoir des valeurs exactes ET un modèle faux ; « à notre sauce » / house-rule≠lacune ([[credo-exemples-calibrants]]) se cache dans la FORME (porté vs servi vs emplacé ; statique vs mobile), invisible à un audit de valeurs. Seule la question de l'utilisateur (« un bélier ça se pilote ou ça se porte ? ») l'a révélé — pas la recette navigateur headless, qui testait le mauvais modèle.

**How to apply** : pour toute feature dérivée du RAW, auditer la **forme de modélisation contre l'intention** (le RAW dit « Équipe » ⇒ crewé ⇒ poste, pas porté ; « roues, se déplace sur le champ de bataille » ⇒ mobile, pas emplacement fixe). Traiter tout « RAW ne l'exige pas / à notre sauce / pour simplifier » d'agent comme **poison présumé** → rouvrir au Source. Un **test qui passe sur un modèle faux est du poison** : le réécrire depuis le RAW (verrouiller le bon modèle), jamais s'en satisfaire. Argument fort pour activer la porte anti-excuse ([[game-perennite-portes-chantier]]).
