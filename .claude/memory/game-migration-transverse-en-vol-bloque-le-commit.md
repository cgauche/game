---
name: game-migration-transverse-en-vol-bloque-le-commit
description: "Incident 2026-07-20 : quand une migration transverse non commitée traverse l'arbre partagé, TON diff contient SON renommage — committer ton geste casse le tronc. Sauvegarder hors git, nommer les fichiers à récupérer, attendre."
metadata: 
  node_type: memory
  type: project
  originSessionId: cb384a41-d20a-494b-aa60-728b2ed7534f
  modified: 2026-07-20T08:55:50.186Z
---

**Incident (2026-07-20)** : une autre session menait la migration `name` → `label` (#608) sur **~250 fichiers du rig** (créatures, armures, coiffures, tenues), **non commitée**. Mon lot d'art touchait 2 defs de tenue. `git diff` sur MES 2 fichiers contenait `- name: "Receleur"` / `+ label: "Receleur"` — **leur** ligne, pas la mienne — pendant que `types.ts` déclarait encore `name: string` **à HEAD**. Committer mon art aurait poussé un fragment de leur migration contre un type qui ne l'attend pas : **tronc rouge pour tout le monde**.

**Why :** dans un arbre partagé, `git diff <mon fichier>` ne montre pas « mon geste » — il montre **l'écart entre HEAD et l'arbre**, quelle que soit la main qui l'a produit. Un pathspec explicite protège des fichiers d'autrui, **pas des lignes d'autrui dans mes fichiers**. C'est l'angle mort de la règle « committer uniquement ses propres fichiers » ([[git-commits-propres-wip-parallele]]).

**Comment détecter avant de committer :** lire le diff de SES fichiers et chercher ce qui n'est pas de son geste (un renommage de champ, un import déplacé, un reformatage). Contrôle décisif : le TYPE que le fichier instancie a-t-il déjà le champ **à HEAD** (`git show HEAD:<types.ts>`) ? Si non, la migration n'a pas atterri et le commit est prématuré.

**How to apply :**
1. **Ne pas committer.** Sauvegarder le travail **hors du dépôt** (scratchpad) — c'est la seule protection qu'aucune opération git d'autrui ne peut annuler.
2. **Nommer explicitement à l'autre session les fichiers À ELLE de récupérer** dans son commit de migration. Ici : mes 4 bibliothèques de garde (`scripts/guards/lib/{fleshInPaletteAudit,paletteLiteralAudit,fleshGradientAudit,partViewAudit}.ts`) que j'avais déjà réparées dans l'arbre.
3. Attendre que la migration atterrisse, puis poser son lot par-dessus.

**Corollaire — une migration transverse DOIT balayer `scripts/guards/lib/**`.** Les gardes keyent sur les champs du domaine ; un renommage les casse silencieusement et **de la pire façon** : `slugId(undefined)` a fait planter les 3 gardes de tenue **à l'import**, et `part-view-format.test.ts` collectait **0 test** — un fichier qui ne collecte rien ne « échoue » pas visiblement, il DISPARAÎT du compte. Une garde qui ne tourne plus est pire qu'une garde rouge.
⚠ Piège dans le piège : tous les registres ne migrent pas vers le même champ. `TenueDef`/`CreatureDef` sont passés à `label`, mais `ArmourDef` à **`id`** — corriger en `label` partout casse.

Lié : [[feedback-jamais-git-surgery-arbre-partage-actif]], [[game-parallel-codeurs-shared-tree-and-rebase]], [[game-ids-internes-libelles-display-multilangue]].
