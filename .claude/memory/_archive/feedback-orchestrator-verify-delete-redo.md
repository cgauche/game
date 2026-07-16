---
name: feedback-orchestrator-verify-delete-redo
description: "Méthode imposée pour le nettoyage/refacto : orchestrer des agents codeurs, tout vérifier soi-même, ne croire personne (ticket/commentaires/agents/user → vérifier le RAW), supprimer+refaire plutôt que rapiécer (tests inclus)."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 66882c89-d1bb-4268-8b6b-486e06ad3827
---

Contrat de travail énoncé par l'user (2026-06-27) pour la campagne de nettoyage/refacto du dépôt (après empilement de features) — vaut au-delà de l'audit :

- **Orchestration** : « c'est toi l'orchestrateur, utilise des agents pour coder ». Je dispatche des agents codeurs (un par tâche, fichiers disjoints = parallèle sûr ; modèle adapté = Sonnet pour le mécanique), je ne code pas tout moi-même.
- **Vérifier TOUJOURS** : « vérifie toujours le travail une fois terminée ». Les agents finissent → JE passe les gardes : `typecheck` + `test` (Bash natif), revue du `git diff`, et au besoin un agent de **revue adversariale** (prompté pour réfuter).
- **Défiance totale** : « ne fais ni confiance au ticket, ni aux commentaires, ni aux agents, ni à moi. Toujours vérifier le RAW ». Lire le **code réel** avant d'agir ; pour toute règle/valeur, vérifier l'Atlas `docs/raw/` puis `Source/` FR citable (n° de ligne dérivés post-Marker → re-localiser).
- **Supprimer + refaire** : « si le code existant n'atteint pas nos exigences, mieux vaut le supprimer et le refaire ; idem pour les tests : les réécrire de 0 plutôt que les travestir pour qu'ils passent ». Jamais bender un test pour faire passer du code douteux.
- **Zéro dette** (rappel) : pas de code mort / deprecated / rétro-compat / duplication ; retirer une branche morte ENTIÈREMENT (pas de garde `?? defaut` « au cas où »), source unique. Cf. [[feedback-zero-retrocompat-briques-solides]], [[feedback-reutiliser-avant-reinventer]], [[feedback-ne-pas-faire-confiance-commentaires]].
- **Workflows** : seulement si réellement nécessaire (pas par réflexe, même sous ultracode) ; le code→vérif-adversariale en fan-out le justifie, pas une petite feature. Cf. [[feedback-workflows-calibres-taille]], [[feedback-workflow-concurrence-rate-limit]].

**Why** : l'user veut remonter la qualité d'un code POC empilé, sans accumuler de nouvelle dette ni de faux verts.
**How to apply** : orchestrer (agents) → vérifier soi-même contre code réel + RAW → préférer suppression/réécriture au rapiéçage. Piège vu : un agent a écrit un fichier de test avec des **guillemets courbes** (`‘ ’`) → `tsc`/vitest cassent → toujours relancer les gardes, ne jamais croire le rapport « tout vert » d'un agent.

**FAILURE MODE vécu (2026-06-29, chantier engins de siège)** : j'ai bien orchestré la grosse feature (4 agents) PUIS **dérivé vers du hand-coding** sur tout ce qui « semblait petit » — la correction d'une regex, FU1/FU2, et un refacto entier (artkit + defs + gen-registry + réécriture de `composeEngin`). L'user : « tu es le pire orchestrator que je connaisse ». **Leçon : ne PAS rationaliser « c'est petit/couplé, je le fais moi-même ». Même un guard d'une ligne ou un refacto ciblé → un agent, avec un spec précis ; MOI = décomposer, spécifier, vérifier (typecheck/test/diff/RAW), intégrer. Le seul code que je tape : l'intégration triviale et la vérif.** La seule chose qui reste à moi sans agent = le grounding/lecture (cartographier avant de spécifier) et les gardes.

Appliqué dans [[project-audit-conformite-2026-06]] (LOT 1).
