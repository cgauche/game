---
name: game-stage-chirurgical-hunk-arbre-partage
description: "Committer un fichier dual-touché (mon changement + WIP d'une autre session) sans capturer ni détruire son WIP — stage chirurgical par hunk"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fe239011-bf46-4e5d-b120-539f4c477f25
  modified: 2026-07-20T10:33:25.880Z
---

Sur l'arbre partagé (3 sessions //), un fichier porte souvent MON changement ET le WIP non-commité d'une autre session (art rig dans une tenue def, `moneyEnc` SOCLE dans `items.ts`). On ne peut ni le committer en bloc (capture leur WIP + risque de committer de l'incomplet), ni `git checkout`/`stash` dessus (détruit leur WIP — interdit).

**Solution : stager UNIQUEMENT mes hunks via `git apply --cached`**, l'arbre de travail (donc leur WIP) reste intact :
1. `git diff -- <fichier>` → repérer les en-têtes `@@` : quels hunks sont à MOI, lesquels à eux.
2. Extraire mes hunks (awk qui garde l'en-tête `diff/index/---/+++` + saute les `@@` d'autrui ET leur corps ; un `@@` gardé DOIT garder son corps) → `mon.patch`.
3. `git apply --cached --check mon.patch` puis `git apply --cached mon.patch` (index seul, arbre inchangé).
4. Vérifier `git diff --cached -- <fichier>` = SEULEMENT mes lignes ; leur WIP reste en `git diff` (non-staged).
5. Committer. L'arbre COMMITÉ = HEAD + mes hunks → doit COMPILER (leur WIP exclu ne doit pas être requis par mes lignes) ; prouver en worktree isolé (`git worktree add --detach <wt> <mon-commit>` + `npm ci` + tsc/tests — l'isolat exclut leur WIP non-commité qui polluait tsc dans l'arbre principal).

Cas simple (hunks bien séparés) : les 2 hunks name→label vs art d'une tenue → j'ai extrait le seul hunk `name:`→`label:`. Cas moteur : `items.ts` avait 3 hunks (mien import, SOCLE `moneyEnc`, mien fix) → gardé 1+3, exclu 2. Fonctionne car un rename/fix touche des LIGNES disjointes de leur WIP. Vu en #608/#637 (2026-07-20). Voir [[game-migration-transverse-en-vol-bloque-le-commit]], [[git-commits-propres-wip-parallele]], [[feedback-jamais-git-surgery-arbre-partage-actif]] (le `git apply --cached` en INDEX n'est pas du git destructif sur l'arbre — il ne touche jamais le non-commité).
