---
name: game-existant-poc-refactor-libre
description: "TOUT l'existant du RPG est un POC — détruire/refactorer librement pour des bases saines ; zéro rétro-compat, deprecated, code mort ou dupliqué."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5b5e1576-6e66-4371-b038-61f34984d882
---

**TOUT le code existant du jeu est un POC** (pas seulement `src/gameIso/`/sprites/IsoStage). L'utilisateur (réaffirmé 2026-06-13) : « Pas de rétro-compatibilité, de deprecated, de code mort, de code dupliqué. L'existant est un poc, n'hésite pas à modifier voire détruire l'existant pour avoir des bases saines. »

**Why:** mes premières propositions visaient « drop-in, zéro rewrite » par prudence ; l'utilisateur veut au contraire qu'on relève le niveau architectural et qu'on supprime franchement plutôt que d'empiler des couches de compat. Une migration n'est PAS finie tant que l'ancien chemin survit en parallèle (shim, re-export deprecated, branche « legacy », fonction doublon) — on retire l'ancien dans le même mouvement.

**How to apply:** remplacer proprement plutôt que contourner ; quand on migre X vers une nouvelle abstraction, **détruire l'ancien X** (pas le garder « au cas où »). Pas de garde de rétro-compat, pas de `@deprecated`, pas de code mort, pas de duplication (centraliser dans la primitive/le registre — cf. [[feedback-no-commit-perfectionism]], [[game-supprimer-legacy]]). RESTER discipliné : détruire ce qui sert la tâche en cours, pas un sweep non lié ; et l'arbre git est PARTAGÉ par des sessions // → ne pas raser des fichiers qu'une autre session édite ([[feedback-no-commit-surgery-shared-tree]]). Voir [[game-visual-direction]], [[game-bestiary-sprite-bar]].

**GRANT SPÉCIFIQUE FRONT ART (2026-07-11, verbatim)** : « ne pas oublier que les navires comme les armes de siège et véhicules c'est vraiment du poc, je te laisserai[t] toute la latitude pour refaire les choses biens. » — Latitude TOTALE pour REFAIRE (pas rafistoler) la machinerie ET l'art des rigs navires / engins de siège / véhicules : redesign propre (multi-vues, registres, échelles) plutôt qu'extension du POC. S'applique au front art ouvert le même jour (inventaire couverture visuelle + moisson art-ref + vagues Fable, cf. [[feedback-svg-art-fable-pas-opus]]).

**COROLLAIRE CORRECTION (2026-07-05, fort) : le comportement de l'existant n'est PAS un oracle.** Le POC peut être INFIDÈLE au RAW, pas seulement mal architecturé. Donc migrer ≠ recopier « à parité » : pour chaque règle migrée, ROUVRIR `Source/`, vérifier la règle réelle, et migrer la version CORRECTE — corriger l'écart, jamais préserver le bug. Les commentaires qui avouent une interprétation (« mappé de façon monotone », « artefact de conversion ») sont un drapeau rouge à re-vérifier ([[game-raw-comments-suspect-read-source]]). Un test réécrit doit asserter le **RAW vérifié**, JAMAIS le comportement de l'ancien code (sinon on enshrine le bug). Ne JAMAIS donner à un agent une consigne de « parité de comportement stricte » sur du code métier RAW — lui demander de vérifier la source et corriger. Cf. [[feedback-fidelite-raw-et-editabilite-non-negociables]], [[feedback-ne-pas-faire-confiance-commentaires]].
