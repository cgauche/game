---
name: orchestrer-des-agents
description: À utiliser dès qu'une tâche implique d'écrire ou modifier du code, de dispatcher un agent ou un workflow — ou dès qu'on est tenté de coder soi-même « parce que c'est petit ». Aussi au retour d'un agent (avant de vérifier/committer son travail) et avant tout agent() sans modèle/effort explicites.
---

# Orchestrer des agents

**Je ne code pas — même le trivial.** Un guard d'une ligne, une regex, un refacto « couplé » →
un agent, avec un spec précis. Moi = décomposer, spécifier, vérifier, intégrer. Seul code de ma
main : l'intégration triviale et les gates. Violer la lettre de cette règle EST violer son esprit.

## Cycle

1. **Grounding** — sweep de 3+ fichiers → agent Explore (régions + rapport). 1-2 lectures ciblées
   inline pour trancher = OK. La décision d'archi reste dans mon fil ; **primitives cibles NOMMÉES
   avant tout code** (table « Primitives partagées » du CLAUDE.md, grep du concept en amont).
2. **Brief d'agent** — un brief contient : périmètre de fichiers exact, primitives cibles nommées,
   réfs RAW nues (`LDB 13 l.142` — jamais paraphrasées), le chemin ABSOLU du worktree à utiliser
   tel quel, l'interdit de tout `git checkout/restore/reset/stash/add/commit`, et « ton rendu
   final = données brutes, pas un message ».
3. **Dispatch** — l'effort de chaque étage est MAÎTRISÉ, jamais subi. Trois canaux : Workflow
   `agent()` (opts `model` + `effort` par appel — le seul contrôle par appel) ; tool Agent
   (`model` seul — l'effort vient de la définition du type dans `.claude/agents/*.md`, sinon
   HÉRITE de la session : ultracode = xhigh silencieux) ; définition d'agent épinglée (modèle +
   effort au frontmatter). Workflows lourds SÉQUENTIELS (3 en // = rate-limit serveur, finders
   morts) ; gros volume → lots séquentiels dans le script.
4. **Isolation** — agent qui MUTE des fichiers pendant qu'une session // est active →
   `isolation: "worktree"` ; à défaut committer immédiatement au retour. Deux strays d'agents
   consécutifs dans l'arbre principal = j'applique moi-même le patch chirurgical connu.
5. **Attente** — un agent background n'est PAS fini avant sa `<task-notification>` : ne pas lire,
   tester ni diagnostiquer son WIP (erreurs fantômes garanties).
6. **Vérification (par MOI, jamais sur la foi du rapport)** — typecheck en sortie COMPLÈTE
   (`npm run typecheck 2>&1 | grep -cE "error TS"` + filtre sur mes fichiers, jamais `tail`) ;
   suite COMPLÈTE avant commit (les échecs s'attribuent, un arbre churné n'excuse rien) ; revue
   du diff ; règle/valeur → Atlas `docs/raw/` puis `Source/` ; UI → skill `recette-navigateur`.
   Livraison d'agent sur un sous-système → audit adversarial : fidélité RAW intégrale + éditabilité
   first-class (un raccourci « borne le reste » est un défaut, pas un choix).
7. **Commit** — mes seuls fichiers par pathspec, jamais `--amend` en arbre partagé, git via
   l'outil PowerShell (RTK rend le Bash git lent/compressé).

## Calibrage — routage et cérémonie

| Étage | Modèle | Effort |
|---|---|---|
| Lecture / comparaison de masse | sonnet | medium |
| Vérification mécanique (existence, famille) | haiku | low |
| Code sous spec précise | sonnet | medium |
| Jugement dur (réfutation, synthèse, archi) | opus | medium |

**JAMAIS Sonnet en effort haut/xhigh** (coûte plus cher qu'un Opus medium). La cérémonie se
calibre à la taille/risque RÉEL, pas au flag ultracode : petite feature testée → 1 agent codeur
+ gates, sans fan-out ni reviewer dédié ; tâche large/incertaine (audit moteur, migration,
extraction massive) → workflow ; reviewer adversarial réservé aux régressions silencieuses
possibles et à l'art (l'audit aveugle EST la revue). Un arbitrage user nécessaire → couper la
boucle et poser les questions GROUPÉES, pas les parquer dans une spec.

## Rationalisations connues

| Excuse | Réalité |
|---|---|
| « C'est petit/couplé, je le fais moi-même » | 2026-06-29 : « le pire orchestrator que je connaisse ». Même une ligne → agent. |
| « L'agent rapporte tout vert » | Vécu : guillemets courbes qui cassaient tsc. Relancer les gates soi-même. |
| « `tail` suffit pour le typecheck » | TS2322 livrée en affirmant « clean » (`82c3f416`). Sortie complète, comptée. |
| « Arbre churné, la suite complète n'est pas attribuable » | Régression `92c70234` attrapée par la SEULE suite complète. |
| « L'effort par défaut fera l'affaire » | Héritage session = xhigh sous ultracode, hors de prix sur un fan-out. |
| « Ticket fermé = fini » | Combat de masse #69 livré à ~50 % avec tests verts. Auditer RAW + éditabilité. |

## Red flags — STOP

- Je tape du code applicatif dans mon fil principal.
- Un dispatch dont l'effort n'est ni fixé (Workflow `effort`, définition d'agent) ni assumé
  sciemment comme hérité — un Agent `sonnet` en session à gros effort = Sonnet xhigh interdit.
- Deux workflows lourds lancés en parallèle.
- Lire ou tester les fichiers d'un agent background avant sa notification.
- Dire « vérifié » sans avoir moi-même relancé typecheck complet + suite complète.
