---
name: game-memoire-junction-repo
description: "La mémoire persistante vit DANS le repo (.claude/memory) via junction NTFS — committée, lisible en session cloud ; jamais de git destructif dessus"
metadata: 
  node_type: memory
  type: project
  originSessionId: b1f2be25-80bc-48e1-81ac-0c5ac1ab8658
---

Depuis 2026-07-16, la mémoire persistante de ce projet vit dans le repo :
`Game/.claude/memory/` (committée). Le chemin harness
`~/.claude/projects/C--Users-gauch-PhpstormProjects-Foundry-Game/memory` est une
**junction NTFS** vers ce dossier — une seule source, zéro miroir (cf. doctrine
[[game-doc-derivee-jamais-ecrite-a-la-main]]).

**Pourquoi :** les sessions cloud (claude.ai/code) ne chargent QUE le repo — la mémoire
user-scope, les skills user et les plugins n'y existent pas. Le CLAUDE.md projet porte le
pointeur « en cloud, lire `.claude/memory/MEMORY.md` en début de session ».

**Conséquences pratiques :**
- Chaque écriture mémoire apparaît en WIP dans `git status` → se committe comme du code,
  par chemins explicites (arbre partagé entre sessions).
- **JAMAIS de git destructif** (`checkout --`, `restore`, `clean`…) sur `.claude/memory/` :
  c'est la mémoire vivante des sessions locales.
- Les écritures mémoire d'une session cloud vont dans la VM jetable et ne reviennent pas —
  une leçon durable apprise en cloud se consigne en fiche committée.
- `.gitignore` : `.claude/*` avec exemption `!.claude/memory/`.
- Backup pré-junction : `~/.claude/projects/…/memory-local-pre-junction` (supprimable une
  fois le dispositif validé).
- Prérequis de push : le repo `cgauche/game` doit être PRIVÉ (le compte gh local
  `gaucheclement` n'a pas les droits d'admin pour le basculer — action utilisateur).
