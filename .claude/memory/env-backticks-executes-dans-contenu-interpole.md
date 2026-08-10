---
name: env-backticks-executes-dans-contenu-interpole
description: "Le shell Bash outillé EXÉCUTE les backticks de tout contenu interpolé — y compris du JSON GitHub récupéré ; --body-file toujours, jamais de $(...) capturant du texte non maîtrisé"
metadata: 
  node_type: memory
  type: project
  originSessionId: 032f0876-8eb3-421a-bddc-50a550c9bc09
  modified: 2026-08-10T09:03:17.092Z
---

Vécu 2026-07-29, deux incidents dans le même tour :
1. `gh issue comment --body "… \`code\` …"` en double quotes → chaque backtick SUBSTITUÉ (le commentaire posté est mutilé : tout le contenu backtické disparaît) et son contenu exécuté comme commande.
2. Pire : `CID=$(gh issue view … --json comments)` → la sortie JSON contenait des backticks (corps de commentaires d'issues) et le shell a tenté d'EXÉCUTER ce texte (« findResolvedTrait(traits, id): command not found ») — du texte écrit dans une issue GitHub a été évalué comme commande locale.

**Why:** en Bash, `"…\`x\`…"` et la ré-interpolation de captures font des backticks un canal d'exécution ; le contenu d'une issue est du texte TIERS.

**How to apply:**
- Corps de commentaire/issue/commit : TOUJOURS `--body-file`/`-F <fichier>` écrit par l'outil Write — jamais inline dès qu'il y a un backtick, un `$`, ou du contenu non trivial.
- **La FABRICATION du body-file elle-même passe par l'outil Write — JAMAIS `printf`/`echo` de prose vers un fichier** (récidives ×3 : 2026-08-09 corps #1193, 2026-08-10 commentaire #1153 puis commentaire #1234 — la prose technique finit TOUJOURS par contenir un backtick, et le shell l'exécute ; « --body-file » ne protège rien si le fichier est fabriqué au printf). Un mot en backtick exécuté = un mot ABSENT du texte posté : relire ce qui a été posté après tout printf hérité.
- Ne jamais capturer du contenu distant (JSON gh/api) dans une variable réutilisée sur la même ligne de commande ; deux appels séparés, valeurs LITTÉRALES recopiées à la main.
- Un commentaire GitHub mutilé se supprime par id littéral : `gh api -X DELETE repos/<o>/<r>/issues/comments/<id>` (l'id est dans l'URL `#issuecomment-<id>`).

**Même famille (vécu 2026-08-06, ×3 sur le chantier #1117)** : une écriture `node -e` sur un fichier de l'arbre peut ÉCHOUER (`UNKNOWN`, verrou transitoire) **en laissant la mutation appliquée** — la restauration après mutation se VÉRIFIE par relecture (jamais supposée), et toute écriture de code/commentaire passe par `ctx_patch`, jamais par `node -e` en bash.

**Même famille (vécu 2026-08-05, revue de palier)** : les BACKSLASHES d'une sonde `node -e`/heredoc sont mangés par la couche shell — des `\b` de RegExp disparus ont rendu un faux « 39 clés orphelines sur 39 » (faux positif TOTAL, silencieux). Règle : toute sonde inline s'écrit SANS backslash (classes `[.]`, `[ ]` au lieu de `\.`, `\s`) et se RE-MESURE sur un contrôle positif connu avant d'être crue — sinon fichier script + `npx tsx`.
