---
name: feedback-adversaire-reel-valeur-nue-anomalie
description: "Un adversaire/participant est une ENTITÉ À FICHE par défaut — une valeur nue à sa place est une anomalie d'homogénéité à résorber en lot, jamais une question ticket-ou-lot"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 032f0876-8eb3-421a-bddc-50a550c9bc09
  modified: 2026-08-13T20:50:22.365Z
---

2026-08-13, #1279 S4 (verbatim) : « Drole de question, encore un peu et tu vas m'annoncer que la course poursuite se joue contre nos propres héros ou contre une valeur fictive plutot que des vrais adversaires » — en réponse à ma question « ticket ou lot ? » sur les adversaires de taverne à fiche.

**Why :** le projet joue des ENTITÉS (Combatants à fiche : compétences réelles, effets par [[game-traits-trigger-aura-mechanisms]] `fireTriggers`, bourse, États). La direction produit de l'utilisateur : les adversaires sont RÉELS (le gnome/la halfling de NADJ, Phillipe Descartes d'EDO T1, les rosters du tournoi #1302), jamais des valeurs fictives.

⚠ CORRECTIF (2026-08-13, STOP du codeur S4) : ma justification initiale « la Poursuite joue déjà de vrais Combatants adverses » était FAUSSE — `PursuitFoe` = `{label, movement:number, skill:number}`, valeurs nues sans rangée (pursuitFlow.ts:57). L'adversaire abstrait était la forme UNIQUE du socle, pas une anomalie d'un seul client. La direction produit reste valide ; ma prémisse de code, non.

**How to apply :** (1) la direction « adversaires réels » se traite en lot du chantier courant, pas en ticket différé ni AskUserQuestion — c'est du PRODUIT recadré par l'utilisateur. (2) La valeur simple peut RESTER comme kind supplémentaire (figurants : « valeur unique, pas 7 statblocks ») mais jamais comme SEULE forme. (3) LEÇON DU CORRECTIF : toute affirmation de code dans MES briefs (« X fait déjà Y ») se MESURE avant d'être écrite — un codeur consciencieux la vérifiera et le brief faux coûte un aller-retour ; cf. [[feedback-verifier-les-claims-architecturaux-des-agents]], qui vaut aussi pour l'orchestrateur.
