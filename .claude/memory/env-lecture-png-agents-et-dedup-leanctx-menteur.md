---
name: env-lecture-png-agents-et-dedup-leanctx-menteur
description: "2 pièges de lecture mesurés (2026-08-06, artistes #1128) : (1) le tool natif Read refuse les PNG dans les sessions d'agents — brief-type des artistes voyants doit nommer ctx_read(mode=auto) ; (2) le dedup lean-ctx répond « unchanged since your last Read » sur des fichiers JAMAIS lus — contourner par ctx_read(mode=raw, fresh=true)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 97758451-6f31-4cac-98e5-e0b61ef6dedd
  modified: 2026-08-10T11:28:11.951Z
---

Deux pièges d'outillage mesurés par l'artiste des vues de bout (#1128 L4, 2026-08-06) :

1. **`Read` natif refuse les PNG côté agents** (`Permission to use Read has been denied`, y compris sur des fichiers de l'arbre principal). Le contrat de voyant (Read d'image obligatoire) se tient via **`mcp__lean-ctx__ctx_read(path, mode="auto")`**, qui rend bien l'image. Tout brief d'artiste voyant doit nommer `ctx_read` comme chemin de lecture d'image, pas « Read ». (L'orchestrateur en session principale peut aussi perdre Read selon la policy — `SendUserFile` pour montrer à l'utilisateur.)

2. **Le dedup lean-ctx MENT parfois** : réponse « unchanged since your last Read in this session » sur des fichiers **jamais lus** dans la session. Un agent qui fait confiance à ce message travaille SANS avoir lu le fichier. Contournement mesuré : `ctx_read(mode="raw", fresh=true)`. Réflexe : si un « unchanged » arrive sur un fichier qu'on n'a pas encore lu, c'est un mensonge du cache — forcer `fresh=true`. ⚠ **Pas seulement les PNG** : mesuré aussi sur des `.md` (recetteur 2026-08-10, `docs/recette-navigateur.md` — contourné par `sed` via Bash). Le piège vaut pour TOUT type de fichier.

Voir aussi [[env-session-background-pieges-outils]], [[env-exit-code-avale-par-l-outillage-shell]].
