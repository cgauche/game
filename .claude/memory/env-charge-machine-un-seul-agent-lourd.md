---
name: env-charge-machine-un-seul-agent-lourd
description: "CONTRAINTE MACHINE (2026-08-06) : les reprises à charges parallèles ont GELÉ et REDÉMARRÉ le PC de l'utilisateur (×3) — UN seul agent lourd à la fois, suite complète SEULE et jamais en fond, workers Vitest bornés"
metadata: 
  node_type: memory
  type: project
  originSessionId: 032f0876-8eb3-421a-bddc-50a550c9bc09
  modified: 2026-08-06T08:08:47.617Z
---

⚠ LEVÉE (2026-08-06, verbatim utilisateur) : « N'attends pas, le soucis de reboot c'est terminée » — la contrainte stricte UN-seul-agent-lourd est LEVÉE ; le parallélisme redevient permis. GARDER par hygiène : suites bornées (`--minWorkers=1 --maxWorkers=N` — le piège du faux vert reste réel), pas deux suites complètes simultanées, briefs d'agents en suites ciblées.

Vécu (2026-08-06, verbatim utilisateur) : « A chaque fois que je te demande de reprendre, mon PC freeze et redémare » — trois gels/redémarrages Windows corrélés aux reprises de session qui relançaient d'un coup : un codeur (suites Vitest à N workers) + une suite complète en arrière-plan + le serveur dev + possiblement la session d'ART exécutant sa propre suite. Machine : 32 Go de RAM. Diagnostic à froid : arbre sain (4 node, 315 Mo) — c'est le PIC de superposition qui tue, pas une fuite.

**Why :** deux suites complètes simultanées (1 178 fichiers × workers Node) + navigateurs Playwright peuvent saturer RAM/CPU au point du gel matériel.

**How to apply :**
- **UN seul agent lourd à la fois** (codeur OU juge exécutant des tests) — plus jamais 2-3 en parallèle, même sur périmètres disjoints ; les juges purement lecteurs restent OK en parallèle d'un codeur.
- **La suite complète (`npm test`) : UNE fois, SEULE, au gate de commit** — jamais en `run_in_background` pendant qu'un agent tourne ; la borner (`npx vitest run --minWorkers=1 --maxWorkers=4`) pour les gates.
- ⚠ **PIÈGE (mesuré 2026-08-05 par le juge)** : `--maxWorkers=N` SANS `--minWorkers=1` sur ce dépôt → `RangeError: minThreads/maxThreads conflict` AVALÉ : *0 suite exécutée*, `"success":true`, RTK affiche `PASS (0) FAIL (0)` — **faux vert total**. Toujours apparier `--minWorkers=1 --maxWorkers=N`, et ne croire un vert QUE s'il porte un COMPTE de tests > 0.
- Les briefs d'agents disent : suites CIBLÉES uniquement, la complète appartient à l'orchestrateur.
- À la REPRISE d'une session : relancer les agents UN par UN, jamais tous d'un coup ; vérifier la charge d'abord (Get-Process node + RAM libre).
- Coordination inter-sessions : si la session d'ART tourne, ne pas lancer ma suite complète en même temps que la sienne (l'utilisateur alterne).
Cf. [[env-session-background-pieges-outils]], [[game-tests-isolate-false-speedup]].
