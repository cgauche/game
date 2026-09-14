---
name: user-doctrine-chantier-outille-sans-reinventer
description: "Une session déroule le workflow de bout en bout (worktree, suivi, commits, CI, tests, publication, fermeture) avec les outils du dépôt — jamais en réinventant un geste à la main"
metadata:
  node_type: memory
  type: user
---

**Verbatim (2026-09-14)** : « Moi ce que je veux c'est qu'une session puisse travailler convenablement en suivant notre workflow sans devoir réinventer la roue, que ce soit le worktree que le fichier de suivis, les messages de commits, la ci, les tests, etc ... »

**Verbatim (2026-09-14)** : « Ca me rends dingue que tu ais a faire des commandes git sur la branche principale » — dit pendant le Lot 1 de #1750, après un `git worktree add` joué depuis l'arbre principal parce que `ops:chantier` refusait tout autre point de départ.

**Verbatim (2026-09-14)** : « En tout cas il est important d'offrir des outils qui ne demande pas de ma part une validation de la creation ou la modification d'un fichier, ou ca serait absurde » — dit le même jour, après qu'une session voisine (#1508) a mesuré que la branche `Write` de `scripts/hooks/enterine-guard.mjs` demande une validation sur un tag `[entériné …]` DÉJÀ présent sur le disque.

**Contexte** : dit à la clôture de #1736 (le train de publication devenu `npm run ops:publier`), quand l'orchestrateur a demandé ce qui méritait amélioration ; prolonge l'arbitrage du même jour consigné sur #1736 (« pourquoi on doit tout faire a la main ? »).

**Why :** chaque geste du régime (ouvrir un chantier, tenir le suivi, écrire un message de commit conforme aux hooks, jouer gates et CI, publier, fermer) rejoué à la main par chaque session coûte la cérémonie ET produit des variantes : un hook qui refuse, un solde mal formé, un worktree sous-équipé, un log de train perdu. Le régime est FIXE, donc il s'outille ; ce qu'une session doit encore inventer est un défaut de l'outillage, pas une compétence attendue d'elle.

**How to apply :** avant d'écrire à la main un artefact du régime (worktree, TODO de vague, solde `.claude/soldes/<N>.md`, message de commit avec `REFUTATION:`/`JUGE:`/`CLIQUET:`, brief de codeur, revue de palier, train de publication, pilotage), chercher l'outil `scripts/ops/*` qui le pose ; s'il n'existe pas ou refuse dans un cas réel, c'est un ticket `domaine:outillage` à traiter dans le geste, et la mesure (commande + sortie) va au ticket. Un outil qui ne sait pas se jouer depuis n'importe quel worktree, ou qui exige de « savoir » quelque chose que le dépôt déclare déjà (`ECRIT_LU`, `ci.yml`, le hook), réinvente la roue chez l'appelant. L'ARBRE PRINCIPAL n'est jamais un point d'entrée : aucune commande git ne s'y joue à la main (ni `worktree add`, ni `pull`, ni `branch -d`) — si le seul moyen d'avancer est une commande git sur l'arbre principal, c'est l'outil qui est en défaut, et le geste attend son correctif. Un outil ou un hook ne demande JAMAIS à l'utilisateur de valider la création ou la modification d'un fichier : un hook `PreToolUse` sur `Write`/`Edit` juge le DELTA contre le disque, jamais le contenu entier, et ne rend `ask` que pour un fait NOUVEAU qu'il mesure ; toute demande de validation vue par l'utilisateur pour un geste d'outil est un défaut de la classe « hook = contenu entier », Lot 3 de #1750, corrigé dans la vague qui l'a rencontré. Épique porteuse : #1750 (phases en prose : ouvrir/publier/nettoyer depuis tout worktree, suivi généré, commit conforme, briefs gabarités, coût des gates #1738).
