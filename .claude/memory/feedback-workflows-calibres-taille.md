---
name: feedback-workflows-calibres-taille
description: "Calibrer les workflows multi-agents (ET la cérémonie de revue) à la taille/risque réelle de la tâche, pas au flag « ultracode » ; pas de fan-out ni de double reviewer sur une petite feature déjà testée."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6a091869-bf82-4c57-9848-2d25a75eaedb
---

L'utilisateur a relevé qu'un workflow 5-lentilles × vérification adversariale (≈10 agents) sur la petite feature Souffle (Fumée) — quelques fichiers, 9 tests — était disproportionné, surtout que TOUT le gros travail combat précédent (attaques de créature, 5 résolveurs spéciaux, etc.) avait été fait en solo, soigné et testé, sans aucun agent.

**Why:** « ultracode ON » pousse à lancer un workflow par défaut sur chaque tâche substantielle, mais l'instruction utilisateur prime (et la cohérence d'approche compte). Fan-out massif sur du petit/bien-compris/déjà-couvert = gaspillage incohérent.

**How to apply:** pour une feature petite, bien comprise et déjà couverte de tests → faire la revue MOI-MÊME, ciblée sur le(s) point(s) réel(s) que j'ai repérés (ici : auto-aveuglement de la créature par sa propre fumée → fix 1 ligne). Réserver les workflows multi-agents aux tâches LARGES, incertaines ou à fort risque (audit de fidélité sur tout le moteur, migration, extraction massive). Même sous ultracode : juger la taille/risque avant de fan-out. Voir [[feedback-decisiveness-routine-git]] (agir lean) et [[feedback-no-padding-status]].

**Complément — cérémonie de revue elle-même à calibrer** (« Vous passez plus de temps à créer vos commits
parfaits qu'à développer ») : ne pas dérouler une revue à deux étages (spec-reviewer + quality-reviewer en
subagents) NI une vérification de scope de commit par subagent sur chaque tâche de `subagent-driven-development`.
Le garde-fou primaire reste **golden master + `npm run typecheck` + `npm test`** (runners en Bash natif) — c'est
ça qui prouve l'iso-rendu, pas un reviewer dédié. Pour une tâche additive/mécanique (registre vide, extraction de
table en fichiers, commit de script) : implémenteur → coup d'œil `git show --stat` + golden vert → commit →
suivant, sans reviewer. Réserver le reviewer adversarial dédié aux tâches à **régression silencieuse** (flips de
migration qui touchent du code partagé hors périmètre du golden : vues back/anim/éditeur) et à l'**art** (l'audit
aveugle EST la revue). Les commits scopés (`git commit -- <chemins>`) restent nécessaires en arbre partagé mais
= un coup d'œil, jamais un subagent.

**Complément 2026-07-05 — modèles ET efforts explicites par étage** (relevé par l'utilisateur : « Sonnet 5, tu utilises quel effort ? Ça bouffe un max de tokens ») : en session ultracode, un `agent()` sans `effort` **hérite xhigh** — silencieusement hors de prix sur un fan-out. TOUJOURS fixer `model` + `effort` explicitement pour CHAQUE étage d'un workflow : lecture/comparaison de masse → `sonnet`+`medium` ; vérification mécanique (existence, famille) → `haiku`+`low` ; jugement dur (réfutation subtile, synthèse) → `opus`+`medium`. **JAMAIS Sonnet 5 en effort haut/xhigh** (user 2026-07-05 : « il coûte plus cher qu'un Opus en medium ») — et jamais d'héritage session implicite (= xhigh en ultracode). ⚠ Le tool Agent n'expose PAS `effort` → un sous-agent Agent hérite du xhigh de session : passer par Workflow (agent() a `effort`) dès qu'on veut plafonner. Piège connexe : `args` du Workflow arrive parfois STRINGIFIÉ → embarquer les listes en const dans le script.
