---
name: env-budget-horloge-agents-2026-09-08
description: "Mesuré 2026-09-08 (#1692 correctifs) : un juge de diff SANS budget a pris 3 h 15, un codeur de corrections 11 h 17 d'horloge (machine à 100 % de mémoire pendant la suite du pair) — tout brief porte un BUDGET d'horloge et un rendu à l'échéance ; un claim « banc vert » d'un codeur se rejoue avant le commit"
metadata:
  type: feedback
  originSessionId: 4407a64f-b0ad-4d3d-b30f-ffca252025d6
---

**Mesuré (2026-09-08, wt-1624, correctifs du lot 2 de #1692)** : juge de diff « registre de tables vif » = 11 698 s (3 h 15) ; codeur « fermer l'angle mort alias JSON » = 40 603 s (11 h 17) — pendant que la suite complète du pair saturait la machine (« mémoire système max : 31,2 Go / 31,2 Go (100 %) » au rapport `[diag]`). Cause mesurée du codeur de 11 h : un job de mesure lancé en fond AVANT sa propre correction de deux boucles infinies de la garde (`bindingsVifs.mjs`) est resté PENDU sur l'ancien code ; l'agent a attendu ce job au lieu de le tuer — un job de fond qui dépasse 10× son coût attendu se tue et se rejoue sur le code courant. Le juge suivant, briefé avec « BUDGET : 30 minutes, rends à l'échéance », a rendu en 9 min 30 un verdict aussi dur (un rouge bloquant trouvé, un claim de codeur réfuté).

Deuxième fait : le codeur affirmait « `comment-poison-guard` → 74 tests, EXIT=0 » ; le juge a rejoué le banc : ROUGE sur une ligne introduite par le lot. Un claim de banc vert n'est pas une preuve — il se rejoue (par le juge ou par l'orchestrateur) avant tout commit.

**Why:** un agent sans échéance explore jusqu'à épuisement du sujet ; sur une machine saturée chaque banc coûte 10× ; l'utilisateur a déjà dit « C'est super long non ? » ([[feedback-train-court-codeur-rend-apres-gates]]).

**How to apply:** chaque brief de juge/codeur porte « BUDGET : N min d'horloge, rends à l'échéance ce qui est fait, le reste NOMMÉ » (juge de diff : 30 min ; codeur de corrections : 45 min ; codeur de lot : 2 h) ; avant de dispatcher un banc lourd, regarder si une suite voisine tourne (`qui-tient-le-verrou.mjs`) ; les bancs cités par un codeur sont rejoués par le juge (le brief du juge le demande). Liens : [[env-charge-machine-un-seul-agent-lourd]], [[feedback-verifier-les-claims-architecturaux-des-agents]], [[feedback-workflows-multi-lentilles-multiplient-le-grounding]].

**Mesure 2026-09-09 (#1715)** : un BUDGET écrit dans le brief n'est PAS une borne — codeur « placeholder + recapture » brief 30 min → 3 h 20 (11 867 s), codeur volet (b) 90 min → 68 min, codeurs (a) 75 → 37 min. Le harnais ne coupe rien : seule une borne EXTERNE borne (Monitor sur l'horloge + TaskStop à l'échéance, ou brief à livrable UNIQUE — une recapture Playwright est un gouffre : viser une mesure DOM (`getComputedStyle`) plutôt qu'un rejeu de parcours).
