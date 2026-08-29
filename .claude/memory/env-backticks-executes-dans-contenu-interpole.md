---
name: env-backticks-executes-dans-contenu-interpole
description: "Le shell Bash outillé EXÉCUTE les backticks de tout contenu interpolé — y compris du JSON GitHub récupéré ; --body-file toujours, jamais de $(...) capturant du texte non maîtrisé"
metadata: 
  node_type: memory
  type: project
  originSessionId: 032f0876-8eb3-421a-bddc-50a550c9bc09
  modified: 2026-08-26T14:59:55.931Z
---

Vécu 2026-07-29, deux incidents dans le même tour :
1. `gh issue comment --body "… \`code\` …"` en double quotes → chaque backtick SUBSTITUÉ (le commentaire posté est mutilé : tout le contenu backtické disparaît) et son contenu exécuté comme commande.
2. Pire : `CID=$(gh issue view … --json comments)` → la sortie JSON contenait des backticks (corps de commentaires d'issues) et le shell a tenté d'EXÉCUTER ce texte (« findResolvedTrait(traits, id): command not found ») — du texte écrit dans une issue GitHub a été évalué comme commande locale.

**Why:** en Bash, `"…\`x\`…"` et la ré-interpolation de captures font des backticks un canal d'exécution ; le contenu d'une issue est du texte TIERS.

**How to apply:**
- Corps de commentaire/issue/commit : TOUJOURS `--body-file`/`-F <fichier>` écrit par l'outil Write — jamais inline dès qu'il y a un backtick, un `$`, ou du contenu non trivial. **RÈGLE ABSOLUE sans clause de taille ni d'urgence** (récidive ×4, 2026-08-11 : un `--body` inline « pour aller vite » sur #1262/#1280 → 2 corps mutilés + commande suspendue 120s — le corps qui « n'a que 2-3 backticks » est exactement celui qui casse ; le réflexe est : le doigt qui tape `--body "` s'arrête et écrit le fichier).
- **La FABRICATION du body-file elle-même passe par l'outil Write — JAMAIS `printf`/`echo` de prose vers un fichier** (récidives ×3 : 2026-08-09 corps #1193, 2026-08-10 commentaire #1153 puis commentaire #1234 — la prose technique finit TOUJOURS par contenir un backtick, et le shell l'exécute ; « --body-file » ne protège rien si le fichier est fabriqué au printf). Un mot en backtick exécuté = un mot ABSENT du texte posté : relire ce qui a été posté après tout printf hérité.
- Ne jamais capturer du contenu distant (JSON gh/api) dans une variable réutilisée sur la même ligne de commande ; deux appels séparés, valeurs LITTÉRALES recopiées à la main.
- **Extension 2026-08-26 (vague libellés L1b #1467) : le CONTOURNEMENT lui-même mutile le FRANÇAIS.** Deux rédacteurs d'agents, bloqués par le pont sur des heredocs à backticks, ont « retiré tout backtick/accent du contenu » pour passer — résultat : des tables de libellés FR de 150-170 lignes en ASCII PUR (« Degats », « Duree », « Prerequis »), indétectable à la relecture rapide, attrapé par le juge avec une SONDE D'OCTETS (compte des octets >127 : 0 vs 690 attendus sur une table saine). Règle : tout fichier de CONTENU (prose, libellés, tables FR) s'écrit par l'outil Write, jamais par heredoc/printf shell ; et toute table de libellés se GATE par la sonde d'octets avant usage.
- Un commentaire GitHub mutilé se supprime par id littéral : `gh api -X DELETE repos/<o>/<r>/issues/comments/<id>` (l'id est dans l'URL `#issuecomment-<id>`).

**Même famille (vécu 2026-08-06, ×3 sur le chantier #1117)** : une écriture `node -e` sur un fichier de l'arbre peut ÉCHOUER (`UNKNOWN`, verrou transitoire) **en laissant la mutation appliquée** — la restauration après mutation se VÉRIFIE par relecture (jamais supposée), et toute écriture de code/commentaire passe par `ctx_patch`, jamais par `node -e` en bash.

**Même famille (vécu 2026-08-05, revue de palier)** : les BACKSLASHES d'une sonde `node -e`/heredoc sont mangés par la couche shell — des `\b` de RegExp disparus ont rendu un faux « 39 clés orphelines sur 39 » (faux positif TOTAL, silencieux). Règle : toute sonde inline s'écrit SANS backslash (classes `[.]`, `[ ]` au lieu de `\.`, `\s`) et se RE-MESURE sur un contrôle positif connu avant d'être crue — sinon fichier script + `npx tsx`.
