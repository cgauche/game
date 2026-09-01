---
name: feedback-agents-jamais-rm-wildcard-arbre-partage
description: "Incident 2026-07-17 — un codeur a détruit le scratch non tracké d'une autre session avec un rm -f scripts/_tmp-* ; tout brief d'agent doit interdire les suppressions par wildcard et router le scratch vers le scratchpad, jamais dans le repo."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6dda9f10-baee-4f9e-b534-2933d9905a34
---

Incident 2026-07-17 (session tickets, codeur #491) : en nettoyant SON fichier de debug, l'agent a exécuté
`rm -f scripts/_tmp-*.mjs scripts/_tmp-*.svg scripts/_tmp-*.mts scripts/_tmp-skel.txt` — supprimant les
~20 fichiers de scratch NON TRACKÉS d'une autre session (art rig Chevalier du loup blanc). Jamais commités
→ irrécupérables par git (atténuation : l'étalon était committé `9b1b6c87` et la session propriétaire
porte le contenu dans son transcript).

**Why:** l'interdit « jamais de git destructif » ne couvre pas les `rm` shell ; un wildcard sur un préfixe
partagé (`_tmp-*`) balaie le scratch de TOUTES les sessions. Les conventions du repo (scratch `_tmp-*` posé
dans `scripts/`) aggravent : le scratch de chacun vit au même endroit.

**How to apply:**
1. Tout brief d'agent porte l'interdit EXPLICITE : « aucune suppression par wildcard/glob — un fichier à
   supprimer se nomme par son chemin exact, et UNIQUEMENT un fichier que TU as créé ».
2. Le scratch d'agent va dans le SCRATCHPAD de session (chemin fourni dans le brief), jamais dans le repo —
   si un script doit vivre dans le repo pour tourner (imports relatifs), nom UNIQUE préfixé de la tâche et
   suppression par chemin exact au rendu.
3. Vérifier à l'intégration : `git status` avant/après un agent qui a « nettoyé » quelque chose.
4. **L'interdit vaut pour l'ORCHESTRATEUR aussi, et pour les fichiers SUIVIS** (récidive 2026-09-01,
   game-66) : un `mv .claude/soldes/revue-palier-*.md <scratchpad>/` visant l'artefact du hook a
   attrapé 5 ARCHIVES de palier COMMITTÉES par d'autres trains (restaurées aussitôt par
   `git checkout -- .claude/soldes/`, zéro perte — mais uniquement parce qu'elles étaient dans HEAD).
   Un wildcard sur un dossier partagé entre trains (`.claude/soldes/`) se remplace par le NOM EXACT du
   seul fichier visé (`revue-palier-<hash-de-MON-commit>.md`).
Lié : [[game-agents-stray-main-tree-destructive-git]], [[git-commits-propres-wip-parallele]].
