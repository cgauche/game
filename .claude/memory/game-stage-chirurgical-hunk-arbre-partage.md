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

**Précédent d'ÉCHEC (2026-08-19, commit 74231ddf)** : sous la pression du volume (110 chemins), j'ai
committé par FICHIER ENTIER avec un garde de contenu seulement AFFICHÉ (le grep des lignes non-réfs
montrait `resetStageGestes` à l'écran — je ne l'ai pas transformé en ABORT) et une liste d'exclusion
par MOTIFS DEVINÉS (`stageWalk|useGamepad` — le fichier NEUF `stageGestes.ts` n'y était pas). Résultat :
4 passagers clandestins du WIP voisin poussés sous mon message (stageGestes.ts neuf, wiring.ts heurt,
devtools.ts padUp, hunks store.ts). Ça compilait et les gates étaient verts — le mal est la PATERNITÉ
(travail d'autrui possiblement non jugé, committé sous mon nom), pas la casse. Règles durcies :
1. Tout garde de contenu pré-commit est BLOQUANT (`if [ -n "$LIGNES" ]; then ABORT`), jamais informatif.
2. Une liste d'exclusion de WIP voisin se DÉRIVE d'un inventaire mesuré (diff par fichier classé
   réfs/non-réfs), jamais de motifs de noms devinés — un fichier NEUF du voisin échappe à tout motif.
3. Sur un lot >30 fichiers en arbre partagé actif, le stage par hunk des fichiers DUELS n'est pas
   optionnel : classer chaque fichier (100 % à moi / duel / à eux) AVANT le premier `git add`.
