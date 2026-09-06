---
name: feedback-sonder-la-ci-de-chaque-push-avant-d-enchainer
description: "2026-09-05/06 : après CHAQUE push, sonder la CI du sha AVANT d'enchaîner un train ou une attente longue — un rouge de main bloque le pre-push de TOUTES les sessions ; ma session a laissé main rouge 2 h 30 sur son propre lot pendant qu'elle attendait un juge de palier, et un peer a dû porter le correctif"
metadata:
  type: feedback
  originSessionId: 4407a64f-b0ad-4d3d-b30f-ffca252025d6
---

**Fait (2026-09-05 → 06)** : le lot 3a-2 de #1686 (1658c946a) a rougi `main` sur UN test (`grammaire.test.ts:1038` mutait le registre généré `IDS_PAR_DATASET` en place ; en CI, un fichier du même worker avait chargé `overrides.ts` qui pose la source vivante → `idsVivants()` masquait la mutation ; vert en local, rouge en CI, déterministe). Je n'ai pas sondé la CI de ce push : j'ai enchaîné le train mémoire, un juge de palier de 55 min et des gates, sans relire les notifications. Le pre-push refuse tout push tant que `main` est rouge (#1679 L3 T2) : trois trains de deux autres sessions ont attendu, et le peer `audit-drift-project-plan` a porté le correctif (627451282) sous dérogation « rouge » journalisée à mon nom, après 2 h 30 de messages sans réponse.

**Why** : un push est un acte PUBLIC dont l'effet (vert/rouge) n'est connu que 6 à 8 min après ; sous le régime « pas de push sur rouge », un rouge non traité est une panne partagée. Une session qui enchaîne des attentes longues (TaskOutput bloquant de 10 min, juge d'une heure) ne voit les messages inter-sessions qu'à la fin — trop tard.

**How to apply** :
- Après CHAQUE push : lancer immédiatement la sonde CI du sha en fond (`gh run list --branch main --json headSha,status,conclusion`) et ne dépêcher un juge ou une attente longue qu'APRÈS son verdict, ou en parallèle avec un point de relecture toutes les 10 min.
- Un test ne mute JAMAIS un registre généré ni un magasin partagé (fiche `feedback-test-jamais-un-cardinal-vivant-ni-un-magasin-partage`) : il pose une source synthétique par le seam prévu (`poserSourceDIdsVivants`, qui rend désormais la source remplacée) et la restaure.
- Si un peer signale un rouge sur mon sha : répondre dans le quart d'heure, même « je prends » ; sinon le peer porte le correctif et le dit à mon nom.
- Les attentes bloquantes sur un agent (`TaskOutput` 10 min) se remplacent par une veille silencieuse (`node node_modules/.cache/veille-agent.mjs <transcript>`) qui rend la main aux notifications.
- **Corollaire (2026-09-06)** : au retour de CHAQUE agent, vérifier qu'il ne laisse aucun processus derrière lui (`node node_modules/.cache/processus-wt1624.mjs` : boucles `until`, `run.mjs`, `vitest`). Un codeur du lot 3a-2 avait laissé une boucle `until ! grep -q "verrou" …; do node …suite…; done` qui relançait la suite filtrée à chaque refus de verrou — elle a bloqué trois fois les gates d'un peer (deux sessions en attente) avant d'être trouvée et tuée. Une boucle de relance sur le verrou machine est INTERDITE : le verrou se demande par PRÉAVIS (message au peer), jamais par polling.
