---
name: game-reprise-chantier-lire-superpowers-sdd
description: "Reprendre un chantier abandonné : LIRE `.superpowers/sdd/` D'ABORD (progress.md + briefs + rapports de tâche) — il dit l'état RÉEL, là où le plan et ses cases à cocher mentent."
metadata:
  node_type: memory
  type: project
---

**Vécu 2026-07-24** : reprise du chantier « architecture de bâtiments / La Diligence » après la mort
de la session qui le portait (budget épuisé). J'ai passé une heure à reconstituer l'état par
grounding (agents de lecture, git log, portes) — alors que `.superpowers/sdd/` le disait déjà.

**Ce que contient `.superpowers/sdd/`** (dossier du skill `subagent-driven-development`) :
- `progress.md` — l'état RÉEL tâche par tâche, avec les plages de commits (`b92a5704..c8aca121`),
  les verdicts de revue, et surtout les tâches marquées **« en cours »** ;
- `task-<N>-brief.md` — le contrat détaillé de chaque tâche, souvent PLUS précis que le plan ;
- `task-<N>-report.md` — ce qui a été réellement livré, avec sorties de portes ;
- `review-*.diff` — les diffs soumis à revue.

**Pourquoi c'est la PREMIÈRE chose à lire** :
1. Les cases `- [ ]` du plan `docs/plans/*.md` ne sont **jamais** cochées (vérifié : zéro `[x]` sur
   9 tâches livrées) — elles ne disent RIEN de l'état.
2. Les messages de commit du chantier mentaient (un commit « supprime la rétrocompatibilité » ne
   touchait que le `.md` du plan) — cf. [[feedback-verifier-les-claims-architecturaux-des-agents]].
3. Le plan lui-même se périme : il décrivait `RoofSection.foot` alors que le code avait migré vers
   `parts`. Le plan est un artefact DATÉ ; le code fait foi, mais `sdd/` dit ce qui a été TENTÉ.
4. Un brief de tâche peut avoir DÉJÀ tranché un arbitrage que je m'apprêtais à faire trancher à
   l'utilisateur (vécu : les ornements de bâtiment, décidés et exécutés en Lot A — j'ai posé la
   question quand même, avec de mauvaises informations).

**How to apply** : en reprenant un chantier, lire dans cet ordre — `.superpowers/sdd/progress.md`,
puis les briefs/rapports des tâches marquées « en cours », puis le plan `docs/plans/*.md`, puis le
code. Et vérifier au code ce que les rapports affirment : ils décrivent une INTENTION livrée, pas
forcément l'état après les commits suivants (le Lot B rapportait 23 sections ; le code en a 5, les
23 ayant été fusionnées par un refacto ultérieur).

Voir aussi [[game-migration-transverse-en-vol-bloque-le-commit]], [[git-commits-propres-wip-parallele]].
