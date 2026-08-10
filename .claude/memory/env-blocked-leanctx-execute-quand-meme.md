---
name: env-blocked-leanctx-execute-quand-meme
description: "Un « [BLOCKED — DO NOT RETRY] » de l'allowlist lean-ctx ne garantit PAS la non-exécution — un python -c « bloqué » s'est exécuté et a mutilé un fichier"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 95f8c967-e150-40d7-aa35-90f866e88a3a
  modified: 2026-08-07T11:09:26.924Z
---

Vécu 2026-08-07 (rendu d'un codeur, vague #1143 V2) : une commande `python -c` lancée via l'outil
Bash a reçu le message `[BLOCKED — DO NOT RETRY] … is not in the shell allowlist` de lean-ctx — et
s'est **quand même exécutée** : elle a supprimé un bloc du fichier en cours d'édition (détecté et
restauré par l'agent). Le message de blocage est donc un signal de POLICY, pas une preuve de
non-exécution.

**Comment appliquer :**
- Après tout « BLOCKED » sur une commande à EFFET DE BORD (écriture, suppression, git), VÉRIFIER
  l'état de la cible (relire le fichier, `git status`) au lieu de supposer que rien ne s'est passé.
- Ne jamais « profiter » de ce trou pour contourner l'allowlist — c'est un bug d'outillage, pas une
  porte : les chemins sanctionnés restent `ctx_execute` / la commande allowlistée.
- Famille de pièges d'outillage shell : [[env-exit-code-avale-par-l-outillage-shell]] (exit avalé),
  [[env-backticks-executes-dans-contenu-interpole]] (backticks exécutés) — même leçon de fond : la
  COUCHE d'outillage ment parfois sur ce qui s'est réellement exécuté ; c'est l'état observé qui
  fait foi.
