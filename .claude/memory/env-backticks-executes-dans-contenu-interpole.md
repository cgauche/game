---
name: env-backticks-executes-dans-contenu-interpole
description: "Le shell Bash outillé EXÉCUTE les backticks de tout contenu interpolé — y compris du JSON GitHub récupéré ; --body-file toujours, jamais de $(...) capturant du texte non maîtrisé"
metadata: 
  node_type: memory
  type: project
  originSessionId: 032f0876-8eb3-421a-bddc-50a550c9bc09
  modified: 2026-07-28T22:42:05.960Z
---

Vécu 2026-07-29, deux incidents dans le même tour :
1. `gh issue comment --body "… \`code\` …"` en double quotes → chaque backtick SUBSTITUÉ (le commentaire posté est mutilé : tout le contenu backtické disparaît) et son contenu exécuté comme commande.
2. Pire : `CID=$(gh issue view … --json comments)` → la sortie JSON contenait des backticks (corps de commentaires d'issues) et le shell a tenté d'EXÉCUTER ce texte (« findResolvedTrait(traits, id): command not found ») — du texte écrit dans une issue GitHub a été évalué comme commande locale.

**Why:** en Bash, `"…\`x\`…"` et la ré-interpolation de captures font des backticks un canal d'exécution ; le contenu d'une issue est du texte TIERS.

**How to apply:**
- Corps de commentaire/issue/commit : TOUJOURS `--body-file`/`-F <fichier>` écrit par l'outil Write — jamais inline dès qu'il y a un backtick, un `$`, ou du contenu non trivial.
- Ne jamais capturer du contenu distant (JSON gh/api) dans une variable réutilisée sur la même ligne de commande ; deux appels séparés, valeurs LITTÉRALES recopiées à la main.
- Un commentaire GitHub mutilé se supprime par id littéral : `gh api -X DELETE repos/<o>/<r>/issues/comments/<id>` (l'id est dans l'URL `#issuecomment-<id>`).
