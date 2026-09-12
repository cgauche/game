---
name: feedback-solde-de-ticket-obligatoire-au-commit
description: "Fermer un ticket exige un SOLDE mécanique : vérification orchestrateur du rendu + disposition de CHAQUE reste signalé par l'agent (nouveau ticket / corrigé / RAS justifié) — hook solde-ticket-guard"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: adfd4529-35c1-4ae9-85da-f959f7971274
---

2026-07-14, verbatim : « J'en ai marre que tu donne un ticket a un agent, commit et
consigne les résultats dans le ticket tout en le fermant, et oubliant que potentiellement
il n'a pas bien fait son boulot ou qu'il a detecter un problème qu'il a consiédéré comme
hors périmetre et que tu n'as pas mis dans un nouveau ticket » (demande : un hook au
commit qui vérifie les retours — nouveau ticket à créer ? ticket à fermer ? restes ?).

**Why:** le rendu d'agent vit dans le contexte de session et s'évapore ; la fermeture
GitHub, elle, est permanente. Sans gate mécanique, chaque « écart assumé »/« RESTE
signalé »/« hors périmètre » non ticketé devient du backlog invisible (précédent : le
backfill #399-#408 après 3 rappels utilisateur), et un rendu non re-vérifié devient une
fausse complétion.

**How to apply:** AVANT tout commit portant `corrige/fixes/closes/ferme #N`, écrire le
solde `.claude/soldes/<N>.md` : ligne `VERIFIE:` (comment J'AI vérifié le rendu — portes
re-run, diff relu, capture vue) + section `## Restes` où chaque item signalé par l'agent
reçoit sa disposition (`-> #X` ticket créé / `corrigé dans ce commit` / `RAS : <raison>`),
ou `RAS` explicite, + section `## Réfutation` (juge adversarial sur le diff/DoD :
`verdict: CONFIRMÉ|PARTIEL` — un RÉFUTÉ ne se ferme pas). Le hook
`scripts/hooks/solde-ticket-guard.mjs` (PreToolUse Bash|PowerShell) BLOQUE la fermeture
sans solde conforme ; la fermeture elle-même suit la PUBLICATION — le job `fermetures` de
`.github/workflows/ci.yml` (`scripts/ops/fermer-depuis-main.mjs`) poste le solde emporté par
le commit en commentaire et ferme l'issue, après un `build` vert sur `main`. PALIER (2e demande, même jour : « apres un certain nombre de ticket fermé, il
faudrait lancer une review adversarial. Ou a chaque ticket ... c'est peut etre la même
régle » → les deux) : le palier se MESURE sur l'histoire — commits touchant `src`/`scripts`
depuis la tête de fenêtre de la dernière revue ARCHIVÉE (`scripts/guards/lib/revuePalier.mjs`,
`mesureDuPalier`) — PAS un compte de fermetures, et plus un compteur de fichier (il valait 32
pour 9 commits réels, incrémenté par les post-commit de 20 worktrees) ; à 10, plus AUCUNE
fermeture sans une revue adversariale LARGE du cumul, STAGÉE, dont la fenêtre s'ENCHAÎNE sur
celle de la revue précédente. ⚠ Trou connu : `gh issue close` direct n'est gaté par RIEN au
moment du geste (#1402) — il est RAPPORTÉ a posteriori par `scripts/ops/fermetures-non-citees.mjs`
(joué par le canari), et une fermeture hors commit sans solde suivi y est ROUGE. Opposable aux
sous-agents. Un rendu d'agent qui liste des restes SANS que je les aie soldés = le
commit ne part pas.
Cf. [[feedback-audit-obligatoire-avant-annonce-de-fermeture]],
[[feedback-ne-pas-livrer-complet-si-connu-incomplet]].

**Complément 2026-07-14 (« Tu met bien a jour les tickets que tu traites ? ») :** le solde
couvre les FERMETURES ; les tickets EN COURS dépendent de la discipline — règle : tout
arbitrage utilisateur qui change le plan d'un ticket OUVERT se poste en commentaire du
ticket DANS LE MÊME GESTE que le dispatch à l'agent (verbatim + date + conséquence),
jamais « à la fin ». Précédent : les 2 réfutations de la rose (#409) et le « 7 races »
(#393) tracés avec des heures de retard, plans périmés sur GitHub entre-temps.

**Complément 2026-09-11 (actions α et ε de la revue de palier `6382c792d..fd660c8b8`, réponses
à AskUserQuestion, posté sur #1679) :** (α) option retenue, verbatim : « Tout commit de substance
cite un ticket — un commit qui touche src/ ou scripts/ sans `refs #N`/`corrige #N` est refusé par
le pre-commit ; le ticket est l'unité de travail, même pour un fix d'une ligne. » → la porte du
ticket PRÉCÈDE le garde de solde (critère de substance = `commitsDeSubstanceDepuis`, source
unique) ; les commits de docs dérivés et de mémoire passent sans ticket ; le périmètre #591
(« un commit sans ticket n'entre jamais dans le mécanisme ») est caduc. (ε) verbatim : « Je ne
comprends pas, en toute logique ce qui est important c'est que le tout soit vert, pas chaque
commit indépendant non ? » → un push de N commits est jugé par sa TÊTE ; la revue de palier ne
compte plus « pas de run CI à son sha » comme un défaut. Train R1 de #1709 porte les deux dans
les portes et au CLAUDE.md § Commandes.
