---
name: feedback-train-court-codeur-rend-apres-gates
description: "« C'est super long non ? » (2026-09-06) — 17 h d'horloge pour deux trains : un train = 4-5 gestes au plus, le codeur RENd APRÈS avoir joué les gates complètes (il prend le verrou machine), et tout moniteur détecte le REFUS du verrou au lancement (40 min perdues en silence ×2)"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 02e357dc-4cb8-4e52-8966-93c37c1ab79e
  modified: 2026-09-07T08:28:39.746Z
---

Verbatim utilisateur (2026-09-06, 12 h 50) : « C'est super long non ? » — après dix-sept heures d'horloge pour les trains A et B de #1679 L3b.

Mesuré : codeur B 9 h 30 pour douze gestes (un seul agent) ; cinq passages de gates pour A (le codeur rendait sans les avoir jouées ; chaque passage trouvait un défaut RÉEL hors de son DoD : test:runner, tests `src/` hors `data`, docs dont un test corrigé était la source, porte de stock, magasin d'exports partagé) ; deux refus du verrou machine (suites voisines lancées sans préavis) que mon moniteur, qui n'attendait que « [gates] total », a laissé passer 40 min chacun ; main rouge 3 h par une autre session.

**Why:** un gros train amortit mal les juges et les reprises (chaque correction rejoue 10-15 min de gates) ; un codeur qui rend sans gates externalise chez l'orchestrateur N cycles de gates + reprises, là où un seul cycle chez lui suffirait ; un moniteur qui ne connaît qu'un seul état terminal se tait sur les autres (« la couverture — le silence n'est pas un succès »).

**How to apply:**
- Un train = 4 ou 5 gestes au plus ; au-delà, scinder (C → C1/C2) avant de briefer.
- Le brief de codeur porte au DoD : « PUIS `npm run gates` complètes, 22/22, lues ; le verrou machine peut refuser — attendre, jamais forcer ; une gate rouge = corriger et rejouer ; ne pas rendre sur du rouge ». L'orchestrateur ne rejoue que si l'arbre a bougé (rebase).
  ⚠ Précision mesurée 2026-09-07 (#1709 train A) : `npm run gates` REFUSE un arbre non committé au périmètre de la clé (`toutes.mjs`, « REFUS — l'arbre porte N chemin(s) non committé(s) ») et le codeur n'a pas le droit de committer → le cycle réel est : codeur rend le diff + vérifications ciblées → orchestrateur committe (message par FICHIER, `-F <chemin>` ; `-F -` refusé par le garde de solde) sur la branche du worktree → gates (détachées, `--serie`) → juge de diff en parallèle → corrections = nouveau train court → commit unique par squash par diff cumulé + gates. Le worktree se crée sur `origin/main` (jamais sur `main` local, 74 commits de retard vécus) et reçoit `npm ci` + `npm --prefix server ci` avant les gates. Un worktree lié n'a PAS les `.pdf` gitignorés de `Source/` : les gains liés aux PDF ne se mesurent que sur l'arbre principal.
- Tout moniteur de gates détecte AUSSI « rien n'a été joué » / `[verrou]` et la fin du processus ; un lanceur détaché imprime son code de sortie.
- Préavis aux sessions AVANT le dispatch du codeur (ses gates viendront à une heure inconnue) et à chaque relance.
- Voir [[feedback-workflows-multi-lentilles-multiplient-le-grounding]], [[env-charge-machine-un-seul-agent-lourd]], [[feedback-test-jamais-un-cardinal-vivant-ni-un-magasin-partage]].
